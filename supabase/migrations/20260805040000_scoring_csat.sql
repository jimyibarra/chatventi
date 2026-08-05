-- =====================================================================
-- ChatVenti · Superpoderes del agente · Fase 4:
--   calificación IA de la conversación (1-5, con alerta) + CSAT del cliente
--
--   Hoy nadie mide la calidad de la atención: no hay forma de saber si el
--   agente lo hace bien ni de enterarse de una conversación que salió mal.
--   Y el follow-up post-cita YA pregunta "¿cómo estuvo tu experiencia?"
--   pero tira la respuesta.
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. Calificación IA de la conversación
--    ai_scored_at es además la MARCA DE RECLAMO: se pone antes de llamar
--    al modelo, así un reintento del cron no vuelve a pagar la llamada.
-- ---------------------------------------------------------------
alter table public.conversations
  add column if not exists ai_score        smallint,
  add column if not exists ai_score_reason text,
  add column if not exists ai_scored_at    timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'conversations_ai_score_range'
  ) then
    alter table public.conversations
      add constraint conversations_ai_score_range
      check (ai_score is null or ai_score between 1 and 5);
  end if;
end $$;

-- Cola del cron: sin calificar y ya enfriadas.
create index if not exists conversations_pendientes_de_calificar_idx
  on public.conversations (last_message_at)
  where ai_scored_at is null;

-- ---------------------------------------------------------------
-- 2. CSAT del cliente
-- ---------------------------------------------------------------
create table if not exists public.csat_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  appointment_id  uuid references public.appointments(id) on delete set null,
  score smallint not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- Una respuesta por cita: es lo que hace que un reintento del proveedor (o
-- un cliente que pulsa dos veces) no duplique la fila.
create unique index if not exists csat_responses_una_por_cita
  on public.csat_responses (appointment_id)
  where appointment_id is not null;

create index if not exists csat_responses_org_idx
  on public.csat_responses (organization_id, created_at desc);

alter table public.csat_responses enable row level security;

-- Solo LECTURA para los miembros de la org. La inserción entra siempre por
-- record_csat (SECURITY DEFINER): nadie escribe su propia calificación.
drop policy if exists csat_select_own_org on public.csat_responses;
create policy csat_select_own_org on public.csat_responses
  for select to authenticated
  using (organization_id = public.get_my_org());

-- ---------------------------------------------------------------
-- 3. record_csat — la pulsación del botón del cliente.
--    Invocable por ANON (el webhook usa ANON key).
--
--    🔴 NO reutiliza `_resolve_chat_appointment`, aunque la tentación es
--    obvia: esa función exige que la cita sea FUTURA y esté activa
--    ("not_actionable"), porque nació para cancelar y reagendar. La
--    encuesta se manda justo DESPUÉS de la cita, así que reutilizarla
--    habría rechazado el 100 % de las calificaciones en producción.
--    Aquí se valida la MISMA propiedad —la cita tiene que ser de ESE
--    cliente en ESE canal, así que nadie puede calificar la de otro
--    adivinando un uuid— pero sin el requisito de "accionable".
-- ---------------------------------------------------------------
create or replace function public.record_csat(
  p_channel_type text,
  p_external_id text,
  p_client_phone text,
  p_appointment_id uuid,
  p_score smallint
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org    uuid;
  v_client uuid;
  v_conv   uuid;
  v_id     uuid;
begin
  if p_score is null or p_score < 1 or p_score > 5 then
    raise exception 'score fuera de rango';
  end if;

  select organization_id into v_org
    from public.channels
   where type = p_channel_type
     and external_id = p_external_id
     and status <> 'disabled'
   limit 1;
  if v_org is null then raise exception 'channel_not_found'; end if;

  -- Por teléfono canónico, igual que el resto del motor de chat.
  select id into v_client
    from public.clients
   where organization_id = v_org
     and phone_canonical = public.client_canonical(p_channel_type, p_client_phone)
   limit 1;
  if v_client is null then raise exception 'appointment_not_found'; end if;

  -- La cita tiene que ser de ESE cliente en ESA org. Sin filtro de fecha ni
  -- de estado: la encuesta llega cuando la cita ya pasó.
  if not exists (
    select 1 from public.appointments a
     where a.id = p_appointment_id
       and a.organization_id = v_org
       and a.client_id = v_client
  ) then
    raise exception 'appointment_not_found';
  end if;

  select c.id into v_conv
    from public.conversations c
    join public.channels ch on ch.id = c.channel_id
   where ch.type = p_channel_type
     and ch.external_id = p_external_id
     and ch.organization_id = v_org
     and c.client_id = v_client
   order by c.last_message_at desc nulls last, c.created_at desc
   limit 1;

  insert into public.csat_responses (organization_id, conversation_id, appointment_id, score)
  values (v_org, v_conv, p_appointment_id, p_score)
  on conflict (appointment_id) where appointment_id is not null do nothing
  returning id into v_id;

  return jsonb_build_object(
    'conversation_id', v_conv,
    'duplicate', v_id is null
  );
end;
$$;

revoke all on function public.record_csat(text, text, text, uuid, smallint) from public;
grant execute on function public.record_csat(text, text, text, uuid, smallint)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------
-- 4. Cola de calificación para el cron.
--    Solo orgs con la capacidad ENCENDIDA: con todo apagado, el cron hace
--    exactamente lo que hacía antes de esta fase.
-- ---------------------------------------------------------------
create or replace function public.get_conversations_to_score(p_idle_minutes integer default 120)
returns table (
  conversation_id uuid,
  organization_id uuid,
  client_name text
)
language sql
security definer
set search_path to 'public'
as $$
  select c.id, c.organization_id, cl.name
    from public.conversations c
    join public.agent_configs ac on ac.organization_id = c.organization_id
    left join public.clients cl on cl.id = c.client_id
   where ac.cap_scoring
     and c.ai_scored_at is null
     and c.last_message_at is not null
     and c.last_message_at < now() - make_interval(mins => p_idle_minutes)
     -- Conversaciones con sustancia: una sola línea suelta no se califica.
     and (select count(*) from public.messages m where m.conversation_id = c.id) >= 4
   order by c.last_message_at
   limit 50;
$$;

-- ---------------------------------------------------------------
-- 5. Reclamo ATÓMICO antes de llamar al modelo. Sin esto, un reintento de
--    Vercel a mitad de corrida vuelve a pagar la calificación.
-- ---------------------------------------------------------------
create or replace function public.claim_conversation_scoring(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_updated integer;
begin
  update public.conversations
     set ai_scored_at = now()
   where id = p_conversation_id
     and ai_scored_at is null;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.save_conversation_score(
  p_conversation_id uuid,
  p_score smallint,
  p_reason text
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_updated integer;
begin
  if p_score is null or p_score < 1 or p_score > 5 then
    return false;
  end if;
  update public.conversations
     set ai_score = p_score,
         ai_score_reason = left(trim(coalesce(p_reason, '')), 500)
   where id = p_conversation_id;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- Las tres son SOLO para el cron: devuelven o tocan datos de TODAS las orgs.
revoke all on function public.get_conversations_to_score(integer) from public;
grant execute on function public.get_conversations_to_score(integer) to service_role;

revoke all on function public.claim_conversation_scoring(uuid) from public;
grant execute on function public.claim_conversation_scoring(uuid) to service_role;

revoke all on function public.save_conversation_score(uuid, smallint, text) from public;
grant execute on function public.save_conversation_score(uuid, smallint, text) to service_role;
