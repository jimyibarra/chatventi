-- =====================================================================
-- ChatVenti · Registro corto + Antiabuso capa 1 · FASE 1 (cimientos)
--
-- Aditiva y reversible: no toca ninguna función ni columna existente.
--   1. rate_events        · contador durable de eventos (sustituye los Map
--                           en memoria, inservibles en Vercel multi-instancia)
--   2. canonical_email()  · correo canónico (mata el truco del alias +tag)
--   3. profiles.*         · email_canonical / signup_ip / signup_user_agent
--   4. organizations.*    · consumo de IA durante la prueba gratis
--   5. consume_rate_limit / count_rate_events · RPCs SECURITY DEFINER
--
-- PATRÓN MAESTRO respetado: los caminos SIN sesión (alta, demo de la landing)
-- usan la clave ANON, que con RLS no puede escribir nada por sí sola. Toda
-- escritura va por RPC SECURITY DEFINER que valida sus propias entradas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Contador durable de eventos con ventana temporal
-- ---------------------------------------------------------------------
create table if not exists public.rate_events (
  id         bigserial   primary key,
  bucket     text        not null,   -- 'signup_ip' | 'demo_ip' | 'sandbox_org' | ...
  key        text        not null,   -- ip / organization_id / correo canónico
  created_at timestamptz not null default now()
);

create index if not exists rate_events_lookup_idx
  on public.rate_events (bucket, key, created_at desc);

-- RLS ACTIVA Y SIN POLICIES: nadie (anon ni authenticated) lee o escribe
-- directo. El único acceso es por las RPC SECURITY DEFINER de abajo.
alter table public.rate_events enable row level security;

comment on table public.rate_events is
  'Eventos con marca de tiempo para límites de tasa durables. Solo accesible '
  'vía consume_rate_limit()/count_rate_events(). Se purga sola (ver la RPC).';

-- ---------------------------------------------------------------------
-- 2. Correo canónico
--
--    +etiqueta se recorta en TODOS los dominios (es estándar y solo la usa
--    quien quiere varias identidades). Los PUNTOS solo se colapsan en Gmail,
--    donde son irrelevantes por diseño: en un dominio corporativo
--    a.b@empresa.com y ab@empresa.com SON personas distintas y colapsarlos
--    bloquearía clientes legítimos.
-- ---------------------------------------------------------------------
create or replace function public.canonical_email(p_email text)
returns text
language sql
immutable
as $$
  with base as (
    select lower(btrim(coalesce(p_email, ''))) as e
  ),
  parts as (
    select
      split_part(e, '@', 1) as local_part,
      split_part(e, '@', 2) as domain_part
    from base
    where position('@' in e) > 1
  ),
  clean as (
    select
      split_part(local_part, '+', 1) as local_part,
      case when domain_part = 'googlemail.com' then 'gmail.com' else domain_part end as domain_part
    from parts
  )
  select case
           when local_part = '' or domain_part = '' then null
           when domain_part = 'gmail.com' then replace(local_part, '.', '') || '@gmail.com'
           else local_part || '@' || domain_part
         end
  from clean;
$$;

comment on function public.canonical_email(text) is
  'Correo reducido a identidad única: minúsculas, sin +etiqueta y, solo en '
  'Gmail, sin puntos. Devuelve null si la entrada no es un correo.';

-- ---------------------------------------------------------------------
-- 3. Huella del alta en profiles
--    (el índice único se crea en una migración aparte, DESPUÉS de comprobar
--     que el backfill no dejó duplicados preexistentes — ver 20260803000100)
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists email_canonical   text;
-- text y no inet: la cabecera puede traer 'unknown' o una lista, y un cast
-- fallido en el alta abortaría un registro legítimo por un dato accesorio.
alter table public.profiles add column if not exists signup_ip         text;
alter table public.profiles add column if not exists signup_user_agent text;

update public.profiles
   set email_canonical = public.canonical_email(email)
 where email_canonical is null
   and email is not null;

create index if not exists profiles_email_canonical_idx
  on public.profiles (email_canonical)
  where email_canonical is not null;

-- ---------------------------------------------------------------------
-- 4. Consumo de IA durante la prueba gratis
--    El tope protege el saldo de OpenRouter: una cuenta reciclada vale poco
--    si su capacidad de gasto está acotada.
-- ---------------------------------------------------------------------
alter table public.organizations
  add column if not exists trial_ai_messages_used int not null default 0;
alter table public.organizations
  add column if not exists trial_ai_capped_at timestamptz;

-- ---------------------------------------------------------------------
-- 5. RPCs de límite de tasa
-- ---------------------------------------------------------------------

-- Registra un intento y dice si se PERMITE. Contrato deliberado:
--   true  = adelante
--   false = bloqueado
-- Cualquier entrada inválida devuelve false (falla CERRADO). Quien la llama
-- debe tratar también el error de red como false: una guarda cuya consulta
-- falla y deja pasar a todo el mundo está al revés (CLAUDE.md 2026-07-15).
create or replace function public.consume_rate_limit(
  p_bucket         text,
  p_key            text,
  p_limit          int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if coalesce(btrim(p_bucket), '') = ''
     or coalesce(btrim(p_key), '') = ''
     or coalesce(p_limit, 0) <= 0
     or coalesce(p_window_seconds, 0) <= 0 then
    return false;
  end if;

  -- Purga barata y amortizada (~1 de cada 100 llamadas) para que la tabla no
  -- crezca sin fin. No hace falta cron dedicado.
  if random() < 0.01 then
    delete from public.rate_events where created_at < now() - interval '2 days';
  end if;

  select count(*) into v_count
    from public.rate_events
   where bucket = p_bucket
     and key = p_key
     and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.rate_events (bucket, key) values (p_bucket, p_key);
  return true;
end;
$$;

-- Solo consulta, sin registrar. Para pintar "te quedan N" sin gastar cupo.
create or replace function public.count_rate_events(
  p_bucket         text,
  p_key            text,
  p_window_seconds int
)
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int
    from public.rate_events
   where bucket = p_bucket
     and key = p_key
     and created_at > now() - make_interval(secs => coalesce(p_window_seconds, 3600));
$$;

revoke all on function public.consume_rate_limit(text, text, int, int) from public;
revoke all on function public.count_rate_events(text, text, int) from public;
revoke all on function public.canonical_email(text) from public;

-- anon: el alta y la demo de la landing ocurren SIN sesión.
grant execute on function public.consume_rate_limit(text, text, int, int) to anon, authenticated;
grant execute on function public.count_rate_events(text, text, int)       to anon, authenticated;
grant execute on function public.canonical_email(text)                    to anon, authenticated;
