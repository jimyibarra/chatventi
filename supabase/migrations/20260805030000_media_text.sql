-- =====================================================================
-- ChatVenti · Superpoderes del agente · Fase 3: visión y transcripción
--
--   1. messages.media_text — qué DICE el archivo (lectura de la imagen o
--      transcripción del audio). Es dato limpio en su propia columna: el
--      `body` sigue siendo el placeholder que mandó el canal.
--   2. RPC set_message_media_text — la escribe el webhook (ANON), con las
--      mismas guardas estrechas que attach_message_media.
--   3. get_agent_context PARCHEADA (aditivo, dos campos):
--      · `messages[].media_text` — sin esto el agente no ve la lectura y
--        toda la fase no sirve de nada: su historial sale de aquí.
--      · `config.cap_vision` / `config.cap_transcribe` — el webhook decide
--        si leer sin una consulta extra.
--      Ambos son opcionales aguas arriba: un cliente que no los use se
--      comporta igual que antes.
-- =====================================================================

alter table public.messages
  add column if not exists media_text text;

-- ---------------------------------------------------------------
-- set_message_media_text
--   Invocable por ANON (patrón route_inbound_message). Estrecha como
--   attach_message_media: solo mensajes ENTRANTES, que YA tengan archivo
--   anclado y que aún no tengan lectura. Así un reintento no reescribe ni
--   se puede inyectar texto en un mensaje ajeno adivinando un uuid.
-- ---------------------------------------------------------------
create or replace function public.set_message_media_text(
  p_message_id uuid,
  p_text text
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_updated integer;
begin
  if p_message_id is null or coalesce(trim(p_text), '') = '' then
    return false;
  end if;

  update public.messages
     set media_text = left(trim(p_text), 4000)
   where id = p_message_id
     and direction = 'inbound'
     and media_path is not null
     and media_text is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.set_message_media_text(uuid, text) from public;
grant execute on function public.set_message_media_text(uuid, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------
-- get_agent_context — copia EXACTA de la definición viva con dos añadidos
-- marcados abajo. Se reescribe entera porque es plpgsql: no hay forma de
-- parchear un fragmento. Cualquier otro cambio aquí sería accidental.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agent_context(p_channel_type text, p_external_id text, p_from_handle text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid; v_channel uuid; v_conv uuid; v_client uuid; v_branch uuid; v_result jsonb;
begin
  select id, organization_id into v_channel, v_org
    from public.channels
   where type = p_channel_type and external_id = p_external_id and status <> 'disabled'
   limit 1;
  if v_channel is null then return null; end if;

  select id into v_client from public.clients
   where organization_id = v_org
     and phone_canonical = public.client_canonical(p_channel_type, p_from_handle) limit 1;

  select id into v_conv from public.conversations
   where channel_id = v_channel and client_id is not distinct from v_client limit 1;
  if v_conv is null then return null; end if;

  select b.id into v_branch
    from public.branches b where b.organization_id = v_org order by b.created_at limit 1;

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
        'approval_mode', ac.approval_mode, 'approval_chat_id', ac.approval_telegram_chat_id,
        'voice_preset', ac.voice_preset, 'voice_profile', ac.voice_profile,
        -- AÑADIDO Fase 3: capacidades de lectura de media.
        'cap_vision', ac.cap_vision, 'cap_transcribe', ac.cap_transcribe
      ) from public.agent_configs ac where ac.organization_id = v_org
    ),
    'branch', (
      select jsonb_build_object('id', b.id, 'name', b.name, 'timezone', b.timezone)
        from public.branches b where b.id = v_branch
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes,
        'price', s.price, 'description', s.description) order by s.name)
      from public.service_catalogs s where s.organization_id = v_org and s.active
    ), '[]'::jsonb),
    'resources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name,
        'service_ids', coalesce((
          select jsonb_agg(rs.service_id)
            from public.resource_services rs where rs.resource_id = r.id
        ), '[]'::jsonb)
      ) order by r.sort_order, r.name)
      from public.resources r
      where r.organization_id = v_org and r.active
        and (r.branch_id is null or r.branch_id = v_branch)
        and exists (select 1 from public.staff_schedules ss where ss.resource_id = r.id and ss.branch_id = v_branch)
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.name, 'price', p.price, 'description', p.description) order by p.name)
      from public.products p where p.organization_id = v_org and p.active
    ), '[]'::jsonb),
    'knowledge', coalesce((
      select jsonb_agg(k.content order by k.created_at)
      from public.knowledge_base k where k.organization_id = v_org
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(m order by m.created_at)
      from (
        -- AÑADIDO Fase 3: media_text viaja con cada mensaje.
        select direction, sender, body, media_text, created_at from public.messages
        where conversation_id = v_conv order by created_at desc limit 20
      ) m
    ), '[]'::jsonb),
    'upcoming_appointments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'starts_at', u.starts_at, 'ends_at', u.ends_at,
        'status', u.status, 'services', u.services, 'resource_name', u.resource_name) order by u.starts_at)
      from (
        select a.id, a.starts_at, a.ends_at, a.status,
               (select r.name from public.resources r where r.id = a.resource_id) as resource_name,
               coalesce((
                 select string_agg(sc.name, ' + ' order by sc.name)
                   from public.appointment_services aps
                   join public.service_catalogs sc on sc.id = aps.service_id
                  where aps.appointment_id = a.id
               ), 'Cita') as services
          from public.appointments a
         where a.client_id = v_client and a.organization_id = v_org
           and a.status in ('scheduled','confirmed') and a.starts_at > now()
         order by a.starts_at limit 5
      ) u
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;
