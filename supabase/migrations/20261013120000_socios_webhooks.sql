-- =====================================================================
-- API de socios v2: avisos salientes (webhooks) cuando se crea o cambia
-- una cita de un negocio del socio.
--
--   · partners.webhook_url / webhook_secret: un endpoint por socio. El
--     secreto firma cada entrega (HMAC-SHA256); se genera en la API y se
--     muestra una vez. La tabla partners solo la lee service_role.
--   · partner_webhook_deliveries: cola con reintentos. Cada fila es UNA
--     entrega pendiente; el despachador (/api/cron/partner-webhooks) arma el
--     cuerpo al momento de enviar, con el estado ACTUAL de la cita.
--   · Disparador en appointments: encola y despierta al despachador con
--     pg_net (misma receta que el cron de recordatorios). Si pg_net falla,
--     la cita se guarda igual y la corrida de cada 15 min recoge lo pendiente.
-- =====================================================================

alter table public.partners
  add column if not exists webhook_url        text,
  add column if not exists webhook_secret     text,
  add column if not exists webhook_created_at timestamptz;
comment on column public.partners.webhook_url is 'Endpoint https del socio para avisos de citas. null = sin webhooks.';
comment on column public.partners.webhook_secret is 'Secreto HMAC-SHA256 de las entregas (cvw_…). Solo service_role lo lee.';

create table if not exists public.partner_webhook_deliveries (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid not null references public.partners(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  event           text not null,
  -- Sin FK: una cita borrada se sigue pudiendo reportar como cancelada.
  appointment_id  uuid,
  payload         jsonb,
  attempts        int not null default 0,
  next_attempt_at timestamptz not null default now(),
  delivered_at    timestamptz,
  last_status     int,
  last_error      text,
  created_at      timestamptz not null default now()
);
create index if not exists partner_webhook_deliveries_pending_idx
  on public.partner_webhook_deliveries (next_attempt_at) where delivered_at is null;
create index if not exists partner_webhook_deliveries_partner_idx
  on public.partner_webhook_deliveries (partner_id, created_at desc);

alter table public.partner_webhook_deliveries enable row level security;
revoke all on table public.partner_webhook_deliveries from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Despertar al despachador. Nunca falla hacia afuera: un problema de red o
-- de Vault no debe impedir que se guarde una cita.
-- ---------------------------------------------------------------------
create or replace function public.kick_partner_webhooks()
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_secret is null then return; end if;
  perform net.http_get(
    url := 'https://www.chatventi.com/api/cron/partner-webhooks',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 25000
  );
exception when others then
  raise warning 'kick_partner_webhooks: %', sqlerrm;
end;
$$;
revoke execute on function public.kick_partner_webhooks() from public, anon, authenticated;
grant execute on function public.kick_partner_webhooks() to service_role;

-- ---------------------------------------------------------------------
-- Encolar al crear o cambiar una cita de un negocio con socio con webhook.
-- Cambios que cuentan: estado, fecha/hora y profesional.
-- ---------------------------------------------------------------------
create or replace function public.enqueue_partner_appointment_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_partner uuid;
  v_url     text;
  v_event   text;
begin
  select o.partner_id into v_partner from public.organizations o where o.id = new.organization_id;
  if v_partner is null then return new; end if;
  select p.webhook_url into v_url from public.partners p where p.id = v_partner and p.status = 'active';
  if v_url is null then return new; end if;

  if tg_op = 'INSERT' then
    v_event := 'appointment.created';
  elsif new.status is distinct from old.status and new.status = 'cancelled' then
    v_event := 'appointment.cancelled';
  elsif new.status is distinct from old.status
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.resource_id is distinct from old.resource_id then
    v_event := 'appointment.updated';
  else
    return new;
  end if;

  insert into public.partner_webhook_deliveries (partner_id, organization_id, event, appointment_id)
  values (v_partner, new.organization_id, v_event, new.id);
  perform public.kick_partner_webhooks();
  return new;
end;
$$;

drop trigger if exists appointments_partner_webhook on public.appointments;
create trigger appointments_partner_webhook
  after insert or update of status, starts_at, ends_at, resource_id on public.appointments
  for each row execute function public.enqueue_partner_appointment_event();

-- ---------------------------------------------------------------------
-- Reclamar entregas pendientes (el despachador puede correr dos veces a la
-- vez: la del kick y la del cron). skip locked evita entregas dobles.
-- Espera entre intentos: 1 min, 5 min, 30 min, 2 h, 12 h; a los 6 se rinde.
-- ---------------------------------------------------------------------
create or replace function public.claim_partner_webhook_deliveries(p_limit int default 25)
returns setof public.partner_webhook_deliveries
language sql security definer set search_path = public
as $$
  update public.partner_webhook_deliveries d
     set attempts = d.attempts + 1,
         next_attempt_at = now() + case d.attempts
           when 0 then interval '1 minute'
           when 1 then interval '5 minutes'
           when 2 then interval '30 minutes'
           when 3 then interval '2 hours'
           else interval '12 hours' end
   where d.id in (
     select id from public.partner_webhook_deliveries
      where delivered_at is null and attempts < 6 and next_attempt_at <= now()
      order by created_at
      limit greatest(1, least(coalesce(p_limit, 25), 200))
      for update skip locked
   )
  returning d.*;
$$;
revoke execute on function public.claim_partner_webhook_deliveries(int) from public, anon, authenticated;
grant execute on function public.claim_partner_webhook_deliveries(int) to service_role;
