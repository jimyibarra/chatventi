-- =====================================================================
-- ChatVenti · Fase 7 · Billing por software (Stripe)
--   Suscripción por organización: base "Starter" + módulo opcional
--   "Recepcionista IA" por volumen (tiers fijos) + add-ons.
--   El estado lo escribe SOLO el webhook de Stripe (service_role, bypassa
--   RLS). La organización LEE su propia fila por RLS. Gating en la app.
-- =====================================================================

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null unique references public.organizations(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  status                 text not null default 'none'
                           check (status in ('none','trialing','active','past_due','canceled','incomplete','unpaid')),
  plan                   text not null default 'starter',
  ai_tier                text not null default 'none'
                           check (ai_tier in ('none','300','1000','3000')),
  has_domain             boolean not null default false,
  team_seats             int not null default 0,
  current_period_end     timestamptz,
  trial_end              timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists subscriptions_org_idx on public.subscriptions(organization_id);
create index if not exists subscriptions_stripe_sub_idx on public.subscriptions(stripe_subscription_id);

alter table public.subscriptions enable row level security;

-- La org LEE su propia suscripción (owner/manager); super_admin ve todo.
drop policy if exists sub_select on public.subscriptions;
create policy sub_select on public.subscriptions for select
  using (
    public.get_my_role() = 'super_admin'
    or (organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager'))
  );
-- SIN políticas de INSERT/UPDATE/DELETE: nadie escribe por RLS. El webhook
-- de Stripe usa service_role (bypassa RLS). Así un cliente no puede
-- auto-otorgarse acceso escribiendo su propia fila.

-- ---------------------------------------------------------------------
-- Helpers de gating (SECURITY DEFINER). Devuelven solo boolean.
-- ---------------------------------------------------------------------
-- ¿La org tiene acceso vigente? (en trial o activa)
create or replace function public.org_is_active(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.organization_id = p_org
      and s.status in ('trialing','active')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

-- ¿Tiene el módulo de Recepcionista IA activo? (para gating del agente)
create or replace function public.org_has_ai(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.organization_id = p_org
      and s.status in ('trialing','active')
      and s.ai_tier <> 'none'
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

-- Blindaje de grants (patrón firme de fases previas: revocar anon salvo
-- que un webhook/chat lo necesite; aquí el agente consulta con service_role).
revoke execute on function public.org_is_active(uuid) from anon, public;
revoke execute on function public.org_has_ai(uuid)   from anon, public;
grant  execute on function public.org_is_active(uuid) to authenticated, service_role;
grant  execute on function public.org_has_ai(uuid)   to authenticated, service_role;
