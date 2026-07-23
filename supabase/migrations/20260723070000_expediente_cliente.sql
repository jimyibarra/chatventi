-- =====================================================================
-- ChatVenti · Expediente del cliente (PRP 4)
--   1. Bucket PRIVADO `records` (historial clinico = dato sensible)
--   2. client_files / client_records / client_reminders + RLS
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. Bucket PRIVADO. A diferencia de `media`, NO es publico:
--    se lee solo por URL firmada generada en el servidor.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('records', 'records', false, 10485760,
        array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Subida directa desde el browser, aislada por org (ruta "<orgId>/clients/...").
drop policy if exists records_insert_own_org on storage.objects;
create policy records_insert_own_org on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'records'
    and (storage.foldername(name))[1] = public.get_my_org()::text
  );

-- Lectura solo para miembros de la misma org (ademas de la firma del servidor).
drop policy if exists records_select_own_org on storage.objects;
create policy records_select_own_org on storage.objects
  for select to authenticated
  using (
    bucket_id = 'records'
    and (storage.foldername(name))[1] = public.get_my_org()::text
  );

-- ---------------------------------------------------------------
-- 2. Tablas del expediente
-- ---------------------------------------------------------------
create table if not exists public.client_files (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  path            text not null,
  file_name       text not null,
  mime_type       text not null,
  size_bytes      integer not null,
  note            text,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null
);
create index if not exists client_files_client_idx on public.client_files(client_id, created_at desc);

create table if not exists public.client_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  kind            text not null default 'service'
                    check (kind in ('service','purchase','note')),
  title           text not null,
  detail          text,
  amount          numeric(10,2),
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null
);
create index if not exists client_records_client_idx on public.client_records(client_id, occurred_at desc);

create table if not exists public.client_reminders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  message         text not null,
  interval_days   integer not null check (interval_days between 1 and 3650),
  next_due_at     timestamptz not null,
  active          boolean not null default true,
  last_sent_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists client_reminders_due_idx
  on public.client_reminders(next_due_at) where active;

-- ---------------------------------------------------------------
-- 3. RLS · patron de la org (igual que products / service_catalogs)
-- ---------------------------------------------------------------
alter table public.client_files    enable row level security;
alter table public.client_records  enable row level security;
alter table public.client_reminders enable row level security;

create policy client_files_select on public.client_files for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
create policy client_files_write on public.client_files for all
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin')
  with check (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');

create policy client_records_select on public.client_records for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
create policy client_records_write on public.client_records for all
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin')
  with check (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');

create policy client_reminders_select on public.client_reminders for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
create policy client_reminders_write on public.client_reminders for all
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin')
  with check (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
