-- =====================================================================
-- ChatVenti · Ola 1 · Acciones de cita desde el chat (cancelar/reagendar)
--   cancel_appointment_from_chat     · cancela cita propia (valida telefono)
--   reschedule_appointment_from_chat · mueve cita propia (valida telefono)
--   get_agent_context                · + upcoming_appointments del cliente
--
-- Guardas (patron create_appointment_from_chat):
--   · El webhook corre como ANON: la org se resuelve por canal
--     (channels.type + external_id), NUNCA por sesion.
--   · Propiedad: la cita debe pertenecer al cliente (org, phone) de la
--     conversacion. Un appointment_id ajeno lanza appointment_not_found
--     (mismo error que inexistente: no filtra existencia a terceros).
--   · Solo citas futuras y en estado activo ('scheduled','confirmed').
--   · Reagendar delega en reschedule_appointment (advisory lock +
--     no-solapamiento excluyendo la propia cita + slot_taken).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper interno: resuelve (org, client, appointment) validando propiedad.
-- Lanza channel_not_found / appointment_not_found / not_actionable.
-- ---------------------------------------------------------------------
create or replace function public._resolve_chat_appointment(
  p_channel_type text,
  p_external_id  text,
  p_client_phone text,
  p_appointment_id uuid
)
returns uuid  -- organization_id (la cita ya quedo validada)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org    uuid;
  v_client uuid;
  v_ok     boolean;
begin
  select organization_id into v_org
    from public.channels
   where type = p_channel_type and external_id = p_external_id and status <> 'disabled'
   limit 1;
  if v_org is null then raise exception 'channel_not_found'; end if;

  select id into v_client from public.clients
   where organization_id = v_org and phone = trim(p_client_phone) limit 1;
  if v_client is null then raise exception 'appointment_not_found'; end if;

  select true into v_ok
    from public.appointments a
   where a.id = p_appointment_id
     and a.organization_id = v_org
     and a.client_id = v_client;
  if v_ok is not true then raise exception 'appointment_not_found'; end if;

  -- Accionable desde chat: futura y en estado activo.
  select true into v_ok
    from public.appointments a
   where a.id = p_appointment_id
     and a.status in ('scheduled','confirmed')
     and a.starts_at > now();
  if v_ok is not true then raise exception 'not_actionable'; end if;

  return v_org;
end;
$$;

-- ---------------------------------------------------------------------
-- cancel_appointment_from_chat
-- ---------------------------------------------------------------------
create or replace function public.cancel_appointment_from_chat(
  p_channel_type   text,
  p_external_id    text,
  p_client_phone   text,
  p_appointment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._resolve_chat_appointment(
    p_channel_type, p_external_id, p_client_phone, p_appointment_id);

  update public.appointments
     set status = 'cancelled'
   where id = p_appointment_id;
end;
$$;

-- ---------------------------------------------------------------------
-- reschedule_appointment_from_chat
--   Valida propiedad y delega en reschedule_appointment (lock +
--   no-solapamiento + slot_taken). No permite mover a un instante pasado.
-- ---------------------------------------------------------------------
create or replace function public.reschedule_appointment_from_chat(
  p_channel_type   text,
  p_external_id    text,
  p_client_phone   text,
  p_appointment_id uuid,
  p_new_starts_at  timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._resolve_chat_appointment(
    p_channel_type, p_external_id, p_client_phone, p_appointment_id);

  if p_new_starts_at <= now() then
    raise exception 'not_actionable';
  end if;

  perform public.reschedule_appointment(p_appointment_id, p_new_starts_at, null);
end;
$$;

-- ---------------------------------------------------------------------
-- get_agent_context: + upcoming_appointments (citas futuras activas del
-- cliente, con nombres de servicios agregados). Resto sin cambios.
-- ---------------------------------------------------------------------
create or replace function public.get_agent_context(
  p_channel_type text,
  p_external_id  text,
  p_from_handle  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org     uuid;
  v_channel uuid;
  v_conv    uuid;
  v_client  uuid;
  v_result  jsonb;
begin
  select id, organization_id into v_channel, v_org
    from public.channels
   where type = p_channel_type and external_id = p_external_id and status <> 'disabled'
   limit 1;
  if v_channel is null then return null; end if;

  select id into v_client from public.clients
   where organization_id = v_org and phone = trim(p_from_handle) limit 1;

  select id into v_conv from public.conversations
   where channel_id = v_channel and client_id is not distinct from v_client limit 1;
  if v_conv is null then return null; end if;

  select jsonb_build_object(
    'org_id', v_org,
    'conversation', (
      select jsonb_build_object(
        'id', c.id, 'status', c.status, 'ai_enabled', c.ai_enabled,
        'ai_paused_until', c.ai_paused_until,
        'channel_type', p_channel_type, 'channel_external_id', p_external_id,
        'client_id', v_client, 'client_handle', trim(p_from_handle),
        'client_name', (select name from public.clients where id = v_client),
        'should_respond', (
          coalesce((select enabled from public.agent_configs where organization_id = v_org), false)
          and c.ai_enabled
          and (c.ai_paused_until is null or c.ai_paused_until < now())
          and not exists (
            select 1 from public.ai_approvals a
             where a.conversation_id = c.id and a.status = 'pending'
          )
        )
      ) from public.conversations c where c.id = v_conv
    ),
    'config', (
      select jsonb_build_object(
        'enabled', ac.enabled, 'system_prompt', ac.system_prompt, 'model', ac.model,
        'approval_mode', ac.approval_mode, 'approval_chat_id', ac.approval_telegram_chat_id
      ) from public.agent_configs ac where ac.organization_id = v_org
    ),
    'branch', (
      select jsonb_build_object('id', b.id, 'name', b.name, 'timezone', b.timezone)
        from public.branches b where b.organization_id = v_org order by b.created_at limit 1
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes,
        'price', s.price, 'description', s.description) order by s.name)
      from public.service_catalogs s where s.organization_id = v_org and s.active
    ), '[]'::jsonb),
    'knowledge', coalesce((
      select jsonb_agg(k.content order by k.created_at)
      from public.knowledge_base k where k.organization_id = v_org
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(m order by m.created_at)
      from (
        select direction, sender, body, created_at
        from public.messages
        where conversation_id = v_conv
        order by created_at desc
        limit 20
      ) m
    ), '[]'::jsonb),
    -- Citas futuras activas del cliente (max 5): el agente cancela/reagenda
    -- por id de esta lista, nunca por ids inventados.
    'upcoming_appointments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'starts_at', u.starts_at, 'ends_at', u.ends_at,
        'status', u.status, 'services', u.services) order by u.starts_at)
      from (
        select a.id, a.starts_at, a.ends_at, a.status,
               coalesce((
                 select string_agg(sc.name, ' + ' order by sc.name)
                   from public.appointment_services aps
                   join public.service_catalogs sc on sc.id = aps.service_id
                  where aps.appointment_id = a.id
               ), 'Cita') as services
          from public.appointments a
         where a.client_id = v_client
           and a.organization_id = v_org
           and a.status in ('scheduled','confirmed')
           and a.starts_at > now()
         order by a.starts_at
         limit 5
      ) u
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- GRANTS (patron harden). El helper interno NO se expone a clientes.
-- ---------------------------------------------------------------------
revoke all on function public._resolve_chat_appointment(text, text, text, uuid) from public;
revoke execute on function public._resolve_chat_appointment(text, text, text, uuid) from anon;
revoke execute on function public._resolve_chat_appointment(text, text, text, uuid) from authenticated;

revoke all on function public.cancel_appointment_from_chat(text, text, text, uuid) from public;
grant execute on function public.cancel_appointment_from_chat(text, text, text, uuid) to anon, authenticated;

revoke all on function public.reschedule_appointment_from_chat(text, text, text, uuid, timestamptz) from public;
grant execute on function public.reschedule_appointment_from_chat(text, text, text, uuid, timestamptz) to anon, authenticated;

-- get_agent_context conserva sus grants (create or replace no los toca).
