-- =====================================================================
-- ChatVenti · Fase 2 · Motor de agenda: esquema + RLS
--   branches.timezone · service_catalogs · business_hours ·
--   staff_schedules · staff_time_off · appointments · appointment_services
--
-- Convenciones (portadas de Fase 0/1):
--   · Aislar por organization_id con helpers get_my_org()/get_my_role()
--     (SECURITY DEFINER, sin recursion RLS). Tablas sin organization_id
--     directo se acotan por EXISTS via su relacion (patron de `messages`).
--   · weekday = EXTRACT(DOW) de Postgres -> 0=Domingo .. 6=Sabado.
--   · Zona horaria: la agenda y los recordatorios usan branches.timezone,
--     NO el UTC del servidor (Gotcha del PRP).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Zona horaria por sucursal (Gotcha PRP: nunca asumir UTC del server)
-- ---------------------------------------------------------------------
alter table public.branches
  add column if not exists timezone text not null default 'America/Mexico_City';

-- ---------------------------------------------------------------------
-- 1. CATALOGO DE SERVICIOS (no existia en el baseline; el PRP lo asumia
--    heredado de SastrePro2). Org-scoped, con duracion para calcular slots.
-- ---------------------------------------------------------------------
create table if not exists public.service_catalogs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  description      text,
  duration_minutes int  not null default 30 check (duration_minutes > 0),
  price            numeric(10,2),
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists service_catalogs_org_idx on public.service_catalogs(organization_id);

-- ---------------------------------------------------------------------
-- 2. HORARIO DE LA SUCURSAL (una fila por dia de semana abierto)
-- ---------------------------------------------------------------------
create table if not exists public.business_hours (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id) on delete cascade,
  weekday    int  not null check (weekday between 0 and 6),
  open_time  time not null,
  close_time time not null,
  is_closed  boolean not null default false,
  check (is_closed or close_time > open_time)
);
create index if not exists business_hours_branch_idx on public.business_hours(branch_id);

-- ---------------------------------------------------------------------
-- 3. DISPONIBILIDAD DEL STAFF (bloques por dia de semana)
-- ---------------------------------------------------------------------
create table if not exists public.staff_schedules (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id) on delete cascade,
  staff_id   uuid not null references public.profiles(id) on delete cascade,
  weekday    int  not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  check (end_time > start_time)
);
create index if not exists staff_schedules_branch_idx on public.staff_schedules(branch_id);
create index if not exists staff_schedules_staff_idx  on public.staff_schedules(staff_id);

-- ---------------------------------------------------------------------
-- 4. AUSENCIAS PUNTUALES DEL STAFF (vacaciones/permisos)
-- ---------------------------------------------------------------------
create table if not exists public.staff_time_off (
  id        uuid primary key default gen_random_uuid(),
  staff_id  uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  reason    text,
  check (ends_at > starts_at)
);
create index if not exists staff_time_off_staff_idx on public.staff_time_off(staff_id);

-- ---------------------------------------------------------------------
-- 5. CITAS (organization_id directo -> RLS simple; source incluye 'ai')
-- ---------------------------------------------------------------------
create table if not exists public.appointments (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  branch_id            uuid not null references public.branches(id) on delete cascade,
  client_id            uuid references public.clients(id) on delete set null,
  staff_id             uuid references public.profiles(id) on delete set null,
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  status               text not null default 'scheduled'
                         check (status in ('scheduled','confirmed','completed','cancelled','no_show')),
  source               text not null default 'staff'
                         check (source in ('staff','whatsapp','telegram','web','ai')),
  notes                text,
  reminder_24h_sent_at timestamptz,
  reminder_2h_sent_at  timestamptz,
  followup_sent_at     timestamptz,
  created_at           timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists appointments_org_idx    on public.appointments(organization_id);
create index if not exists appointments_branch_idx on public.appointments(branch_id);
create index if not exists appointments_staff_idx  on public.appointments(staff_id);
-- Rango temporal por sucursal: acelera la deteccion de solapamiento en la RPC.
create index if not exists appointments_branch_time_idx
  on public.appointments(branch_id, starts_at, ends_at);

create table if not exists public.appointment_services (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id     uuid not null references public.service_catalogs(id) on delete restrict,
  primary key (appointment_id, service_id)
);

-- ---------------------------------------------------------------------
-- 6. RLS — aislar por organization_id (directo o via relacion)
-- ---------------------------------------------------------------------
alter table public.service_catalogs      enable row level security;
alter table public.business_hours        enable row level security;
alter table public.staff_schedules       enable row level security;
alter table public.staff_time_off        enable row level security;
alter table public.appointments          enable row level security;
alter table public.appointment_services  enable row level security;

-- service_catalogs: organization_id directo
drop policy if exists service_select on public.service_catalogs;
create policy service_select on public.service_catalogs for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
drop policy if exists service_write on public.service_catalogs;
create policy service_write on public.service_catalogs for all
  using ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin');

-- business_hours: via branch -> org
drop policy if exists bhours_select on public.business_hours;
create policy bhours_select on public.business_hours for select
  using (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.branches b
               where b.id = business_hours.branch_id and b.organization_id = public.get_my_org())
  );
drop policy if exists bhours_write on public.business_hours;
create policy bhours_write on public.business_hours for all
  using (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.branches b
               where b.id = business_hours.branch_id and b.organization_id = public.get_my_org()
                 and public.get_my_role() in ('owner','manager'))
  )
  with check (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.branches b
               where b.id = business_hours.branch_id and b.organization_id = public.get_my_org()
                 and public.get_my_role() in ('owner','manager'))
  );

-- staff_schedules: via branch -> org
drop policy if exists sched_select on public.staff_schedules;
create policy sched_select on public.staff_schedules for select
  using (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.branches b
               where b.id = staff_schedules.branch_id and b.organization_id = public.get_my_org())
  );
drop policy if exists sched_write on public.staff_schedules;
create policy sched_write on public.staff_schedules for all
  using (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.branches b
               where b.id = staff_schedules.branch_id and b.organization_id = public.get_my_org()
                 and public.get_my_role() in ('owner','manager'))
  )
  with check (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.branches b
               where b.id = staff_schedules.branch_id and b.organization_id = public.get_my_org()
                 and public.get_my_role() in ('owner','manager'))
  );

-- staff_time_off: via profile del staff -> org
drop policy if exists timeoff_select on public.staff_time_off;
create policy timeoff_select on public.staff_time_off for select
  using (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.profiles p
               where p.id = staff_time_off.staff_id and p.organization_id = public.get_my_org())
  );
drop policy if exists timeoff_write on public.staff_time_off;
create policy timeoff_write on public.staff_time_off for all
  using (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.profiles p
               where p.id = staff_time_off.staff_id and p.organization_id = public.get_my_org()
                 and public.get_my_role() in ('owner','manager'))
  )
  with check (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.profiles p
               where p.id = staff_time_off.staff_id and p.organization_id = public.get_my_org()
                 and public.get_my_role() in ('owner','manager'))
  );

-- appointments: organization_id directo. staff tambien puede gestionar.
drop policy if exists appt_select on public.appointments;
create policy appt_select on public.appointments for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
drop policy if exists appt_write on public.appointments;
create policy appt_write on public.appointments for all
  using ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager','staff')) or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager','staff')) or public.get_my_role() = 'super_admin');

-- appointment_services: via appointment -> org
drop policy if exists apptsvc_select on public.appointment_services;
create policy apptsvc_select on public.appointment_services for select
  using (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.appointments a
               where a.id = appointment_services.appointment_id and a.organization_id = public.get_my_org())
  );
drop policy if exists apptsvc_write on public.appointment_services;
create policy apptsvc_write on public.appointment_services for all
  using (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.appointments a
               where a.id = appointment_services.appointment_id and a.organization_id = public.get_my_org()
                 and public.get_my_role() in ('owner','manager','staff'))
  )
  with check (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.appointments a
               where a.id = appointment_services.appointment_id and a.organization_id = public.get_my_org()
                 and public.get_my_role() in ('owner','manager','staff'))
  );
