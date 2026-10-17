-- =====================================================================
-- 17-oct-2026 · Fase 3: recordatorios atados al servicio + mascotas
--
--   · service_catalogs.followup_days / followup_message: «vacuna → otra vez en
--     365 días», «baño → en 30». Al terminar la cita, create_service_followups
--     (corrida diaria) deja UN recordatorio por cliente+servicio(+mascota): si
--     vuelve, se recorre la fecha; no se acumulan.
--   · client_reminders: repeat (los automáticos son de una vez), service_id,
--     pet_id y source ('manual' | 'service' | 'vaccine'). Si el cliente ya tiene
--     una cita próxima, el automático no se manda (no estorba).
--   · pets + pet_vaccines: ficha por mascota y cartilla. La próxima dosis
--     programa el recordatorio con el nombre de la mascota.
--   · appointments.pet_id: la cita es de esa mascota (la pone la recepcionista).
-- RLS: igual que el expediente (miembros de la organización).
-- =====================================================================

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  species text check (species is null or length(species) <= 40),
  breed text check (breed is null or length(breed) <= 60),
  sex text check (sex is null or sex in ('macho', 'hembra')),
  birth_date date,
  notes text check (notes is null or length(notes) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists pets_client_idx on public.pets (client_id);
create index if not exists pets_org_idx on public.pets (organization_id);

create table if not exists public.pet_vaccines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  applied_on date not null,
  next_due_on date check (next_due_on is null or next_due_on > applied_on),
  notes text check (notes is null or length(notes) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists pet_vaccines_pet_idx on public.pet_vaccines (pet_id);
create index if not exists pet_vaccines_org_idx on public.pet_vaccines (organization_id);

alter table public.pets enable row level security;
alter table public.pet_vaccines enable row level security;
drop policy if exists pets_select on public.pets;
drop policy if exists pets_write on public.pets;
drop policy if exists pet_vaccines_select on public.pet_vaccines;
drop policy if exists pet_vaccines_write on public.pet_vaccines;
create policy pets_select on public.pets for select using (organization_id = (select public.get_my_org()));
create policy pets_write on public.pets for all
  using (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager', 'staff'))
  with check (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager', 'staff'));
create policy pet_vaccines_select on public.pet_vaccines for select using (organization_id = (select public.get_my_org()));
create policy pet_vaccines_write on public.pet_vaccines for all
  using (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager', 'staff'))
  with check (organization_id = (select public.get_my_org()) and (select public.get_my_role()) in ('owner', 'manager', 'staff'));
revoke all on public.pets, public.pet_vaccines from anon;

-- Una mascota y su vacuna son de la MISMA organización que su dueño / mascota.
create or replace function public.pet_same_org() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_table_name = 'pets' then
    if not exists (select 1 from public.clients c where c.id = new.client_id and c.organization_id = new.organization_id) then
      raise exception 'pet_client_org_mismatch';
    end if;
  else
    if not exists (select 1 from public.pets p where p.id = new.pet_id and p.organization_id = new.organization_id) then
      raise exception 'vaccine_pet_org_mismatch';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.pet_same_org() from public, anon, authenticated;
drop trigger if exists pets_same_org on public.pets;
create trigger pets_same_org before insert or update on public.pets for each row execute function public.pet_same_org();
drop trigger if exists pet_vaccines_same_org on public.pet_vaccines;
create trigger pet_vaccines_same_org before insert or update on public.pet_vaccines for each row execute function public.pet_same_org();

alter table public.service_catalogs
  add column if not exists followup_days int check (followup_days is null or followup_days between 1 and 3650),
  add column if not exists followup_message text check (followup_message is null or length(followup_message) <= 300);

alter table public.appointments
  add column if not exists pet_id uuid references public.pets(id) on delete set null,
  add column if not exists service_followup_done_at timestamptz;
create index if not exists appointments_pet_idx on public.appointments (pet_id) where pet_id is not null;

alter table public.client_reminders
  add column if not exists repeat boolean not null default true,
  add column if not exists source text not null default 'manual' check (source in ('manual', 'service', 'vaccine')),
  add column if not exists service_id uuid references public.service_catalogs(id) on delete set null,
  add column if not exists pet_id uuid references public.pets(id) on delete cascade;
create index if not exists client_reminders_service_idx on public.client_reminders (service_id) where service_id is not null;
create index if not exists client_reminders_pet_idx on public.client_reminders (pet_id) where pet_id is not null;

-- Un automático de una sola vez se apaga al mandarse; el manual sigue su periodo.
create or replace function public.claim_client_reminder(p_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_next timestamptz;
  v_days integer;
  v_repeat boolean;
begin
  select next_due_at, interval_days, repeat into v_next, v_days, v_repeat
    from public.client_reminders
   where id = p_id and active and next_due_at <= now()
   for update skip locked;
  if v_next is null then
    return false;
  end if;
  if not v_repeat then
    update public.client_reminders set active = false, last_sent_at = now() where id = p_id;
    return true;
  end if;
  while v_next <= now() loop
    v_next := v_next + make_interval(days => v_days);
  end loop;
  update public.client_reminders set next_due_at = v_next, last_sent_at = now() where id = p_id;
  return true;
end;
$function$;
revoke execute on function public.claim_client_reminder(uuid) from public, anon, authenticated;
grant execute on function public.claim_client_reminder(uuid) to service_role;

-- Los automáticos no se mandan si el cliente ya tiene una cita próxima.
create or replace function public.get_due_client_reminders()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_result jsonb;
begin
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'reminder_id', rm.id,
      'message', rm.message,
      'conversation_id', conv.id,
      'channel_type', ch.type,
      'channel_external_id', ch.external_id,
      'send_to', cl.phone,
      'client_name', cl.name,
      'org_name', o.name
    ) as x
    from public.client_reminders rm
    join public.clients cl on cl.id = rm.client_id
    join public.organizations o on o.id = rm.organization_id
    left join lateral (
      select c.id, c.channel_id from public.conversations c
       where c.client_id = rm.client_id
       order by c.last_message_at desc nulls last, c.created_at desc limit 1
    ) conv on true
    left join public.channels ch on ch.id = conv.channel_id
    where rm.active
      and rm.next_due_at <= now()
      and cl.phone is not null
      and (rm.source = 'manual' or not exists (
        select 1 from public.appointments a
         where a.client_id = rm.client_id and a.status in ('scheduled', 'confirmed') and a.starts_at > now()
      ))
    order by rm.next_due_at
    limit 200
  ) t;
  return v_result;
end;
$function$;
revoke execute on function public.get_due_client_reminders() from public, anon, authenticated;
grant execute on function public.get_due_client_reminders() to service_role;

-- Corrida diaria: citas terminadas en los últimos 3 días → un recordatorio por
-- cliente + servicio (+ mascota). Si ya existía y sigue activo, se recorre la
-- fecha (volvió antes de tiempo) en vez de duplicarlo.
create or replace function public.create_service_followups()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_count integer := 0;
  v_msg text;
  v_id uuid;
begin
  for r in
    select a.id as appointment_id, a.organization_id, a.client_id, a.pet_id, a.ends_at,
           sc.id as service_id, sc.name as service_name, sc.followup_days, sc.followup_message,
           p.name as pet_name
      from public.appointments a
      join public.appointment_services aps on aps.appointment_id = a.id
      join public.service_catalogs sc on sc.id = aps.service_id and sc.followup_days is not null
      left join public.pets p on p.id = a.pet_id
     where a.ends_at between now() - interval '3 days' and now()
       and a.status in ('scheduled', 'confirmed', 'completed')
       and a.service_followup_done_at is null
       and a.client_id is not null
  loop
    v_msg := coalesce(nullif(trim(r.followup_message), ''),
      case when r.pet_name is not null
        then 'A ' || r.pet_name || ' ya le toca su ' || lower(r.service_name) || '. ¿Te agendo su cita?'
        else 'Ya te toca tu ' || lower(r.service_name) || '. ¿Te agendo una cita?' end);
    v_msg := replace(v_msg, '{mascota}', coalesce(r.pet_name, 'tu mascota'));

    v_id := null;
    select id into v_id from public.client_reminders
     where client_id = r.client_id and service_id = r.service_id and source = 'service'
       and pet_id is not distinct from r.pet_id and active
     limit 1;
    if v_id is not null then
      update public.client_reminders
         set next_due_at = r.ends_at + make_interval(days => r.followup_days), message = v_msg
       where id = v_id;
    else
      insert into public.client_reminders (organization_id, client_id, message, interval_days, next_due_at, active, repeat, source, service_id, pet_id)
      values (r.organization_id, r.client_id, v_msg, r.followup_days, r.ends_at + make_interval(days => r.followup_days), true, false, 'service', r.service_id, r.pet_id);
    end if;
    v_count := v_count + 1;
  end loop;

  update public.appointments a set service_followup_done_at = now()
   where a.ends_at between now() - interval '3 days' and now()
     and a.service_followup_done_at is null;
  return v_count;
end;
$function$;
revoke execute on function public.create_service_followups() from public, anon, authenticated;
grant execute on function public.create_service_followups() to service_role;

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
