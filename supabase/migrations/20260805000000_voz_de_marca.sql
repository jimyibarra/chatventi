-- =====================================================================
-- Voz de marca (PRP prp-verticales-seo.md · Fase 3)
--
-- 🔴 ANTES DE APLICAR: la parte 2 hace CREATE OR REPLACE de
-- public.get_agent_context, que usan los webhooks de WhatsApp y Telegram EN
-- PRODUCCIÓN. El cuerpo de abajo se copió de la última migración que la
-- definió (20260723040000_phone_canonical_switch.sql) porque en la sesión en
-- que se escribió no había acceso a la base. VERIFICAR PRIMERO que coincide
-- con lo que hay vivo:
--
--   select pg_get_functiondef('public.get_agent_context(text,text,text)'::regprocedure);
--
-- y si difiere, portar el cambio sobre la definición REAL en vez de aplicar
-- esta tal cual. Reemplazar a ciegas una función SECURITY DEFINER del webhook
-- es exactamente cómo se rompió la reagenda en la Fase 7 CONTRACT.
--
-- La parte 1 (columnas) es puramente aditiva y no tiene ese riesgo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columnas de voz en agent_configs
--
-- La voz vive AQUÍ y no en organizations.branding por tres razones:
--   · branding se devuelve ENTERO en RPC públicas (get_public_org_by_slug,
--     el token de cita, los correos) → filtraría configuración interna;
--   · branding es un jsonb con >=2 escritores que hacen merge a mano, y cada
--     escritor nuevo es otra ocasión de borrar el logo o resource_label;
--   · system_prompt ya tiene dueño: applyBusinessTemplate lo SOBRESCRIBE, así
--     que aplicar una plantilla de rubro habría borrado la voz.
-- ---------------------------------------------------------------------
alter table public.agent_configs
  add column if not exists voice_preset text
    check (voice_preset is null or voice_preset in ('calido','formal','divertido','custom')),
  add column if not exists voice_profile jsonb,
  add column if not exists voice_source_url text,
  add column if not exists voice_updated_at timestamptz;

comment on column public.agent_configs.voice_profile is
  'Retrato de voz TIPADO (treatment/energy/emoji/sentence/quirks). Se valida con Zod al escribir Y al leer: un perfil corrupto nunca debe llegar crudo al prompt.';

-- ---------------------------------------------------------------------
-- 2. get_agent_context: dos claves más dentro de `config`.
--    Único cambio respecto a 20260723040000. Todo lo demás es idéntico.
-- ---------------------------------------------------------------------
create or replace function public.get_agent_context(p_channel_type text, p_external_id text, p_from_handle text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
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
        -- NUEVO: voz de marca.
        'voice_preset', ac.voice_preset, 'voice_profile', ac.voice_profile
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
        select direction, sender, body, created_at from public.messages
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
