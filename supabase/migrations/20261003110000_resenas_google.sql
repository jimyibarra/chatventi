-- =====================================================================
-- Reseñas en Google tras la encuesta post-cita.
--
--   El negocio guarda el enlace para dejar reseña (pegado a mano o resuelto
--   con Google Places a partir de su ficha). Quien responde la encuesta
--   recibe el enlace — TODOS, no solo los contentos: Google prohíbe pedir
--   reseñas de forma selectiva y la FTC (EE. UU.) sanciona filtrar opiniones.
--
--   record_csat devuelve además lo necesario para ese mensaje y para avisar
--   al dueño de una nota baja, sin una segunda consulta desde el webhook.
-- =====================================================================

alter table public.organizations
  add column if not exists google_review_url text,
  add column if not exists google_place_id text;

alter table public.organizations
  drop constraint if exists organizations_google_review_url_check;
alter table public.organizations
  add constraint organizations_google_review_url_check
  check (google_review_url is null or (google_review_url ~ '^https://' and length(google_review_url) <= 500));

-- Tabla con permisos por columna (migración 20261003090000): una columna
-- nueva nace sin permiso de escritura. Estas dos sí las decide el dueño.
grant update (google_review_url, google_place_id) on public.organizations to authenticated;

create or replace function public.record_csat(p_channel_type text, p_external_id text, p_client_phone text, p_appointment_id uuid, p_score smallint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org    uuid;
  v_client uuid;
  v_conv   uuid;
  v_id     uuid;
  v_client_name text;
  v_org_row record;
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

  select id, name into v_client, v_client_name
    from public.clients
   where organization_id = v_org
     and phone_canonical = public.client_canonical(p_channel_type, p_client_phone)
   limit 1;
  if v_client is null then raise exception 'appointment_not_found'; end if;

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

  select o.name, o.contact_email, o.google_review_url into v_org_row
    from public.organizations o where o.id = v_org;

  return jsonb_build_object(
    'conversation_id', v_conv,
    'duplicate', v_id is null,
    'review_url', v_org_row.google_review_url,
    'org_name', v_org_row.name,
    'contact_email', v_org_row.contact_email,
    'client_name', v_client_name
  );
end;
$function$;

-- Devuelve el correo del dueño: solo el servidor (webhooks con service_role).
revoke execute on function public.record_csat(text, text, text, uuid, smallint) from public, anon, authenticated;
grant execute on function public.record_csat(text, text, text, uuid, smallint) to service_role;
