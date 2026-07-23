-- =====================================================================
-- ChatVenti · Teléfonos · FASE 3+4: resolver por canónico + blindaje
--   · Fusiona duplicados (idempotente; ya se corrió en vivo).
--   · UNIQUE parcial (org, phone_canonical) -> evita NUEVOS duplicados.
--   · Los WRITERS upsert por canónico; los READERS resuelven por canónico.
--   Legacy v1 (create_appointment_from_chat / create_public_appointment) NO se
--   tocan: 0 usos en la app; se dropean en la Fase 7 (CONTRACT) de la Ola 4.
-- =====================================================================

-- Seguridad de replay: en datos limpios es un no-op.
select public.merge_duplicate_clients();

-- Blindaje: un solo cliente por (org, teléfono canónico).
create unique index if not exists clients_org_canonical_uidx
  on public.clients(organization_id, phone_canonical)
  where phone_canonical is not null;

-- ---------------------------------------------------------------------
-- WRITERS
-- ---------------------------------------------------------------------
create or replace function public.route_inbound_message(
  p_channel_type text, p_external_id text, p_from_handle text,
  p_body text, p_media_path text default null, p_ext_msg_id text default null
) returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; v_channel uuid; v_client uuid; v_conv uuid; v_msg uuid;
begin
  select id, organization_id into v_channel, v_org
    from public.channels
   where type = p_channel_type and external_id = p_external_id and status <> 'disabled'
   limit 1;
  if v_channel is null then
    raise notice 'route_inbound_message: canal % / % no encontrado', p_channel_type, p_external_id;
    return jsonb_build_object('message_id', null, 'duplicate', false);
  end if;

  if p_ext_msg_id is not null then
    select id into v_msg from public.messages where external_id = p_ext_msg_id limit 1;
    if v_msg is not null then
      return jsonb_build_object('message_id', v_msg, 'duplicate', true);
    end if;
  end if;

  if coalesce(trim(p_from_handle), '') <> '' then
    insert into public.clients (organization_id, phone, phone_canonical)
      values (v_org, trim(p_from_handle), public.client_canonical(p_channel_type, p_from_handle))
    on conflict (organization_id, phone_canonical) where phone_canonical is not null
      do update set phone_canonical = excluded.phone_canonical
      returning id into v_client;
  end if;

  insert into public.conversations (organization_id, channel_id, client_id, last_message_at)
    values (v_org, v_channel, v_client, now())
  on conflict (channel_id, client_id)
    do update set last_message_at = now()
    returning id into v_conv;

  insert into public.messages (conversation_id, direction, sender, body, media_path, external_id)
    values (v_conv, 'inbound', 'contact', p_body, p_media_path, p_ext_msg_id)
  returning id into v_msg;

  return jsonb_build_object('message_id', v_msg, 'duplicate', false);
end;
$function$;

create or replace function public.create_appointment_from_chat_v2(
  p_channel_type text, p_external_id text, p_client_phone text, p_service_ids uuid[],
  p_starts_at timestamptz, p_branch_id uuid default null, p_resource_id uuid default null
) returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; v_branch uuid; v_client uuid;
begin
  select organization_id into v_org from public.channels
   where type = p_channel_type and external_id = p_external_id and status <> 'disabled' limit 1;
  if v_org is null then raise exception 'channel_not_found'; end if;

  if p_branch_id is not null then
    select id into v_branch from public.branches where id = p_branch_id and organization_id = v_org;
  else
    select id into v_branch from public.branches where organization_id = v_org order by created_at limit 1;
  end if;
  if v_branch is null then raise exception 'branch_not_found'; end if;

  if p_resource_id is not null and not exists (
    select 1 from public.resources r where r.id = p_resource_id and r.organization_id = v_org and r.active
  ) then
    raise exception 'resource_not_found';
  end if;

  if coalesce(trim(p_client_phone), '') <> '' then
    insert into public.clients (organization_id, phone, phone_canonical)
      values (v_org, trim(p_client_phone), public.client_canonical(p_channel_type, p_client_phone))
    on conflict (organization_id, phone_canonical) where phone_canonical is not null
      do update set phone_canonical = excluded.phone_canonical
      returning id into v_client;
  end if;

  return public.create_appointment_v2(
    v_branch, p_service_ids, p_starts_at, v_client, p_resource_id,
    case p_channel_type when 'whatsapp' then 'whatsapp' when 'telegram' then 'telegram' else 'ai' end,
    null
  );
end;
$function$;

create or replace function public.create_public_appointment_v2(
  p_slug text, p_service_ids uuid[], p_starts_at timestamptz,
  p_client_name text, p_client_phone text, p_resource_id uuid default null
) returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; v_branch uuid; v_client uuid;
begin
  select o.id, b.id into v_org, v_branch
    from public.organizations o
    join public.branches b on b.organization_id = o.id
   where o.web_slug = p_slug order by b.created_at limit 1;
  if v_org is null then raise exception 'not_published'; end if;
  if v_branch is null then raise exception 'branch_not_found'; end if;
  if coalesce(trim(p_client_phone), '') = '' then raise exception 'phone_required'; end if;

  if p_resource_id is not null and not exists (
    select 1 from public.resources r where r.id = p_resource_id and r.organization_id = v_org and r.active
  ) then
    raise exception 'resource_not_found';
  end if;

  insert into public.clients (organization_id, phone, phone_canonical, name)
    values (v_org, trim(p_client_phone), public.client_canonical('web', p_client_phone), nullif(trim(p_client_name), ''))
  on conflict (organization_id, phone_canonical) where phone_canonical is not null
    do update set name = coalesce(nullif(trim(p_client_name), ''), public.clients.name)
  returning id into v_client;

  return public.create_appointment_v2(
    v_branch, p_service_ids, p_starts_at, v_client, p_resource_id, 'web', null
  );
end;
$function$;

-- ---------------------------------------------------------------------
-- READERS
-- ---------------------------------------------------------------------
create or replace function public._resolve_chat_appointment(
  p_channel_type text, p_external_id text, p_client_phone text, p_appointment_id uuid
) returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; v_client uuid; v_ok boolean;
begin
  select organization_id into v_org from public.channels
   where type = p_channel_type and external_id = p_external_id and status <> 'disabled' limit 1;
  if v_org is null then raise exception 'channel_not_found'; end if;

  select id into v_client from public.clients
   where organization_id = v_org
     and phone_canonical = public.client_canonical(p_channel_type, p_client_phone) limit 1;
  if v_client is null then raise exception 'appointment_not_found'; end if;

  select true into v_ok from public.appointments a
   where a.id = p_appointment_id and a.organization_id = v_org and a.client_id = v_client;
  if v_ok is not true then raise exception 'appointment_not_found'; end if;

  select true into v_ok from public.appointments a
   where a.id = p_appointment_id and a.status in ('scheduled','confirmed') and a.starts_at > now();
  if v_ok is not true then raise exception 'not_actionable'; end if;

  return v_org;
end;
$function$;

create or replace function public.confirm_appointment_from_chat(
  p_channel_type text, p_external_id text, p_client_phone text, p_appointment_id uuid
) returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; v_conv uuid;
begin
  v_org := public._resolve_chat_appointment(p_channel_type, p_external_id, p_client_phone, p_appointment_id);

  update public.appointments
     set status = 'confirmed', confirmed_by_client_at = now()
   where id = p_appointment_id;

  select c.id into v_conv
    from public.conversations c
    join public.channels ch on ch.id = c.channel_id
    join public.clients cl on cl.id = c.client_id
   where ch.type = p_channel_type
     and ch.external_id = p_external_id
     and ch.organization_id = v_org
     and cl.phone_canonical = public.client_canonical(p_channel_type, p_client_phone)
   order by c.last_message_at desc nulls last, c.created_at desc
   limit 1;

  return jsonb_build_object('conversation_id', v_conv);
end;
$function$;

create or replace function public.set_client_name_from_chat(
  p_channel_type text, p_external_id text, p_client_phone text, p_name text
) returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; v_name text;
begin
  v_name := nullif(btrim(p_name), '');
  if v_name is null then return; end if;
  if length(v_name) > 80 then v_name := left(v_name, 80); end if;

  select organization_id into v_org from public.channels
   where type = p_channel_type and external_id = p_external_id and status <> 'disabled' limit 1;
  if v_org is null then return; end if;

  update public.clients
     set name = v_name
   where organization_id = v_org
     and phone_canonical = public.client_canonical(p_channel_type, p_client_phone);
end;
$function$;

-- get_agent_context: solo cambia la resolución del cliente (por canónico).
create or replace function public.get_agent_context(p_channel_type text, p_external_id text, p_from_handle text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_org uuid; v_channel uuid; v_conv uuid; v_client uuid; v_branch uuid; v_result jsonb;
begin
  select id, organization_id into v_channel, v_org
    from public.channels
   where type = p_channel_type and external_id = p_external_id and status <> 'disabled'
   limit 1;
  if v_channel is null then return null; end if;

  select id into v_client from public.clients
   where organization_id = v_org
     and phone_canonical = public.client_canonical(p_channel_type, p_from_handle) limit 1;

  select id into v_conv from public.conversations
   where channel_id = v_channel and client_id is not distinct from v_client limit 1;
  if v_conv is null then return null; end if;

  select b.id into v_branch
    from public.branches b where b.organization_id = v_org order by b.created_at limit 1;

  select jsonb_build_object(
    'org_id', v_org,
    'conversation', (
      select jsonb_build_object(
        'id', c.id, 'status', c.status, 'ai_enabled', c.ai_enabled,
        'ai_paused_until', c.ai_paused_until,
        'channel_type', p_channel_type, 'channel_external_id', p_external_id,
        'client_id', v_client, 'client_handle', trim(p_from_handle),
        'client_name', (select name from public.clients where id = v_client),
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
        from public.branches b where b.id = v_branch
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes,
        'price', s.price, 'description', s.description) order by s.name)
      from public.service_catalogs s where s.organization_id = v_org and s.active
    ), '[]'::jsonb),
    'resources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name,
        'service_ids', coalesce((
          select jsonb_agg(rs.service_id)
            from public.resource_services rs where rs.resource_id = r.id
        ), '[]'::jsonb)
      ) order by r.sort_order, r.name)
      from public.resources r
      where r.organization_id = v_org and r.active
        and (r.branch_id is null or r.branch_id = v_branch)
        and exists (select 1 from public.staff_schedules ss where ss.resource_id = r.id and ss.branch_id = v_branch)
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.name, 'price', p.price, 'description', p.description) order by p.name)
      from public.products p where p.organization_id = v_org and p.active
    ), '[]'::jsonb),
    'knowledge', coalesce((
      select jsonb_agg(k.content order by k.created_at)
      from public.knowledge_base k where k.organization_id = v_org
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(m order by m.created_at)
      from (
        select direction, sender, body, created_at from public.messages
        where conversation_id = v_conv order by created_at desc limit 20
      ) m
    ), '[]'::jsonb),
    'upcoming_appointments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'starts_at', u.starts_at, 'ends_at', u.ends_at,
        'status', u.status, 'services', u.services, 'resource_name', u.resource_name) order by u.starts_at)
      from (
        select a.id, a.starts_at, a.ends_at, a.status,
               (select r.name from public.resources r where r.id = a.resource_id) as resource_name,
               coalesce((
                 select string_agg(sc.name, ' + ' order by sc.name)
                   from public.appointment_services aps
                   join public.service_catalogs sc on sc.id = aps.service_id
                  where aps.appointment_id = a.id
               ), 'Cita') as services
          from public.appointments a
         where a.client_id = v_client and a.organization_id = v_org
           and a.status in ('scheduled','confirmed') and a.starts_at > now()
         order by a.starts_at limit 5
      ) u
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;
