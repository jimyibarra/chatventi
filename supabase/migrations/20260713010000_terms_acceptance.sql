-- ---------------------------------------------------------------------
-- Click-wrap (2026-07-13): registro legal de aceptación de Términos.
-- Recomendación del abogado: guardar QUÉ versión aceptó el usuario y CUÁNDO.
-- El sello de tiempo lo pone el servidor (now()) — no se puede falsear desde
-- el cliente. Se extiende create_organization_with_owner con p_terms_version.
-- ---------------------------------------------------------------------

alter table public.profiles add column if not exists terms_version     text;
alter table public.profiles add column if not exists terms_accepted_at  timestamptz;

-- La firma anterior (6 args) quedaría como OVERLOAD ambiguo: tirarla antes.
drop function if exists public.create_organization_with_owner(text, text, text, text, text, text);

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

  insert into public.organizations (name, contact_email, country, city)
    values (trim(p_org_name), v_email, nullif(trim(p_country), ''), nullif(trim(p_city), ''))
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

revoke all on function public.create_organization_with_owner(text, text, text, text, text, text, text) from public;
revoke execute on function public.create_organization_with_owner(text, text, text, text, text, text, text) from anon;
grant execute on function public.create_organization_with_owner(text, text, text, text, text, text, text) to authenticated;
