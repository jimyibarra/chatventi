-- =====================================================================
-- Socios: editar, cambiar la clave y eliminar desde /admin/socios.
--
--   admin_update_partner      → nombre, correo de facturación y descuento.
--   admin_rotate_partner_key  → clave nueva; la anterior deja de servir al
--                               instante (solo se guarda la huella).
--   admin_delete_partner      → solo si el socio NO tiene negocios: así no se
--                               pierde historia de facturación. Con negocios,
--                               se suspende en vez de borrar.
--
--   Mismo patrón que admin_create_partner: SECURITY DEFINER con la guarda de
--   super_admin DENTRO; ejecutable por sesiones (authenticated), nunca anon.
-- =====================================================================

create or replace function public.admin_update_partner(
  p_id uuid, p_name text, p_billing_email text, p_discount_pct numeric
) returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  if coalesce(trim(p_name), '') = ''
     or coalesce(trim(p_billing_email), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or p_discount_pct is null or p_discount_pct < 0 or p_discount_pct > 100 then
    raise exception 'invalid_input';
  end if;
  update public.partners
     set name = trim(p_name),
         billing_email = lower(trim(p_billing_email)),
         discount_pct = p_discount_pct
   where id = p_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;

create or replace function public.admin_rotate_partner_key(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_key text;
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  v_key := 'cvp_' || encode(gen_random_bytes(24), 'hex');
  update public.partners
     set api_key_hash = encode(digest(v_key, 'sha256'), 'hex'),
         api_key_prefix = left(v_key, 12)
   where id = p_id;
  if not found then raise exception 'not_found'; end if;
  -- La clave completa sale UNA vez, aquí.
  return jsonb_build_object('api_key', v_key);
end;
$$;

create or replace function public.admin_delete_partner(p_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  if exists (select 1 from public.organizations where partner_id = p_id) then
    raise exception 'has_organizations';
  end if;
  delete from public.partners where id = p_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;

revoke execute on function public.admin_update_partner(uuid, text, text, numeric) from public, anon;
revoke execute on function public.admin_rotate_partner_key(uuid) from public, anon;
revoke execute on function public.admin_delete_partner(uuid) from public, anon;
grant execute on function public.admin_update_partner(uuid, text, text, numeric) to authenticated, service_role;
grant execute on function public.admin_rotate_partner_key(uuid) to authenticated, service_role;
grant execute on function public.admin_delete_partner(uuid) to authenticated, service_role;
