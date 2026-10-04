-- =====================================================================
-- Cobro: días de gracia, aclaraciones de pago y plan real en /admin
-- (2026-10-04, GO de Juan). Todo ADITIVO; las guardas se reescriben con el
-- mismo cuerpo y solo dos cambios deliberados, marcados con «CAMBIO».
--
--   1. Días de gracia. Si una renovación no se cobra, Stripe pone la
--      suscripción en 'past_due' y reintenta. Hasta hoy eso bloqueaba el panel
--      y la recepcionista AL INSTANTE. Ahora hay 7 días de gracia desde que el
--      cobro falló (subscriptions.past_due_since, que mantiene un disparador:
--      no depende de que el webhook se acuerde).
--   2. consume_trial_ai_message decidía «está pagando» con el legado
--      ai_tier <> 'none'. Las suscripciones del catálogo 2026-08 tienen
--      plan_id y ai_tier = 'none': un negocio que PAGA contaba como prueba y
--      a las 300 respuestas su recepcionista se callaba. Ahora usa el mismo
--      criterio que org_has_ai (plan_id o ai_tier).
--   3. billing_inquiries: «Aclarar este pago» desde Facturación.
--   4. admin_org_billing: plan, periodicidad y moneda reales para /admin.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Desde cuándo está pendiente el pago.
-- ---------------------------------------------------------------------
alter table public.subscriptions add column if not exists past_due_since timestamptz;

create or replace function public.track_past_due()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Al salir de 'past_due' se borra; al entrar, se fecha una sola vez. Mientras
  -- sigue en 'past_due' se conserva la fecha original (los reintentos de Stripe
  -- no reinician la gracia).
  if new.status is distinct from 'past_due' then
    new.past_due_since := null;
  elsif new.past_due_since is null then
    new.past_due_since := now();
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_track_past_due on public.subscriptions;
create trigger subscriptions_track_past_due
  before insert or update on public.subscriptions
  for each row execute function public.track_past_due();

-- Quien ya estuviera en 'past_due' al aplicar esto arranca su gracia hoy.
update public.subscriptions set past_due_since = now() where status = 'past_due' and past_due_since is null;

-- ---------------------------------------------------------------------
-- Guardas. Condición de «al corriente» (la misma en las cuatro):
--   status trialing/active, O past_due con menos de 7 días.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_app_access()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org   uuid;
  v_trial timestamptz;
  v_sub   boolean;
begin
  select p.organization_id into v_org
    from public.profiles p
   where p.id = auth.uid();

  if v_org is null then
    return 'sin_org';
  end if;

  select o.trial_ends_at into v_trial
    from public.organizations o
   where o.id = v_org;

  select exists (
    select 1 from public.subscriptions s
     where s.organization_id = v_org
       -- CAMBIO: gracia de 7 días con el pago pendiente.
       and (s.status in ('trialing', 'active')
            or (s.status = 'past_due' and s.past_due_since > now() - interval '7 days'))
  ) into v_sub;

  if v_sub or (v_trial is not null and v_trial > now()) then
    return 'con_acceso';
  end if;

  return 'bloqueado';
end;
$function$;

CREATE OR REPLACE FUNCTION public.org_has_ai(p_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.subscriptions s
    where s.organization_id = p_org
      -- CAMBIO: gracia de 7 días con el pago pendiente.
      and (s.status in ('trialing','active')
           or (s.status = 'past_due' and s.past_due_since > now() - interval '7 days'))
      and (s.plan_id is not null or s.ai_tier <> 'none')
      and (s.current_period_end is null or s.current_period_end > now())
  )
  or exists (
    select 1 from public.organizations o
    where o.id = p_org
      and o.trial_ends_at is not null
      and o.trial_ends_at > now()
  );
$function$;

CREATE OR REPLACE FUNCTION public.org_is_active(p_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.subscriptions s
    where s.organization_id = p_org
      -- CAMBIO: gracia de 7 días con el pago pendiente.
      and (s.status in ('trialing','active')
           or (s.status = 'past_due' and s.past_due_since > now() - interval '7 days'))
      and (s.current_period_end is null or s.current_period_end > now())
  );
$function$;

CREATE OR REPLACE FUNCTION public.consume_trial_ai_message(p_org uuid, p_cap integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_used int;
  v_has_ai boolean;
  v_exempt boolean;
begin
  if p_org is null or coalesce(p_cap, 0) <= 0 then
    return jsonb_build_object('allowed', true, 'counted', false, 'reason', 'sin_datos');
  end if;

  select coalesce(ai_cap_exempt, false) into v_exempt
    from public.organizations where id = p_org;
  if coalesce(v_exempt, false) then
    return jsonb_build_object('allowed', true, 'counted', false, 'reason', 'exenta');
  end if;

  select exists (
    select 1 from public.subscriptions s
     where s.organization_id = p_org
       -- CAMBIO: gracia de 7 días con el pago pendiente.
       and (s.status in ('trialing','active')
            or (s.status = 'past_due' and s.past_due_since > now() - interval '7 days'))
       -- CAMBIO: «paga» = plan del catálogo actual O tier legado (antes solo
       -- el legado, y el catálogo nuevo tiene ai_tier = 'none').
       and (s.plan_id is not null or s.ai_tier <> 'none')
       and (s.current_period_end is null or s.current_period_end > now())
  ) into v_has_ai;

  if v_has_ai then
    return jsonb_build_object('allowed', true, 'counted', false, 'reason', 'suscripcion_vigente');
  end if;

  update public.organizations
     set trial_ai_messages_used = coalesce(trial_ai_messages_used, 0) + 1,
         trial_ai_capped_at = case
           when coalesce(trial_ai_messages_used, 0) + 1 > p_cap
                and trial_ai_capped_at is null then now()
           else trial_ai_capped_at
         end
   where id = p_org
   returning trial_ai_messages_used into v_used;

  if v_used is null then
    return jsonb_build_object('allowed', true, 'counted', false, 'reason', 'org_inexistente');
  end if;

  return jsonb_build_object('allowed', v_used <= p_cap, 'counted', true, 'used', v_used, 'cap', p_cap);
end;
$function$;

-- ---------------------------------------------------------------------
-- 3. Aclaraciones de pago. Las crea el servidor (tras comprobar que la
--    factura es del cliente de Stripe de la org); el dueño/gerente las lee.
-- ---------------------------------------------------------------------
create table if not exists public.billing_inquiries (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  created_by        uuid references auth.users(id) on delete set null,
  stripe_invoice_id text not null,
  invoice_number    text,
  amount            numeric(12, 2),
  currency          text,
  reason            text not null check (reason in ('duplicado', 'no_reconozco', 'monto', 'otro')),
  message           text not null check (char_length(message) between 1 and 1000),
  status            text not null default 'open' check (status in ('open', 'resolved')),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
create index if not exists billing_inquiries_org_idx on public.billing_inquiries (organization_id);
create index if not exists billing_inquiries_user_idx on public.billing_inquiries (created_by);

alter table public.billing_inquiries enable row level security;
drop policy if exists billing_inquiries_select on public.billing_inquiries;
create policy billing_inquiries_select on public.billing_inquiries
  for select using (
    organization_id = (select public.get_my_org())
    and (select public.get_my_role()) in ('owner', 'manager')
  );
revoke all on public.billing_inquiries from anon;
revoke insert, update, delete, truncate on public.billing_inquiries from authenticated;

create or replace function public.admin_list_billing_inquiries()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id, 'organization', o.name, 'contact_email', o.contact_email,
      'invoice_number', b.invoice_number, 'stripe_invoice_id', b.stripe_invoice_id,
      'amount', b.amount, 'currency', b.currency, 'reason', b.reason, 'message', b.message,
      'status', b.status, 'created_at', b.created_at, 'resolved_at', b.resolved_at
    ) order by b.status, b.created_at desc)
    from public.billing_inquiries b
    join public.organizations o on o.id = b.organization_id
    where b.status = 'open' or b.resolved_at > now() - interval '30 days'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_resolve_billing_inquiry(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  update public.billing_inquiries set status = 'resolved', resolved_at = now()
   where id = p_id and status = 'open';
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Plan real de cada negocio (admin_list_organizations solo trae el
--    ai_tier legado y devuelve TABLE: cambiarla obligaría a borrarla).
-- ---------------------------------------------------------------------
create or replace function public.admin_org_billing()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'organization_id', s.organization_id, 'plan_id', s.plan_id,
      'billing_interval', s.billing_interval, 'currency', s.currency,
      'status', s.status, 'past_due_since', s.past_due_since,
      'stripe', s.stripe_subscription_id is not null
    ))
    from public.subscriptions s
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.track_past_due() from public, anon, authenticated;
revoke execute on function public.admin_list_billing_inquiries() from public, anon;
revoke execute on function public.admin_resolve_billing_inquiry(uuid) from public, anon;
revoke execute on function public.admin_org_billing() from public, anon;
grant execute on function public.admin_list_billing_inquiries() to authenticated, service_role;
grant execute on function public.admin_resolve_billing_inquiry(uuid) to authenticated, service_role;
grant execute on function public.admin_org_billing() to authenticated, service_role;
