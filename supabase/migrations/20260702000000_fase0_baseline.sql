-- =====================================================================
-- ChatVenti · Fase 0 · Baseline: tenancy + auth roles + channels + onboarding
-- Patron portado por patron desde SastrePro2, con tenancy limpio:
-- helpers SECURITY DEFINER (sin sync app_meta/user_meta).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLAS NUCLEO (multi-tenant)
-- ---------------------------------------------------------------------
create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  web_slug      text unique,
  branding      jsonb,
  contact_email text,
  phone         text,
  created_at    timestamptz not null default now()
);

create table if not exists public.branches (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  address         text,
  business_hours  jsonb,
  status          text not null default 'active' check (status in ('active','disabled')),
  created_at      timestamptz not null default now()
);
create index if not exists branches_org_idx on public.branches(organization_id);

-- profiles.id = auth.users.id (1:1 con el usuario autenticado)
create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  full_name          text,
  role               text not null default 'owner'
                       check (role in ('super_admin','owner','manager','staff')),
  organization_id    uuid references public.organizations(id) on delete cascade,
  assigned_branch_id uuid references public.branches(id) on delete set null,
  phone              text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);
create index if not exists profiles_org_idx on public.profiles(organization_id);

-- ---------------------------------------------------------------------
-- 2. CANALES (omnicanal) — abstraccion WhatsApp / Telegram / Web
--    external_id = phone_number_id (WA) / bot id (TG) / slug (web)
-- ---------------------------------------------------------------------
create table if not exists public.channels (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type            text not null check (type in ('whatsapp','telegram','web')),
  external_id     text not null,
  waba_id         text,
  display_name    text,
  credentials     jsonb,
  status          text not null default 'pending' check (status in ('pending','active','disabled')),
  created_at      timestamptz not null default now(),
  unique (type, external_id)
);
create index if not exists channels_org_idx on public.channels(organization_id);

-- ---------------------------------------------------------------------
-- 3. HELPERS DE TENANCY (SECURITY DEFINER -> evitan recursion RLS)
-- ---------------------------------------------------------------------
create or replace function public.get_my_org()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.get_my_branch()
returns uuid language sql stable security definer set search_path = public as $$
  select assigned_branch_id from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.branches      enable row level security;
alter table public.profiles       enable row level security;
alter table public.channels       enable row level security;

-- organizations: miembros de la org (o super_admin) ven/gestionan su org
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select
  using (id = public.get_my_org() or public.get_my_role() = 'super_admin');
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update
  using ((id = public.get_my_org() and public.get_my_role() = 'owner') or public.get_my_role() = 'super_admin');

-- branches: dentro de la org
drop policy if exists branch_select on public.branches;
create policy branch_select on public.branches for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
drop policy if exists branch_write on public.branches;
create policy branch_write on public.branches for all
  using ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin');

-- profiles: se ve a si mismo y a miembros de su org
drop policy if exists profile_select on public.profiles;
create policy profile_select on public.profiles for select
  using (id = auth.uid() or organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
drop policy if exists profile_update_self on public.profiles;
create policy profile_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- channels: aislado por organization_id
drop policy if exists channel_select on public.channels;
create policy channel_select on public.channels for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
drop policy if exists channel_write on public.channels;
create policy channel_write on public.channels for all
  using ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin');

-- ---------------------------------------------------------------------
-- 5. ONBOARDING SELF-SERVICE (transaccional, SECURITY DEFINER)
--    Crea org + sucursal + profile(owner) para el usuario autenticado.
-- ---------------------------------------------------------------------
create or replace function public.create_organization_with_owner(
  p_org_name    text,
  p_owner_name  text default null,
  p_branch_name text default 'Principal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_org   uuid;
  v_branch uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if coalesce(trim(p_org_name), '') = '' then
    raise exception 'org_name_required';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'already_onboarded';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into public.organizations (name, contact_email)
    values (trim(p_org_name), v_email)
    returning id into v_org;

  insert into public.branches (organization_id, name)
    values (v_org, coalesce(nullif(trim(p_branch_name), ''), 'Principal'))
    returning id into v_branch;

  insert into public.profiles (id, email, full_name, role, organization_id, assigned_branch_id)
    values (v_uid, v_email, nullif(trim(p_owner_name), ''), 'owner', v_org, v_branch);

  return v_org;
end;
$$;

revoke all on function public.create_organization_with_owner(text, text, text) from public;
grant execute on function public.create_organization_with_owner(text, text, text) to authenticated;
