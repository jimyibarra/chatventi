-- =====================================================================
-- 17-oct-2026 · Fase 2: pedidos por WhatsApp (restaurantes)
--
-- El carrito de las páginas de ¡Pasen! manda el pedido con un formato fijo;
-- el webhook lo reconoce (código, no IA), lo guarda aquí, confirma al cliente
-- con el tiempo del negocio y avisa al equipo. Tablero en /dashboard/pedidos.
--
-- Seguridad: los miembros de la organización LEEN sus pedidos (RLS); nadie con
-- sesión escribe: el webhook y las acciones del panel usan service_role tras
-- comprobar la organización con la sesión.
-- =====================================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  -- El mensaje de WhatsApp que trajo el pedido: un reintento de Meta no lo duplica.
  source_message_id uuid unique references public.messages(id) on delete set null,
  customer_name text check (customer_name is null or length(customer_name) <= 80),
  items jsonb not null default '[]'::jsonb,
  total_text text check (total_text is null or length(total_text) <= 80),
  delivery_mode text not null default 'pickup' check (delivery_mode in ('pickup', 'delivery')),
  address text check (address is null or length(address) <= 200),
  notes text check (notes is null or length(notes) <= 200),
  status text not null default 'new' check (status in ('new', 'preparing', 'ready', 'delivered', 'cancelled')),
  eta_minutes int check (eta_minutes is null or eta_minutes between 5 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz,
  delivered_at timestamptz,
  ready_notified_at timestamptz
);

create index if not exists orders_org_status_created_idx on public.orders (organization_id, status, created_at desc);
create index if not exists orders_conversation_idx on public.orders (conversation_id);
create index if not exists orders_client_idx on public.orders (client_id);

alter table public.orders enable row level security;
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select using (organization_id = (select public.get_my_org()));
revoke all on public.orders from anon;
revoke insert, update, delete on public.orders from authenticated;
grant select on public.orders to authenticated;

-- Tiempo estimado que la recepcionista promete al confirmar (lo ajusta el dueño
-- desde el tablero; columna nueva = sin escritura para authenticated).
alter table public.organizations
  add column if not exists order_eta_minutes int not null default 30 check (order_eta_minutes between 5 and 240);

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
    -- AÑADIDO 2026-10-17: giro (reglas y herramientas por giro) y página del
    -- negocio (los restaurantes mandan a su menú con carrito).
    'business_type', (select o.business_type from public.organizations o where o.id = v_org),
    'site_url', (select o.site_url from public.organizations o where o.id = v_org),
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
        'cap_vision', ac.cap_vision, 'cap_transcribe', ac.cap_transcribe
      ) from public.agent_configs ac where ac.organization_id = v_org
    ),
    'branch', (
      select jsonb_build_object('id', b.id, 'name', b.name, 'timezone', b.timezone)
        from public.branches b where b.id = v_branch
    ),
    -- AÑADIDO 2026-08-14: horario de atención del branch, para que el agente
    -- pueda responder "¿cuál es su horario?" (weekday 0=domingo..6=sábado).
    'business_hours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekday', bh.weekday, 'open_time', bh.open_time,
        'close_time', bh.close_time, 'is_closed', bh.is_closed) order by bh.weekday)
      from public.business_hours bh where bh.branch_id = v_branch
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes,
        'price', s.price, 'price_text', s.price_text, 'description', s.description) order by s.name)
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
        select direction, sender, body, media_text, created_at from public.messages
        where conversation_id = v_conv order by created_at desc limit 20
      ) m
    ), '[]'::jsonb),
    -- AÑADIDO 2026-10-17 (fase 2): pedidos recientes del cliente (3 días), para
    -- que la recepcionista conteste «¿ya está mi pedido?» con el estado real.
    'recent_orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', o.status, 'items', o.items, 'total_text', o.total_text,
        'delivery_mode', o.delivery_mode, 'eta_minutes', o.eta_minutes,
        'created_at', o.created_at) order by o.created_at desc)
      from (
        select * from public.orders
         where organization_id = v_org and client_id = v_client
           and created_at > now() - interval '3 days'
         order by created_at desc limit 3
      ) o
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

revoke execute on function public.get_agent_context(text, text, text) from public, anon, authenticated;
grant execute on function public.get_agent_context(text, text, text) to service_role;
