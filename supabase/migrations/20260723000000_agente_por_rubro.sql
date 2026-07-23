-- =====================================================================
-- ChatVenti · Agente por tipo de negocio + Modelo administrado por SUPERADMIN
--   · organizations.business_type (rubro, para plantillas del agente)
--   · admin_list_agent_models / admin_set_agent_model (gated a super_admin)
--   Aditivo y seguro.
-- =====================================================================

-- 1. Rubro del negocio (peluqueria, dental, veterinaria, ...). Nullable: las
--    orgs existentes lo eligen luego en el módulo del Agente.
alter table public.organizations add column if not exists business_type text;

-- 2. SUPERADMIN: listar el modelo del agente por org (incluye orgs sin config,
--    con el default). SECURITY DEFINER, gated: sin super_admin => forbidden.
create or replace function public.admin_list_agent_models()
returns table (
  org_id uuid,
  org_name text,
  model text,
  enabled boolean
)
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  return query
    select o.id, o.name,
           coalesce(ac.model, 'openai/gpt-4o-mini') as model,
           coalesce(ac.enabled, false) as enabled
      from public.organizations o
      left join public.agent_configs ac on ac.organization_id = o.id
     order by o.created_at desc;
end;
$$;

-- 3. SUPERADMIN: fijar el modelo del agente de una org (crea la fila si falta).
create or replace function public.admin_set_agent_model(p_org uuid, p_model text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  if coalesce(trim(p_model), '') = '' then
    raise exception 'model_required';
  end if;
  insert into public.agent_configs (organization_id, model, updated_at)
    values (p_org, trim(p_model), now())
  on conflict (organization_id)
    do update set model = excluded.model, updated_at = now();
end;
$$;

revoke all on function public.admin_list_agent_models() from public;
revoke all on function public.admin_set_agent_model(uuid, text) from public;
grant execute on function public.admin_list_agent_models() to authenticated;
grant execute on function public.admin_set_agent_model(uuid, text) to authenticated;
