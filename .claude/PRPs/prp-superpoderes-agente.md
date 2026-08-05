# PRP — Superpoderes del Agente: catálogo, media, calidad y proactividad

> **Estado**: PENDIENTE (no se ha tocado código)
> **Fecha**: 2026-08-04
> **Proyecto**: ChatVenti
> **Origen**: análisis competitivo vs **Forjabots**

> **Este PRP es autocontenido.** Es uno de tres derivados del mismo análisis:
> `prp-verticales-seo.md` (landings por giro + voz de marca), `prp-canales-meta.md`
> (Instagram DM + Messenger) y `prp-superpoderes-agente.md` (este).
> **Los tres son independientes y pueden ejecutarse en paralelo**, por equipos distintos y
> en cualquier orden. No comparten archivos críticos ni migraciones.
> **La única dependencia interna de todo el conjunto vive aquí dentro**: la Fase 2 (ingesta
> de media) debe completarse antes que la Fase 3 (visión y transcripción), porque hoy el
> binario de un archivo entrante no se descarga nunca. Las fases 1, 4 y 5 son independientes
> entre sí y de la 2/3.

> **Cobertura del roadmap.** Este PRP cubre íntegramente los ítems **4, 5 y 6** del roadmap
> derivado del análisis vs Forjabots: **calificación IA de la conversación 1-5 con alerta**
> (Fase 4), **CSAT** (Fase 4), **seguimiento a conversaciones frías** (Fase 5), **reporte
> diario** (Fase 5), **transcripción de notas de voz** (Fase 3) y **visión para comprobantes**
> (Fase 3), más el empaquetado y nombrado de los superpoderes (Fase 1). **No deben
> planificarse en ningún otro PRP.** La *voz de marca* NO está aquí: vive en
> `prp-verticales-seo.md` por decisión del usuario.

---

## Objetivo

Convertir lo que el agente ya sabe hacer —y lo que aún no— en un **catálogo de capacidades
nombradas, activables y vendibles**, y construir los seis superpoderes que faltan:
calificación IA de la conversación con alerta, CSAT, seguimiento a conversaciones frías,
reporte diario al dueño, transcripción de notas de voz y visión para comprobantes.

Hoy el agente hace mucho y **no se nota**: la UI expone tres controles y ningún inventario de
lo que sabe hacer. No hay nada que enseñar en una demo, nada que listar en la página de
precios, y nada que el dueño pueda encender o apagar.

---

## Por Qué

| Problema | Solución |
|---|---|
| El agente **ya hace mucho pero es invisible**: agenda 24/7, escala a humano, recuerda al cliente, manda recordatorios, consulta su base de conocimiento… y nada de eso tiene nombre ni aparece en ninguna lista. | Catálogo de capacidades con nombre comercial, descripción e icono, visible en el dashboard y reutilizable en la landing. |
| El agente **se rinde ante audio e imagen**. Responde literalmente *"no puedo revisar imágenes ni audios"* y escala a un humano. Un comprobante de pago o una nota de voz —lo más común en WhatsApp— rompe la automatización. | Ingesta de media + visión (comprobantes) + transcripción (notas de voz). |
| **Nadie mide la calidad de la atención.** No hay forma de saber si el agente lo está haciendo bien ni de enterarse de una conversación que salió mal. | Calificación IA 1-5 con razón y alerta al dueño cuando es mala. |
| El follow-up post-cita **pregunta "¿cómo estuvo tu experiencia?" y tira la respuesta**: no se captura ni se agrega. | CSAT con botones, registro y agregados. |
| Un lead que escribió, no agendó y se enfrió **se pierde en silencio**. Todo el sistema de recordatorios cuelga de `appointments`: si no hay cita, no existe. | Cazador de conversaciones frías: un mensaje de reactivación, una sola vez. |
| El dueño **no recibe ni un solo correo sobre su negocio**: las 8 plantillas existentes son de billing y lifecycle. Abre el dashboard cuando se acuerda. | Reporte diario con la actividad del día anterior. |
| Los tiers de IA ($19 / $39 / $109) se venden por volumen y **no tienen nada que los diferencie en funcionalidad**. | Capacidades asignables por tier: argumento de upsell real. |

**Valor de negocio**: automatización que no se cae ante un archivo adjunto, retención (el
dueño ve valor cada mañana en su bandeja), recuperación de leads que hoy se pierden,
argumento de upsell entre tiers, y material concreto para demo y landing.

---

## Qué

### Criterios de Éxito

- [ ] Existe un catálogo de capacidades con **nombre comercial** y descripción, activable por org, y el dashboard lo muestra como lista de toggles.
- [ ] **Con todas las capacidades apagadas, el sistema se comporta exactamente como hoy.** Verificado.
- [ ] Una imagen y una nota de voz enviadas por cada canal quedan en un bucket **privado**, con `media_path` no nulo, y se ven en la conversación mediante URL firmada.
- [ ] Una foto de comprobante es **leída por el agente** (no escalada a ciegas) y su lectura queda en el historial.
- [ ] Una nota de voz se **transcribe** y entra al historial como texto que el agente responde.
- [ ] Con la capacidad apagada o el proveedor caído, **vuelve el comportamiento actual** (aviso amable + escalamiento), no un error.
- [ ] Al cerrarse o enfriarse una conversación, el sistema le asigna una **calificación 1-5 con razón breve**; si es ≤ 2, notifica al dueño.
- [ ] El cliente recibe una **encuesta CSAT** tras la cita, su respuesta se registra y no se duplica al reintentar.
- [ ] Una conversación **sin cita y sin actividad** durante N días recibe **un solo** mensaje de seguimiento.
- [ ] El dueño recibe un **reporte diario** por email con citas de mañana, conversaciones, escalamientos y calificación media.
- [ ] **No se añade ninguna entrada nueva a `vercel.json`**: los jobs cuelgan del cron existente.
- [ ] Ningún job envía dos veces tras un reintento de Vercel.

### Comportamiento Esperado

Un cliente manda la foto de su comprobante. El binario se descarga a un bucket privado, se le
pasa al modelo con visión, el agente confirma el pago citando lo que ve y sigue la
conversación sin molestar a nadie. Otro cliente manda una nota de voz pidiendo cita: se
transcribe, el agente la lee como texto y agenda.

Al cerrarse la conversación, el sistema la califica 4/5 con una razón de una línea. Si
hubiera sido 2/5, al dueño le habría llegado un push. Tres días después de la cita, el
cliente recibe la encuesta CSAT con botones del 1 al 5 y su respuesta queda registrada.

Un lead que preguntó precios hace cuatro días y nunca agendó recibe un único mensaje de
reactivación. A la mañana siguiente, el dueño abre su correo y ve el resumen del día: cuántas
conversaciones, cuántas citas, qué se escaló y cómo va la calificación media.

---

## Contexto

### Referencias del codebase (investigadas)

**Agente**
- `src/features/agente-ia/agent.ts` (680 líneas) — `runAgent()`, `buildSystemPrompt()`, OpenRouter + Vercel AI SDK v6 `generateText`, **`stopWhen: stepCountIs(6)`**. Modelo por defecto `openai/gpt-4o-mini` (`agent_configs.model`, gestionado desde el panel SUPERADMIN). 6 tools: `check_availability`, `book_appointment`, `cancel_appointment`, `reschedule_appointment`, `save_client_name`, `request_human_approval`. Gating por `org_has_ai` cuando `BILLING_ENFORCED === 'true'`.
- `src/features/agente-ia/media.ts` — **el punto de enganche exacto de las fases 2 y 3.** Hoy: constante `MEDIA_REPLY` (*"Por ahora no puedo revisar imágenes ni audios…"*), aviso estático, `create_ai_approval` con un borrador fijo y `notifyOrgOwners`. Respeta `should_respond`. Nunca toca el binario.
- `src/features/agente-ia/types.ts` — `AgentContext`, `AgentSenders`.
- `src/app/(main)/dashboard/agente/probar/page.tsx` + `/api/agente/probar` — sandbox con `sandbox: true`: contexto real, cero efectos secundarios. Banco de pruebas de cada capacidad nueva.
- `agent_configs` (`20260704010000_fase3_ai_agent.sql`): `organization_id` (unique), `enabled`, `system_prompt`, `model`, `approval_mode` (`off|low_confidence|always`), `approval_telegram_chat_id`. **Único interruptor hoy: `enabled`, global.**
- `saveAgentConfig` **omite `model` en el upsert a propósito** (lo preserva en conflicto, usa el default al insertar).

**Los tres webhooks — todos pasan `p_media_path: null`**
- `src/app/api/webhooks/whatsapp/route.ts` líneas ~147, `src/app/api/channels/telegram/route.ts` líneas ~107, ~156, ~277. Detectan el tipo de media (`msg.image|audio|document|video`, `photo|voice|audio|document|video`), lo convierten en un placeholder de texto (`[image]`, `[audio]`) y llaman a `handleIncomingMedia`. **El binario no se descarga nunca.**

**Storage**
- `supabase/migrations/20260722000000_media_storage.sql` — bucket **`media`**: **público de lectura**, 5 MB, `allowed_mime_types` solo `image/png|jpeg|webp`. Es para UI (logos, productos, fotos de profesionales). **No sirve para media entrante.**
- `supabase/migrations/20260723070000_expediente_cliente.sql` + `src/features/storage/records.ts` — `client_files` + bucket **privado** con `signRecordUrl`. **Este es el patrón a copiar.**
- `messages.media_path` (columna existente, siempre null).

**Cron, emails y notificaciones**
- `vercel.json` — **un solo cron**: `/api/cron/appointment-reminders` a las `0 14 * * *`.
- `src/app/api/cron/appointment-reminders/route.ts` (463 líneas) — auth `Bearer ${CRON_SECRET}`. **Ya multiplexa cinco trabajos** en un solo endpoint: recordatorios `24h` / `2h` / `followup`, recordatorios recurrentes de cliente, funnel de trial (`trialEnding`, `trialEnded`, `deletionWarning`, `dataDeleted`), limpieza de la org demo y `verifyTransport()`. Patrón de idempotencia: `get_due_reminders(p_kind)` → `claim_reminder(...)` **atómico** antes de enviar.
- `src/features/emails/mailer.ts` — **SMTP + nodemailer (Hostinger). NO es Resend**, pese a lo que dice `ROADMAP-PARIDAD-CITAFLOW.md`. `emailsEnabled()` omite el envío **en silencio** si faltan credenciales.
- `src/features/emails/templates.ts` — 8 plantillas, **todas de lifecycle/billing**: `teamInvitation`, `welcome`, `onboarding`, `subscriptionActive`, `trialEnding`, `trialEnded`, `deletionWarning`, `dataDeleted`. Ninguna operativa.
- `src/features/notifications/send.ts` — `notifyOrgOwners()` con `web-push`. El agente ya la usa con tags `escalation` y `approval`.
- **No hay `pg_cron` ni `pg_net`** en ninguna migración: toda la programación es cron de Vercel.

**Billing**
- `src/features/billing/plans.ts` — `STARTER_PRICE_USD=29`, `AI_TIERS` `none|300|1000|3000` a $0/$19/$39/$109, `TRIAL_DAYS=10`, `DATA_RETENTION_DAYS=30`, addons de dominio ($5) y equipo ($19).
- `src/features/billing/gating.ts` — `subHasAi()`, RPC `org_has_ai`. **El gating es binario**: los tiers son etiquetas de precio; **no hay contador de conversaciones ni enforcement de cuota en ninguna parte.**

**Botones interactivos (reutilizables para CSAT)**
- WhatsApp: `waSendInteractiveButtons` (máx. 3 botones) → llega como `interactive.button_reply` con `{id, title}`.
- Telegram: `tgSendChoiceButtons` → `callback_query.data`.
- Prefijos ya en uso: `appr:` (aprobación), `say:` (opción del cliente), `conf:<uuid>` (confirmar asistencia). **`conf:` es el molde exacto para un `csat:`**: se maneja en el webhook sin despertar al LLM.

### Estado real de cada capacidad (verificado, no supuesto)

| Capacidad | Estado |
|---|---|
| Agente multi-turno con 6 tools de agenda | EXISTE |
| Escalamiento human-in-the-loop + aprobación por Telegram | EXISTE |
| Base de conocimiento (texto plano, **sin embeddings**) | EXISTE |
| Prompt por rubro (6 plantillas) | EXISTE |
| Sandbox "Probar chat" | EXISTE |
| Botones rápidos (slots, confirmar asistencia) | EXISTE |
| Recordatorios 24 h / 2 h / follow-up post-visita | EXISTE |
| Recordatorios recurrentes por cliente | EXISTE |
| Push al dueño (escalation / approval) | EXISTE |
| Segmentación CRM nuevo/regular/VIP (reglas, no IA) | EXISTE |
| **Descarga de media entrante** | **NO EXISTE** (`p_media_path: null` en los 3 webhooks) |
| **Transcripción de audio / notas de voz** | **NO EXISTE** |
| **Visión / lectura de imágenes / comprobantes** | **NO EXISTE** |
| **Calificación / sentiment / scoring de conversación** | **NO EXISTE** |
| **CSAT / NPS / encuestas** | **NO EXISTE** (el follow-up pregunta pero no captura) |
| **Follow-up de conversaciones frías (lead sin cita)** | **NO EXISTE** (todo cuelga de `appointments`) |
| **Reporte diario al dueño** | **NO EXISTE** |
| **Toggles por capacidad / feature flags** | **NO EXISTE** (solo `enabled` global) |
| **Contador y enforcement de cuota de conversaciones** | **NO EXISTE** |

*Verificado por búsqueda: `csat|sentiment|nps|encuesta|calific|score|transcri|whisper|vision`
devuelve **cero** coincidencias en todo `src/`.*

### Arquitectura propuesta

```
src/features/agente-ia/
├── capabilities.ts        # NUEVO — catálogo: id, nombre comercial, descripción, icono, tier
├── vision.ts              # NUEVO — lectura de imágenes
├── transcribe.ts          # NUEVO — audio → texto (proveedor distinto de OpenRouter)
├── scoring.ts             # NUEVO — calificación 1-5 con razón
├── media.ts               # MODIFICADO — deja de escalar a ciegas
└── components/capabilities-form.tsx   # NUEVO — toggles

src/features/storage/inbound.ts        # NUEVO — bucket privado + URL firmada
src/features/emails/templates.ts       # MODIFICADO — reporte diario
src/app/api/cron/appointment-reminders/route.ts  # MODIFICADO — jobs de F4 y F5
```

### Modelo de datos (aditivo)

```sql
-- Fase 1 — capacidades activables (default seguro: todo apagado = comportamiento actual)
alter table public.agent_configs
  add column if not exists cap_vision         boolean not null default false,
  add column if not exists cap_transcribe     boolean not null default false,
  add column if not exists cap_scoring        boolean not null default false,
  add column if not exists cap_csat           boolean not null default false,
  add column if not exists cap_cold_followup  boolean not null default false,
  add column if not exists cap_daily_report   boolean not null default false;

-- Fase 2 — media entrante (bucket PRIVADO nuevo; `media` es público y solo imágenes)
alter table public.messages
  add column if not exists media_mime text,
  add column if not exists media_text text;   -- transcripción o lectura de la imagen

-- Fase 4 — calificación IA
alter table public.conversations
  add column if not exists ai_score        smallint check (ai_score between 1 and 5),
  add column if not exists ai_score_reason text,
  add column if not exists ai_scored_at    timestamptz;

-- Fase 4 — CSAT
create table if not exists public.csat_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  appointment_id  uuid references public.appointments(id) on delete set null,
  score smallint not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
alter table public.csat_responses enable row level security;
-- policies aisladas por get_my_org() (mismo patrón que clients / conversations)

-- Fase 5 — conversaciones frías y reporte diario (marcas idempotentes)
alter table public.conversations
  add column if not exists cold_followup_sent_at timestamptz;
-- + marca por org y día para el reporte diario, reclamada de forma ATÓMICA
--   (patrón claim_reminder) para que un reintento de Vercel no reenvíe.
```

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico:
> mapear contexto real → generar subtareas → ejecutar → auto-blindaje).
> **Dependencia: Fase 2 antes que Fase 3.** Las fases 1, 4 y 5 son independientes.

### Fase 1: Catálogo de capacidades (nombrar y activar)
**Objetivo**: `capabilities.ts` con nombre comercial, descripción, icono y tier de cada
superpoder —**incluidos los que YA existen**: agenda 24/7, escalamiento a humano, memoria del
cliente, recordatorios, base de conocimiento, botones rápidos—, columnas `cap_*` en
`agent_configs`, UI de toggles en `/dashboard/agente`, y el mismo catálogo reutilizable como
sección de la landing. Evaluar aquí el **contador de uso** por org, dado que las capacidades
nuevas consumen tokens y los tiers no tienen enforcement.
**Validación**: los toggles persisten y sobreviven a un guardado del resto de la config
(`model` sigue sin quedar en null); **con todo apagado, el comportamiento es idéntico al
actual**; el catálogo se pinta desde una sola fuente.

### Fase 2: Ingesta de media entrante (habilitador de la Fase 3)
**Objetivo**: bucket **privado** nuevo —el bucket `media` es público y solo acepta imágenes—,
descarga del binario desde WhatsApp Graph, Telegram `getFile` y el CDN correspondiente,
guardado con ruta `<orgId>/…`, `p_media_path` y `media_mime` reales en
`route_inbound_message`, y URL firmada para el dashboard (patrón `signRecordUrl`).
**Validación**: una imagen y un audio enviados por cada canal quedan en el bucket con
`media_path` no nulo y se ven en la conversación mediante URL firmada; un archivo de tipo o
tamaño no admitido se rechaza con gracia, sin romper la conversación.

### Fase 3: Visión (comprobantes) y transcripción (notas de voz)
**Objetivo**: sustituir el escalamiento ciego de `media.ts` por lectura real: imagen → modelo
con visión, audio → transcripción; el resultado va a `messages.media_text` y al historial que
consume el agente. **La lectura ocurre ANTES de invocar al agente**, no como una tool más.
Mantener el escalamiento actual como **fallback** cuando la capacidad está apagada, el
proveedor falla o el tipo no es soportado.
**Validación**: foto de un comprobante → el agente responde sobre su contenido; nota de voz
pidiendo cita → el agente agenda; con los toggles apagados vuelve exactamente el mensaje
actual; con el proveedor caído, degrada a escalamiento en vez de romper.

### Fase 4: Calificación IA 1-5 con alerta + CSAT
**Objetivo**: al cerrarse o enfriarse una conversación, calificarla 1-5 con una razón breve
(`conversations.ai_score`), notificar al dueño si es ≤ 2, y enviar la encuesta CSAT tras la
cita capturando la respuesta en `csat_responses` mediante botones —reutilizando el mecanismo
`conf:` / `say:` que ya existe, resuelto en el webhook **sin despertar al LLM**. Integrar la
encuesta en el follow-up post-cita que **ya pregunta** por la experiencia, en vez de mandar un
segundo mensaje. Agregados visibles en el dashboard.
**Validación**: una conversación de prueba obtiene score y razón; una mala dispara push al
dueño; pulsar un botón de CSAT inserta la fila y un reintento del proveedor **no la duplica**;
el cliente no recibe dos mensajes preguntando lo mismo.

### Fase 5: Seguimiento a conversaciones frías + reporte diario
**Objetivo**: dos jobs nuevos **dentro del cron existente** (sin tocar `vercel.json`):
(1) detectar conversaciones sin cita e inactivas N días → un único mensaje de reactivación,
con `cold_followup_sent_at` como marca idempotente y respetando la ventana de envío del canal;
(2) email de reporte diario al dueño con citas de mañana, conversaciones, escalamientos y
calificación media.
**Validación**: ejecutar el cron a mano con `CRON_SECRET` produce el envío **una sola vez**;
una segunda ejecución no reenvía; el correo llega por SMTP con datos reales; con las
capacidades apagadas, el cron hace exactamente lo que hacía antes.

### Fase 6: Validación final
**Objetivo**: sistema completo en producción.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run lint` pasa
- [ ] `npm run build` exitoso
- [ ] **E2E con navegador**: comprobante por WhatsApp, nota de voz por WhatsApp y por Telegram, CSAT pulsado por el cliente, reporte diario recibido
- [ ] Regresión: con todas las capacidades apagadas, el sistema se comporta como antes del PRP
- [ ] Regresión del cron: recordatorios 24 h / 2 h / follow-up y funnel de trial siguen funcionando
- [ ] El bucket privado no es accesible sin URL firmada (probar con la URL pública a pelo)
- [ ] `get_advisors` de Supabase sin hallazgos nuevos de seguridad

---

## 🧠 Aprendizajes (Self-Annealing)

> Se llena durante la implementación. El mismo error nunca ocurre dos veces.

### 2026-08-05 (Fase 1): el contador de consumo de IA YA EXISTÍA
- **Corrección al PRP**: la investigación decía *"contador y enforcement de cuota: NO EXISTE"*. **Falso desde el 2026-08-04**: la línea de antiabuso dejó `organizations.trial_ai_messages_used`, `trial_ai_capped_at`, `ai_cap_exempt` y la RPC `consume_trial_ai_message(p_org, p_cap)`, que `runAgent` ya llama con `TRIAL_AI_MESSAGE_CAP = 300`.
- **Matiz que sí sigue en pie**: ese contador es **solo para la prueba gratis**. Los tiers de pago (300/1000/3000) siguen sin enforcement. Lo que falta no es un contador, es extender el existente a los tiers.
- **Detalle de diseño heredado**: ese tope **falla ABIERTO** a propósito (si la consulta falla, el agente responde igual). Es lo contrario a los gates de acceso, y está bien: aquí se acota un coste, no se protege una puerta. Cualquier tope nuevo debe seguir el mismo criterio.
- **Regla**: un PRP escrito hace un día puede estar desfasado si otra línea de trabajo aterrizó en medio. **Mapear el contexto real al entrar en la fase, no fiarse del inventario del PRP.**

### 2026-08-05 (Fase 2): la ingesta va DESPUÉS del 200 y ANTES de la guarda `should_respond`
- **Dónde encaja la descarga**: bajar el binario son dos llamadas HTTP al proveedor. Hacerlo antes de responder 200 invita a que Meta reintente el mismo mensaje. Va dentro del `after()`, y por eso el webhook necesita el `message_id` que devuelve `route_inbound_message`: es lo único a lo que anclar el archivo. En Telegram eso obligó a cambiar el `shouldHandle` booleano por el id.
- **Corrección al diseño previsto**: el guardado NO puede ir detrás de `should_respond`. Esa guarda existe para no duplicar **avisos**; si la ingesta cuelga de ella, con la IA pausada el archivo del cliente no se guarda y la persona que atiende no ve nada. Ahora: se guarda siempre, se avisa solo si corresponde. Verificado: con la IA apagada, el archivo queda anclado y salen **0** mensajes.
- **`attach_message_media` es invocable por ANON** (el webhook usa la ANON key a propósito), así que se escribió estrecha: solo mensajes entrantes, solo si aún no tienen archivo, y la ruta debe empezar por la org dueña del mensaje. Probado con control: ruta de otra org → false, correcta → true, reintento → false.
- **Telegram: el MIME viaja en el mensaje, NO en `getFile`.** Y `photo` llega como array de resoluciones: hay que tomar la **última**. Las fotos no traen `mime_type` — son siempre JPEG.
- **Carpeta privada en App Router**: una ruta en `src/app/api/_algo/` **no se enruta** (Next trata `_` como carpeta privada). Costó un 404 desconcertante al montar el endpoint de prueba.

### 2026-08-05 (Fase 1): las migraciones aplicadas por el editor SQL NO quedan registradas
- **Hallazgo**: `supabase_migrations.schema_migrations` no contiene `20260805000000_voz_de_marca` ni `20260805010000_trial_14_dias`, porque se aplicaron pegando SQL en el editor del panel. Solo la de esta fase quedó registrada, por haber usado `apply_migration`.
- **Consecuencia**: un `supabase db push` intentaría reaplicarlas. **No rompen nada** —ambas son idempotentes: la de voz sale por `return` si ya existe `voice_preset`, y la del trial no encuentra `interval '10 days'`— pero la divergencia existe y conviene saberla.
- **Regla**: usar `apply_migration` siempre que el MCP esté disponible; pegar SQL en el editor es el último recurso y deja la base y el repo desalineados.

---

## Gotchas

> Críticos, verificados leyendo el código durante la investigación.

**Media y storage**
- [ ] **El bucket `media` es público de lectura y solo acepta `image/png|jpeg|webp`.** Guardar ahí comprobantes o notas de voz de clientes **filtraría datos privados** —cualquiera con la URL los vería— y el audio ni siquiera pasaría el filtro MIME. Hay que crear un bucket **privado** nuevo, con el patrón de `client_files` + `signRecordUrl`.
- [ ] **`media_path` existe en `messages` pero los tres webhooks pasan `p_media_path: null`.** El binario no se descarga nunca. Sin la Fase 2 no hay nada que analizar en la Fase 3.
- [ ] Descargar media de WhatsApp requiere **dos llamadas** a Graph (obtener la URL y luego el binario **con el token**) y la URL caduca. Telegram usa `getFile` + otra URL con el token del bot. No son intercambiables.
- [ ] La retención de datos es de **30 días** (`DATA_RETENTION_DAYS`) y hay limpieza automática: los archivos entrantes deben entrar en esa política, o el bucket crece sin control y se convierte en un pasivo de privacidad.

**Modelos y coste**
- [ ] **OpenRouter no expone Whisper/STT de forma fiable.** La transcripción necesita **otro proveedor** (OpenAI o Groq) y, por tanto, una env var y un cliente nuevos. `gpt-4o-mini` **sí** soporta visión, así que la parte de visión puede ir por OpenRouter, pero la de audio no.
- [ ] **`stopWhen: stepCountIs(6)`** en `runAgent`. Meter visión o transcripción como una tool más puede agotar los pasos a mitad de un agendamiento: la lectura de media debe hacerse **antes** de invocar al agente.
- [ ] Las capacidades nuevas **cuestan tokens por mensaje**. Los tiers de IA (`none|300|1000|3000`) **no tienen contador ni enforcement**: activar visión y transcripción sin medir uso es un riesgo de margen directo. Por eso el contador se evalúa en la Fase 1, no al final.
- [ ] El modelo lo fija `agent_configs.model` desde el panel SUPERADMIN. Una capacidad que exija un modelo con visión **no puede asumir** que la org lo tiene configurado: hay que comprobarlo o forzar el modelo solo para esa llamada.

**Cron y envíos**
- [ ] **Vercel Hobby limita los cron jobs** y su granularidad. Hoy hay **un solo cron** que ya multiplexa cinco trabajos. Los jobs de las fases 4 y 5 deben colgarse de ese mismo endpoint: **no** añadir entradas a `vercel.json` (Vercel Pro está diferido a propósito).
- [ ] **No hay `pg_cron` ni `pg_net`**: no existe la opción de programar desde la base de datos.
- [ ] Todo job nuevo necesita **marca idempotente atómica** (patrón `get_due_reminders` → `claim_reminder`, reclamar **antes** de enviar). Sin eso, un reintento de Vercel manda el correo o el mensaje dos veces al mismo cliente.
- [ ] El cron ya es largo (463 líneas, cinco trabajos). Añadir dos más exige vigilar el **tiempo máximo de ejecución** de la función: si expira a mitad, los trabajos del final nunca corren. Ordenar por criticidad y hacer cada job resiliente al fallo del anterior.
- [ ] **Los emails salen por SMTP/nodemailer (Hostinger), NO por Resend** — el `ROADMAP-PARIDAD-CITAFLOW.md` se equivoca en este punto. Y **`emailsEnabled()` omite el envío en silencio** si faltan credenciales: un reporte diario que "no llega" puede ser esto y no un bug de la consulta.
- [ ] El envío de recordatorios y de mensajes de reactivación ocurre **fuera de la conversación**. En WhatsApp eso está sujeto a la ventana de 24 h y **no existe ninguna abstracción de plantillas/HSM en el repo**: todos los envíos son free-form. Un mensaje a una conversación fría de hace 4 días puede fallar en silencio.

**Producto e integración**
- [ ] **El follow-up post-cita ya pregunta** *"¿Cómo estuvo tu experiencia?"* pero no captura la respuesta. El CSAT debe **integrarse ahí**, no añadir un segundo mensaje: el cliente recibiría dos preguntas casi idénticas.
- [ ] WhatsApp admite **máximo 3 botones interactivos**. Una escala CSAT de 1 a 5 no cabe en una sola tanda: hay que decidir (3 opciones, dos tandas, o texto libre con parseo) antes de implementar.
- [ ] Los prefijos de botón `appr:`, `say:` y `conf:` ya están en uso y se resuelven **en el webhook sin despertar al LLM**. Un `csat:` debe seguir exactamente ese molde, incluido el paso por `route_inbound_message` para dedupe.
- [ ] `saveAgentConfig` omite `model` en el upsert a propósito (lo preserva en conflicto, usa el default al insertar). **Al añadir las columnas `cap_*`, no romper ese patrón** ni dejar el modelo en null.
- [ ] `handleIncomingMedia` respeta `should_respond` para no duplicar avisos cuando la IA está pausada o ya hay una aprobación pendiente. **Cualquier lógica nueva debe respetar la misma guarda**, o el cliente recibirá mensajes con la IA supuestamente apagada.
- [ ] La base de conocimiento es **texto plano sin embeddings**: no confundir "visión/transcripción" con RAG. No hay búsqueda semántica que reutilizar.
- [ ] El sandbox `/dashboard/agente/probar` corre con `sandbox: true` (salta gates, simula escrituras, no crea aprobaciones). Es donde se validan las capacidades **antes** de exponerlas a clientes reales.

**Transversales**
- [ ] `maybeSingle()`/`single()` exigen un filtro que garantice ≤1 fila. Una guarda cuya query falla devuelve `null` y **abre** el paso. Al escribir un gate: *si esta query falla, ¿pasa todo el mundo?* (Aprendizaje 2026-07-15.)
- [ ] Antes de dropear o reemplazar cualquier función, buscar quién la llama **por su nombre** (`prosrc ~ 'nombre_funcion\s*\('`), no por el parámetro. Postgres no registra las llamadas dentro de cuerpos `plpgsql`: un `drop function` verde no prueba nada. (Aprendizaje 2026-07-23.)
- [ ] El webhook usa **ANON key** a propósito: toda escritura nueva entra por RPC `SECURITY DEFINER` con `set search_path = public`.
- [ ] RLS obligatoria en `csat_responses`, aislada por `get_my_org()`.
- [ ] Ni typecheck, ni lint, ni SQL verde han cazado ningún bug histórico de este proyecto. **La validación es E2E con navegador.**

## Anti-Patrones

- NO guardar media de clientes en el bucket público `media`.
- NO meter visión ni transcripción como una tool dentro del turno del agente.
- NO crear entradas nuevas en `vercel.json`.
- NO enviar sin reclamar antes la marca de idempotencia.
- NO mandar un segundo mensaje de CSAT junto al follow-up que ya pregunta lo mismo.
- NO activar capacidades por defecto: el default es apagado y el comportamiento actual.
- NO asumir que el modelo configurado de la org soporta visión.
- NO usar `any` (usar `unknown`); NO omitir Zod en entradas de usuario ni en salidas de proveedores.
- NO dar por buena una fase sin E2E con navegador.

---

*PRP pendiente de aprobación. No se ha modificado código.*
