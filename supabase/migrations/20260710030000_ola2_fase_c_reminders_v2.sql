-- Ola 2 Fase C: recordatorio 24h con botón "Confirmar asistencia" + enlace
-- mágico, y fix del gotcha de Fase 8: get_due_reminders omitía en silencio
-- las citas de clientes SIN conversación (creadas por staff o por la web).

-- ---------------------------------------------------------------
-- 1) Confirmar asistencia desde el chat (botón del recordatorio).
--    Misma validación de propiedad que cancel/reschedule_from_chat.
--    Devuelve la conversación para que el webhook registre el saliente.
-- ---------------------------------------------------------------
create or replace function public.confirm_appointment_from_chat(
  p_channel_type text,
  p_external_id text,
  p_client_phone text,
  p_appointment_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org  uuid;
  v_conv uuid;
begin
  v_org := public._resolve_chat_appointment(
    p_channel_type, p_external_id, p_client_phone, p_appointment_id);

  update public.appointments
     set status = 'confirmed',
         confirmed_by_client_at = now()
   where id = p_appointment_id;

  select c.id into v_conv
    from public.conversations c
    join public.channels ch on ch.id = c.channel_id
    join public.clients cl on cl.id = c.client_id
   where ch.type = p_channel_type
     and ch.external_id = p_external_id
     and ch.organization_id = v_org
     and cl.phone = trim(p_client_phone)
   order by c.last_message_at desc nulls last, c.created_at desc
   limit 1;

  return jsonb_build_object('conversation_id', v_conv);
end;
$$;

revoke all on function public.confirm_appointment_from_chat(text, text, text, uuid) from public;
grant execute on function public.confirm_appointment_from_chat(text, text, text, uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------
-- 2) get_due_reminders v2: LEFT JOIN a la conversación (las citas de
--    clientes sin chat YA NO desaparecen: llegan con conversation_id null
--    y el cron las reporta como no_channel en vez de omitirlas en silencio)
--    + manage_token para el enlace mágico del mensaje.
-- ---------------------------------------------------------------
create or replace function public.get_due_reminders(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_result jsonb;
begin
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'appointment_id', a.id,
      'manage_token', a.manage_token,
      'conversation_id', conv.id,
      'channel_type', ch.type,
      'channel_external_id', ch.external_id,
      'send_to', cl.phone,
      'starts_at', a.starts_at,
      'tz', b.timezone,
      'org_name', o.name,
      'client_name', cl.name,
      'service_names', (
        select string_agg(sc.name, ', ')
          from public.appointment_services aps
          join public.service_catalogs sc on sc.id = aps.service_id
         where aps.appointment_id = a.id
      )
    ) as x
    from public.appointments a
    join public.organizations o on o.id = a.organization_id
    join public.branches b on b.id = a.branch_id
    join public.clients cl on cl.id = a.client_id
    left join lateral (
      select c.id, c.channel_id from public.conversations c
       where c.client_id = a.client_id
       order by c.last_message_at desc nulls last, c.created_at desc limit 1
    ) conv on true
    left join public.channels ch on ch.id = conv.channel_id
    where cl.phone is not null and (
      (p_kind = '24h' and a.status in ('scheduled','confirmed')
        and a.reminder_24h_sent_at is null
        and a.starts_at > now() and a.starts_at <= now() + interval '24 hours')
      or (p_kind = '2h' and a.status in ('scheduled','confirmed')
        and a.reminder_2h_sent_at is null
        and a.starts_at > now() and a.starts_at <= now() + interval '2 hours')
      or (p_kind = 'followup' and a.status in ('scheduled','confirmed','completed')
        and a.followup_sent_at is null and a.ends_at < now())
    )
    order by a.starts_at limit 200
  ) t;
  return v_result;
end;
$$;

-- Blindaje (igual que Fase 5): solo service_role.
revoke all on function public.get_due_reminders(text) from public;
revoke execute on function public.get_due_reminders(text) from anon, authenticated;
grant execute on function public.get_due_reminders(text) to service_role;
