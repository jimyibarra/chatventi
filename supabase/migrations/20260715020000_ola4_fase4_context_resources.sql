-- =====================================================================
-- ChatVenti · Ola 4 · Fase 4 · Recursos en el contexto de web y agente
--   get_public_booking_context  + resources[]
--   get_agent_context           + resources[] + resource_name en citas
--
-- POR QUE AQUI SI SE REEMPLAZA EN SITIO (y no se crean _v2):
--   La FIRMA no cambia (mismos parametros y tipos), solo se AÑADEN claves
--   al jsonb devuelto. Por tanto:
--     · `create or replace` conserva la ACL de la funcion -> no se pierden
--       los grants a anon (el webhook y /r/[slug] corren como anon).
--     · El codigo desplegado ignora las claves nuevas -> compatible con
--       expand/contract, produccion no se entera.
--   Las de agenda SI necesitaron _v2 porque alli cambiaba el nombre de un
--   parametro (p_staff_id -> p_resource_id), que Postgres no permite en un
--   replace ("cannot change name of input parameter").
--
-- CUERPOS PORTADOS DE LA DEFINICION VIVA (pg_get_functiondef), NO de las
-- migraciones: get_agent_context se reemplazo 3 veces (fase3 -> ola1 ->
-- ola3) y la migracion de ola3 NO contiene el cuerpo completo. Reescribirla
-- desde el repo habria borrado `products`, `knowledge` y
-- `upcoming_appointments`. (Gotcha del PRP, confirmado al volcarla.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CONTEXTO DE LA WEB PUBLICA /r/[slug]
--    `branding` ya se devuelve entero, asi que resource_label viaja solo.
--    Solo se exponen los recursos RESERVABLES: activos, de esta sucursal
--    y CON horario. Uno sin horario no genera huecos: ofrecerlo en el
--    selector seria un callejon sin salida para el cliente.
-- ---------------------------------------------------------------------
create or replace function public.get_public_booking_context(p_slug text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; v_branch uuid; v_result jsonb;
begin
  select id into v_org from public.organizations where web_slug = p_slug limit 1;
  if v_org is null then return null; end if;

  select b.id into v_branch
    from public.branches b where b.organization_id = v_org order by b.created_at limit 1;

  select jsonb_build_object(
    'org', (select jsonb_build_object('name', o.name, 'branding', o.branding)
              from public.organizations o where o.id = v_org),
    'branch', (select jsonb_build_object('id', b.id, 'name', b.name, 'timezone', b.timezone)
                 from public.branches b where b.id = v_branch),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes,
        'price', s.price, 'description', s.description) order by s.name)
      from public.service_catalogs s where s.organization_id = v_org and s.active), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'price', p.price,
        'image_url', p.image_url, 'description', p.description) order by p.name)
      from public.products p where p.organization_id = v_org and p.active), '[]'::jsonb),
    'resources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'photo_url', r.photo_url,
        -- Lista vacia = presta TODOS los servicios (regla del motor, Fase 2).
        'service_ids', coalesce((
          select jsonb_agg(rs.service_id)
            from public.resource_services rs where rs.resource_id = r.id
        ), '[]'::jsonb)
      ) order by r.sort_order, r.name)
      from public.resources r
      where r.organization_id = v_org
        and r.active
        and (r.branch_id is null or r.branch_id = v_branch)
        and exists (
          select 1 from public.staff_schedules ss
           where ss.resource_id = r.id and ss.branch_id = v_branch
        )
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

-- ---------------------------------------------------------------------
-- 2. CONTEXTO DEL AGENTE (webhook = anon)
--    + resources[]: para que pueda preguntar "¿con quien?" y respetar
--      el horario individual.
--    + resource_name en upcoming_appointments: para decir "tu cita es
--      con Ana" al confirmar/reagendar.
-- ---------------------------------------------------------------------
create or replace function public.get_agent_context(p_channel_type text, p_external_id text, p_from_handle text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_org     uuid;
  v_channel uuid;
  v_conv    uuid;
  v_client  uuid;
  v_branch  uuid;
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
        'approval_mode', ac.approval_mode, 'approval_chat_id', ac.approval_telegram_chat_id
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
    -- NUEVO: quien puede atender. Lista vacia de service_ids = presta todo.
    'resources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'service_ids', coalesce((
          select jsonb_agg(rs.service_id)
            from public.resource_services rs where rs.resource_id = r.id
        ), '[]'::jsonb)
      ) order by r.sort_order, r.name)
      from public.resources r
      where r.organization_id = v_org
        and r.active
        and (r.branch_id is null or r.branch_id = v_branch)
        and exists (
          select 1 from public.staff_schedules ss
           where ss.resource_id = r.id and ss.branch_id = v_branch
        )
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', p.name, 'price', p.price, 'description', p.description) order by p.name)
      from public.products p where p.organization_id = v_org and p.active
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
    'upcoming_appointments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'starts_at', u.starts_at, 'ends_at', u.ends_at,
        'status', u.status, 'services', u.services,
        'resource_name', u.resource_name) order by u.starts_at)
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
$function$;
