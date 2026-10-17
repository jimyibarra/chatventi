-- =====================================================================
-- 17-oct-2026 · Fase 4: membresías (gimnasio, yoga y pilates)
--
--   · membership_plans: los planes del negocio («Mensualidad», 30 días, $500).
--   · memberships: la membresía de un cliente (copia nombre y precio del plan:
--     si el plan cambia después, la membresía vendida no).
--   · membership_payments: lo que pagó (efectivo, tarjeta, transferencia).
--   · client_reminders.source 'membership': aviso 3 días antes de vencer.
-- RLS: el equipo lee y registra; los planes solo dueño o gerente.
-- =====================================================================

create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  duration_days int not null check (duration_days between 1 and 3650),
  price numeric(10,2) check (price is null or price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists membership_plans_org_idx on public.membership_plans (organization_id);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  plan_id uuid references public.membership_plans(id) on delete set null,
  plan_name text not null check (length(plan_name) between 1 and 60),
  price numeric(10,2) check (price is null or price >= 0),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  cancelled_at timestamptz,
  notes text check (notes is null or length(notes) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists memberships_org_ends_idx on public.memberships (organization_id, ends_on);
create index if not exists memberships_client_idx on public.memberships (client_id);
create index if not exists memberships_plan_idx on public.memberships (plan_id) where plan_id is not null;

create table if not exists public.membership_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  method text not null default 'efectivo' check (method in ('efectivo', 'tarjeta', 'transferencia', 'otro')),
  paid_on date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists membership_payments_membership_idx on public.membership_payments (membership_id);
create index if not exists membership_payments_org_idx on public.membership_payments (organization_id, paid_on desc);
create index if not exists membership_payments_created_by_idx on public.membership_payments (created_by) where created_by is not null;

alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_payments enable row level security;

drop policy if exists membership_plans_select on public.membership_plans;
drop policy if exists membership_plans_write on public.membership_plans;
create policy membership_plans_select on public.membership_plans for select using (organization_id = (select public.get_my_org()));
create policy membership_plans_write on public.membership_plans for all
  using (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager'))
  with check (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager'));

drop policy if exists memberships_select on public.memberships;
drop policy if exists memberships_write on public.memberships;
create policy memberships_select on public.memberships for select using (organization_id = (select public.get_my_org()));
create policy memberships_write on public.memberships for all
  using (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager', 'staff'))
  with check (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager', 'staff'));

drop policy if exists membership_payments_select on public.membership_payments;
drop policy if exists membership_payments_write on public.membership_payments;
create policy membership_payments_select on public.membership_payments for select using (organization_id = (select public.get_my_org()));
create policy membership_payments_write on public.membership_payments for all
  using (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager', 'staff'))
  with check (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager', 'staff'));

revoke all on public.membership_plans, public.memberships, public.membership_payments from anon;

-- La membresía es de un cliente de la MISMA organización; el pago, de una membresía de la misma.
create or replace function public.membership_same_org() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_table_name = 'memberships' then
    if not exists (select 1 from public.clients c where c.id = new.client_id and c.organization_id = new.organization_id) then
      raise exception 'membership_client_org_mismatch';
    end if;
    if new.plan_id is not null and not exists (select 1 from public.membership_plans p where p.id = new.plan_id and p.organization_id = new.organization_id) then
      raise exception 'membership_plan_org_mismatch';
    end if;
  else
    if not exists (select 1 from public.memberships m where m.id = new.membership_id and m.organization_id = new.organization_id) then
      raise exception 'payment_membership_org_mismatch';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.membership_same_org() from public, anon, authenticated;
drop trigger if exists memberships_same_org on public.memberships;
create trigger memberships_same_org before insert or update on public.memberships for each row execute function public.membership_same_org();
drop trigger if exists membership_payments_same_org on public.membership_payments;
create trigger membership_payments_same_org before insert or update on public.membership_payments for each row execute function public.membership_same_org();

alter table public.client_reminders drop constraint if exists client_reminders_source_check;
alter table public.client_reminders
  add constraint client_reminders_source_check check (source in ('manual', 'service', 'vaccine', 'membership'));

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
    -- AÑADIDO 2026-10-17 (fase 3): mascotas del cliente con su próxima vacuna.
    'pets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', p.name, 'species', p.species, 'breed', p.breed,
        'next_vaccine', (
          select jsonb_build_object('name', v.name, 'due_on', v.next_due_on)
            from public.pet_vaccines v
           where v.pet_id = p.id and v.next_due_on is not null and v.next_due_on >= current_date
           order by v.next_due_on limit 1
        )) order by p.created_at)
      from public.pets p
      where p.client_id = v_client and p.organization_id = v_org and p.active
    ), '[]'::jsonb),
    -- AÑADIDO 2026-10-17 (fase 4): la membresía más reciente del cliente.
    'membership', (
      select jsonb_build_object('plan_name', m.plan_name, 'starts_on', m.starts_on, 'ends_on', m.ends_on, 'cancelled', m.cancelled_at is not null)
        from public.memberships m
       where m.client_id = v_client and m.organization_id = v_org
       order by m.ends_on desc limit 1
    ),
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
