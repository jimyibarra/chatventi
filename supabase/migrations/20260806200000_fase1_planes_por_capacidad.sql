-- =====================================================================
-- Fase 1 · Reprecificación por capacidad (expand, sin contract)
--   APLICADA en producción el 2026-08-06 vía MCP (apply_migration).
--   Contexto: desde oct-2026 Meta cobra los mensajes de servicio. El catálogo
--   pasa de bolsas de conversaciones (ai_tier) a 4 planes por capacidad con
--   crédito de uso. `ai_tier` NO se toca: convive (contract posterior).
--   Verificado tras aplicar: 2 subs backfilleadas a 'profesional', 0 sin plan,
--   org_has_ai true para org con sub y false para uuid inexistente, anon sin
--   execute sobre plan_included_seats.
-- =====================================================================

alter table public.subscriptions
  add column if not exists plan_id text
  check (plan_id is null or plan_id in ('arranque','negocio','profesional','multisede'));

comment on column public.subscriptions.plan_id is
  'Plan del catálogo 2026-08 (arranque|negocio|profesional|multisede). NULL = legado ai_tier. Todos los planes incluyen IA.';

update public.subscriptions
   set plan_id = case ai_tier
     when '3000' then 'multisede'
     when '1000' then 'profesional'
     when '300'  then 'negocio'
     else 'arranque'
   end
 where plan_id is null;

-- Asientos incluidos por plan. NULL (legado) = 1, que reproduce 1+team_seats.
create or replace function public.plan_included_seats(p_plan text)
 returns int
 language sql
 immutable
as $$
  select case p_plan
    when 'arranque'    then 1
    when 'negocio'     then 2
    when 'profesional' then 5
    when 'multisede'   then 10
    else 1
  end;
$$;

revoke all on function public.plan_included_seats(text) from public, anon;
grant execute on function public.plan_included_seats(text) to authenticated, service_role;

-- org_has_ai v2. Cambio de criterio DELIBERADO: (a) todos los planes nuevos
-- incluyen IA; (b) el trial de la app también (el tope de consumo ya la acota;
-- sin esto, encender BILLING_ENFORCED callaría al agente de toda org en prueba).
create or replace function public.org_has_ai(p_org uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.organization_id = p_org
      and s.status in ('trialing','active')
      and (s.plan_id is not null or s.ai_tier <> 'none')
      and (s.current_period_end is null or s.current_period_end > now())
  )
  or exists (
    select 1 from public.organizations o
    where o.id = p_org
      and o.trial_ends_at is not null
      and o.trial_ends_at > now()
  );
$$;

-- Asientos por plan en las invitaciones: permitidos = plan_included_seats +
-- team_seats (add-ons). Sin fila de subscriptions: 1, igual que antes.
create or replace function public.create_team_invitation(p_email text, p_role text, p_scope text default 'all'::text, p_resource_id uuid default null::uuid, p_enforce_seats boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org uuid; v_allowed int; v_used int; v_token uuid; v_id uuid; v_email text;
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

  if exists (
    select 1 from public.profiles p
     where p.organization_id = v_org and lower(coalesce(p.email,'')) = v_email
  ) then
    raise exception 'already_member';
  end if;

  if p_resource_id is not null and not exists (
    select 1 from public.resources r where r.id = p_resource_id and r.organization_id = v_org
  ) then
    raise exception 'resource_not_found';
  end if;

  if p_enforce_seats then
    select public.plan_included_seats(s.plan_id) + coalesce(s.team_seats, 0)
      into v_allowed
      from public.subscriptions s where s.organization_id = v_org;
    v_used := public.org_seats_used(v_org);
    if v_used >= coalesce(v_allowed, 1) then
      raise exception 'no_seats: sin accesos disponibles' using errcode = '23514';
    end if;
  end if;

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
end $function$;