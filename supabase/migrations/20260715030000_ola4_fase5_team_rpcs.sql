-- =====================================================================
-- ChatVenti · Ola 4 · Fase 5 · Equipo: invitaciones y roles
--   org_seats_used · create_team_invitation · revoke_team_invitation ·
--   get_invitation_preview · accept_team_invitation ·
--   set_member_role · set_member_active
--
-- POR QUE RPCs Y NO ESCRITURA DIRECTA POR RLS:
--   `profiles` solo tiene la policy `profile_update_self`: HOY ningun owner
--   puede cambiar el rol ni desactivar a OTRO miembro. En vez de abrir una
--   policy de UPDATE sobre profiles (superficie amplia: cualquier columna,
--   cualquier fila de la org), se exponen RPCs `SECURITY DEFINER` acotadas
--   a lo justo y auditables. (Gotcha del PRP.)
--
-- MODELO DE ASIENTOS:
--   El plan base incluye al DUEÑO. `subscriptions.team_seats` son accesos
--   ADICIONALES ($19/mes cada uno, ADDON_TEAM_USD). Por tanto:
--     permitidos = 1 + team_seats
--     usados     = profiles activos de la org + invitaciones pendientes
--   Las pendientes cuentan: si no, invitar a 10 personas de golpe burlaria
--   el limite hasta que aceptasen.
--   El `super_admin` es de ChatVenti, no del tenant: nunca cuenta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ASIENTOS EN USO
-- ---------------------------------------------------------------------
create or replace function public.org_seats_used(p_org uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select
    (select count(*) from public.profiles p
      where p.organization_id = p_org and p.is_active and p.role <> 'super_admin')::int
    +
    (select count(*) from public.team_invitations i
      where i.organization_id = p_org and i.status = 'pending' and i.expires_at > now())::int
$$;

revoke execute on function public.org_seats_used(uuid) from anon, public;
grant  execute on function public.org_seats_used(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. CREAR INVITACION (solo el dueño)
--    Devuelve el token: la Server Action arma el enlace y manda el correo.
-- ---------------------------------------------------------------------
-- p_enforce_seats lo manda la Server Action con el valor de BILLING_ENFORCED:
-- esa bandera es una env var de Node, NO un GUC de Postgres, asi que la RPC no
-- puede leerla por su cuenta (current_setting devolveria null y el gate jamas
-- se aplicaria). Se pasa como parametro para que el limite se compruebe DENTRO
-- de la misma transaccion que inserta, sin ventana de carrera.
create or replace function public.create_team_invitation(
  p_email         text,
  p_role          text,
  p_scope         text default 'all',
  p_resource_id   uuid default null,
  p_enforce_seats boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid; v_seats int; v_used int; v_token uuid; v_id uuid; v_email text;
begin
  v_org := public.get_my_org();
  if v_org is null then raise exception 'no_organization'; end if;
  if public.get_my_role() <> 'owner' then
    raise exception 'forbidden: solo el dueño puede invitar' using errcode = '42501';
  end if;

  v_email := lower(btrim(p_email));
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'invalid_email'; end if;
  if p_role not in ('owner','manager','staff') then raise exception 'invalid_role'; end if;
  if p_scope not in ('all','own') then raise exception 'invalid_scope'; end if;

  -- Ya es miembro (por email): reinvitar no tiene sentido.
  if exists (
    select 1 from public.profiles p
     where p.organization_id = v_org and lower(coalesce(p.email,'')) = v_email
  ) then
    raise exception 'already_member';
  end if;

  -- El recurso a vincular debe ser de la org.
  if p_resource_id is not null and not exists (
    select 1 from public.resources r where r.id = p_resource_id and r.organization_id = v_org
  ) then
    raise exception 'resource_not_found';
  end if;

  -- Gate de asientos: solo con el cobro activado (rollout seguro, igual que
  -- el resto del gating; con BILLING_ENFORCED=false no se estorba a nadie).
  if p_enforce_seats then
    select coalesce(team_seats, 0) into v_seats from public.subscriptions where organization_id = v_org;
    v_used := public.org_seats_used(v_org);
    if v_used >= 1 + coalesce(v_seats, 0) then
      raise exception 'no_seats: sin accesos disponibles' using errcode = '23514';
    end if;
  end if;

  -- Reinvitar a un pendiente = renovar su token y su caducidad.
  update public.team_invitations
     set role = p_role, resource_scope = p_scope, resource_id = p_resource_id,
         token = gen_random_uuid(), expires_at = now() + interval '7 days',
         invited_by = auth.uid(), created_at = now()
   where organization_id = v_org and lower(email) = v_email and status = 'pending'
   returning id, token into v_id, v_token;

  if v_id is null then
    insert into public.team_invitations
        (organization_id, email, role, resource_scope, resource_id, invited_by)
      values (v_org, v_email, p_role, p_scope, p_resource_id, auth.uid())
      returning id, token into v_id, v_token;
  end if;

  return jsonb_build_object('id', v_id, 'token', v_token, 'email', v_email);
end $$;

revoke execute on function public.create_team_invitation(text, text, text, uuid, boolean) from anon, public;
grant  execute on function public.create_team_invitation(text, text, text, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 3. REVOCAR INVITACION
-- ---------------------------------------------------------------------
create or replace function public.revoke_team_invitation(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_org uuid;
begin
  v_org := public.get_my_org();
  if v_org is null or public.get_my_role() <> 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.team_invitations
     set status = 'revoked'
   where id = p_id and organization_id = v_org and status = 'pending';
end $$;

revoke execute on function public.revoke_team_invitation(uuid) from anon, public;
grant  execute on function public.revoke_team_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. VISTA PREVIA DE LA INVITACION (pantalla publica /invitacion/[token])
--    Anon a proposito: el invitado aun no tiene cuenta. Solo expone lo
--    minimo (nombre de la org, email, rol) y NUNCA el resto de la org.
--    El token es el secreto (patron de appointments.manage_token).
-- ---------------------------------------------------------------------
create or replace function public.get_invitation_preview(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_inv record; v_org_name text;
begin
  select * into v_inv from public.team_invitations where token = p_token;
  if v_inv is null then return jsonb_build_object('valid', false, 'reason', 'not_found'); end if;

  select name into v_org_name from public.organizations where id = v_inv.organization_id;

  if v_inv.status <> 'pending' then
    return jsonb_build_object('valid', false, 'reason', v_inv.status, 'org_name', v_org_name);
  end if;
  if v_inv.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired', 'org_name', v_org_name);
  end if;

  return jsonb_build_object(
    'valid', true,
    'org_name', v_org_name,
    'email', v_inv.email,
    'role', v_inv.role,
    -- ¿Existe ya una cuenta con ese email? Cambia el copy de la pantalla.
    'has_account', exists (select 1 from auth.users u where lower(u.email) = lower(v_inv.email))
  );
end $$;

revoke execute on function public.get_invitation_preview(uuid) from public;
grant  execute on function public.get_invitation_preview(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. ACEPTAR INVITACION
--    Camino DISTINTO al de create_organization_with_owner: crea el profile
--    SIN crear organizacion (aquella lanza 'already_onboarded' y no sirve).
-- ---------------------------------------------------------------------
create or replace function public.accept_team_invitation(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_inv record; v_uid uuid; v_email text; v_name text;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_inv from public.team_invitations where token = p_token for update;
  if v_inv is null then raise exception 'invitation_not_found'; end if;
  if v_inv.status <> 'pending' then raise exception 'invitation_not_pending'; end if;
  if v_inv.expires_at < now() then
    update public.team_invitations set status = 'expired' where id = v_inv.id;
    raise exception 'invitation_expired';
  end if;

  select u.email, coalesce(u.raw_user_meta_data->>'full_name', '')
    into v_email, v_name
    from auth.users u where u.id = v_uid;

  -- El invitado debe ser el dueño del email invitado: si no, cualquiera con
  -- el enlace se metería en la org ajena.
  if lower(coalesce(v_email, '')) <> lower(v_inv.email) then
    raise exception 'invitation_email_mismatch';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'already_member';
  end if;

  insert into public.profiles (id, email, full_name, role, organization_id, resource_scope, is_active)
  values (v_uid, v_email, nullif(v_name, ''), v_inv.role, v_inv.organization_id, v_inv.resource_scope, true);

  -- Vincular a su ficha de profesional, si la invitacion la traia.
  if v_inv.resource_id is not null then
    update public.resources
       set profile_id = v_uid
     where id = v_inv.resource_id and organization_id = v_inv.organization_id;
  end if;

  update public.team_invitations
     set status = 'accepted', accepted_at = now()
   where id = v_inv.id;

  return jsonb_build_object('organization_id', v_inv.organization_id, 'role', v_inv.role);
end $$;

revoke execute on function public.accept_team_invitation(uuid) from anon, public;
grant  execute on function public.accept_team_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. CAMBIAR ROL DE UN MIEMBRO (solo el dueño)
-- ---------------------------------------------------------------------
create or replace function public.set_member_role(
  p_profile_id  uuid,
  p_role        text,
  p_scope       text default 'all',
  p_resource_id uuid default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_org uuid;
begin
  v_org := public.get_my_org();
  if v_org is null or public.get_my_role() <> 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('owner','manager','staff') then raise exception 'invalid_role'; end if;
  if p_scope not in ('all','own') then raise exception 'invalid_scope'; end if;

  -- El dueño no puede degradarse a si mismo: la org se quedaria sin dueño y
  -- sin quien pueda pagar ni invitar.
  if p_profile_id = auth.uid() then raise exception 'cannot_change_own_role'; end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_profile_id and p.organization_id = v_org and p.role <> 'super_admin'
  ) then
    raise exception 'member_not_found';
  end if;

  update public.profiles
     set role = p_role, resource_scope = p_scope
   where id = p_profile_id and organization_id = v_org;

  -- Vinculo con su ficha de profesional (uno a uno, indice parcial).
  if p_resource_id is not null then
    update public.resources set profile_id = null
     where profile_id = p_profile_id and id <> p_resource_id;
    update public.resources set profile_id = p_profile_id
     where id = p_resource_id and organization_id = v_org;
  else
    update public.resources set profile_id = null where profile_id = p_profile_id;
  end if;
end $$;

revoke execute on function public.set_member_role(uuid, text, text, uuid) from anon, public;
grant  execute on function public.set_member_role(uuid, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. ACTIVAR / DESACTIVAR MIEMBRO (solo el dueño)
--    Desactivar = pierde el acceso (get_my_org sigue devolviendo la org,
--    pero la app comprueba is_active) y libera su asiento.
-- ---------------------------------------------------------------------
create or replace function public.set_member_active(p_profile_id uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_org uuid;
begin
  v_org := public.get_my_org();
  if v_org is null or public.get_my_role() <> 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_profile_id = auth.uid() then raise exception 'cannot_deactivate_self'; end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_profile_id and p.organization_id = v_org and p.role <> 'super_admin'
  ) then
    raise exception 'member_not_found';
  end if;

  update public.profiles set is_active = p_active
   where id = p_profile_id and organization_id = v_org;
end $$;

revoke execute on function public.set_member_active(uuid, boolean) from anon, public;
grant  execute on function public.set_member_active(uuid, boolean) to authenticated;
