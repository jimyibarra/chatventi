-- =====================================================================
-- ChatVenti · Fase 5 · Recordatorios + seguimiento post-cita
--   Las columnas reminder_24h_sent_at / reminder_2h_sent_at /
--   followup_sent_at ya existen en appointments (Fase 2).
--   El cron (service_role) usa estas RPCs para hallar y "reclamar" envíos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- get_due_reminders(kind): citas que deben recibir un envío de tipo
--   '24h' | '2h' | 'followup'. Solo clientes con una conversación (canal)
--   por donde enviar. Devuelve todo lo necesario para armar y mandar.
-- ---------------------------------------------------------------------
create or replace function public.get_due_reminders(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'appointment_id', a.id,
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
    join lateral (
      select c.id, c.channel_id
        from public.conversations c
       where c.client_id = a.client_id
       order by c.last_message_at desc nulls last, c.created_at desc
       limit 1
    ) conv on true
    join public.channels ch on ch.id = conv.channel_id
    where cl.phone is not null and (
      (p_kind = '24h'
        and a.status in ('scheduled','confirmed')
        and a.reminder_24h_sent_at is null
        and a.starts_at > now() and a.starts_at <= now() + interval '24 hours')
      or (p_kind = '2h'
        and a.status in ('scheduled','confirmed')
        and a.reminder_2h_sent_at is null
        and a.starts_at > now() and a.starts_at <= now() + interval '2 hours')
      or (p_kind = 'followup'
        and a.status in ('scheduled','confirmed','completed')
        and a.followup_sent_at is null
        and a.ends_at < now())
    )
    order by a.starts_at
    limit 200
  ) t;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- claim_reminder(id, kind): marca el envío de forma atómica e idempotente.
--   Devuelve true solo si ESTA llamada lo reclamó (col estaba null).
-- ---------------------------------------------------------------------
create or replace function public.claim_reminder(p_appointment_id uuid, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_kind = '24h' then
    update public.appointments set reminder_24h_sent_at = now()
      where id = p_appointment_id and reminder_24h_sent_at is null returning id into v_id;
  elsif p_kind = '2h' then
    update public.appointments set reminder_2h_sent_at = now()
      where id = p_appointment_id and reminder_2h_sent_at is null returning id into v_id;
  elsif p_kind = 'followup' then
    update public.appointments set followup_sent_at = now()
      where id = p_appointment_id and followup_sent_at is null returning id into v_id;
  else
    return false;
  end if;
  return v_id is not null;
end;
$$;

-- ---------------------------------------------------------------------
-- GRANTS: solo el cron (service_role). No exponer a anon/authenticated.
-- ---------------------------------------------------------------------
revoke all on function public.get_due_reminders(text) from public;
grant  execute on function public.get_due_reminders(text) to service_role;

revoke all on function public.claim_reminder(uuid, text) from public;
grant  execute on function public.claim_reminder(uuid, text) to service_role;
