-- =====================================================================
-- Coexistencia con la app WhatsApp Business: fases 2, 3 y 4 (16-oct-2026).
--
--   · messages.origin: 'business_app' = lo escribió el dueño desde su app
--     (eco de Meta); 'history' = importado del historial (opcional, 90 días).
--   · channels: actividad de la app (para las alertas de los 14 días), nivel
--     de alerta enviado (0..3 = nada, día 7, día 10, día 12) y desconexión.
--   · log_coexistence_message: crea cliente y conversación si hace falta,
--     guarda el mensaje sin duplicar, pausa a la recepcionista cuando el dueño
--     escribe y marca la actividad de la app. Solo service_role.
-- =====================================================================

alter table public.messages
  add column if not exists origin text check (origin is null or origin in ('business_app', 'history'));
comment on column public.messages.origin is 'business_app = enviado por el dueño desde su app WhatsApp Business (coexistencia); history = importado.';

alter table public.channels
  add column if not exists app_activity_at        timestamptz,
  add column if not exists coexistence_alert_level smallint not null default 0,
  add column if not exists disconnected_at        timestamptz,
  add column if not exists disconnect_reason      text;
comment on column public.channels.app_activity_at is 'Última señal de uso de la app WhatsApp Business (eco, contactos o historial). Base de las alertas de 14 días.';
comment on column public.channels.coexistence_alert_level is '0 = sin alerta; 1 = día 7; 2 = día 10; 3 = día 12. Vuelve a 0 con actividad.';

create or replace function public.log_coexistence_message(
  p_phone_number_id text,
  p_customer        text,
  p_direction       text,
  p_body            text,
  p_ext_id          text default null,
  p_origin          text default 'business_app',
  p_at              timestamptz default null,
  p_pause_minutes   int default 0
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid; v_channel uuid; v_client uuid; v_conv uuid; v_msg uuid;
  v_at timestamptz := coalesce(p_at, now());
begin
  if p_direction not in ('inbound', 'outbound') or p_origin not in ('business_app', 'history') then
    raise exception 'invalid_input';
  end if;
  select id, organization_id into v_channel, v_org
    from public.channels
   where type = 'whatsapp' and external_id = p_phone_number_id and status <> 'disabled'
   limit 1;
  if v_channel is null then
    return jsonb_build_object('message_id', null, 'duplicate', false, 'reason', 'no_channel');
  end if;

  -- Un eco de un mensaje que mandó la propia API ya existe con ese id: no se
  -- duplica ni pausa a la recepcionista.
  if p_ext_id is not null then
    select id into v_msg from public.messages where external_id = p_ext_id limit 1;
    if v_msg is not null then
      return jsonb_build_object('message_id', v_msg, 'duplicate', true);
    end if;
  end if;

  if coalesce(trim(p_customer), '') = '' then
    return jsonb_build_object('message_id', null, 'duplicate', false, 'reason', 'no_customer');
  end if;
  insert into public.clients (organization_id, phone, phone_canonical)
    values (v_org, trim(p_customer), public.client_canonical('whatsapp', p_customer))
  on conflict (organization_id, phone_canonical) where phone_canonical is not null
    do update set phone_canonical = excluded.phone_canonical
    returning id into v_client;

  insert into public.conversations (organization_id, channel_id, client_id, last_message_at)
    values (v_org, v_channel, v_client, v_at)
  on conflict (channel_id, client_id)
    do update set last_message_at = greatest(public.conversations.last_message_at, excluded.last_message_at)
    returning id into v_conv;

  insert into public.messages (conversation_id, direction, sender, body, external_id, created_at, origin)
    values (v_conv, p_direction, case when p_direction = 'inbound' then 'contact' else 'agent' end,
            coalesce(p_body, ''), p_ext_id, v_at, p_origin)
  returning id into v_msg;

  if coalesce(p_pause_minutes, 0) > 0 then
    update public.conversations
       set ai_paused_until = greatest(coalesce(ai_paused_until, now()), now() + make_interval(mins => p_pause_minutes))
     where id = v_conv;
  end if;

  if p_origin = 'business_app' then
    update public.channels set app_activity_at = now(), coexistence_alert_level = 0 where id = v_channel;
  end if;

  return jsonb_build_object('message_id', v_msg, 'duplicate', false, 'conversation_id', v_conv, 'organization_id', v_org);
end;
$$;
revoke execute on function public.log_coexistence_message(text, text, text, text, text, text, timestamptz, int) from public, anon, authenticated;
grant execute on function public.log_coexistence_message(text, text, text, text, text, text, timestamptz, int) to service_role;
