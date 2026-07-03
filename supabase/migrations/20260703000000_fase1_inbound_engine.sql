-- =====================================================================
-- ChatVenti · Fase 1 · Inbound Engine: clients + conversations + messages
-- + RPC route_inbound_message (SECURITY DEFINER, idempotente por external_id)
--
-- Portado por patron de SastrePro2: el webhook usa ANON key -> toda escritura
-- entra por esta RPC SECURITY DEFINER (memoria chat-autoresponder-dedup-fix).
-- Reutiliza tenancy de Fase 0: organizations / channels / profiles y helpers
-- get_my_org() / get_my_role() / get_my_branch().
--
-- NOTA: NO aplicada a la BD remota (pendiente de revision humana).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CLIENTES (contactos del negocio) — no existia en el baseline
--    Minima para Fase 1; el CRM (Fase 6) la extiende con etiquetas/historial.
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone           text,
  name            text,
  created_at      timestamptz not null default now(),
  -- un contacto por telefono/handle dentro de la organizacion (upsert desde el webhook)
  unique (organization_id, phone)
);
create index if not exists clients_org_idx on public.clients(organization_id);

-- ---------------------------------------------------------------------
-- 2. CONVERSACIONES (chat omnicanal acotado por canal + contacto)
-- ---------------------------------------------------------------------
create table if not exists public.conversations (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  channel_id        uuid not null references public.channels(id) on delete cascade,
  client_id         uuid references public.clients(id) on delete set null,
  assigned_agent_id uuid references public.profiles(id) on delete set null,
  status            text not null default 'open' check (status in ('open','pending','closed')),
  ai_enabled        boolean not null default true,
  ai_paused_until   timestamptz,
  last_message_at   timestamptz,
  created_at        timestamptz not null default now(),
  unique (channel_id, client_id)
);
create index if not exists conversations_org_idx     on public.conversations(organization_id);
create index if not exists conversations_channel_idx on public.conversations(channel_id);

-- ---------------------------------------------------------------------
-- 3. MENSAJES (dedup idempotente por external_id de WA/TG)
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction       text not null check (direction in ('inbound','outbound')),
  sender          text not null check (sender in ('contact','agent','ai','system')),
  agent_id        uuid references public.profiles(id) on delete set null,
  body            text,
  media_path      text,
  external_id     text,   -- id del mensaje en WA/TG -> dedup idempotente
  created_at      timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages(conversation_id);
-- dedup: solo un mensaje por external_id (cuando existe). Partial unique -> permite nulls.
create unique index if not exists messages_external_id_uidx
  on public.messages(external_id) where external_id is not null;

-- Indice para resolver la organizacion por canal en el webhook (external_id + type).
-- El baseline ya creo unique (type, external_id) en channels; reforzamos lookup por external_id.
create index if not exists channels_external_id_idx on public.channels(external_id);

-- ---------------------------------------------------------------------
-- 4. RLS (aislar por organization_id; messages via su conversacion)
-- ---------------------------------------------------------------------
alter table public.clients       enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- clients: dentro de la org
drop policy if exists client_select on public.clients;
create policy client_select on public.clients for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
drop policy if exists client_write on public.clients;
create policy client_write on public.clients for all
  using ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager','staff')) or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager','staff')) or public.get_my_role() = 'super_admin');

-- conversations: dentro de la org
drop policy if exists conversation_select on public.conversations;
create policy conversation_select on public.conversations for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
drop policy if exists conversation_write on public.conversations;
create policy conversation_write on public.conversations for all
  using ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager','staff')) or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager','staff')) or public.get_my_role() = 'super_admin');

-- messages: acceso via la conversacion (que ya esta aislada por org).
drop policy if exists message_select on public.messages;
create policy message_select on public.messages for select
  using (
    public.get_my_role() = 'super_admin'
    or exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.organization_id = public.get_my_org()
    )
  );
drop policy if exists message_write on public.messages;
create policy message_write on public.messages for all
  using (
    public.get_my_role() = 'super_admin'
    or exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.organization_id = public.get_my_org()
        and public.get_my_role() in ('owner','manager','staff')
    )
  )
  with check (
    public.get_my_role() = 'super_admin'
    or exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.organization_id = public.get_my_org()
        and public.get_my_role() in ('owner','manager','staff')
    )
  );

-- ---------------------------------------------------------------------
-- 5. RPC route_inbound_message (SECURITY DEFINER, invocable por ANON)
--    Resuelve org por channels(type, external_id) -> upsert cliente ->
--    upsert conversacion -> inserta mensaje con dedup por external_id.
--    Idempotente: si el external_id ya existe, devuelve el id existente.
-- ---------------------------------------------------------------------
create or replace function public.route_inbound_message(
  p_channel_type text,
  p_external_id   text,
  p_from_handle   text,
  p_body          text,
  p_media_path    text default null,
  p_ext_msg_id    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org     uuid;
  v_channel uuid;
  v_client  uuid;
  v_conv    uuid;
  v_msg     uuid;
begin
  -- 1. Resolver el canal (y por tanto la organizacion) por tipo + external_id.
  --    UNIQUE(type, external_id) blinda contra fuga entre tenants.
  select id, organization_id
    into v_channel, v_org
    from public.channels
   where type = p_channel_type
     and external_id = p_external_id
     and status <> 'disabled'
   limit 1;

  if v_channel is null then
    -- Canal no registrado o deshabilitado: no escribimos nada.
    raise notice 'route_inbound_message: canal % / % no encontrado', p_channel_type, p_external_id;
    return null;
  end if;

  -- 2. Dedup idempotente: si ya procesamos ese external_id, devolvemos su id.
  if p_ext_msg_id is not null then
    select id into v_msg from public.messages where external_id = p_ext_msg_id limit 1;
    if v_msg is not null then
      return v_msg;
    end if;
  end if;

  -- 3. Upsert del cliente por telefono/handle dentro de la org.
  if coalesce(trim(p_from_handle), '') <> '' then
    insert into public.clients (organization_id, phone)
      values (v_org, trim(p_from_handle))
    on conflict (organization_id, phone)
      do update set phone = excluded.phone
      returning id into v_client;
  end if;

  -- 4. Upsert de la conversacion (UNIQUE channel_id + client_id).
  insert into public.conversations (organization_id, channel_id, client_id, last_message_at)
    values (v_org, v_channel, v_client, now())
  on conflict (channel_id, client_id)
    do update set last_message_at = now()
    returning id into v_conv;

  -- 5. Insertar el mensaje entrante.
  insert into public.messages (conversation_id, direction, sender, body, media_path, external_id)
    values (v_conv, 'inbound', 'contact', p_body, p_media_path, p_ext_msg_id)
  returning id into v_msg;

  return v_msg;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. GRANTS (patron de _harden_function_grants.sql)
--    El webhook llama con rol ANON -> anon necesita EXECUTE.
--    authenticated tambien (util para pruebas server autenticadas).
-- ---------------------------------------------------------------------
revoke all on function public.route_inbound_message(text, text, text, text, text, text) from public;
grant  execute on function public.route_inbound_message(text, text, text, text, text, text) to anon, authenticated;
