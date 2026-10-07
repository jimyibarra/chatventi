-- Catálogo administrado por el socio (PASEN manda servicios y horario) y
-- pases de entrada de un solo uso (el dueño entra desde PASEN sin contraseña).

-- 1. Servicios: referencia del socio, orden y precio como texto.
alter table public.service_catalogs
  add column if not exists partner_ref text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists price_text text check (price_text is null or length(price_text) <= 60);
-- Unicidad completa (no parcial): PostgREST solo infiere ON CONFLICT sobre
-- restricciones; los NULL no chocan entre sí, así que los servicios propios
-- del dueño (sin partner_ref) no se ven afectados.
alter table public.service_catalogs
  add constraint service_catalogs_org_partner_ref_key unique (organization_id, partner_ref);
comment on column public.service_catalogs.partner_ref is 'Id del servicio en el sistema del socio (PUT /partners/v1/organizations/{id}/catalog).';
comment on column public.service_catalogs.price_text is 'Precio tal como lo escribió el dueño en el socio («Desde $250»); manda sobre price al mostrar.';

-- 2. Organización cuyo catálogo administra el socio: el panel lo muestra de
--    solo lectura. Nace sin permiso de escritura para authenticated (columna
--    nueva en tabla con permisos por columna).
alter table public.organizations
  add column if not exists catalog_managed_by_partner boolean not null default false;

-- 3. Pases de entrada: solo la huella del ticket, 60 s, un solo uso. Solo
--    service_role (sin políticas; RLS encendida y permisos revocados).
create table if not exists public.partner_login_tickets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  token_hash      text not null unique,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.partner_login_tickets enable row level security;
revoke all on public.partner_login_tickets from anon, authenticated;
create index if not exists partner_login_tickets_expires_idx on public.partner_login_tickets (expires_at);
comment on table public.partner_login_tickets is 'Pases de un solo uso que un socio pide para que el dueño entre a su panel sin contraseña.';
