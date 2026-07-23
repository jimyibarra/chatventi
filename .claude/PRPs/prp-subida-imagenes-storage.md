# PRP — Subida de imágenes a Storage (logo + producto + profesional)

> Origen: feedback de Juan sobre las imágenes `Falta Foto Prod.png`,
> `Falta imagen de productos.png` (logo) y `Foto profesional.png`.
> Decisión de Juan: **solo subida desde dispositivo (PC/celular), SIN campo de URL.**

## Objetivo

Que el dueño suba imágenes **desde su dispositivo** (no pegando URLs) para:
1. **Logo** del negocio (Reservas Web → aparece en `/r/[slug]`, correos, público).
2. **Foto por producto** (tienda).
3. **Foto del profesional** (para que el cliente reconozca a quién lo atiende).

Con **borrar / cambiar** en los tres, aislamiento **por dueño** (no se mezclan entre
orgs), y **borrado en cascada** de la imagen cuando se borra el producto.

## Modelo / infraestructura

- **Bucket `media`** (Supabase Storage), **público de lectura** (las imágenes se muestran
  en páginas públicas), con topes: `image/png|jpeg|webp`, 5 MB.
- **Aislamiento por org = la PRIMERA carpeta de la ruta:** `"<orgId>/logo/<uuid>.<ext>"`,
  `"<orgId>/products/<uuid>.<ext>"`, `"<orgId>/resources/<uuid>.<ext>"`.
- **RLS en `storage.objects`:** lectura pública; `INSERT` solo `authenticated` cuya
  `(storage.foldername(name))[1] = get_my_org()::text` → un dueño no puede escribir en la
  carpeta de otro. (El borrado lo hace el servidor con `service_role`, que salta RLS.)
- Los campos existentes NO cambian de forma: se sigue guardando la **URL pública** en
  `branding.logo_url`, `products.image_url`, `resources.photo_url`. Así las páginas
  públicas y correos siguen funcionando sin tocarlas.

## Piezas

| Archivo | Rol |
|---|---|
| `supabase/migrations/20260722000000_media_storage.sql` | Bucket `media` + policies (aditivo) |
| `src/features/storage/media.ts` | `removeMediaByUrl(url)` — borra el objeto por su URL pública (service_role) |
| `src/shared/components/image-upload.tsx` | Componente cliente reutilizable: elegir → validar → subir → preview → Cambiar/Quitar |
| `reservas-web/actions.ts` | `saveLogo(url\|null)`, `setProductImage(id,url\|null)`; `deleteProduct` borra la imagen; `saveWebConfig` deja de tocar el logo |
| `reservas-web/components/web-config-form.tsx` | Logo por subida (quita el input de URL) |
| `reservas-web/components/product-manager.tsx` | Miniatura + subida por producto |
| `profesionales/actions.ts` | `setResourcePhoto(id,url\|null)` |
| `profesionales/components/resource-card.tsx` | Foto por subida (quita el input de URL) |
| páginas | pasan `orgId` a los componentes |

## Flujo de subida

1. El cliente (browser, sesión del dueño) sube a `media` con RLS → obtiene la **URL
   pública**.
2. Llama a la Server Action del módulo, que **persiste la URL** en el campo y, si había una
   imagen anterior distinta, **borra el objeto viejo** con `service_role`
   (`removeMediaByUrl`). Sin huérfanos.
3. **Borrar producto** → `deleteProduct` lee `image_url`, borra la fila y borra el objeto.
4. **Quitar** (logo/producto/profesional) → guarda `null` y borra el objeto.

## Decisiones / gotchas

- **Limpieza server-side** (no desde el browser): la BD es la fuente de verdad del "URL
  anterior", así no hay carreras ni se depende del policy de DELETE en el browser.
- `saveWebConfig` **ya NO escribe `logo_url`** (lo maneja `saveLogo`): si lo siguiera
  escribiendo con el form sin ese campo, **borraría el logo** al guardar el resto.
- Aislamiento por org validado en la RLS de INSERT: la ruta empieza por `<orgId>`.
- Sin campo de URL (decisión de Juan). Guía de specs visible en el UI del logo.
- Ayuda contextual: cada control lleva un texto de qué imagen subir.

## Fuera de alcance (fases posteriores)

- Historial clínico / archivos por cliente + recordatorios recurrentes (PRP aparte).
- Recorte/optimización de imagen en el cliente (se puede añadir luego).
