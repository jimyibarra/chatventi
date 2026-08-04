# PRP — Canales Meta: Instagram DM + Facebook Messenger

> **Estado**: PENDIENTE (no se ha tocado código)
> **Fecha**: 2026-08-04
> **Proyecto**: ChatVenti
> **Origen**: análisis competitivo vs **Forjabots**

> **Este PRP es autocontenido.** Es uno de tres derivados del mismo análisis:
> `prp-verticales-seo.md` (landings por giro + voz de marca), `prp-canales-meta.md` (este) y
> `prp-superpoderes-agente.md` (capacidades del agente).
> **Los tres son independientes y pueden ejecutarse en paralelo**, por equipos distintos y
> en cualquier orden. No comparten archivos críticos ni migraciones. La única dependencia
> interna del conjunto vive dentro del Track C (la ingesta de media va antes de visión y
> transcripción) y no afecta a este PRP.

---

## Objetivo

Que el mismo agente que hoy atiende WhatsApp y Telegram atienda también **Instagram Direct**
y **Facebook Messenger**, reutilizando el webhook de Meta, el motor de conversaciones y las
tools de agenda que ya existen. Un DM de Instagram debe entrar a la misma bandeja, crear la
misma conversación y agendar con las mismas RPC que un mensaje de WhatsApp.

---

## Por Qué

| Problema | Solución |
|---|---|
| Forjabots vende Instagram y Messenger; ChatVenti solo WhatsApp y Telegram. Es una objeción directa en la venta. | Paridad de canales con el competidor. |
| Los negocios de **estética, spa, uñas y barbería** —cuatro de nuestros seis rubros— reciben la mayoría de sus mensajes por **Instagram DM**, no por WhatsApp. | El canal donde ya está su clientela. |
| Hoy esos DMs los contesta el dueño a mano, fuera del sistema: no hay historial, ni CRM, ni agenda. | Una sola bandeja para los cuatro canales. |
| El motor **ya es multicanal** (Telegram lo demuestra) y las RPC ya están parametrizadas por canal: no explotar eso es dejar valor construido sin cobrar. | Añadir dos canales es ampliar, no reescribir. |

**Valor de negocio**: elimina una objeción de venta recurrente, abre el canal principal de
cuatro de los seis rubros objetivo, y aumenta el volumen de conversaciones que justifica los
tiers de IA ($19/$39/$109).

---

## Qué

### Criterios de Éxito

- [ ] Un DM de Instagram a la cuenta conectada crea `client` + `conversation` + `message` en la **org correcta**, y el agente responde por Instagram.
- [ ] Lo mismo por Messenger desde una página de Facebook.
- [ ] El **handle de IG/Messenger no se deforma** al guardarse: verificado leyendo `clients.phone_canonical` en la BD.
- [ ] Una cita agendada desde Instagram queda con `appointments.source = 'instagram'` (no con el genérico `'ai'`).
- [ ] El agente usa sus tools de agenda por los canales nuevos igual que por WhatsApp (consultar disponibilidad, reservar, cancelar, reagendar).
- [ ] El escalamiento a humano y la aprobación por Telegram funcionan para conversaciones originadas en IG/Messenger.
- [ ] **El webhook de WhatsApp sigue funcionando sin cambiar la URL registrada en Meta** (regresión E2E obligatoria, no negociable).
- [ ] Telegram sigue funcionando igual (regresión E2E).
- [ ] La pantalla de conexiones y la bandeja de conversaciones muestran los cuatro canales con su etiqueta y logo.
- [ ] Los envíos fuera de la ventana de 24 h (recordatorios) **no fallan en silencio**: o usan un tag válido, o se registran como no enviables.

### Comportamiento Esperado

Un cliente manda un DM por Instagram. Meta pega al webhook unificado, se valida la firma
HMAC del body crudo, se despacha por `object`, se resuelve la cuenta de IG → canal → org, y
el mensaje entra por la misma RPC `route_inbound_message` que usan WhatsApp y Telegram. El
mismo `runAgent` responde por Instagram con las mismas tools. En la bandeja aparece con el
icono de Instagram, y el dueño puede tomar la conversación a mano. Si el agente escala, la
aprobación llega por Telegram como siempre y, al aprobarse, el texto sale por Instagram.

---

## Contexto

### Referencias del codebase (investigadas)

**El activo clave: el motor ya es multicanal.** Telegram no es un parche, es un segundo canal
completo. Eso significa que añadir IG/Messenger es sobre todo **ampliar dos `CHECK`,
escribir un parser y añadir dos ramas a dos dispatchers** — no reescribir el motor.

- `src/app/api/webhooks/whatsapp/route.ts` — GET de verificación con `hub.challenge` y `META_WEBHOOK_VERIFY_TOKEN`; firma HMAC-SHA256 del **rawBody** con `META_APP_SECRET` comparada con `timingSafeEqual`; `runtime = 'nodejs'` (obligatorio: la firma es sobre el cuerpo crudo); **responde 200 siempre**; el trabajo pesado va en `after()` para no provocar reintentos de Meta. Parsea `entry[].changes[].value.messages[]` con `metadata.phone_number_id` como identificador del canal.
- `src/app/api/channels/telegram/route.ts` — **el patrón a copiar**: valida secreto, parsea el update, llama `route_inbound_message`, despierta `runAgent` en `after()`, maneja `callback_query` con prefijos `appr:` / `say:` / `conf:`.
- `src/features/agente-ia/senders.ts` — `sendToCustomerByChannel()` y `sendButtonsToCustomerByChannel()` son **dos dispatchers `if/else` por `channelType`**: ahí se enchufan los canales nuevos. También `getWaToken(service, channelExternalId)` (lee `channels.credentials.access_token`), `waSendMessage`, `waSendInteractiveButtons`, `tgSendMessage`, `tgSendApproval`, `tgSendChoiceButtons`, `tgAnswerCallback`, `tgEditMessageText`.
- `src/features/agente-ia/agent.ts` — `runAgent({ channelType, externalId, fromHandle, supabase, senders, sandbox })`. La unión de `channelType` está **cerrada a `'whatsapp' | 'telegram' | 'web'`**. 6 tools: `check_availability`, `book_appointment`, `cancel_appointment`, `reschedule_appointment`, `save_client_name`, `request_human_approval`.
- `src/features/agente-ia/types.ts` — `AgentSenders` (`sendToCustomer`, `sendApproval`, `sendButtons`): buena abstracción, lista para un canal más. `AgentContext.conversation.channel_type` es otra unión cerrada.
- `src/features/agente-ia/media.ts` — `handleIncomingMedia`, con unión `'whatsapp' | 'telegram'` a ampliar.
- `src/features/conexiones/components/embedded-signup-button.tsx` + `src/app/api/whatsapp/embedded-signup/route.ts` — **Embedded Signup de Meta ya implementado**: OAuth code → token → `subscribed_apps` → `register` → upsert en `channels`. El OAuth de páginas de Facebook / cuentas de IG Business sigue el mismo molde.

**Base de datos**

- `channels` (`supabase/migrations/20260702000000_fase0_baseline.sql`):
  ```
  id, organization_id, type, external_id, waba_id, display_name,
  credentials jsonb, status, created_at
  check (type in ('whatsapp','telegram','web'))     ← ampliar
  unique (type, external_id)
  ```
- `clients` (`20260703000000_fase1_inbound_engine.sql`): `id, organization_id, phone, name, created_at`, `unique(organization_id, phone)`. **El handle de cualquier canal se guarda en una columna llamada `phone`.**
- `conversations`: `organization_id, channel_id, client_id, assigned_agent_id, status, ai_enabled, ai_paused_until, last_message_at`, `unique(channel_id, client_id)`.
- `messages`: `conversation_id, direction, sender, agent_id, body, media_path, external_id`, con índice único parcial en `external_id` (dedup idempotente de reintentos del proveedor).
- `20260723020000_phone_canonical_p1.sql` — `normalize_phone_mx(raw)` y **`client_canonical(p_channel_type, raw)`**, que hoy solo exceptúa `telegram` y los handles `sandbox:%`; **todo lo demás se normaliza como teléfono mexicano**. Índice `clients(organization_id, phone_canonical)`.

**RPCs SECURITY DEFINER (el webhook usa ANON key a propósito, por diseño portado de SastrePro2)**
`route_inbound_message(p_channel_type, p_external_id, p_from_handle, p_body, p_media_path, p_ext_msg_id) → {message_id, duplicate}`,
`get_agent_context(p_channel_type, p_external_id, p_from_handle)`, `log_outbound_message`,
`create_ai_approval`, `resolve_ai_approval`, `create_appointment_from_chat_v2`,
`cancel_appointment_from_chat`, `reschedule_appointment_from_chat`, `set_client_name_from_chat`,
`get_available_slots_v2`, `confirm_appointment_from_chat`, `get_due_reminders(p_kind)` / `claim_reminder`.
**Todas están ya parametrizadas por `(p_channel_type, p_external_id, p_client_phone)`: no hay que reescribirlas para un canal nuevo.**

**Cron y envíos fuera de conversación**
- `vercel.json` — **un solo cron**: `/api/cron/appointment-reminders` a las `0 14 * * *`.
- `src/app/api/cron/appointment-reminders/route.ts` (463 líneas) — envía recordatorios `24h`/`2h`/`followup` con `sendToCustomerByChannel` / `sendButtonsToCustomerByChannel`. **Envía fuera de la conversación**, que es justo donde IG/Messenger aplican la ventana de 24 h.
- **No existe ninguna abstracción de plantillas/HSM ni de ventana de 24 h en todo el repo.** Todos los envíos son free-form.

**Verificado por búsqueda**: `instagram|messenger|igsid|psid` aparece **una sola vez** en
todo `src/`, y es copy de marketing (`landing/data.ts`, "tu bio de Instagram"). El canal es
enteramente greenfield.

### Arquitectura propuesta

```
src/app/api/webhooks/meta/route.ts      # NUEVO — GET verify + POST con dispatch por body.object
src/app/api/webhooks/whatsapp/route.ts  # SE MANTIENE VIVO — URL ya registrada en Meta

src/features/canales/                   # NUEVO
├── meta-shared.ts                      # firma HMAC + hub.challenge (extraído, sin cambiar semántica)
├── whatsapp.ts                         # parser actual, movido tal cual
├── instagram.ts                        # parser entry[].messaging[] + sender IG
└── messenger.ts                        # parser entry[].messaging[] + sender Page

src/features/agente-ia/senders.ts       # MODIFICADO — 2 ramas nuevas en cada dispatcher
src/features/agente-ia/agent.ts         # MODIFICADO — unión de canal + matiz de prompt
src/features/agente-ia/types.ts         # MODIFICADO — uniones de canal
src/features/conexiones/                # MODIFICADO — conexión y listado multicanal
```

### Modelo de datos (aditivo, expand-only)

```sql
-- 1. Ampliar los CHECK existentes (NO recrear las tablas)
alter table public.channels drop constraint if exists channels_type_check;
alter table public.channels add constraint channels_type_check
  check (type in ('whatsapp','telegram','web','instagram','messenger'));

alter table public.appointments drop constraint if exists appointments_source_check;
alter table public.appointments add constraint appointments_source_check
  check (source in ('staff','whatsapp','telegram','web','ai','instagram','messenger'));

-- 2. Los handles de IG/Messenger NO son teléfonos: bypass del normalizador MX
create or replace function public.client_canonical(p_channel_type text, raw text)
returns text language plpgsql immutable set search_path = public as $$
begin
  if raw is null then return null; end if;
  if raw like 'sandbox:%' then return raw; end if;
  if p_channel_type in ('telegram','instagram','messenger') then return raw; end if;
  return public.normalize_phone_mx(raw);
end;
$$;

-- 3. create_appointment_from_chat_v2: hoy mapea el canal con `case ... else 'ai' end`.
--    Añadir 'instagram' y 'messenger' o toda cita de IG quedará marcada como 'ai'.

-- 4. Colisión de handles entre canales (evaluar en la Fase 1):
--    hoy unique(organization_id, phone) e índice (organization_id, phone_canonical)
--    NO incluyen el canal. Dos canales con handles numéricos pueden chocar.
--    Opción evaluada: unicidad por (organization_id, channel_type, handle).
```

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico:
> mapear contexto real → generar subtareas → ejecutar → auto-blindaje).

### Fase 1: EXPAND de base de datos (aditivo, sin romper nada)
**Objetivo**: ampliar los dos `CHECK` (`channels.type`, `appointments.source`), añadir el
bypass de `client_canonical` para los handles de IG/Messenger, corregir el mapeo de `source`
en `create_appointment_from_chat_v2`, y decidir la unicidad de handles entre canales.
**Validación**: SQL que confirme los constraints nuevos;
`client_canonical('instagram','17841400000000000')` devuelve el valor **intacto**;
`client_canonical('whatsapp','5512345678')` sigue devolviendo `525512345678`.
Regresión: WhatsApp y Telegram enrutan exactamente igual que antes.

### Fase 2: Webhook de Meta unificado
**Objetivo**: extraer la verificación GET y la validación de firma a un módulo compartido
—sin cambiar su semántica— y crear `/api/webhooks/meta` que despache por `body.object`
(`whatsapp_business_account` | `instagram` | `page`), con parser propio para
`entry[].messaging[]`, que es donde IG y Messenger ponen los mensajes. Resolver el canal por
`entry.id` (page id / IG business id) y el remitente por `sender.id` (PSID / IGSID).
**Validación**: POST simulado de cada `object` enruta a la org correcta y dedupea un reintento
con el mismo `mid`; un payload con firma inválida se descarta; **E2E real de WhatsApp sin
regresión**.

### Fase 3: Senders, tipos y ventana de 24 h
**Objetivo**: ramas `instagram` y `messenger` en `sendToCustomerByChannel` y
`sendButtonsToCustomerByChannel`; generalizar `getWaToken` a un `getChannelToken`; ampliar
las uniones de TypeScript (`runAgent`, `handleIncomingMedia`, `AgentContext.channel_type`);
ajustar el prompt, que hoy dice literalmente *"es un chat de WhatsApp/Telegram"*. Introducir
el concepto de **ventana de 24 h / message tag** para los envíos fuera de conversación, que
hoy no existe en ninguna parte.
**Validación**: `npm run typecheck` sin `any`; mensaje enviado y recibido en IG y en
Messenger; el cron de recordatorios no intenta enviar fuera de ventana sin tag, y lo que no
puede enviar queda registrado, no perdido.

### Fase 4: Conexión de cuentas y UI multicanal
**Objetivo**: OAuth de páginas de Facebook y cuentas de IG Business (mismo molde que el
Embedded Signup existente), guardando `page_id` / `ig_business_id` y token en `channels`.
Quitar el `.eq('type','whatsapp')` hardcodeado de la pantalla de conexiones, mostrar los
canales con su logo y estado, y etiquetar el canal en la bandeja de conversaciones.
**Validación**: conectar una cuenta de Instagram real desde el dashboard y sostener una
conversación completa —hasta agendar— con navegador, extremo a extremo.

### Fase 5: Validación final
**Objetivo**: los cuatro canales conviviendo en producción.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run lint` pasa
- [ ] `npm run build` exitoso
- [ ] **E2E con navegador contra producción**: WhatsApp (regresión), Telegram (regresión), Instagram, Messenger
- [ ] Enlace mágico `/c/<token>` y página `/r/<slug>` siguen funcionando
- [ ] Escalamiento y aprobación por Telegram funcionan para una conversación nacida en Instagram
- [ ] `clients.phone_canonical` de un contacto de IG conserva el handle intacto
- [ ] Una cita creada desde IG tiene `source = 'instagram'`
- [ ] `get_advisors` de Supabase sin hallazgos nuevos de seguridad

---

## 🧠 Aprendizajes (Self-Annealing)

> Se llena durante la implementación. El mismo error nunca ocurre dos veces.

---

## Gotchas

> Críticos, verificados leyendo el código durante la investigación.

- [ ] **IG y Messenger NO usan `entry[].changes[].value.messages[]`** sino **`entry[].messaging[]`**, con `entry.id` = page/IG id y `sender.id` = PSID/IGSID. El schema Zod actual **descartaría el payload entero en silencio**, porque el handler responde 200 pase lo que pase. Es el fallo más fácil de no ver.
- [ ] **`client_canonical()` normaliza como teléfono mexicano todo lo que no sea `telegram` ni `sandbox:%`.** Un IGSID/PSID pasaría por `normalize_phone_mx`: un handle de 10 dígitos se convertiría en `52`+10 y uno de 12 que empiece por `52` se daría por canónico. **Es el bug más probable de este PRP** y hay que arreglarlo en la Fase 1, antes de que entre el primer mensaje.
- [ ] `clients` guarda el handle en una columna llamada **`phone`**, y la unicidad —`unique(organization_id, phone)` más el índice `(organization_id, phone_canonical)`— **no incluye el canal**. Dos canales con handles numéricos pueden colisionar dentro de la misma org.
- [ ] **`create_appointment_from_chat_v2` mapea el canal con un `case ... else 'ai' end`**: sin tocarlo, toda cita de Instagram queda marcada como `'ai'` y se pierde la atribución de canal.
- [ ] **`waNormalizeTo()` es MX-only** (convierte a `52XXXXXXXXXX`). No debe aplicarse jamás a un handle de IG/Messenger.
- [ ] **No existe abstracción de plantillas/HSM ni de ventana de 24 h.** Todos los envíos son free-form. El cron ya envía recordatorios fuera de conversación; en IG/Messenger eso **falla en silencio** sin un message tag válido.
- [ ] **El webhook responde 200 siempre**, incluso con firma inválida (a propósito: no filtrar información ni provocar reintentos). Un fallo nuevo **no se verá como error HTTP**: hay que mirar logs.
- [ ] **`/api/webhooks/whatsapp` es la URL ya registrada en Meta.** Renombrarla, moverla o romperla tumba WhatsApp en producción. Debe seguir viva y funcionando aunque se cree `/api/webhooks/meta`.
- [ ] La firma HMAC se calcula sobre el **body crudo**: `runtime = 'nodejs'` es obligatorio y no se puede leer el body como JSON antes de validar.
- [ ] **`NEXT_PUBLIC_META_CONFIG_ID` (que lee el código) no coincide con `META_CONFIG_ID` del `.env.local.example`.** Verificar antes de tocar la conexión, o el Embedded Signup dejará de abrir.
- [ ] Instagram y Messenger requieren **permisos y App Review propios** (`instagram_manage_messages`, `pages_messaging`), sobre la app de Meta de ChatVenti (`2268338090636391`), que **no** es la de SastrePro. El código puede estar listo mucho antes que el permiso: planificar el trámite en paralelo.
- [ ] El webhook usa **ANON key** a propósito: toda escritura nueva debe entrar por RPC `SECURITY DEFINER` con `set search_path = public`, no por el cliente.
- [ ] El dedup depende del índice único parcial en `messages.external_id`. Los ids de IG (`mid`) tienen formato propio: garantizar que se guardan y que un reintento de Meta no despierta al agente dos veces.
- [ ] **Antes de dropear o reemplazar cualquier función, buscar quién la llama POR SU NOMBRE** (`prosrc ~ 'nombre_funcion\s*\('`), no por el parámetro que cambias. Postgres no registra las llamadas dentro de cuerpos `plpgsql`: un `drop function` verde no prueba nada. Esto ya rompió `/c/<token>` y la reagenda del agente en producción una vez. (Aprendizaje 2026-07-23.)
- [ ] `maybeSingle()`/`single()` exigen un filtro que garantice ≤1 fila. Una guarda cuya query falla devuelve `null` y **abre** el paso. (Aprendizaje 2026-07-15.)
- [ ] RLS obligatoria y aislada por `get_my_org()` en cualquier tabla nueva.
- [ ] Ni typecheck, ni lint, ni SQL verde han cazado ningún bug histórico de este proyecto. **La validación es E2E con navegador, haciendo clic en el flujo real.**

## Anti-Patrones

- NO crear un webhook separado por canal: extraer lo común y despachar por `body.object`.
- NO reescribir las RPC de chat: ya están parametrizadas por canal.
- NO romper ni mover `/api/webhooks/whatsapp`.
- NO aplicar la normalización de teléfonos MX a handles que no son teléfonos.
- NO asumir que un `case` de canal tiene un `else` inofensivo.
- NO usar `any` (usar `unknown`); NO omitir Zod en los payloads de Meta.
- NO dar por buena una fase sin E2E con navegador.

---

*PRP pendiente de aprobación. No se ha modificado código.*
