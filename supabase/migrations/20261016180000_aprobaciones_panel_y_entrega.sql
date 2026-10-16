-- =====================================================================
-- 16-oct-2026 · Aprobaciones desde el panel y estado de entrega de WhatsApp
--
-- 1. ai_approvals.status 'answered': el equipo contestó él mismo (desde el
--    panel o desde su app WhatsApp Business) en vez de aprobar el borrador.
--    Sin esto la respuesta quedaba «pendiente» para siempre y la recepcionista
--    no volvía a contestar esa plática (should_respond exige 0 pendientes).
-- 2. messages.wa_status / wa_status_at / wa_error: lo que Meta reporta de cada
--    mensaje que sale (enviado, entregado, leído, falló). Antes se ignoraba:
--    un retraso o un rechazo de Meta no se veía en ningún lado.
-- 3. log_coexistence_message: un eco del dueño (escribió desde su app) cierra
--    las aprobaciones pendientes de esa plática y la saca de «Te espera».
-- 4. apply_wa_status: aplica un estado sin retroceder (leído no vuelve a
--    entregado). Solo service_role: la llama el webhook tras validar la firma.
-- =====================================================================

alter table public.ai_approvals drop constraint if exists ai_approvals_status_check;
alter table public.ai_approvals
  add constraint ai_approvals_status_check check (status in ('pending', 'approved', 'rejected', 'answered'));

alter table public.messages
  add column if not exists wa_status text check (wa_status in ('sent', 'delivered', 'read', 'failed')),
  add column if not exists wa_status_at timestamptz,
  add column if not exists wa_error text;

-- Ojo: `messages` tiene grant de TABLA a authenticated + policy message_write
-- (miembros de la org), así que un revoke por columna aquí no haría nada. Las
-- columnas son informativas y solo de la propia org; las escribe apply_wa_status.

create or replace function public.apply_wa_status(p_ext_id text, p_status text, p_at timestamptz default null, p_error text default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_rows int;
begin
  if p_status not in ('sent', 'delivered', 'read', 'failed') or coalesce(p_ext_id, '') = '' then
    return false;
  end if;
  update public.messages m
     set wa_status = p_status,
         wa_status_at = coalesce(p_at, now()),
         wa_error = case when p_status = 'failed' then left(p_error, 300) else null end
   where m.external_id = p_ext_id
     and (
       p_status = 'failed'
       or m.wa_status is null
       or (case m.wa_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 0 end)
          < (case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 0 end)
     );
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$function$;

revoke execute on function public.apply_wa_status(text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.apply_wa_status(text, text, timestamptz, text) to service_role;

create or replace function public.log_coexistence_message(p_phone_number_id text, p_customer text, p_direction text, p_body text, p_ext_id text DEFAULT NULL::text, p_origin text DEFAULT 'business_app'::text, p_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_pause_minutes integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid; v_channel uuid; v_client uuid; v_conv uuid; v_msg uuid;
  v_at timestamptz := coalesce(p_at, now());
begin
  if p_direction not in ('inbound', 'outbound') or p_origin not in ('business_app', 'history') then
    raise exception 'invalid_input';
  end if;
  select id, organization_id into v_channel, v_org
    from public.channels
   where type = 'whatsapp' and external_id = p_phone_number_id and status <> 'disabled'
   limit 1;
  if v_channel is null then
    return jsonb_build_object('message_id', null, 'duplicate', false, 'reason', 'no_channel');
  end if;

  -- Un eco de un mensaje que mandó la propia API ya existe con ese id: no se
  -- duplica ni pausa a la recepcionista.
  if p_ext_id is not null then
    select id into v_msg from public.messages where external_id = p_ext_id limit 1;
    if v_msg is not null then
      return jsonb_build_object('message_id', v_msg, 'duplicate', true);
    end if;
  end if;

  if coalesce(trim(p_customer), '') = '' then
    return jsonb_build_object('message_id', null, 'duplicate', false, 'reason', 'no_customer');
  end if;
  insert into public.clients (organization_id, phone, phone_canonical)
    values (v_org, trim(p_customer), public.client_canonical('whatsapp', p_customer))
  on conflict (organization_id, phone_canonical) where phone_canonical is not null
    do update set phone_canonical = excluded.phone_canonical
    returning id into v_client;

  insert into public.conversations (organization_id, channel_id, client_id, last_message_at)
    values (v_org, v_channel, v_client, v_at)
  on conflict (channel_id, client_id)
    do update set last_message_at = greatest(public.conversations.last_message_at, excluded.last_message_at)
    returning id into v_conv;

  insert into public.messages (conversation_id, direction, sender, body, external_id, created_at, origin)
    values (v_conv, p_direction, case when p_direction = 'inbound' then 'contact' else 'agent' end,
            coalesce(p_body, ''), p_ext_id, v_at, p_origin)
  returning id into v_msg;

  if coalesce(p_pause_minutes, 0) > 0 then
    update public.conversations
       set ai_paused_until = greatest(coalesce(ai_paused_until, now()), now() + make_interval(mins => p_pause_minutes))
     where id = v_conv;
  end if;

  if p_origin = 'business_app' then
    update public.channels set app_activity_at = now(), coexistence_alert_level = 0 where id = v_channel;
    -- El dueño contestó desde su app: lo que la recepcionista dejó esperando
    -- aprobación ya no aplica, y la plática deja de estar «Te espera».
    if p_direction = 'outbound' then
      update public.ai_approvals set status = 'answered', resolved_at = now()
       where conversation_id = v_conv and status = 'pending';
      update public.conversations set status = 'open' where id = v_conv and status = 'pending';
    end if;
  end if;

  return jsonb_build_object('message_id', v_msg, 'duplicate', false, 'conversation_id', v_conv, 'organization_id', v_org);
end;
$function$;

revoke execute on function public.log_coexistence_message(text, text, text, text, text, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.log_coexistence_message(text, text, text, text, text, text, timestamptz, integer) to service_role;
