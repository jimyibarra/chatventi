-- =====================================================================
-- Marca nivel 3: la ventana de Meta (Embedded Signup de WhatsApp e inicio
-- de sesión para Facebook/Instagram) con la app del SOCIO en vez de la de
-- ChatVenti. Cada socio interno puede traer su propia app de Meta; sus
-- negocios la usan al conectar canales. Sin estas columnas, se usa la app
-- de ChatVenti como hasta hoy.
--
--   Secretos (app secret y token del System User) solo los lee service_role:
--   la tabla partners no tiene policies para sesiones. El panel /admin los
--   escribe por RPC y nunca los vuelve a mostrar (solo «configurado»).
-- =====================================================================

alter table public.partners
  add column if not exists meta_app_id            text,
  add column if not exists meta_app_secret        text,
  add column if not exists meta_config_id         text,
  add column if not exists meta_pages_config_id   text,
  add column if not exists meta_system_user_token text;
comment on column public.partners.meta_app_id is 'App de Meta del socio (nivel 3 de marca). null = usa la app de ChatVenti.';
comment on column public.partners.meta_config_id is 'Configuración del Embedded Signup de WhatsApp en la app del socio.';
comment on column public.partners.meta_pages_config_id is 'Configuración del inicio de sesión para empresas (páginas/Instagram) en la app del socio.';

-- Guardar la app de Meta de un socio. Un texto vacío borra el campo; null lo
-- deja como está (así el panel no obliga a reescribir los secretos).
create or replace function public.admin_set_partner_meta(
  p_id uuid,
  p_app_id text default null,
  p_app_secret text default null,
  p_config_id text default null,
  p_pages_config_id text default null,
  p_system_user_token text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  if p_app_id is not null and p_app_id <> '' and p_app_id !~ '^\d{5,20}$' then
    raise exception 'invalid_input';
  end if;
  update public.partners
     set meta_app_id            = case when p_app_id is null then meta_app_id when p_app_id = '' then null else trim(p_app_id) end,
         meta_app_secret        = case when p_app_secret is null then meta_app_secret when p_app_secret = '' then null else trim(p_app_secret) end,
         meta_config_id         = case when p_config_id is null then meta_config_id when p_config_id = '' then null else trim(p_config_id) end,
         meta_pages_config_id   = case when p_pages_config_id is null then meta_pages_config_id when p_pages_config_id = '' then null else trim(p_pages_config_id) end,
         meta_system_user_token = case when p_system_user_token is null then meta_system_user_token when p_system_user_token = '' then null else trim(p_system_user_token) end
   where id = p_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;
revoke execute on function public.admin_set_partner_meta(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.admin_set_partner_meta(uuid, text, text, text, text, text) to authenticated, service_role;

-- El listado del panel dice qué hay configurado, sin exponer secretos.
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
      'display_name', p.display_name, 'app_domain', p.app_domain,
      'webhook_url', p.webhook_url,
      'meta', jsonb_build_object(
        'app_id', p.meta_app_id,
        'config_id', p.meta_config_id,
        'pages_config_id', p.meta_pages_config_id,
        'has_secret', p.meta_app_secret is not null,
        'has_system_user_token', p.meta_system_user_token is not null
      ),
      'organizations', (select count(*) from public.organizations o where o.partner_id = p.id)
    ) order by p.created_at)
    from public.partners p
  ), '[]'::jsonb);
end;
$function$;
