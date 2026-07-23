-- =====================================================================
-- ChatVenti · Storage de imágenes (logo + producto + profesional)
--   Bucket `media` público de lectura; escritura aislada por org via RLS.
--   El borrado lo hace el servidor con service_role (salta RLS).
--   Aditivo y seguro (expand/contract): no toca datos existentes.
-- =====================================================================

-- 1. Bucket público con topes de tipo y tamaño (5 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Lectura pública (las imágenes se muestran en /r/[slug], correos, etc.).
drop policy if exists media_read_public on storage.objects;
create policy media_read_public on storage.objects
  for select
  using (bucket_id = 'media');

-- 3. Subida: solo usuarios autenticados y SOLO a la carpeta de SU organización.
--    La ruta es "<orgId>/<carpeta>/<archivo>": el 1er segmento = org.
--    UNIQUE por org -> un dueño no puede escribir en la carpeta de otro.
drop policy if exists media_insert_own_org on storage.objects;
create policy media_insert_own_org on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = public.get_my_org()::text
  );
