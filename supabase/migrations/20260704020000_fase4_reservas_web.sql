-- =====================================================================
-- ChatVenti · Fase 4 · Reservas Web: tienda de productos + RPCs públicas
--   organizations.web_slug / branding ya existen (baseline).
--   La web pública /r/[slug] y el widget son ANÓNIMOS -> lectura y reserva
--   entran por RPCs SECURITY DEFINER (patrón de los webhooks).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PRODUCTOS (tienda del negocio)
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  description     text,
  price           numeric(10,2),
  image_url       text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists products_org_idx on public.products(organization_id);

alter table public.products enable row level security;

drop policy if exists product_select on public.products;
create policy product_select on public.products for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
drop policy if exists product_write on public.products;
create policy product_write on public.products for all
  using ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin');

-- Índice para resolver la org por slug rápido (web_slug ya es UNIQUE en el baseline).
create index if not exists organizations_web_slug_idx on public.organizations(web_slug) where web_slug is not null;

-- ---------------------------------------------------------------------
-- 2. RPC get_public_booking_context(slug) — datos públicos de la web.
--    Solo devuelve algo si la org publicó su slug. Sin secretos.
-- ---------------------------------------------------------------------
create or replace function public.get_public_booking_context(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_org uuid; v_result jsonb;
begin
  select id into v_org from public.organizations where web_slug = p_slug limit 1;
  if v_org is null then return null; end if;

  select jsonb_build_object(
    'org', (select jsonb_build_object('name', o.name, 'branding', o.branding)
              from public.organizations o where o.id = v_org),
    'branch', (select jsonb_build_object('id', b.id, 'name', b.name, 'timezone', b.timezone)
                 from public.branches b where b.organization_id = v_org order by b.created_at limit 1),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes,
        'price', s.price, 'description', s.description) order by s.name)
      from public.service_catalogs s where s.organization_id = v_org and s.active), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'price', p.price,
        'image_url', p.image_url, 'description', p.description) order by p.name)
      from public.products p where p.organization_id = v_org and p.active), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. RPC create_public_appointment — reserva desde la web/widget (ANÓNIMO).
--    Resuelve org+sucursal por slug, upsert del cliente por teléfono y
--    delega en create_appointment (no-solapamiento + lock, source 'web').
--    create_appointment es authenticated-only para el REST, pero esta
--    función SECURITY DEFINER (owner admin) puede invocarla internamente.
-- ---------------------------------------------------------------------
create or replace function public.create_public_appointment(
  p_slug         text,
  p_service_ids  uuid[],
  p_starts_at    timestamptz,
  p_client_name  text,
  p_client_phone text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_org uuid; v_branch uuid; v_client uuid;
begin
  select o.id, b.id into v_org, v_branch
    from public.organizations o
    join public.branches b on b.organization_id = o.id
   where o.web_slug = p_slug
   order by b.created_at limit 1;
  if v_org is null then raise exception 'not_published'; end if;
  if v_branch is null then raise exception 'branch_not_found'; end if;

  if coalesce(trim(p_client_phone), '') = '' then
    raise exception 'phone_required';
  end if;

  insert into public.clients (organization_id, phone, name)
    values (v_org, trim(p_client_phone), nullif(trim(p_client_name), ''))
  on conflict (organization_id, phone)
    do update set name = coalesce(nullif(trim(p_client_name), ''), public.clients.name)
  returning id into v_client;

  return public.create_appointment(
    v_branch, p_service_ids, p_starts_at, v_client, null, 'web', null
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. GRANTS: públicas -> anon + authenticated.
-- ---------------------------------------------------------------------
revoke all on function public.get_public_booking_context(text) from public;
grant  execute on function public.get_public_booking_context(text) to anon, authenticated;

revoke all on function public.create_public_appointment(text, uuid[], timestamptz, text, text) from public;
grant  execute on function public.create_public_appointment(text, uuid[], timestamptz, text, text) to anon, authenticated;
