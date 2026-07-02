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
