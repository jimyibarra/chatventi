-- ---------------------------------------------------------------------
-- Panel Super Admin (2026-07-13): funciones de lectura global.
-- SECURITY DEFINER + guarda explícita a super_admin (defensa en profundidad
-- además del guard de la ruta /admin). Evita N+1 agregando en Postgres.
-- No exponen secretos (credenciales de canales, tokens de Stripe, etc.).
-- ---------------------------------------------------------------------

-- KPIs globales de toda la plataforma.
create or replace function public.admin_global_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  -- coalesce: un usuario sin perfil (rol NULL) NO debe pasar la guarda.
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;

  select json_build_object(
    'orgs_total',          (select count(*) from public.organizations),
    'users_total',         (select count(*) from public.profiles),
    'new_orgs_7d',         (select count(*) from public.organizations where created_at >= now() - interval '7 days'),
    'new_orgs_30d',        (select count(*) from public.organizations where created_at >= now() - interval '30 days'),
    'subs_active',         (select count(*) from public.subscriptions where status = 'active'),
    'subs_trialing',       (select count(*) from public.subscriptions where status = 'trialing'),
    'subs_past_due',       (select count(*) from public.subscriptions where status in ('past_due', 'unpaid')),
    'subs_canceled',       (select count(*) from public.subscriptions where status = 'canceled'),
    'conversations_total', (select count(*) from public.conversations),
    'messages_total',      (select count(*) from public.messages),
    'appointments_total',  (select count(*) from public.appointments),
    'clients_total',       (select count(*) from public.clients),
    'msgs_7d',             (select count(*) from public.messages where created_at >= now() - interval '7 days'),
    'appts_7d',            (select count(*) from public.appointments where created_at >= now() - interval '7 days')
  ) into v_result;

  return v_result;
end;
$$;

-- Una fila por organización, con dueño, plan/estado de suscripción y actividad.
create or replace function public.admin_list_organizations()
returns table (
  id                 uuid,
  name               text,
  country            text,
  city               text,
  created_at         timestamptz,
  owner_email        text,
  owner_name         text,
  plan               text,
  sub_status         text,
  ai_tier            text,
  has_domain         boolean,
  team_seats         integer,
  trial_end          timestamptz,
  current_period_end timestamptz,
  users_count        bigint,
  conversations_count bigint,
  appointments_count bigint,
  clients_count      bigint,
  last_activity      timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- coalesce: un usuario sin perfil (rol NULL) NO debe pasar la guarda.
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;

  return query
  select
    o.id,
    o.name,
    o.country,
    o.city,
    o.created_at,
    own.email,
    own.full_name,
    coalesce(s.plan, 'starter'),
    coalesce(s.status, 'none'),
    coalesce(s.ai_tier, 'none'),
    coalesce(s.has_domain, false),
    coalesce(s.team_seats, 0),
    s.trial_end,
    s.current_period_end,
    (select count(*) from public.profiles p       where p.organization_id = o.id),
    (select count(*) from public.conversations c   where c.organization_id = o.id),
    (select count(*) from public.appointments a    where a.organization_id = o.id),
    (select count(*) from public.clients cl        where cl.organization_id = o.id),
    (select max(m.created_at)
       from public.messages m
       join public.conversations c2 on c2.id = m.conversation_id
      where c2.organization_id = o.id)
  from public.organizations o
  left join public.subscriptions s on s.organization_id = o.id
  left join lateral (
    select email, full_name
    from public.profiles
    where organization_id = o.id and role = 'owner'
    order by created_at asc
    limit 1
  ) own on true
  order by o.created_at desc;
end;
$$;

revoke all on function public.admin_global_stats() from public, anon;
revoke all on function public.admin_list_organizations() from public, anon;
grant execute on function public.admin_global_stats() to authenticated;
grant execute on function public.admin_list_organizations() to authenticated;
