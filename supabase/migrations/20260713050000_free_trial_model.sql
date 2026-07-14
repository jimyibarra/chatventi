-- ---------------------------------------------------------------------
-- Modelo de prueba GRATIS sin tarjeta (2026-07-13).
--   · Trial de 10 días desde el registro (sin Stripe, sin tarjeta).
--   · Al terminar: acceso bloqueado; datos conservados hasta el día 30.
--   · Día 30 sin compra: se borran los DATOS OPERATIVOS del negocio, se
--     conserva la CUENTA del dueño (sin nuevo periodo de prueba).
-- ---------------------------------------------------------------------

alter table public.organizations add column if not exists trial_ends_at        timestamptz;
alter table public.organizations add column if not exists delete_scheduled_at  timestamptz;
alter table public.organizations add column if not exists data_deleted_at      timestamptz;
alter table public.organizations add column if not exists trial_ending_email_sent_at   timestamptz;
alter table public.organizations add column if not exists trial_ended_email_sent_at    timestamptz;
alter table public.organizations add column if not exists deletion_warning_email_sent_at timestamptz;

-- El registro arranca el trial de 10 días. Se extiende la firma existente.
drop function if exists public.create_organization_with_owner(text, text, text, text, text, text, text);

create or replace function public.create_organization_with_owner(
  p_org_name      text,
  p_owner_name    text default null,
  p_branch_name   text default 'Principal',
  p_country       text default null,
  p_city          text default null,
  p_phone         text default null,
  p_terms_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_org    uuid;
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

  -- trial_ends_at = 10 días (mantener sincronizado con TRIAL_DAYS en plans.ts).
  insert into public.organizations (name, contact_email, country, city, trial_ends_at)
    values (trim(p_org_name), v_email, nullif(trim(p_country), ''), nullif(trim(p_city), ''),
            now() + interval '10 days')
    returning id into v_org;

  insert into public.branches (organization_id, name)
    values (v_org, coalesce(nullif(trim(p_branch_name), ''), 'Principal'))
    returning id into v_branch;

  insert into public.profiles (
    id, email, full_name, role, organization_id, assigned_branch_id, phone,
    terms_version, terms_accepted_at
  )
  values (
    v_uid, v_email, nullif(trim(p_owner_name), ''), 'owner', v_org, v_branch,
    nullif(trim(p_phone), ''),
    nullif(trim(p_terms_version), ''),
    case when nullif(trim(p_terms_version), '') is not null then now() end
  );

  return v_org;
end;
$$;

revoke all on function public.create_organization_with_owner(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_organization_with_owner(text, text, text, text, text, text, text) to authenticated;

-- Borra los DATOS OPERATIVOS de una org, conservando la cuenta (organizations
-- shell, branches, profiles, auth). Idempotente. SECURITY DEFINER + solo la
-- ejecuta el service_role (cron); revocada a anon/authenticated.
create or replace function public.wipe_organization_business_data(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.appointment_services where appointment_id in
    (select id from public.appointments where organization_id = p_org);
  delete from public.appointments   where organization_id = p_org;
  delete from public.messages where conversation_id in
    (select id from public.conversations where organization_id = p_org);
  delete from public.ai_approvals   where organization_id = p_org;
  delete from public.conversations  where organization_id = p_org;
  delete from public.client_tags where client_id in
    (select id from public.clients where organization_id = p_org);
  delete from public.clients        where organization_id = p_org;
  delete from public.tags           where organization_id = p_org;
  delete from public.service_catalogs where organization_id = p_org;
  delete from public.business_hours where branch_id in
    (select id from public.branches where organization_id = p_org);
  delete from public.staff_schedules where branch_id in
    (select id from public.branches where organization_id = p_org);
  delete from public.staff_time_off where staff_id in
    (select id from public.profiles where organization_id = p_org);
  delete from public.channels       where organization_id = p_org;
  delete from public.agent_configs  where organization_id = p_org;
  delete from public.knowledge_base where organization_id = p_org;
  delete from public.products       where organization_id = p_org;

  update public.organizations set data_deleted_at = now() where id = p_org;
end;
$$;

revoke all on function public.wipe_organization_business_data(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------
-- Backfill: las orgs EXISTENTES no deben bloquearse ni borrarse de golpe.
-- Se les da un trial fresco de 10 días desde ahora y se marcan los correos
-- del funnel como ya avisados (sin envíos retroactivos). La org demo de la
-- landing nunca expira.
-- ------------------------------------------------------------------
update public.organizations
   set trial_ends_at = coalesce(trial_ends_at, now() + interval '10 days'),
       trial_ending_email_sent_at    = coalesce(trial_ending_email_sent_at, now()),
       trial_ended_email_sent_at     = coalesce(trial_ended_email_sent_at, now()),
       deletion_warning_email_sent_at = coalesce(deletion_warning_email_sent_at, now());

update public.organizations
   set trial_ends_at = timestamptz '2099-01-01'
 where id = '12974a7a-fb18-4713-9d2c-28c251b09312'; -- org demo de la landing
