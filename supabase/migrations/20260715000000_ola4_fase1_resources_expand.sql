-- =====================================================================
-- ChatVenti · Ola 4 · Fase 1 · Profesionales/Recursos: EXPAND
--   resources · resource_services · team_invitations ·
--   profiles.resource_scope · resource_id (junto a staff_id)
--
-- ESTRATEGIA: expand/contract. Esta migracion es ESTRICTAMENTE ADITIVA.
--   La BD es PRODUCCION y no hay staging (ver Aprendizajes del PRP
--   prp-profesionales-equipo.md, 2026-07-15). El codigo desplegado hace
--   .select('staff_id') y llama p_staff_id: renombrar o dropear aqui
--   tumbaria agenda + /r/[slug] + chat hasta el deploy de las Fases 2-5.
--
--   · NADA de rename / drop column / drop function en esta migracion.
--   · resource_id convive con staff_id; staff_id sigue mandando en el
--     codigo desplegado hasta el deploy.
--   · La Fase 7 (CONTRACT) borra staff_id, el trigger de sync y las
--     RPCs viejas, SOLO tras verificar el deploy en produccion.
--
-- Convenciones (portadas de Fase 0/2):
--   · Aislar por organization_id con get_my_org()/get_my_role().
--     Tablas sin organization_id directo se acotan por EXISTS via su
--     relacion (patron de business_hours/staff_schedules).
--   · anon NO lee estas tablas por RLS: lo hara por RPC SECURITY DEFINER
--     en las Fases 2/4 (el webhook y /r/[slug] corren como anon).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RECURSOS (profesional / sala / equipo) — DESACOPLADO DEL LOGIN
--    profile_id es OPCIONAL: un peluquero no necesita cuenta. Solo se
--    rellena si esa persona ademas entra al panel.
-- ---------------------------------------------------------------------
create table if not exists public.resources (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  profile_id      uuid references public.profiles(id) on delete set null,
  name            text not null,
  photo_url       text,
  active          boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists resources_org_idx    on public.resources(organization_id);
create index if not exists resources_branch_idx on public.resources(branch_id);

-- Indice PARCIAL a proposito: sin el WHERE, solo UN recurso podria
-- existir sin login (todos los NULL colisionarian). Un profile = max 1 recurso.
create unique index if not exists resources_profile_uniq
  on public.resources(profile_id) where profile_id is not null;

-- ---------------------------------------------------------------------
-- 2. QUE SERVICIOS PRESTA CADA RECURSO
-- ---------------------------------------------------------------------
create table if not exists public.resource_services (
  resource_id uuid not null references public.resources(id) on delete cascade,
  service_id  uuid not null references public.service_catalogs(id) on delete cascade,
  primary key (resource_id, service_id)
);
create index if not exists resource_services_service_idx on public.resource_services(service_id);

-- ---------------------------------------------------------------------
-- 3. INVITACIONES DE EQUIPO
--    Token propio (patron de appointments.manage_token + /c/[token]).
--    No se usa inviteUserByEmail de Supabase: necesitamos controlar rol,
--    reenvio/revocado, gate de asientos y copy en español.
-- ---------------------------------------------------------------------
create table if not exists public.team_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null,
  role            text not null check (role in ('owner','manager','staff')),
  resource_scope  text not null default 'all' check (resource_scope in ('all','own')),
  resource_id     uuid references public.resources(id) on delete set null,
  token           uuid not null unique default gen_random_uuid(),
  invited_by      uuid references public.profiles(id) on delete set null,
  status          text not null default 'pending'
                    check (status in ('pending','accepted','revoked','expired')),
  expires_at      timestamptz not null default now() + interval '7 days',
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz
);
create index if not exists team_invitations_org_idx on public.team_invitations(organization_id);

-- Una sola invitacion pendiente por email y org (reinvitar = reenviar).
create unique index if not exists team_invitations_pending_uniq
  on public.team_invitations(organization_id, lower(email)) where status = 'pending';

-- ---------------------------------------------------------------------
-- 4. ALCANCE DEL ROL — sin tocar el check de profiles.role
--    'all' = ve toda la agenda (Dueño/Administrador/Recepcion)
--    'own' = solo su propio recurso (Profesional)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists resource_scope text not null default 'all';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_resource_scope_check'
  ) then
    alter table public.profiles
      add constraint profiles_resource_scope_check
      check (resource_scope in ('all','own'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. COLUMNA resource_id — JUNTO A staff_id, NO en su lugar
--    NULLABLE a proposito: el codigo desplegado inserta horarios con
--    solo staff_id (staff-availability.tsx sigue vivo hasta la Fase 3).
--    Un NOT NULL aqui reventaria esos inserts en produccion.
--    La Fase 7 la pondra NOT NULL tras dropear staff_id.
-- ---------------------------------------------------------------------
alter table public.staff_schedules
  add column if not exists resource_id uuid references public.resources(id) on delete cascade;
alter table public.staff_time_off
  add column if not exists resource_id uuid references public.resources(id) on delete cascade;
alter table public.appointments
  add column if not exists resource_id uuid references public.resources(id) on delete set null;

create index if not exists staff_schedules_resource_idx on public.staff_schedules(resource_id);
create index if not exists staff_time_off_resource_idx  on public.staff_time_off(resource_id);
create index if not exists appointments_resource_idx    on public.appointments(resource_id);

-- Rango temporal por recurso: acelera el no-solapamiento por recurso de la Fase 2.
create index if not exists appointments_resource_time_idx
  on public.appointments(resource_id, starts_at, ends_at);

-- ---------------------------------------------------------------------
-- 6. BACKFILL — un recurso por cada profile ya referenciado por la agenda
--    Verificado antes de escribir esto (2026-07-15): 4 profiles con
--    horario, cada uno en una org distinta y con UNA sola sucursal
--    coherente con su org. staff_time_off vacia. Las 2 citas existentes
--    tienen staff_id NULL -> no aportan profiles ni se backfillean.
-- ---------------------------------------------------------------------
-- Nota: min(uuid) NO existe en Postgres (no hay orden agregable para uuid).
-- array_agg + [1] es equivalente aqui: cada profile tiene UNA sola sucursal (verificado).
insert into public.resources (organization_id, branch_id, profile_id, name, active)
select
  p.organization_id,
  coalesce(p.assigned_branch_id, (array_agg(s.branch_id))[1]),
  p.id,
  coalesce(nullif(btrim(p.full_name), ''), split_part(coalesce(p.email,''), '@', 1), 'Profesional'),
  p.is_active
from public.profiles p
join public.staff_schedules s on s.staff_id = p.id
where p.organization_id is not null
  and p.role <> 'super_admin'
  and not exists (select 1 from public.resources r where r.profile_id = p.id)
group by p.id, p.organization_id, p.assigned_branch_id, p.full_name, p.email, p.is_active;

update public.staff_schedules s
   set resource_id = r.id
  from public.resources r
 where r.profile_id = s.staff_id
   and s.resource_id is null;

update public.staff_time_off t
   set resource_id = r.id
  from public.resources r
 where r.profile_id = t.staff_id
   and t.resource_id is null;

update public.appointments a
   set resource_id = r.id
  from public.resources r
 where r.profile_id = a.staff_id
   and a.resource_id is null;

-- ---------------------------------------------------------------------
-- 7. TRIGGER DE TRANSICION (temporal — se dropea en la Fase 7)
--    Mientras el codigo viejo siga desplegado puede insertar filas con
--    solo staff_id. Sin esto, esas filas quedarian con resource_id NULL
--    y perderian su vinculo al dropear staff_id en la Fase 7.
-- ---------------------------------------------------------------------
create or replace function public.tr_sync_resource_from_staff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.resource_id is null and new.staff_id is not null then
    select r.id into new.resource_id
      from public.resources r
     where r.profile_id = new.staff_id;
  end if;
  return new;
end $$;

drop trigger if exists sync_resource_from_staff on public.staff_schedules;
create trigger sync_resource_from_staff
  before insert or update on public.staff_schedules
  for each row execute function public.tr_sync_resource_from_staff();

drop trigger if exists sync_resource_from_staff on public.staff_time_off;
create trigger sync_resource_from_staff
  before insert or update on public.staff_time_off
  for each row execute function public.tr_sync_resource_from_staff();

drop trigger if exists sync_resource_from_staff on public.appointments;
create trigger sync_resource_from_staff
  before insert or update on public.appointments
  for each row execute function public.tr_sync_resource_from_staff();

-- Hardening (patron de fase0_harden_function_grants): toda funcion SECURITY
-- DEFINER en `public` queda expuesta como /rest/v1/rpc/<nombre> y el linter la
-- marca (0028/0029). Una funcion de TRIGGER no necesita EXECUTE de ningun rol:
-- Postgres la invoca como dueño de la tabla, no via GRANT. Se revoca a todos.
revoke execute on function public.tr_sync_resource_from_staff() from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------
alter table public.resources         enable row level security;
alter table public.resource_services enable row level security;
alter table public.team_invitations  enable row level security;

-- resources: organization_id directo (patron de service_catalogs)
drop policy if exists resource_select on public.resources;
create policy resource_select on public.resources for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
drop policy if exists resource_write on public.resources;
create policy resource_write on public.resources for all
  using ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin');

-- resource_services: via resource -> org
drop policy if exists resourcesvc_select on public.resource_services;
create policy resourcesvc_select on public.resource_services for select
  using (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.resources r
               where r.id = resource_services.resource_id and r.organization_id = public.get_my_org())
  );
drop policy if exists resourcesvc_write on public.resource_services;
create policy resourcesvc_write on public.resource_services for all
  using (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.resources r
               where r.id = resource_services.resource_id and r.organization_id = public.get_my_org()
                 and public.get_my_role() in ('owner','manager'))
  )
  with check (
    public.get_my_role() = 'super_admin'
    or exists (select 1 from public.resources r
               where r.id = resource_services.resource_id and r.organization_id = public.get_my_org()
                 and public.get_my_role() in ('owner','manager'))
  );

-- team_invitations: SOLO owner (invitar = dar las llaves del negocio)
drop policy if exists invitation_rw on public.team_invitations;
create policy invitation_rw on public.team_invitations for all
  using ((organization_id = public.get_my_org() and public.get_my_role() = 'owner') or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() = 'owner') or public.get_my_role() = 'super_admin');
