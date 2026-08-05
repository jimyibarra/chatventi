-- =====================================================================
-- ChatVenti · Superpoderes del agente · Fase 2: ingesta de media entrante
--
--   Hasta hoy los tres webhooks llamaban a route_inbound_message con
--   p_media_path := null: el binario que manda el cliente (comprobante,
--   nota de voz) NUNCA se descargaba. Esta migración habilita guardarlo.
--
--   1. Bucket PRIVADO `inbound`. NO se reutiliza `media` porque es
--      PÚBLICO de lectura y solo admite imágenes: guardar ahí el
--      comprobante de un cliente lo dejaría accesible a cualquiera con
--      la URL, y una nota de voz ni siquiera pasaría el filtro MIME.
--   2. messages.media_mime — qué es el archivo (lo decide la Fase 3
--      para elegir entre visión y transcripción).
--   3. RPC attach_message_media — el webhook ancla el archivo al mensaje
--      DESPUÉS de responder 200 (la descarga no puede bloquear el ACK
--      del proveedor, que reintenta si tarda).
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. Bucket privado de media entrante
--    16 MB = el techo de WhatsApp para audio y video.
--    Se admiten los MIME que los clientes mandan de verdad por chat.
--    Video queda fuera a propósito: pesa, no aporta a agendar y hoy
--    nadie lo va a leer.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inbound', 'inbound', false, 16777216,
        array[
          'image/png','image/jpeg','image/webp','image/gif',
          'audio/ogg','audio/mpeg','audio/mp4','audio/aac','audio/amr','audio/wav','audio/webm',
          'application/pdf'
        ])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- La subida la hace SIEMPRE el servidor con el service client (bypassa
-- RLS): no hay policy de insert para el browser, a diferencia de
-- `records`. Nadie sube aquí desde el cliente.

-- Lectura para miembros de la misma org. El dashboard usa URL firmada,
-- así que esto es la segunda barrera, no la principal.
drop policy if exists inbound_select_own_org on storage.objects;
create policy inbound_select_own_org on storage.objects
  for select to authenticated
  using (
    bucket_id = 'inbound'
    and (storage.foldername(name))[1] = public.get_my_org()::text
  );

-- ---------------------------------------------------------------
-- 2. Tipo del archivo entrante
-- ---------------------------------------------------------------
alter table public.messages
  add column if not exists media_mime text;

-- ---------------------------------------------------------------
-- 3. attach_message_media
--    Invocable por ANON: el webhook usa la ANON key a propósito (patrón
--    route_inbound_message). Por eso la función es estrecha a propósito:
--      · solo mensajes ENTRANTES,
--      · solo si aún no tienen archivo (no se puede sobrescribir),
--      · y la ruta debe vivir bajo la carpeta de la org dueña del
--        mensaje, así que ni adivinando un uuid se puede apuntar un
--        mensaje al archivo de otra organización.
--    Devuelve true solo si ancló de verdad.
-- ---------------------------------------------------------------
create or replace function public.attach_message_media(
  p_message_id uuid,
  p_media_path text,
  p_media_mime text
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org     uuid;
  v_updated integer;
begin
  if p_message_id is null or coalesce(trim(p_media_path), '') = '' then
    return false;
  end if;

  select c.organization_id
    into v_org
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
   where m.id = p_message_id
     and m.direction = 'inbound'
     and m.media_path is null;

  if v_org is null then
    return false;
  end if;

  if p_media_path not like v_org::text || '/%' then
    raise notice 'attach_message_media: ruta % fuera de la org %', p_media_path, v_org;
    return false;
  end if;

  update public.messages
     set media_path = p_media_path,
         media_mime = p_media_mime
   where id = p_message_id
     and media_path is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- Gotcha de grants por defecto de Supabase: dejarlos explícitos.
revoke all on function public.attach_message_media(uuid, text, text) from public;
grant execute on function public.attach_message_media(uuid, text, text)
  to anon, authenticated, service_role;
