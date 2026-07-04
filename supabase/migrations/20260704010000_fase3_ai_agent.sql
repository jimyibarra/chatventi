-- =====================================================================
-- ChatVenti · Fase 3 · Recepcionista IA: config del agente + base de
-- conocimiento + aprobaciones (human-in-the-loop) + RPCs de contexto/salida
--
-- El agente corre en el webhook (rol ANON) -> lectura de contexto y escritura
-- de salida entran por RPCs SECURITY DEFINER (patron route_inbound_message).
-- Las RPCs de control desde la UI son solo authenticated (assert_org_access).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CONFIG DEL AGENTE (una por organizacion)
-- ---------------------------------------------------------------------
create table if not exists public.agent_configs (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null unique references public.organizations(id) on delete cascade,
  enabled                   boolean not null default false,
  system_prompt             text,
  model                     text not null default 'openai/gpt-4o-mini',
  -- 'off' = nunca pide aprobacion; 'low_confidence' = cuando el agente lo pide;
  -- 'always' = toda respuesta saliente pasa por aprobacion.
  approval_mode             text not null default 'low_confidence'
                              check (approval_mode in ('off','low_confidence','always')),
  approval_telegram_chat_id text,   -- chat de Telegram del negocio que recibe aprobaciones
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. BASE DE CONOCIMIENTO (FAQs / info del negocio)
-- ---------------------------------------------------------------------
create table if not exists public.knowledge_base (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content         text not null,
  source          text,
  created_at      timestamptz not null default now()
);
create index if not exists knowledge_base_org_idx on public.knowledge_base(organization_id);

-- ---------------------------------------------------------------------
-- 3. APROBACIONES (borrador que el humano aprueba/rechaza por Telegram)
-- ---------------------------------------------------------------------
create table if not exists public.ai_approvals (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  draft           text not null,
  action          jsonb,   -- accion propuesta (p.ej. reserva) — opcional
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index if not exists ai_approvals_org_idx  on public.ai_approvals(organization_id);
create index if not exists ai_approvals_conv_idx on public.ai_approvals(conversation_id);

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table public.agent_configs  enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.ai_approvals   enable row level security;

drop policy if exists agentcfg_select on public.agent_configs;
create policy agentcfg_select on public.agent_configs for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
drop policy if exists agentcfg_write on public.agent_configs;
create policy agentcfg_write on public.agent_configs for all
  using ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin');

drop policy if exists kb_select on public.knowledge_base;
create policy kb_select on public.knowledge_base for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
drop policy if exists kb_write on public.knowledge_base;
create policy kb_write on public.knowledge_base for all
  using ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager')) or public.get_my_role() = 'super_admin');

drop policy if exists approvals_select on public.ai_approvals;
create policy approvals_select on public.ai_approvals for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
-- escritura de aprobaciones solo por RPC (SECURITY DEFINER); sin policy de write directo.

-- ---------------------------------------------------------------------
-- 5. RPC get_agent_context — TODO lo que el agente necesita para responder.
--    Resuelve por (channel_type, external_id de la org, handle del cliente).
-- ---------------------------------------------------------------------
create or replace function public.get_agent_context(
  p_channel_type text,
  p_external_id  text,
  p_from_handle  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org     uuid;
  v_channel uuid;
  v_conv    uuid;
  v_client  uuid;
  v_result  jsonb;
begin
  select id, organization_id into v_channel, v_org
    from public.channels
   where type = p_channel_type and external_id = p_external_id and status <> 'disabled'
   limit 1;
  if v_channel is null then return null; end if;

  select id into v_client from public.clients
   where organization_id = v_org and phone = trim(p_from_handle) limit 1;

  select id into v_conv from public.conversations
   where channel_id = v_channel and client_id is not distinct from v_client limit 1;
  if v_conv is null then return null; end if;

  select jsonb_build_object(
    'org_id', v_org,
    'conversation', (
      select jsonb_build_object(
        'id', c.id, 'status', c.status, 'ai_enabled', c.ai_enabled,
        'ai_paused_until', c.ai_paused_until,
        'channel_type', p_channel_type, 'channel_external_id', p_external_id,
        'client_id', v_client, 'client_handle', trim(p_from_handle),
        'client_name', (select name from public.clients where id = v_client),
        -- debe responder: config activa + IA de la conversacion activa + no en pausa + sin aprobacion pendiente
        'should_respond', (
          coalesce((select enabled from public.agent_configs where organization_id = v_org), false)
          and c.ai_enabled
          and (c.ai_paused_until is null or c.ai_paused_until < now())
          and not exists (
            select 1 from public.ai_approvals a
             where a.conversation_id = c.id and a.status = 'pending'
          )
        )
      ) from public.conversations c where c.id = v_conv
    ),
    'config', (
      select jsonb_build_object(
        'enabled', ac.enabled, 'system_prompt', ac.system_prompt, 'model', ac.model,
        'approval_mode', ac.approval_mode, 'approval_chat_id', ac.approval_telegram_chat_id
      ) from public.agent_configs ac where ac.organization_id = v_org
    ),
    'branch', (
      select jsonb_build_object('id', b.id, 'name', b.name, 'timezone', b.timezone)
        from public.branches b where b.organization_id = v_org order by b.created_at limit 1
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes,
        'price', s.price, 'description', s.description) order by s.name)
      from public.service_catalogs s where s.organization_id = v_org and s.active
    ), '[]'::jsonb),
    'knowledge', coalesce((
      select jsonb_agg(k.content order by k.created_at)
      from public.knowledge_base k where k.organization_id = v_org
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(m order by m.created_at)
      from (
        select direction, sender, body, created_at
        from public.messages
        where conversation_id = v_conv
        order by created_at desc
        limit 20
      ) m
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RPC log_outbound_message — registra la respuesta saliente del agente.
-- ---------------------------------------------------------------------
create or replace function public.log_outbound_message(
  p_conversation_id uuid,
  p_body            text,
  p_sender          text default 'ai',
  p_external_id     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_msg uuid;
begin
  if p_sender not in ('ai','agent','system') then p_sender := 'ai'; end if;
  insert into public.messages (conversation_id, direction, sender, body, external_id)
    values (p_conversation_id, 'outbound', p_sender, p_body, p_external_id)
  returning id into v_msg;
  update public.conversations set last_message_at = now() where id = p_conversation_id;
  return v_msg;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. RPC create_ai_approval — el agente propone un borrador para aprobacion.
--    Pausa la IA (status pending) y devuelve el chat de Telegram destino.
-- ---------------------------------------------------------------------
create or replace function public.create_ai_approval(
  p_conversation_id uuid,
  p_draft           text,
  p_action          jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid;
  v_approval uuid;
  v_chat     text;
begin
  select organization_id into v_org from public.conversations where id = p_conversation_id;
  if v_org is null then raise exception 'conversation_not_found'; end if;

  insert into public.ai_approvals (organization_id, conversation_id, draft, action)
    values (v_org, p_conversation_id, p_draft, p_action)
  returning id into v_approval;

  -- Marca la conversacion pendiente (el agente no vuelve a actuar hasta resolver).
  update public.conversations set status = 'pending' where id = p_conversation_id;

  select approval_telegram_chat_id into v_chat from public.agent_configs where organization_id = v_org;

  return jsonb_build_object('approval_id', v_approval, 'approval_chat_id', v_chat, 'org_id', v_org);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. RPC resolve_ai_approval — el humano aprueba/rechaza desde Telegram.
--    Devuelve el borrador + datos del canal del CLIENTE para enviarlo.
-- ---------------------------------------------------------------------
create or replace function public.resolve_ai_approval(
  p_approval_id uuid,
  p_approved    boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv        uuid;
  v_draft       text;
  v_status      text;
  v_channel_type text;
  v_channel_ext  text;
  v_send_to      text;
begin
  select conversation_id, draft, status into v_conv, v_draft, v_status
    from public.ai_approvals where id = p_approval_id;
  if v_conv is null then raise exception 'approval_not_found'; end if;
  if v_status <> 'pending' then
    return jsonb_build_object('already_resolved', true, 'status', v_status);
  end if;

  update public.ai_approvals
     set status = case when p_approved then 'approved' else 'rejected' end,
         resolved_at = now()
   where id = p_approval_id;

  -- Datos para enviar el borrador aprobado al cliente por su canal.
  select ch.type, ch.external_id, cl.phone
    into v_channel_type, v_channel_ext, v_send_to
    from public.conversations c
    join public.channels ch on ch.id = c.channel_id
    left join public.clients cl on cl.id = c.client_id
   where c.id = v_conv;

  if p_approved then
    -- Reactiva la IA para el siguiente turno.
    update public.conversations set status = 'open', ai_paused_until = null where id = v_conv;
  else
    -- Rechazado: queda para intervencion humana; IA en pausa larga.
    update public.conversations set status = 'pending', ai_paused_until = now() + interval '12 hours' where id = v_conv;
  end if;

  return jsonb_build_object(
    'approved', p_approved, 'conversation_id', v_conv, 'draft', v_draft,
    'channel_type', v_channel_type, 'channel_external_id', v_channel_ext, 'send_to', v_send_to
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 9. RPCs de control desde la UI (authenticated)
-- ---------------------------------------------------------------------
create or replace function public.set_ai_enabled(
  p_conversation_id uuid,
  p_enabled         boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.conversations where id = p_conversation_id;
  if v_org is null then raise exception 'conversation_not_found'; end if;
  perform public.assert_org_access(v_org);
  update public.conversations
     set ai_enabled = p_enabled,
         ai_paused_until = case when p_enabled then null else ai_paused_until end
   where id = p_conversation_id;
end;
$$;

create or replace function public.pause_ai(
  p_conversation_id uuid,
  p_minutes         int default 60
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.conversations where id = p_conversation_id;
  if v_org is null then raise exception 'conversation_not_found'; end if;
  perform public.assert_org_access(v_org);
  update public.conversations
     set ai_paused_until = now() + make_interval(mins => greatest(p_minutes, 1))
   where id = p_conversation_id;
end;
$$;

create or replace function public.set_conversation_status(
  p_conversation_id uuid,
  p_status          text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_org uuid;
begin
  if p_status not in ('open','pending','closed') then raise exception 'invalid_status'; end if;
  select organization_id into v_org from public.conversations where id = p_conversation_id;
  if v_org is null then raise exception 'conversation_not_found'; end if;
  perform public.assert_org_access(v_org);
  update public.conversations set status = p_status where id = p_conversation_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 10. GRANTS (patron _harden_function_grants + gotcha Fase 2: revocar anon)
-- ---------------------------------------------------------------------
-- Contexto/salida/aprobaciones: las usa el webhook (ANON) + authenticated.
revoke all on function public.get_agent_context(text, text, text) from public;
grant  execute on function public.get_agent_context(text, text, text) to anon, authenticated;

revoke all on function public.log_outbound_message(uuid, text, text, text) from public;
grant  execute on function public.log_outbound_message(uuid, text, text, text) to anon, authenticated;

revoke all on function public.create_ai_approval(uuid, text, jsonb) from public;
grant  execute on function public.create_ai_approval(uuid, text, jsonb) to anon, authenticated;

revoke all on function public.resolve_ai_approval(uuid, boolean) from public;
grant  execute on function public.resolve_ai_approval(uuid, boolean) to anon, authenticated;

-- Control desde la UI: SOLO authenticated (revocar anon por el gotcha de grants por defecto).
revoke all on function public.set_ai_enabled(uuid, boolean) from public;
grant  execute on function public.set_ai_enabled(uuid, boolean) to authenticated;
revoke execute on function public.set_ai_enabled(uuid, boolean) from anon;

revoke all on function public.pause_ai(uuid, int) from public;
grant  execute on function public.pause_ai(uuid, int) to authenticated;
revoke execute on function public.pause_ai(uuid, int) from anon;

revoke all on function public.set_conversation_status(uuid, text) from public;
grant  execute on function public.set_conversation_status(uuid, text) to authenticated;
revoke execute on function public.set_conversation_status(uuid, text) from anon;
