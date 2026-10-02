-- =====================================================================
-- Fase 5: socios (revendedores) — PASEN es el primero.
--
--   Un socio da de alta negocios en ChatVenti por API con una clave, sin que
--   el dueño pase por el registro, y ChatVenti le factura AL SOCIO el plan y
--   el uso de IA de esos negocios. El socio cobra a sus clientes como quiera.
--
--   Cómo tiene acceso un negocio de socio sin pagar con tarjeta: se le crea
--   una fila en `subscriptions` con status 'active' y sin ids de Stripe
--   ("administrada por el socio"). Las guardas existentes (my_app_access,
--   org_has_ai, org_is_active) ya la aceptan: NO se toca ninguna guarda.
-- =====================================================================

create table if not exists public.partners (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  billing_email   text not null,
  -- La clave solo se muestra una vez, al crearla. Aquí vive su huella.
  api_key_hash    text not null unique,
  api_key_prefix  text not null,
  -- Descuento de mayoreo sobre el precio de lista del plan (0–100).
  discount_pct    numeric(5, 2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  stripe_customer_id text,
  status          text not null default 'active' check (status in ('active', 'suspended')),
  created_at      timestamptz not null default now()
);

-- Solo el servidor. Sin policies: ninguna sesión de usuario lee ni escribe.
alter table public.partners enable row level security;
revoke all on public.partners from anon, authenticated;

alter table public.organizations
  add column if not exists partner_id uuid references public.partners(id) on delete set null,
  -- Identificador del negocio en el sistema del socio (su "tenant").
  add column if not exists partner_ref text;

-- Único por socio (idempotencia del alta) y, de paso, índice de la FK.
create unique index if not exists organizations_partner_ref_key
  on public.organizations (partner_id, partner_ref) where partner_id is not null;

-- ---------------------------------------------------------------------
-- Alta de un negocio por cuenta de un socio. Solo service_role: la clave del
-- socio se valida en el servidor ANTES de llegar aquí.
-- ---------------------------------------------------------------------
create or replace function public.partner_create_organization(
  p_partner uuid,
  p_user uuid,
  p_partner_ref text,
  p_org_name text,
  p_plan text,
  p_web_slug text,
  p_owner_name text default null,
  p_business_type text default null,
  p_country text default null,
  p_city text default null,
  p_phone text default null
)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_partner public.partners%rowtype;
  v_email  text;
  v_org    uuid;
  v_branch uuid;
begin
  select * into v_partner from public.partners where id = p_partner;
  if v_partner.id is null or v_partner.status <> 'active' then
    raise exception 'partner_inactive';
  end if;
  if coalesce(trim(p_org_name), '') = '' or coalesce(trim(p_partner_ref), '') = '' then
    raise exception 'invalid_input';
  end if;
  if p_plan not in ('arranque', 'negocio', 'profesional', 'multisede') then
    raise exception 'invalid_plan';
  end if;

  select email into v_email from auth.users where id = p_user;
  if v_email is null then raise exception 'user_not_found'; end if;
  if exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user_already_onboarded';
  end if;

  insert into public.organizations (
    name, contact_email, country, city, business_type, phone,
    web_slug, partner_id, partner_ref, signup_ref
  )
  values (
    trim(p_org_name), v_email,
    nullif(trim(p_country), ''), nullif(trim(p_city), ''),
    nullif(trim(p_business_type), ''), nullif(trim(p_phone), ''),
    p_web_slug, p_partner, trim(p_partner_ref), 'socio'
  )
  returning id into v_org;

  insert into public.branches (organization_id, name)
    values (v_org, 'Principal')
    returning id into v_branch;

  insert into public.profiles (
    id, email, email_canonical, full_name, role, organization_id, assigned_branch_id, phone
  )
  values (
    p_user, v_email, public.canonical_email(v_email),
    nullif(trim(p_owner_name), ''), 'owner', v_org, v_branch, nullif(trim(p_phone), '')
  );

  -- Suscripción administrada por el socio: activa, sin Stripe.
  insert into public.subscriptions (organization_id, status, plan_id, billing_interval)
    values (v_org, 'active', p_plan, 'month');

  return v_org;
end;
$function$;

revoke execute on function public.partner_create_organization(uuid, uuid, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.partner_create_organization(uuid, uuid, text, text, text, text, text, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------
-- Administración de socios (solo super_admin; la guarda va DENTRO).
-- ---------------------------------------------------------------------
create or replace function public.admin_create_partner(p_name text, p_billing_email text, p_discount_pct numeric default 0)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_key text;
  v_id  uuid;
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_billing_email), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_input';
  end if;

  v_key := 'cvp_' || encode(gen_random_bytes(24), 'hex');
  insert into public.partners (name, billing_email, discount_pct, api_key_hash, api_key_prefix)
  values (
    trim(p_name), lower(trim(p_billing_email)), coalesce(p_discount_pct, 0),
    encode(digest(v_key, 'sha256'), 'hex'), left(v_key, 12)
  )
  returning id into v_id;

  -- La clave completa sale UNA vez, aquí. No se puede recuperar después.
  return jsonb_build_object('id', v_id, 'api_key', v_key);
end;
$function$;

create or replace function public.admin_list_partners()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'billing_email', p.billing_email,
      'api_key_prefix', p.api_key_prefix, 'discount_pct', p.discount_pct,
      'status', p.status, 'created_at', p.created_at,
      'organizations', (select count(*) from public.organizations o where o.partner_id = p.id)
    ) order by p.created_at)
    from public.partners p
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.admin_set_partner_status(p_id uuid, p_status text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  if p_status not in ('active', 'suspended') then raise exception 'invalid_input'; end if;
  update public.partners set status = p_status where id = p_id;
end;
$function$;

-- Las admin_* llevan su guarda dentro y las llama la sesión del superadmin:
-- se cierran a anon (no tiene nada que hacer aquí) y se dejan a authenticated.
revoke execute on function public.admin_create_partner(text, text, numeric) from public, anon;
revoke execute on function public.admin_list_partners() from public, anon;
revoke execute on function public.admin_set_partner_status(uuid, text) from public, anon;
grant execute on function public.admin_create_partner(text, text, numeric) to authenticated;
grant execute on function public.admin_list_partners() to authenticated;
grant execute on function public.admin_set_partner_status(uuid, text) to authenticated;
