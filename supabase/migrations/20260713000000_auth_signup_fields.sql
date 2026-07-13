-- ---------------------------------------------------------------------
-- Rediseño auth (2026-07-13): el registro pide país/ciudad del negocio y
-- teléfono del dueño. Se extiende create_organization_with_owner.
-- ---------------------------------------------------------------------

alter table public.organizations add column if not exists country text;
alter table public.organizations add column if not exists city    text;
alter table public.profiles      add column if not exists phone   text;

-- Postgres trataría la nueva firma como OVERLOAD (llamadas ambiguas):
-- hay que tirar la firma vieja antes de crear la extendida.
drop function if exists public.create_organization_with_owner(text, text, text);

create or replace function public.create_organization_with_owner(
  p_org_name    text,
  p_owner_name  text default null,
  p_branch_name text default 'Principal',
  p_country     text default null,
  p_city        text default null,
  p_phone       text default null
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

  insert into public.profiles (id, email, full_name, role, organization_id, assigned_branch_id, phone)
    values (v_uid, v_email, nullif(trim(p_owner_name), ''), 'owner', v_org, v_branch, nullif(trim(p_phone), ''));

  return v_org;
end;
$$;

revoke all on function public.create_organization_with_owner(text, text, text, text, text, text) from public;
revoke execute on function public.create_organization_with_owner(text, text, text, text, text, text) from anon;
grant execute on function public.create_organization_with_owner(text, text, text, text, text, text) to authenticated;
