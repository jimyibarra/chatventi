-- =====================================================================
-- ChatVenti · Superpoderes del agente · Fase 5:
--   seguimiento a conversaciones frías + reporte diario al dueño
--
--   Hoy un lead que preguntó, no agendó y se enfrió se pierde en silencio:
--   TODO el sistema de recordatorios cuelga de `appointments`, así que sin
--   cita no existe. Y el dueño no recibe ni un solo correo sobre su
--   negocio: las 8 plantillas existentes son de billing y lifecycle.
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. Marca del mensaje de reactivación. UNA sola vez por conversación:
--    es la diferencia entre rescatar un lead y acosarlo.
-- ---------------------------------------------------------------
alter table public.conversations
  add column if not exists cold_followup_sent_at timestamptz;

-- ---------------------------------------------------------------
-- 2. Marca del reporte diario, por org y día. Es una TABLA y no una
--    columna porque el reclamo tiene que ser atómico e histórico: el
--    insert con clave primaria compuesta es el candado.
-- ---------------------------------------------------------------
create table if not exists public.daily_report_runs (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_date date not null,
  sent_at timestamptz not null default now(),
  primary key (organization_id, report_date)
);

alter table public.daily_report_runs enable row level security;
-- Sin policies: es bitácora del cron (service_role bypassa RLS). Nadie más
-- necesita leerla, y con RLS activa y sin policy queda cerrada por defecto.

-- ---------------------------------------------------------------
-- 3. Conversaciones frías: el cliente escribió, NUNCA agendó nada y
--    lleva N días en silencio. Solo orgs con la capacidad encendida.
-- ---------------------------------------------------------------
create or replace function public.get_cold_conversations(p_days integer default 4)
returns table (
  conversation_id uuid,
  organization_id uuid,
  org_name text,
  client_name text,
  channel_type text,
  channel_external_id text,
  send_to text
)
language sql
security definer
set search_path to 'public'
as $$
  select c.id, c.organization_id, o.name, cl.name, ch.type, ch.external_id, cl.phone
    from public.conversations c
    join public.agent_configs ac on ac.organization_id = c.organization_id
    join public.organizations o on o.id = c.organization_id
    join public.channels ch on ch.id = c.channel_id
    join public.clients cl on cl.id = c.client_id
   where ac.cap_cold_followup
     and c.cold_followup_sent_at is null
     and c.last_message_at is not null
     and c.last_message_at < now() - make_interval(days => p_days)
     -- Nunca agendó NADA con este negocio: ni pasada ni futura. Si tiene
     -- cita, de él ya se ocupan los recordatorios y el follow-up post-visita.
     and not exists (
       select 1 from public.appointments a
        where a.client_id = cl.id and a.organization_id = c.organization_id
     )
     -- Conversación con sustancia: un "hola" suelto no merece perseguirse.
     and (select count(*) from public.messages m where m.conversation_id = c.id) >= 3
     and ch.status <> 'disabled'
   order by c.last_message_at
   limit 50;
$$;

-- Reclamo ATÓMICO. Se marca ANTES de enviar: si el envío falla (p. ej. la
-- ventana de 24 h de WhatsApp, que este proyecto no puede sortear porque no
-- hay plantillas HSM), NO se reintenta. Un intento por conversación y punto:
-- el riesgo de acosar a un cliente pesa más que el de perder un rescate.
create or replace function public.claim_cold_followup(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_updated integer;
begin
  update public.conversations
     set cold_followup_sent_at = now()
   where id = p_conversation_id
     and cold_followup_sent_at is null;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- ---------------------------------------------------------------
-- 4. Reporte diario: reclamo por org y día.
-- ---------------------------------------------------------------
create or replace function public.claim_daily_report(p_org uuid, p_date date)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_inserted integer;
begin
  insert into public.daily_report_runs (organization_id, report_date)
  values (p_org, p_date)
  on conflict (organization_id, report_date) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end;
$$;

-- Orgs con el reporte encendido y un correo al que mandarlo.
create or replace function public.get_daily_report_orgs()
returns table (organization_id uuid, org_name text, contact_email text)
language sql
security definer
set search_path to 'public'
as $$
  select o.id, o.name, o.contact_email
    from public.organizations o
    join public.agent_configs ac on ac.organization_id = o.id
   where ac.cap_daily_report
     and o.contact_email is not null
     and o.data_deleted_at is null
   limit 200;
$$;

-- Cifras del día. `p_day` es el día que se resume (ayer, normalmente) en la
-- zona horaria de la sucursal principal, no en UTC: si no, el "resumen de
-- ayer" que le llega a un negocio de México parte el día por la mitad.
create or replace function public.get_daily_report_data(p_org uuid, p_day date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tz     text;
  v_from   timestamptz;
  v_to     timestamptz;
  v_result jsonb;
begin
  select coalesce(b.timezone, 'America/Mexico_City') into v_tz
    from public.branches b
   where b.organization_id = p_org
   order by b.created_at
   limit 1;
  v_tz := coalesce(v_tz, 'America/Mexico_City');

  v_from := (p_day::text || ' 00:00:00')::timestamp at time zone v_tz;
  v_to   := v_from + interval '1 day';

  select jsonb_build_object(
    'conversaciones', (
      select count(distinct c.id) from public.conversations c
       join public.messages m on m.conversation_id = c.id
       where c.organization_id = p_org
         and m.created_at >= v_from and m.created_at < v_to
    ),
    'mensajes_recibidos', (
      select count(*) from public.messages m
       join public.conversations c on c.id = m.conversation_id
       where c.organization_id = p_org and m.direction = 'inbound'
         and m.created_at >= v_from and m.created_at < v_to
    ),
    'citas_creadas', (
      select count(*) from public.appointments a
       where a.organization_id = p_org
         and a.created_at >= v_from and a.created_at < v_to
    ),
    'escalamientos', (
      select count(*) from public.ai_approvals ap
       join public.conversations c on c.id = ap.conversation_id
       where c.organization_id = p_org
         and ap.created_at >= v_from and ap.created_at < v_to
    ),
    'calificacion_media', (
      select round(avg(c.ai_score)::numeric, 1) from public.conversations c
       where c.organization_id = p_org and c.ai_score is not null
         and c.ai_scored_at >= v_from and c.ai_scored_at < v_to
    ),
    'conversaciones_malas', (
      select count(*) from public.conversations c
       where c.organization_id = p_org and c.ai_score is not null and c.ai_score <= 2
         and c.ai_scored_at >= v_from and c.ai_scored_at < v_to
    ),
    -- Lo único que mira hacia ADELANTE: con qué se encuentra hoy al abrir.
    'citas_de_hoy', (
      select count(*) from public.appointments a
       where a.organization_id = p_org
         and a.status in ('scheduled','confirmed')
         and a.starts_at >= v_to and a.starts_at < v_to + interval '1 day'
    )
  ) into v_result;

  return v_result;
end;
$$;

-- Todas son SOLO para el cron: cruzan datos de TODAS las orgs.
revoke all on function public.get_cold_conversations(integer) from public;
grant execute on function public.get_cold_conversations(integer) to service_role;

revoke all on function public.claim_cold_followup(uuid) from public;
grant execute on function public.claim_cold_followup(uuid) to service_role;

revoke all on function public.claim_daily_report(uuid, date) from public;
grant execute on function public.claim_daily_report(uuid, date) to service_role;

revoke all on function public.get_daily_report_orgs() from public;
grant execute on function public.get_daily_report_orgs() to service_role;

revoke all on function public.get_daily_report_data(uuid, date) from public;
grant execute on function public.get_daily_report_data(uuid, date) to service_role;
