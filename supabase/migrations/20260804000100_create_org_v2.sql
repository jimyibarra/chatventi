-- =====================================================================
-- ChatVenti · Registro corto · FASE 3
--
-- create_organization_with_owner_V2: la usa el asistente /bienvenida.
-- Añade sobre la v1:
--   · p_business_type  → organizations.business_type (antes se elegía en el
--     alta y se PERDÍA: vivía en user_metadata y nunca se persistía)
--   · p_signup_ip / p_user_agent → huella del alta en el perfil
--   · email_canonical sellado en el perfil (lo exige el índice único)
--
-- 🔴 La v1 NO se toca ni se dropea. Regla de CLAUDE.md (2026-07-23): antes
-- de dropear una función hay que buscar quién la llama POR SU NOMBRE, y
-- Postgres no registra las llamadas dentro de cuerpos plpgsql como
-- dependencias — un drop "verde" no prueba nada. La v1 queda viva mientras
-- puedan existir sesiones o despliegues antiguos apuntando a ella; se retira
-- en una fase CONTRACT posterior, con producción sana.
-- =====================================================================

create or replace function public.create_organization_with_owner_v2(
  p_org_name       text,
  p_owner_name     text default null,
  p_business_type  text default null,
  p_country        text default null,
  p_city           text default null,
  p_phone          text default null,
  p_terms_version  text default null,
  p_signup_ip      text default null,
  p_user_agent     text default null,
  p_branch_name    text default 'Principal'
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
  insert into public.organizations (
    name, contact_email, country, city, business_type, trial_ends_at
  )
  values (
    trim(p_org_name), v_email,
    nullif(trim(p_country), ''), nullif(trim(p_city), ''),
    nullif(trim(p_business_type), ''),
    now() + interval '10 days'
  )
  returning id into v_org;

  insert into public.branches (organization_id, name)
    values (v_org, coalesce(nullif(trim(p_branch_name), ''), 'Principal'))
    returning id into v_branch;

  insert into public.profiles (
    id, email, email_canonical, full_name, role, organization_id,
    assigned_branch_id, phone, terms_version, terms_accepted_at,
    signup_ip, signup_user_agent
  )
  values (
    v_uid, v_email, public.canonical_email(v_email),
    nullif(trim(p_owner_name), ''), 'owner', v_org, v_branch,
    nullif(trim(p_phone), ''),
    nullif(trim(p_terms_version), ''),
    -- Sello de tiempo del SERVIDOR: el cliente no puede falsearlo.
    case when nullif(trim(p_terms_version), '') is not null then now() end,
    nullif(trim(p_signup_ip), ''),
    nullif(trim(p_user_agent), '')
  );

  return v_org;
end;
$$;

revoke all on function public.create_organization_with_owner_v2(
  text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_organization_with_owner_v2(
  text, text, text, text, text, text, text, text, text, text) to authenticated;
