-- =====================================================================
-- Socios internos (2026-10-04).
--
--   Grupo ELRI es dueño de ChatVenti, PASEN, SastrePro y ContaCero: entre
--   ellas no hay venta ni factura (una empresa no se cobra a sí misma). PASEN
--   vende ChatVenti dentro de su paquete y le cobra al cliente; ChatVenti solo
--   da el acceso y mide el consumo de IA.
--
--   partners.kind:
--     'external' → otra empresa: se le factura el plan con descuento + el
--                  excedente cada mes (lo de siempre; es el valor por defecto).
--     'internal' → plataforma de Grupo ELRI: el cierre mensual NO le factura.
--
--   Aditiva: columna nueva con default, dos funciones nuevas y
--   admin_list_partners con la misma firma (solo suma el campo `kind`).
-- =====================================================================

alter table public.partners
  add column if not exists kind text not null default 'external'
  check (kind in ('external', 'internal'));

create or replace function public.admin_set_partner_kind(p_id uuid, p_kind text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  if p_kind not in ('external', 'internal') then
    raise exception 'invalid_input';
  end if;
  update public.partners set kind = p_kind where id = p_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;

create or replace function public.admin_list_partners()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'billing_email', p.billing_email,
      'api_key_prefix', p.api_key_prefix, 'discount_pct', p.discount_pct,
      'status', p.status, 'created_at', p.created_at, 'kind', p.kind,
      'organizations', (select count(*) from public.organizations o where o.partner_id = p.id)
    ) order by p.created_at)
    from public.partners p
  ), '[]'::jsonb);
end;
$function$;

-- Qué negocios llegaron por un socio, para las vistas de /admin: los de un
-- socio interno no son ingreso de ChatVenti (los cobra la otra plataforma).
create or replace function public.admin_partner_orgs()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'organization_id', o.id, 'partner_name', p.name, 'partner_kind', p.kind
    ))
    from public.organizations o
    join public.partners p on p.id = o.partner_id
  ), '[]'::jsonb);
end;
$$;

-- Mismo patrón que el resto de admin_*: guarda DENTRO, nunca anon.
revoke execute on function public.admin_set_partner_kind(uuid, text) from public, anon;
revoke execute on function public.admin_partner_orgs() from public, anon;
grant execute on function public.admin_set_partner_kind(uuid, text) to authenticated, service_role;
grant execute on function public.admin_partner_orgs() to authenticated, service_role;
