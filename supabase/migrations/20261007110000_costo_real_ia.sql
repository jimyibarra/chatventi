-- =====================================================================
-- Costo REAL de la IA (2026-10-04).
--
--   Hasta hoy solo se contaban respuestas (usage_periods.ai_replies) y el
--   costo se suponía: $0.0014 USD por respuesta (AI_TURN_COST_USD). Ahora
--   cada llamada a OpenRouter guarda los tokens y el costo que OpenRouter
--   devuelve, por negocio, mes y origen:
--     'agente'       → respuestas a clientes finales (lo que se cobra).
--     'prueba'       → «Prueba el chat» del panel.
--     'superpoderes' → leer comprobantes, calificar conversaciones, voz de marca.
--     'ventas'       → agente de ventas de ChatVenti (página pública y redes).
--
--   PRIVADA: es el costo de ChatVenti. Ningún negocio la lee (RLS sin
--   policies + revoke); la escribe el servidor y la lee el superadmin por RPC.
--   Aditiva: tabla y funciones nuevas.
-- =====================================================================

create table if not exists public.ai_costs (
  period_start       date not null,                 -- primer día del mes (UTC), como usage_periods
  organization_id    uuid references public.organizations(id) on delete cascade, -- null = página pública
  source             text not null check (source in ('agente', 'prueba', 'superpoderes', 'ventas')),
  requests           integer not null default 0,   -- respuestas o tareas medidas (una por registro)
  calls              integer not null default 0,   -- llamadas al modelo (una respuesta puede usar varias)
  calls_without_cost integer not null default 0,   -- llamadas en las que OpenRouter no devolvió costo
  tokens_in          bigint not null default 0,
  tokens_out         bigint not null default 0,
  cost_usd           numeric(12, 6) not null default 0,
  updated_at         timestamptz not null default now()
);

-- (La primera versión de esta migración se aplicó sin `requests`.)
alter table public.ai_costs add column if not exists requests integer not null default 0;

-- Una fila por mes, negocio (o página pública) y origen.
create unique index if not exists ai_costs_key
  on public.ai_costs (period_start, coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), source);
-- Índice propio de la FK (Postgres no la indexa solo).
create index if not exists ai_costs_org_idx on public.ai_costs (organization_id);

alter table public.ai_costs enable row level security;
revoke all on public.ai_costs from anon, authenticated;

-- Suma una medición. Solo el servidor (service_role) la llama.
create or replace function public.record_ai_cost(
  p_org uuid,
  p_source text,
  p_calls integer,
  p_calls_without_cost integer,
  p_tokens_in bigint,
  p_tokens_out bigint,
  p_cost numeric
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_source not in ('agente', 'prueba', 'superpoderes', 'ventas') then
    raise exception 'invalid_source';
  end if;
  insert into public.ai_costs as a (
    period_start, organization_id, source, requests, calls, calls_without_cost, tokens_in, tokens_out, cost_usd
  ) values (
    date_trunc('month', now() at time zone 'utc')::date, p_org, p_source, 1,
    greatest(coalesce(p_calls, 0), 0), greatest(coalesce(p_calls_without_cost, 0), 0),
    greatest(coalesce(p_tokens_in, 0), 0), greatest(coalesce(p_tokens_out, 0), 0),
    greatest(coalesce(p_cost, 0), 0)
  )
  on conflict (period_start, (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)), source)
  do update set
    requests           = a.requests + 1,
    calls              = a.calls + excluded.calls,
    calls_without_cost = a.calls_without_cost + excluded.calls_without_cost,
    tokens_in          = a.tokens_in + excluded.tokens_in,
    tokens_out         = a.tokens_out + excluded.tokens_out,
    cost_usd           = a.cost_usd + excluded.cost_usd,
    updated_at         = now();
end;
$$;

-- Costo del mes por negocio y origen. El costo por respuesta sale de
-- `requests` (respuestas MEDIDAS), no de usage_periods: el contador de
-- respuestas empezó antes que la medición del costo. Solo super_admin.
create or replace function public.admin_ai_costs(p_period date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if coalesce(public.get_my_role(), '') <> 'super_admin' then
    raise exception 'forbidden';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'organization_id', a.organization_id,
      'name', o.name,
      'source', a.source,
      'requests', a.requests,
      'calls', a.calls,
      'calls_without_cost', a.calls_without_cost,
      'tokens_in', a.tokens_in,
      'tokens_out', a.tokens_out,
      'cost_usd', a.cost_usd
    ) order by a.cost_usd desc)
    from public.ai_costs a
    left join public.organizations o on o.id = a.organization_id
    where a.period_start = date_trunc('month', p_period)::date
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.record_ai_cost(uuid, text, integer, integer, bigint, bigint, numeric) from public, anon, authenticated;
grant execute on function public.record_ai_cost(uuid, text, integer, integer, bigint, bigint, numeric) to service_role;
revoke execute on function public.admin_ai_costs(date) from public, anon;
grant execute on function public.admin_ai_costs(date) to authenticated, service_role;
