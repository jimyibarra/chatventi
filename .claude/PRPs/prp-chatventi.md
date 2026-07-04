# PRP-CHATVENTI: ChatVenti — Recepcionista IA + Agenda + CRM Omnicanal (equivalente a CitaFlow)

> **Estado**: APROBADO EN VISIÓN (2026-06-30) — listo para Fase 0 al recibir repo GitHub + token Supabase
> **Fecha**: 2026-06-30 (reescritura unificada)
> **Proyecto**: ChatVenti (chatventi.com) — **repo/deploy independiente**, scaffold v4 limpio en `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti`
> **Supabase**: proyecto propio `gyyogowaxehntsnrccuy` (falta access token para MCP)
>
> **⚠️ Esta versión REEMPLAZA y FUSIONA** el PRP-CHATVENTI anterior (modelo "inbox Callbell") y el PRP-AUTOMATIZAPRO-CITAS (fork de citas). Decisión del usuario 2026-06-30: **ChatVenti hace la misma función que [CitaFlow](https://citaflow.com)** — el corazón es agenda + recepcionista IA, no un inbox genérico. El PRP de Citas queda absorbido aquí.

---

## Objetivo

Construir un **SaaS de reservas con recepcionista IA 24/7**, vendible a negocios de servicios de **cualquier giro** (horizontal), equivalente a **CitaFlow**: el cliente final reserva **solo** por **WhatsApp, Telegram y Web**; un **agente IA acotado al negocio** agenda, reagenda, confirma, cancela, responde FAQs y da seguimiento. El negocio gestiona todo desde un **CRM con agenda/calendario** y ve el seguimiento de las citas de sus clientes. Operamos como **Meta Tech Provider** (Embedded Signup self-service): cada negocio conecta su propio número de WhatsApp. **Monetización 100% por software/suscripción, NUNCA por mensaje.** Se reutiliza el motor probado de SastrePro2 (tenancy, auth/roles, webhook WhatsApp multi-WABA, agente IA, media privada firmada, Stripe) portándolo por patrón al scaffold limpio de ChatVenti.

**Decisiones de alcance (usuario, 2026-06-30):**
1. **Canales v1 = solo chat**: WhatsApp + Telegram + Web. **Voz (Teléfono IA) se difiere** a fase posterior (es el add-on separado de CitaFlow).
2. **Alcance v1 = paridad con CitaFlow** (todo menos voz): agenda, recepcionista IA multicanal, web por negocio con branding, tienda online, widget de reservas embebible, base de conocimiento, aprobaciones por Telegram (human-in-the-loop), recordatorios + seguimiento post-cita, CRM.
3. **Horizontal**: cualquier negocio con citas. El agente y los catálogos se acotan **por dato** (no hay ramas por giro en el código).

## Por Qué

| Problema | Solución |
|----------|----------|
| Negocios de servicios pierden citas y llamadas; agenda en papel/WhatsApp caótica | Recepcionista IA 24/7 + calendario digital que reserva, confirma y recuerda solo |
| Conectar WhatsApp Cloud API es técnico y frena la adopción | **Embedded Signup self-service** bajo nuestro Tech Provider: el negocio conecta su número en minutos |
| Las herramientas cobran por mensaje y el costo es impredecible | Monetización **por software** (suscripción), nunca por mensaje |
| Construir esto desde cero es caro; ya tenemos ~70% del motor en producción | Reutilizar motor SastrePro2 (webhook multi-WABA, agente IA, media firmada, Stripe, RLS) |
| Cada negocio es de un giro distinto | Producto **horizontal**: el agente se acota por `knowledge_base`/servicios del negocio |

**Valor de negocio**: SaaS recurrente (MRR) en un mercado horizontal grande (cualquier negocio con citas), reaprovechando infraestructura amortizada. Base sobre la que después se cuelga el módulo de **Voz** (Teléfono IA).

## Qué

### Criterios de Éxito (v1)
- [ ] Un negocio se registra self-service, **conecta su número de WhatsApp vía Embedded Signup** (bajo nuestro Tech Provider) y opcionalmente un **bot de Telegram**.
- [ ] El **webhook único** enruta cada mensaje entrante al negocio correcto por `phone_number_id`/WABA (multi-tenant sobre una sola app Meta).
- [ ] **Agenda/calendario** (día/semana/recursos) por sucursal y profesional; crear/mover/confirmar/completar/no-show/cancelar; **sin solapamientos** (validado en RPC servidor).
- [ ] **Recepcionista IA acotado al negocio**: consulta disponibilidad, **agenda/reagenda/cancela** citas desde el chat, responde FAQs desde **base de conocimiento**; se **pausa al intervenir un humano** y se **reactiva**; **aprobación por Telegram** cuando no está seguro.
- [ ] **Reservas Web**: página por negocio con su **branding** + **calendario de reservas** + **tienda** de productos; y **widget embebible** para insertar reservas en un sitio externo.
- [ ] **Recordatorios** automáticos (p. ej. 24 h y 2 h antes) por plantilla aprobada + **seguimiento post-cita** (mensaje configurable).
- [ ] **CRM**: contactos/clientes con etiquetas e historial; el negocio ve la agenda y el seguimiento de sus clientes en un panel.
- [ ] **Billing por software** (Stripe): suscripción por negocio (unidad de cobro a confirmar: por número conectado y/o por plan con cupos), trial, portal; el cobro **no** depende del volumen de mensajes.
- [ ] Multi-tenant con **RLS** en todas las tablas nuevas; `npm run typecheck` y `npm run build` pasan; `get_advisors` sin hallazgos de RLS.

### Comportamiento Esperado (Happy Path)
1. Un negocio se registra en chatventi.com, crea su organización, sucursal(es) y equipo (profesionales/agentes); elige su branding.
2. Conecta WhatsApp por **Embedded Signup** y (opcional) Telegram; define **servicios** (con duración y precio), **horario de la sucursal** y **disponibilidad de cada profesional**.
3. Un cliente final escribe "quiero corte el viernes". El **webhook** identifica el negocio; el **agente IA** consulta disponibilidad (RPC), ofrece horarios libres, el cliente elige y la **cita queda agendada**.
4. La IA confirma; 24 h/2 h antes un **cron** envía recordatorio por plantilla; el cliente confirma/reagenda por chat. Tras la cita, **seguimiento** automático.
5. El negocio ve todo en su **calendario/CRM**; el dueño administra su suscripción (Stripe, trial, portal). También puede recibir reservas por su **web ChatVenti** o por el **widget embebido** en su sitio.

---

## Contexto

### Referencias del motor SastrePro2 a **portar por patrón** (el scaffold de ChatVenti está limpio)
- `src/app/api/webhooks/whatsapp/route.ts` — webhook único de entrada. Generalizar a enrutado **por `phone_number_id` → canal → organización**. **Usa ANON key → toda escritura por RPC `SECURITY DEFINER`** (memoria `chat-autoresponder-dedup-fix`).
- `src/app/api/whatsapp/embedded-signup/route.ts` — Embedded Signup (Tech Provider). Corazón del onboarding self-service; falta `META_APP_SECRET`.
- `src/app/api/whatsapp/{register,deregister,native,notify-ready,broadcast}/route.ts` — alta/baja de número, **patrón canónico de envío por plantilla** (credenciales del canal → plantilla UTILITY → fallback texto → `log_bot_message`) y envío masivo. Los recordatorios de cita se modelan igual.
- `src/app/api/chat/{send-message,mark-read,archive,resume-ai}/route.ts` — acciones de conversación (enviar, leído, archivar, **reactivar IA**).
- `src/app/api/chat/media-file/[...path]/route.ts`, `chat/media/[mediaId]/route.ts` + `src/proxy.ts` — **media privada con URL firmada por proxy** (no `getPublicUrl`, no service_role); memoria `chat-media-saliente-fix`.
- `src/features/chat/services/aiAgentService.ts` / `aiAssistantService.ts` — agente IA por negocio (`agent_configs.system_prompt` + `knowledge_base`), pausa/reactivación. **Generalizar provider IA** (hoy Gemini directo → router) y **darle herramientas** de disponibilidad/reserva.
- `src/features/dashboard/components/catalog/ServiceCatalogManager.tsx` — catálogo de servicios (`service_catalogs`); agregar `duration_minutes`.
- `src/features/saas/services/branchBillingServer.ts` + `src/app/api/billing/*` + `webhooks/stripe/route.ts` + `cron/branch-billing` — **cobro Stripe con quantity + trial + portal** (webhook por RPC). Se adapta al modelo de ChatVenti.
- `src/app/(main)/dashboard/clients` — base del CRM de clientes/contactos.
- Tablas núcleo existentes a reutilizar: `organizations`, `branches`, `profiles`, `clients`, `service_catalogs`, `agent_configs`, `chat_conversations`, `chat_messages`, `whatsapp_credentials`, `marketing_templates`.
- Skills de apoyo: `add-payments` (Stripe), `add-login` (auth+roles). **`add-mobile`/PWA** opcional para la web del negocio.

### Decisiones de Arquitectura
- **Repo/deploy independiente**: ChatVenti vive en su propio repo + Vercel + dominio (chatventi.com). Arranque sobre el **scaffold v4 limpio** ya desplegado; el motor de SastrePro2 se **porta por patrón** (copiar selectivamente), no por fork de git. **Supabase propio** (`gyyogowaxehntsnrccuy`).
- **Tech Provider**: una sola app Meta sirve a todos los negocios (Embedded Signup). NO se cobra margen por mensaje (el negocio paga su WhatsApp a Meta). Monetización por software (memoria `whatsapp-tech-provider-2026-06`).
- **Canal como abstracción** (`channels`): WhatsApp / Telegram / Web modelados igual (tipo + credenciales + estado). La **Voz** se añadirá como `channels.type='voice'` sin rediseñar.
- **Horizontalización por dato**: el agente y los catálogos se acotan por `knowledge_base`/servicios del negocio; sin ramas por giro en código. (Historial clínico dentista = módulo opcional futuro, no vertical hardcodeado en v1.)
- **Agente IA con herramientas**: el agente llama RPCs (`get_available_slots`, `create_appointment_from_chat`, `find_client`) — function calling. Provider vía router (no Gemini hardcodeado).

### Arquitectura Propuesta (Feature-First)
```
src/features/canales/        # conexión self-service (Embedded Signup WA, Telegram, Web)
src/features/agenda/         # calendario día/semana/recursos, citas, disponibilidad
src/features/agente-ia/      # config del agente, base de conocimiento, handoff/aprobaciones
src/features/reservas-web/   # página por negocio (branding) + widget embebible + tienda
src/features/crm/            # contactos, etiquetas, historial, panel de seguimiento
src/features/inbox/          # conversaciones (chat) con asignación/estado/notas
src/features/billing/        # suscripción Stripe (por software)
src/app/api/channels/telegram/        # webhook + setWebhook Telegram
src/app/api/webhooks/whatsapp/        # webhook único multi-tenant
src/app/api/citas/                    # endpoints de agenda (validación + RPCs)
src/app/api/cron/appointment-reminders/route.ts   # recordatorios + seguimiento
src/app/r/[slug]/            # web pública de reservas por negocio
src/embed/widget.js          # widget embebible de reservas
```

### Modelo de Datos (multi-tenant + RLS por `organization_id`)
```sql
-- CANALES (omnicanal). external_id = phone_number_id (WA) / bot id (TG) / slug (web)
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('whatsapp','telegram','web')),  -- 'voice' futuro
  external_id TEXT NOT NULL, waba_id TEXT, display_name TEXT,
  credentials JSONB,  -- access_token / bot_token (secreto a nivel app)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','disabled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (type, external_id)
);

-- AGENDA: servicios (extiende service_catalogs con duración), horarios y citas
ALTER TABLE service_catalogs ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 30;
CREATE TABLE business_hours (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_time TIME NOT NULL, close_time TIME NOT NULL, is_closed BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE staff_schedules (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6), start_time TIME NOT NULL, end_time TIME NOT NULL);
CREATE TABLE staff_time_off (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, reason TEXT);
CREATE TABLE appointments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id), staff_id UUID REFERENCES profiles(id),
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  source TEXT NOT NULL DEFAULT 'staff' CHECK (source IN ('staff','whatsapp','telegram','web','ai')),
  notes TEXT, reminder_24h_sent_at TIMESTAMPTZ, reminder_2h_sent_at TIMESTAMPTZ,
  followup_sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE appointment_services (appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES service_catalogs(id), PRIMARY KEY (appointment_id, service_id));

-- CONVERSACIONES + CRM (chat omnicanal acotado + contactos)
CREATE TABLE conversations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id), assigned_agent_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','closed')),
  ai_enabled BOOLEAN NOT NULL DEFAULT true, ai_paused_until TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (channel_id, client_id));
CREATE TABLE messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender TEXT NOT NULL CHECK (sender IN ('contact','agent','ai','system')),
  agent_id UUID REFERENCES profiles(id), body TEXT, media_path TEXT,
  external_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW());  -- external_id = dedup WA/TG
CREATE TABLE tags (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name TEXT NOT NULL, color TEXT);
CREATE TABLE client_tags (client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (client_id, tag_id));

-- BASE DE CONOCIMIENTO + APROBACIONES (human-in-the-loop)
CREATE TABLE knowledge_base (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content TEXT NOT NULL, source TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE ai_approvals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  draft TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW());

-- TIENDA / RESERVAS WEB (catálogo de productos + branding por negocio)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS web_slug TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS branding JSONB;  -- logo, colores
CREATE TABLE products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, price NUMERIC, image_url TEXT, active BOOLEAN DEFAULT true);

-- RLS en TODAS las tablas (aislar por organization_id). RPCs SECURITY DEFINER para webhook (ANON):
--   route_inbound_message(channel_type, external_id, from_handle, body, media, ext_msg_id)
--   get_available_slots(branch_id, service_ids[], date)
--   create_appointment_from_chat(branch_id, client_phone, service_ids[], starts_at)
--   set_conversation_assignment / set_conversation_status / pause_ai(conversation_id)
```

---

## Blueprint (Assembly Line)

> Solo FASES. Subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 0: Bootstrap repo + Supabase + horizontalización + canal
`git init` en el scaffold; conectar Supabase propio (`gyyogowaxehntsnrccuy`) + MCP; portar por patrón el núcleo del motor (auth/roles, tenancy, webhook base, agente IA, media firmada, Stripe). Retirar vocabulario de sastrería; introducir `channels`; onboarding self-service (org + sucursal + equipo). **Validación**: el repo compila/despliega; alta de negocio crea org/equipo; existe `channels` con RLS.

### Fase 1: Tech Provider — Embedded Signup + webhook multi-tenant + Telegram
Completar Embedded Signup (con `META_APP_SECRET`) → `channel` WA activo. Generalizar webhook a enrutar por `phone_number_id`/WABA vía `route_inbound_message` (SECURITY DEFINER, idempotente por `external_id`). Conectar Telegram (`setWebhook` + bot_token). **Validación**: dos negocios con dos números reciben sin cruce; un mensaje TG y uno WA conviven.

### Fase 2: Motor de agenda + disponibilidad + calendario (UI)
Tablas de agenda con RLS; RPCs `get_available_slots`/`create_appointment_from_chat` que respetan horario, duración y **no-solapamiento** (transacción). UI calendario día/semana/recursos: crear/mover/confirmar/completar/no-show/cancelar; editores de horario y disponibilidad. **Validación**: Playwright crea/reagenda/cambia estado; no permite solapamientos.

### Fase 3: Recepcionista IA (agente con herramientas + base de conocimiento + aprobaciones)
Agente acotado al negocio con **function calling** a las RPC de agenda; **base de conocimiento** (FAQs); agenda/reagenda/cancela desde chat; **pausa al intervenir humano** + reactivar; **aprobación por Telegram** cuando baja confianza. **Validación**: una conversación agenda una cita; humano pausa/reanuda; flujo de aprobación funciona; no responde fuera del negocio.

### Fase 4: Reservas Web — página por negocio (branding) + tienda + widget embebible
Web pública `/r/[slug]` con branding del negocio + calendario de reservas + catálogo de **productos**; **widget.js** embebible para insertar reservas en sitio externo. **Validación**: reservar desde la web pública y desde el widget incrustado crea cita sin solapamiento; la tienda muestra productos.

### Fase 5: Recordatorios + seguimiento post-cita
Cron `appointment-reminders` (plantilla 24 h/2 h, idempotente por `reminder_*_sent_at`) + **seguimiento post-cita** (`followup_sent_at`) reusando patrón `notify-ready`. **Validación**: el cron envía una sola vez por ventana y registra con `log_bot_message`.

### Fase 6: CRM (contactos + etiquetas + panel de seguimiento)
Clientes con etiquetas e historial de citas/conversaciones; panel donde el negocio ve agenda y seguimiento de sus clientes; vínculo cliente ↔ conversación ↔ citas. **Validación**: etiquetar un cliente, ver su historial y abrir su conversación; RLS aísla por organización.

### Fase 7: Billing por software (Stripe) + gating
Adaptar Stripe a cobro **por software** (unidad: por número conectado y/o plan con cupos — confirmar con usuario); trial, portal, gating por estado de suscripción; webhook por RPC. **Validación**: alta/baja refleja en Stripe y acceso; el cobro no depende de mensajes.

### Fase 8: Validación Final (E2E)
**Validación**: `typecheck` + `build` ok; Playwright E2E (alta negocio → Embedded Signup → cliente agenda por WhatsApp → IA confirma → recordatorio → reagenda → completa; reserva por web y por widget; conversación Telegram); `get_advisors` sin hallazgos RLS; criterios de éxito cumplidos.

> **Roadmap posterior (fuera de v1)**: **Voz / Teléfono IA** (módulo add-on de CitaFlow) como `channels.type='voice'` — asistente IA por voz (WhatsApp Calling primero, número telefónico real después), buzón con transcripción, IVR, redirección a humano, análisis de llamadas → **"datos de llamadas" del CRM** salen de aquí. Decisión de telefonía pendiente. También: integración Shopify, fianza anti-no-show (Stripe), sync Google/Apple Calendar.

---

## 🧠 Aprendizajes (Self-Annealing)

### 2026-06-30: Punto de partida (heredado de SastrePro)
- Webhook WhatsApp usa **ANON key** → escrituras solo por RPC `SECURITY DEFINER` (aplica a `route_inbound_message`, `create_appointment_from_chat`, cambios de asignación/estado).
- Envío por canal: credenciales del `channel` + plantilla UTILITY + fallback texto + `log_bot_message` (de `notify-ready`). Recordatorios y seguimiento se modelan igual.
- Media de chat = bucket privado + URL firmada por proxy, nunca `getPublicUrl`/service_role (`chat-media-saliente-fix`).
- Pendiente heredado: `META_APP_SECRET` en env para cerrar Embedded Signup.
- **Aplicar en**: Fases 1, 2, 3, 5.

### 2026-07-02: Fase 0 COMPLETADA (bootstrap + tenancy + channels + onboarding)
- **Estado**: ✅ Repo compila (`build` + `typecheck` verdes) · alta de negocio crea org+sucursal+owner · `channels` con RLS · aislamiento multi-tenant verificado E2E con Playwright.
- **Migraciones**: `supabase/migrations/20260702000000_fase0_baseline.sql` + `..._harden_function_grants.sql`. Tablas: `organizations`, `branches`, `profiles`, `channels` (todas RLS).
- **Tenancy limpio (mejora vs SastrePro2)**: helpers `get_my_org()/get_my_role()/get_my_branch()` como `SECURITY DEFINER` que leen de `profiles` → evitan recursión RLS SIN la frágil sincronización `app_meta`/`user_meta` de SastrePro2. Las políticas RLS los usan; `authenticated` conserva EXECUTE (revocado a `anon`).
- **Onboarding self-service**: RPC `create_organization_with_owner(org, owner, branch)` `SECURITY DEFINER` transaccional. El signup guarda `pending_org_name` en `user_metadata`; el dashboard tiene un **safety-net** que ejecuta el RPC al primer acceso autenticado (soporta confirmación de correo activada, que ESTÁ ON en este proyecto).
- **Gotcha resuelto — read-after-write lag**: un `SELECT` inmediato tras un RPC de escritura puede pegar en réplica y no ver el dato → tras onboarding hacer `redirect()` (lectura fresca en el siguiente request), no re-`SELECT`. **Aplicar en**: cualquier RPC de escritura seguido de lectura.
- **Gotcha resuelto — versión @supabase/ssr**: `ssr` 0.6.x importa `GenericSchema` de una ruta que `supabase-js` 2.110 eliminó → el genérico `Database` se rompe y las queries tipan `never`. Fix: `@supabase/ssr@^0.12`. **Aplicar en**: cualquier proyecto nuevo del template.
- **Gotcha resuelto — Tailwind v3 vs v4**: el scaffold traía `globals.css` con `@import 'tailwindcss'` (v4) pero tailwind 3.4 instalado → sin utilidades. Fix: `@tailwind base/components/utilities`.
- **Next 16**: la convención `middleware.ts` está **deprecada** → usar `src/proxy.ts` con `export function proxy()` (coincide con SastrePro2).
- **Alcance**: el motor profundo (webhook multi-tenant, agente IA, media, Stripe) NO se implementó en Fase 0 — se porta en sus fases (1/3/7). Fase 0 dejó los **patrones base**: 4 clientes Supabase (`server`/`client`/`service`/`webhook`), proxy, RLS+RPC.
- **Pendiente de config (dashboard Supabase)**: activar "Leaked Password Protection"; decidir si dejar confirmación de correo ON (afecta UX de signup).

### 2026-07-03: Fase 1 EN PROGRESO — motor de entrada WhatsApp validado E2E
- **Estado**: ✅ Webhook multi-tenant WhatsApp validado end-to-end en producción. Código Fase 1 desplegado (commit `261a454`). Migración `20260703000000_fase1_inbound_engine.sql` aplicada (tablas `clients`/`conversations`/`messages` + RPC `route_inbound_message`).
- **Meta configurado**: producto WhatsApp agregado a la app (ID `2268338090636391`, portfolio `SastrePro` verificado + Tech Provider verificado). Webhook `messages` suscrito. Número de prueba: `+52 14425302649`, `phone_number_id=1090070170857969`, WABA `1280449610662720`.
- **Validación E2E**: payload firmado con `META_APP_SECRET` real → firma HMAC OK → RPC → cliente+conversación+mensaje insertados. **Dedup** (reenvío idéntico no duplica) y **rechazo de firma inválida** confirmados por conteo (`total_mensajes=1`).
- **🔴 GOTCHA CRÍTICO — dominio `www` canónico**: `chatventi.com` hace **redirect 308 → `www.chatventi.com`**, y **Meta NO sigue redirects** al verificar/entregar webhooks. La Callback URL en Meta DEBE ser `https://www.chatventi.com/api/webhooks/whatsapp` (con `www`). Aplica a TODOS los webhooks (Telegram, Stripe, crons externos). **Aplicar en**: Fases 1, 5, 7.
- **GOTCHA — env vars en Vercel**: `.env.local` es solo local; las vars nuevas hay que cargarlas en el dashboard de Vercel (Production) y **redeployar** para que apliquen (un push no basta si se agregan después). Verificar con el GET challenge del webhook (403 = falta la var; 200+challenge = OK).
- **Dato de prueba en BD prod**: existe org "ChatVenti — Org de Prueba (Fase 1)" (`7ab0c2ea-...`) + channel WA del número de prueba + 1 mensaje sintético. **Limpiar antes de producción real.**
- **Telegram ✅ validado E2E (2026-07-03)**: `setWebhook` registrado (Telegram: "Webhook was set") apuntando a `www`, channel TG (`external_id=8947338327` = bot id, la parte antes del `:` del token) creado, update simulado con secret token válido aterrizó en `messages`. Requiere `TELEGRAM_BOT_EXTERNAL_ID` en Vercel (Fase 1 = un bot global; multi-bot es TODO).
- **Prueba con WhatsApp real: DIFERIDA por decisión (2026-07-03)**. En modo desarrollo el número de prueba de Meta solo intercambia mensajes con **remitentes verificados** (requiere generar token temporal + código al teléfono). Como el pipeline server (firma→RPC→dedup→BD) y la alcanzabilidad Meta→servidor (GET challenge exitoso) YA están probados, se difiere la confirmación con mensaje genuino al tiempo de App Review/producción, donde cualquier número escribe sin verificar. **No es un bug**, es límite de dev mode.
- **Pendiente Fase 1**: Embedded Signup real (`META_CONFIG_ID` + System User token) para onboarding self-service de negocios externos — también atado a App Review (segundo tiempo). App Review de Meta diferida (plan en dos tiempos).

### 2026-07-04: Fase 2 COMPLETADA — motor de agenda + calendario (UI) validado E2E
- **Estado**: ✅ `typecheck` + `build` verdes. Playwright E2E completo por la UI real: alta de negocio (onboarding) → configurar servicio/horario/disponibilidad → crear cita (slots en tz correcta) → confirmar (persistido) → **no-solapamiento** (el slot ocupado desaparece de la disponibilidad) → reagendar (09:00→11:00, estado conservado). `get_advisors` sin ERROR de RLS.
- **Migraciones**: `20260704000000_fase2_agenda_schema.sql` (tablas + RLS), `..000100_fase2_agenda_rpcs.sql` (RPCs), `..000200_fase2_revoke_anon_ui_rpcs.sql` (blindaje de grants). Tablas nuevas: `service_catalogs`, `business_hours`, `staff_schedules`, `staff_time_off`, `appointments`, `appointment_services` + `branches.timezone`. Todas con RLS por `organization_id` (directo o vía relación con EXISTS, patrón de `messages`).
- **Hallazgo — `service_catalogs` NO existía**: el PRP lo asumía heredado de SastrePro2, pero Fase 0 solo creó organizations/branches/profiles/channels. Se **creó** (no solo ALTER). **Aplicar en**: no asumir tablas de SastrePro2; verificar con `list_tables` antes.
- **Decisión — horario normalizado vs JSONB**: `branches.business_hours` (JSONB del baseline) quedó **sin uso**; se usó la tabla normalizada `business_hours` (una fila por weekday) porque hace el cálculo de slots en SQL indexable y limpio.
- **RPC `get_available_slots`**: genera slots en la **zona de la sucursal** (nunca UTC). Construye ventanas locales (`business_hours ∩ staff_schedules`) como `timestamp` sin tz sobre `p_date`, hace `generate_series` (paso `p_slot_interval`, default 15 min), y convierte con `AT TIME ZONE branches.timezone` → timestamptz. Descarta pasados, solapados con citas activas y ausencias. Verificado: 09:00 local MX = 15:00 UTC. **weekday = EXTRACT(DOW)** (0=Dom..6=Sáb) — consistente en RPC, tipos y UI.
- **No-solapamiento concurrente**: `create_appointment`/`reschedule_appointment` serializan con `pg_advisory_xact_lock(hashtext(branch||staff))` y re-chequean solape en la misma transacción antes de insertar; conflicto → `raise ... errcode '23P01'` → la Server Action lo traduce a "Ese horario ya está ocupado". Regla: si hay `staff_id` → solape por staff; si no → la sucursal es recurso único.
- **🔴 GOTCHA CRÍTICO — grants por defecto de Supabase**: Supabase tiene `ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO anon, authenticated`. Por eso un `grant execute ... to authenticated` NO limita: la función queda ejecutable por `anon` igual. Como `create_appointment`/`reschedule`/`set_status` usan `assert_org_access` (que solo bloquea a un *autenticado* de otra org; un anon tiene `get_my_org()=null` y **pasa**), quedaban abiertas a anon. **Fix**: `REVOKE EXECUTE ... FROM anon` explícito en toda RPC que deba ser solo-autenticada (migración `..000200`). **Aplicar en**: TODAS las fases — tras crear una RPC, revocar anon salvo que el webhook/chat la necesite; verificar con `has_function_privilege('anon', ...)`. (El pattern `_harden_function_grants` de Fase 0 ya lo hacía; repetirlo siempre.)
- **Limitación conocida (UI)**: al crear una cita, si se da nombre de cliente **sin teléfono**, no se vincula `client` (el upsert usa `unique(organization_id, phone)` como clave). Queda como "Sin cliente". Aceptable en v1; mejorar en CRM (Fase 6) permitiendo cliente solo-nombre.
- **Stack UI**: Server Components (lectura) + Server Actions (mutación) + client components para interactividad; Tailwind puro; utilidades de tz propias en `src/features/agenda/datetime.ts` (sin librería de fechas). Feature en `src/features/agenda/`, rutas `/dashboard/agenda` y `/dashboard/agenda/configuracion`.

### 2026-07-04: Fase 3 CONSTRUIDA — Recepcionista IA (agente + tools + aprobación por Telegram)
- **Estado**: ✅ `typecheck` + `build` verdes. RPCs validadas por SQL sin LLM (contexto, gating should_respond, flujo de aprobación create→resolve, log de salida, idempotencia, reactivación). `get_advisors` sin ERROR. ⏳ **Prueba en vivo del agente PENDIENTE**: falta `OPENROUTER_API_KEY` (el usuario la pega). Sin la key, `runAgent` retorna `{handled:false}` sin romper — desplegar es seguro.
- **Deps**: `ai@^6` (Vercel AI SDK v6) + `@openrouter/ai-sdk-provider`. **Gotcha**: el provider más reciente exige `ai@^6` (no v5 como decía el golden path). En v6 las tools usan `inputSchema` (no `parameters`) y el multi-step es `stopWhen: stepCountIs(n)` (no `maxSteps`).
- **Migración**: `20260704010000_fase3_ai_agent.sql`. Tablas `agent_configs` (1×org: enabled, system_prompt, model, approval_mode, approval_telegram_chat_id), `knowledge_base`, `ai_approvals`. RLS: config/KB por org (owner/manager write); ai_approvals solo SELECT por org (escritura solo vía RPC).
- **RPCs SECURITY DEFINER**: `get_agent_context(channel_type, external_id, from_handle)` devuelve TODO en un jsonb (config, servicios, KB, historial 20 msgs, sucursal, conversación con `should_respond` calculado = config activa ∧ ai_enabled ∧ no en pausa ∧ sin aprobación pendiente). `log_outbound_message`, `create_ai_approval` (pausa conv→pending, devuelve chat TG destino), `resolve_ai_approval` (devuelve draft + canal del cliente para enviar; reabre o deja pendiente). Control UI: `set_ai_enabled`/`pause_ai`/`set_conversation_status` (authenticated, con `REVOKE anon` por el gotcha de Fase 2). Webhook RPCs con grant a anon.
- **Arquitectura del agente** (`src/features/agente-ia/`): `runAgent()` orquesta: get_agent_context → si `should_respond` corre `generateText` con tools `check_availability`/`book_appointment`/`request_human_approval` → decide enviar directo o (approval_mode `always`/escalado) crear aprobación. Los **senders se inyectan** por cada webhook (desacople canal↔agente). System prompt **acota al negocio** (regla Meta): solo servicios/citas/KB.
- **🔴 GOTCHA — respuesta fuera del ciclo de la request**: Meta/Telegram exigen 200 rápido; correr el LLM inline arriesga timeouts/reintentos. Se usa **`after()` de `next/server`** para ejecutar el agente tras devolver 200. Runtime `nodejs` (no edge).
- **WhatsApp saliente**: el token es **por canal** (`channels.credentials.access_token`), secreto → se lee con **service client** (bypassa RLS) dentro del sender, NO por RPC anon (evita exponer el token). Telegram usa el `TELEGRAM_BOT_TOKEN` global. La aprobación SIEMPRE va por Telegram (bot global) al `approval_telegram_chat_id`, sin importar el canal del cliente.
- **Aprobación con botones**: `tgSendApproval` manda inline keyboard con `callback_data="appr:<id>:<1|0>"`; la ruta Telegram maneja `callback_query` → `resolve_ai_approval` → si aprobado envía el draft al cliente por su canal (`sendToCustomerByChannel`) + `log_outbound_message` → `answerCallbackQuery` + edita el mensaje. Idempotente (segunda pulsación = `already_resolved`).
- **UI**: `/dashboard/agente` (config + base de conocimiento) y `/dashboard/conversaciones` (+ `/[id]`): hilo de mensajes, historial de aprobaciones, toggle IA / pausar / cerrar.
- **PENDIENTE para vivo**: (1) `OPENROUTER_API_KEY` en `.env.local` (local) y en Vercel Production (deploy); (2) que el dueño escriba al bot desde su chat de Telegram y ponga ese `chat_id` en la config para recibir aprobaciones; (3) redeploy tras cargar envs.

### 2026-07-04: Fase 3 VALIDADA EN VIVO (con OPENROUTER_API_KEY) — commits `d218bc9` + `e57062d` (push a main)
- **E2E real del agente** (webhook Telegram simulado → `after()` → LLM `openai/gpt-4o-mini` vía OpenRouter): "quiero un corte el lunes 6 jul a las 10" → el agente llamó `check_availability` (disponibilidad real, tz correcta) → "tenemos las 10:00, ¿confirmas?" → "sí" → `book_appointment` → **cita creada** (`appointments`, source `telegram`, 10:00–10:30 local) + respuesta natural de confirmación. Ambos turnos registrados con `log_outbound_message`.
- **Aprobación en vivo** (`approval_mode='always'`): el agente redactó la respuesta pero creó `ai_approval` **pending**, dejó la conversación `pending` y `should_respond=false` (NO envió al cliente). El envío real de botones necesita un chat de Telegram válido (el bot solo mensajea a chats que le escribieron primero); el callback resolve→envío ya se validó por SQL.
- **🔴 GOTCHA — id del servicio en el prompt (fix `e57062d`)**: las tools requieren el uuid del servicio, pero `buildSystemPrompt` solo listaba nombres → el modelo no podía llamar `check_availability`. Fix: incluir `id: <uuid>` en la lista de servicios + instrucción. **Aplicar en**: cualquier tool que reciba ids — exponer los ids en el contexto del modelo.
- **🔴 GOTCHA — caché de turbopack tras instalar deps**: tras `npm install` de `ai`/`@openrouter`, el dev server servía **404 en TODAS las rutas /api** (Next las mandaba a `/_not-found`) aunque `build` compilaba bien. Fix: **parar dev, borrar `.next`, reiniciar**. **Aplicar en**: siempre que se agreguen dependencias con dev server corriendo.
- **Nota de entorno**: la prueba usó la org de prueba de Fase 1 (`7ab0c2ea`) equipada con sucursal/servicio/horario/staff/agente; al terminar se **desactivó el agente** (`enabled=false`) porque su bot `8947338327` apunta a prod. Esa org + sus datos de prueba (incluida la cita 700700700 y las conversaciones 700700702) siguen marcados para limpiar antes de prod real (no se pudo DELETE por el clasificador; hacerlo manualmente o con confirmación).

### 2026-07-04: Fase 4 COMPLETADA — Reservas Web (página pública + tienda + widget embebible)
- **Estado**: ✅ `typecheck` + `build` verdes. Reserva pública validada por SQL y por **Playwright** (cita `source='web'` creada desde `/r/[slug]`), no-solapamiento OK, `widget.js` servido (200 `application/javascript`), modo embed 200, slug inexistente 404, `get_advisors` sin ERROR de RLS.
- **Migraciones**: `20260704020000_fase4_reservas_web.sql` (tabla `products` + RLS; RPCs `get_public_booking_context`/`create_public_appointment`, anon) y `20260704030000_fase4_fix_slots_staffless.sql` (fix de `get_available_slots`).
- **RPCs públicas (SECURITY DEFINER, anon)**: `get_public_booking_context(slug)` devuelve org (name+branding), sucursal, servicios y productos — solo si la org publicó su `web_slug` (sin secretos). `create_public_appointment(slug, service_ids, starts_at, name, phone)` resuelve org+sucursal por slug, upsert del cliente por teléfono, y **reusa `create_appointment`** (no-solapamiento + lock, source 'web'). Truco: `create_appointment` es authenticated-only en el REST, pero una función SECURITY DEFINER (owner admin) puede invocarla internamente aunque el llamante anon no pueda llamarla directo.
- **UI**: `/r/[slug]` pública (server, sin auth) con branding (color/logo/descripción de `organizations.branding`) + servicios + tienda + widget de reserva (client, usa el cliente **anon del browser** directo contra las RPCs). Modo `?embed=1` minimal para iframe. Config del dueño en `/dashboard/reservas-web` (publicar slug + branding + productos); `organizations` RLS ya permite `update` al `owner`.
- **Widget** `public/widget.js`: vanilla JS sin deps; lee `data-slug`, deriva el origin de su propio `src`, monta botón flotante + modal con iframe a `/r/[slug]?embed=1`. Snippet: `<script src="https://www.chatventi.com/widget.js" data-slug="..." async></script>`. Next no fija `X-Frame-Options` por defecto → la página se puede incrustar.
- **🔴 GOTCHA — disponibilidad vs reserva staffless (fix `20260704030000`)**: `get_available_slots` solo excluía solapes del MISMO staff, pero chat/web reservan con `staff_id` NULL (nivel-sucursal) y `create_appointment` staffless valida a nivel de sucursal. Resultado: un hueco ocupado por una cita sin staff SÍ se mostraba libre y la reserva luego fallaba con `slot_taken`. Fix: el `not exists` ahora es `(a.staff_id = c.staff_id OR a.staff_id IS NULL)` → una cita sin staff bloquea el hueco para todos. **Aplicar en**: cualquier vista de disponibilidad debe reflejar el MISMO criterio de solape que la reserva.
- **Nota**: se despublicó el slug de prueba (`web_slug=null` en `7ab0c2ea`) para no dejar una página de test viva en prod tras el deploy.

### 2026-07-04: Fase 5 COMPLETADA — Recordatorios 24h/2h + seguimiento post-cita (cron)
- **Estado**: ✅ `typecheck` + `build` verdes. Cron validado localmente: sin auth → 401; con `Bearer CRON_SECRET` → envió 24h/2h/followup; **idempotente** (2ª corrida 0 envíos, las citas salen del query al marcar `*_sent_at`); mensajes 'system' registrados con el texto correcto por ventana; flags `reminder_24h/2h_sent_at`/`followup_sent_at` marcados. `get_advisors` sin ERROR.
- **Migraciones**: `20260704040000_fase5_reminders.sql` (RPCs `get_due_reminders(kind)` + `claim_reminder(id, kind)`, solo `service_role`) y `20260704040100_fase5_revoke_reminder_rpcs.sql` (blindaje). Las columnas `reminder_*_sent_at`/`followup_sent_at` ya existían (Fase 2).
- **Motor** (`src/app/api/cron/appointment-reminders/route.ts`, GET, runtime nodejs): protegido con `Authorization: Bearer CRON_SECRET`. Para cada kind (24h/2h/followup): `get_due_reminders` → por ítem `claim_reminder` (marca atómica `update ... where col is null returning` → true solo si esta llamada lo reclamó) → envía por el **canal del cliente** (`sendToCustomerByChannel`, senders de Fase 3) → registra el mensaje 'system'. Usa **service client** (bypassa RLS) para todo.
- **Ventanas**: 24h = `starts_at ∈ (now, now+24h]` y col null; 2h = `(now, now+2h]`; followup = `ends_at < now()`. Estados válidos: 24h/2h solo `scheduled`/`confirmed`; followup incluye `completed` (excluye `cancelled`/`no_show`). Solo clientes **con una conversación** (canal por donde enviar) — web/staff sin conversación no reciben aún (limitación v1; requeriría plantilla WA + conversación sintética).
- **🔴 GOTCHA (repetido) — grants por defecto**: `get_due_reminders` devuelve teléfonos/citas de **todas** las orgs (es solo para el cron); los DEFAULT PRIVILEGES de Supabase la dejaron ejecutable por anon/authenticated pese al `grant to service_role` → **fuga potencial**. Fix: `REVOKE EXECUTE ... FROM anon, authenticated` (migración `..040100`). Confirmado: solo `service_role` ejecuta. **Regla firme**: toda RPC nueva → revisar `has_function_privilege('anon'/'authenticated', ...)` y revocar lo que no corresponda.
- **🔴 GOTCHA — Vercel Hobby crons**: Hobby limita los crons a ~1/día. `vercel.json` fija `"0 14 * * *"` (diario, seguro para no romper el deploy). Para recordatorios reales (cada 15 min / hora) se necesita **Vercel Pro** o un **scheduler externo** (p. ej. cron-job.org) que haga `GET /api/cron/appointment-reminders` con `Authorization: Bearer <CRON_SECRET>` (Vercel Cron añade ese header automáticamente cuando existe la env `CRON_SECRET`). El endpoint procesa TODAS las ventanas en cada corrida, así que un scheduler cada 15 min basta.
- **Gotcha heredado — ventana 24h de WhatsApp**: fuera de la ventana de 24h, WhatsApp solo entrega **plantillas aprobadas**; los recordatorios por WA a clientes fuera de ventana fallarán hasta configurar plantillas (atado a App Review). Telegram no tiene esta restricción. **TODO Fase futura**: enviar recordatorios WA por plantilla UTILITY.

### 2026-07-04: Fase 6 COMPLETADA — CRM (contactos + etiquetas + historial)
- **Estado**: ✅ `typecheck` + `build` verdes. Playwright E2E (con un owner creado sobre la org de prueba `7ab0c2ea`, 6 clientes): crear etiqueta "VIP" → etiquetar un cliente + guardar nota → ver su **historial de citas** ("6 jul, 10:00 · Corte — Agendada") → ver sus **conversaciones** y **abrir el chat** (hilo completo agente+recordatorios) → aislamiento por org (el owner solo ve sus 6 clientes). `get_advisors` sin ERROR.
- **Migración**: `20260704050000_fase6_crm.sql`. Reutiliza `clients` (Fase 1); añade `clients.notes`, tablas `tags` (org, name, color, `unique(org,name)`) y `client_tags` (client_id, tag_id) con RLS por org (directo / vía cliente). Sin RPCs nuevas → sin gotcha de grants (tablas RLS accedidas por el cliente autenticado).
- **UI** (`src/features/crm/`): `/dashboard/clientes` (lista con búsqueda por nombre/teléfono via `?q=`, gestor de etiquetas, chips por cliente) y `/dashboard/clientes/[id]` (editar nombre/notas, alternar etiquetas con estado optimista, historial de citas con estado, conversaciones con enlace a `/dashboard/conversaciones/[id]`). Server Components + Server Actions (`createTag`/`deleteTag`/`tagClient`/`untagClient`/`updateClient`). Vínculo cliente ↔ citas ↔ conversaciones reutiliza las tablas existentes (todo RLS-org).
- **Nota**: se creó un owner de prueba (`zztest-crm@example.com`) atado a `7ab0c2ea` para poder ver el CRM con datos; forma parte de los datos de prueba a limpiar de esa org antes de prod.

---

## Gotchas
- [ ] **Enrutado multi-tenant**: resolver organización por `phone_number_id`/WABA antes de escribir; `UNIQUE(type, external_id)` blinda contra fuga entre tenants.
- [ ] **Zona horaria**: agenda/recordatorios usan la zona de la **sucursal**, no UTC del servidor. Verificar/crear `branches.timezone`.
- [ ] **No-solapamiento concurrente**: validar en RPC con bloqueo/transacción (WhatsApp + staff + web pueden reservar el mismo hueco a la vez).
- [ ] **Ventana 24 h de WhatsApp**: fuera de ventana solo viajan **plantillas aprobadas**; recordatorios = plantilla.
- [ ] **Tech Provider / Meta**: NO cobrar por mensaje; el agente IA debe estar **acotado al negocio** (Meta prohíbe chatbots genéricos desde 15-ene-2026); solo API oficial, jamás QR.
- [ ] **Pausa del IA** al intervenir humano (`ai_paused_until`); reactivación explícita (saga `chat-autoresponder-dedup-fix`).
- [ ] **Dedup** por `messages.external_id` en la RPC de entrada.
- [ ] **RLS** en TODAS las tablas nuevas; verificar con `get_advisors` antes de prod. Credenciales de `channels` tratadas como secreto (no legibles vía RLS del agente).
- [ ] **Widget embebible**: CORS + aislamiento por slug; no exponer datos de otros tenants.

## Anti-Patrones
- NO crear tenancy nueva: reutilizar `organizations`/`branches`/`profiles`/`clients`.
- NO escribir desde el webhook con query directa (ANON) — siempre RPC `SECURITY DEFINER`.
- NO cobrar por mensaje ni atar el plan al volumen.
- NO servir media con `getPublicUrl`/service_role — proxy + URL firmada.
- NO hardcodear lógica por giro: horizontal por dato.
- NO validar disponibilidad solo en el cliente.
- NO ignorar errores de TypeScript ni omitir validación Zod.

---

*PRP unificado, visión aprobada por el usuario (2026-06-30). Pendiente para arrancar Fase 0: URL del repo GitHub + access token de Supabase. No se ha modificado código de producto.*
