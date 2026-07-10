-- Fase 8 (auto-blindaje): route_inbound_message devuelve jsonb
-- { message_id, duplicate } para que los webhooks NO disparen al agente
-- ante reintentos del proveedor. Meta reenvía el mismo wamid si tarda el
-- ACK: el insert ya se dedupeaba, pero el agente respondía dos veces.

drop function if exists public.route_inbound_message(text, text, text, text, text, text);

create function public.route_inbound_message(
  p_channel_type text,
  p_external_id text,
  p_from_handle text,
  p_body text,
  p_media_path text default null,
  p_ext_msg_id text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org     uuid;
  v_channel uuid;
  v_client  uuid;
  v_conv    uuid;
  v_msg     uuid;
begin
  select id, organization_id
    into v_channel, v_org
    from public.channels
   where type = p_channel_type
     and external_id = p_external_id
     and status <> 'disabled'
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
    insert into public.clients (organization_id, phone)
      values (v_org, trim(p_from_handle))
    on conflict (organization_id, phone)
      do update set phone = excluded.phone
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
$$;

-- Gotcha de grants por defecto de Supabase: dejarlos explícitos.
revoke all on function public.route_inbound_message(text, text, text, text, text, text) from public;
grant execute on function public.route_inbound_message(text, text, text, text, text, text)
  to anon, authenticated, service_role;
