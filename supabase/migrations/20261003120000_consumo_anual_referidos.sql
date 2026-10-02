-- =====================================================================
-- Fase 4: consumo medido, plan anual y referidos. Todo ADITIVO.
--
--   QUÉ SE MIDE Y QUÉ SE COBRA
--   Se cuenta el uso de IA (respuestas de la recepcionista), que es servicio
--   de ChatVenti. Los mensajes de WhatsApp NO se cobran ni se revenden: los
--   términos de Tech Provider de Meta (31-jul-2026, "No Resale") prohíben
--   cobrar al cliente por el uso de la plataforma de WhatsApp; eso se lo
--   factura Meta a cada negocio.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Consumo por organización y mes.
--    El contador lo lleva un disparador sobre `messages`, no la aplicación:
--    no añade nada al camino del agente, no depende de que el código "se
--    acuerde" de contar, y el inquilino no puede bajarlo (borrar mensajes no
--    resta; la tabla no tiene escritura para sesiones de usuario).
-- ---------------------------------------------------------------------
create table if not exists public.usage_periods (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start    date not null,               -- primer día del mes (UTC)
  ai_replies      integer not null default 0,
  status          text not null default 'open'
                  check (status in ('open', 'closing', 'closed', 'charged')),
  -- Foto del cierre: con qué plan y qué importes se cerró el mes.
  plan_id         text,
  included_replies integer,
  extra_replies   integer,
  charge_usd      numeric(10, 2),
  billed_customer text,                         -- customer de Stripe al que se cargó
  stripe_invoice_item_id text,
  closed_at       timestamptz,
  primary key (organization_id, period_start)
);

alter table public.usage_periods enable row level security;

drop policy if exists usage_select on public.usage_periods;
create policy usage_select on public.usage_periods
  for select using (
    organization_id = (select public.get_my_org())
    and (select public.get_my_role()) in ('owner', 'manager')
  );

revoke insert, update, delete, truncate on public.usage_periods from anon, authenticated;

create or replace function public.count_ai_reply()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.usage_periods (organization_id, period_start, ai_replies)
  values (new.organization_id, date_trunc('month', now() at time zone 'utc')::date, 1)
  on conflict (organization_id, period_start)
  do update set ai_replies = public.usage_periods.ai_replies + 1;
  return null;
end;
$function$;

revoke execute on function public.count_ai_reply() from public, anon, authenticated;

drop trigger if exists messages_count_ai_reply on public.messages;
create trigger messages_count_ai_reply
  after insert on public.messages
  for each row when (new.sender = 'ai')
  execute function public.count_ai_reply();

-- Arranque del contador con lo ya ocurrido en el mes en curso.
insert into public.usage_periods (organization_id, period_start, ai_replies)
select m.organization_id, date_trunc('month', now() at time zone 'utc')::date, count(*)
  from public.messages m
 where m.sender = 'ai'
   and m.created_at >= date_trunc('month', now() at time zone 'utc')
 group by 1
on conflict (organization_id, period_start) do nothing;

-- ---------------------------------------------------------------------
-- 2. Plan anual: la suscripción recuerda su periodicidad.
-- ---------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists billing_interval text not null default 'month'
  check (billing_interval in ('month', 'year'));

-- ---------------------------------------------------------------------
-- 3. Referidos y procedencia del alta.
--    Columnas nuevas en una tabla con permisos por columna: nacen SIN
--    permiso de escritura para sesiones de usuario, que es lo que se quiere
--    (nadie debe poder asignarse quién lo recomendó).
-- ---------------------------------------------------------------------
alter table public.organizations
  add column if not exists referral_code text
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  add column if not exists referred_by uuid references public.organizations(id) on delete set null,
  add column if not exists signup_ref text;

create unique index if not exists organizations_referral_code_key
  on public.organizations (referral_code);
create index if not exists organizations_referred_by_idx
  on public.organizations (referred_by) where referred_by is not null;

create table if not exists public.referral_rewards (
  id            uuid primary key default gen_random_uuid(),
  referrer_org  uuid not null references public.organizations(id) on delete cascade,
  -- Una recompensa por negocio recomendado, pase lo que pase.
  referred_org  uuid not null unique references public.organizations(id) on delete cascade,
  amount_cents  integer,
  status        text not null default 'pending'
                check (status in ('pending', 'crediting', 'credited', 'skipped')),
  stripe_txn_id text,
  created_at    timestamptz not null default now(),
  credited_at   timestamptz
);

create index if not exists referral_rewards_referrer_idx on public.referral_rewards (referrer_org);

alter table public.referral_rewards enable row level security;

drop policy if exists referral_select on public.referral_rewards;
create policy referral_select on public.referral_rewards
  for select using (
    referrer_org = (select public.get_my_org())
    and (select public.get_my_role()) in ('owner', 'manager')
  );

revoke insert, update, delete, truncate on public.referral_rewards from anon, authenticated;

-- Ninguna de las dos tablas tiene nada que ofrecer a un visitante anónimo.
revoke all on public.usage_periods, public.referral_rewards from anon;
