# PRP · API de socios v2 + app de Meta por socio (nivel 3) — EJECUTADO 2026-10-13

GO de Juan el 13-oct-2026 a tres pendientes de PASEN. Todo en producción el mismo día.

## 1. Herramientas de ¡Pasen! solo en WhatsApp
- **Problema**: `buildPasenTools` usaba `client_handle` como teléfono sin mirar el canal; en Messenger/Instagram es un PSID y se le habría mandado a PASEN como WhatsApp del cliente.
- **Fix**: `channelType` en `buildPasenTools`; `null` salvo `whatsapp` o sandbox. Pruebas en `pasen-tools.test.ts`.

## 2. Catálogo en el alta por API
- `POST /organizations` acepta `services`, `hours`, `brandColor` (esquemas en `catalog-schema.ts`, compartidos con `PUT /catalog`).
- Orden: siembra → `applyPartnerCatalog` (alinea al profesional sembrado, marca `catalog_managed_by_partner`) → se borran los servicios de ejemplo (`partner_ref null`, org nueva sin citas).
- Respuesta añade `catalog: { services: [{externalId, id}], hoursUpdated }`.

## 3. Webhooks salientes
- Migración `20261013120000_socios_webhooks.sql`: `partners.webhook_url/webhook_secret`, tabla `partner_webhook_deliveries` (RLS, solo service_role), disparador `appointments_partner_webhook` (insert / update de status, starts_at, ends_at, resource_id) → encola y `kick_partner_webhooks()` (pg_net → `/api/cron/partner-webhooks` con el `cron_secret` de Vault). RPC `claim_partner_webhook_deliveries` con `for update skip locked` y backoff 1m/5m/30m/2h/12h, 6 intentos.
- Código: `src/features/socios/webhooks.ts` (despacho, cuerpo con el estado ACTUAL de la cita), `webhooks-sign.ts` (firma `v1=HMAC-SHA256(secret, ts.body)`, validación de URL https pública), rutas `GET/PUT/DELETE /api/partners/v1/webhook`, `POST /webhook/test`, `GET /api/cron/partner-webhooks`; la corrida de 15 min también despacha (reintentos).
- E2E en prod (socio zztest, borrado): http → 400; test → 200; cita creada y cancelada → 2 entregas con 200 al primer intento.

## 4. App de Meta por socio (nivel 3)
- Migración `20261013130000_partners_meta_app.sql`: `partners.meta_app_id/secret/config_id/pages_config_id/system_user_token`, RPC `admin_set_partner_meta` ('' borra, null conserva), `admin_list_partners` con `meta.{app_id, config_id, pages_config_id, has_secret, has_system_user_token}`.
- `src/features/marca/meta-app.ts`: `metaAppForOrg` (la del socio si está COMPLETA: id + secreto + config de WhatsApp; si no, ChatVenti), `metaAppSecrets` (todas las apps, para firmar webhooks).
- Usan la app del negocio: Conexiones (botones), `/api/whatsapp/embedded-signup` (canje del code, system user token, plantillas), `/api/meta/connect-pages`, plantillas (`managementTokens(token, systemUserToken)`); webhooks WhatsApp y Meta aceptan la firma de cualquier app conocida.
- Panel: `/admin/socios` → botón «App de Meta: propia | ChatVenti» (solo socios internos) → `MetaAppForm`.
- **Lado de Meta (Juan)**: ver `docs/api-socios.md` → «La ventana de Meta con la marca del socio (nivel 3)». Sin App Review aprobado en la app nueva, solo conectan cuentas con rol en esa app.

## Gotchas de esta ejecución
- `import 'server-only'` rompe vitest: la parte pura (firma, URL) vive en `webhooks-sign.ts`.
- `node -e "…"` con comillas dobles deja que Bash expanda `$480` y rompa el dollar-quoting de SQL: scripts en archivo.
- Las migraciones se aplicaron por la API de SQL de Supabase (MCP caído); tipos regenerados por `GET /types/typescript`.
