# PRP-OLA1: Confianza y cierre del agente IA + navegación unificada del dashboard

> **Estado**: ✅ COMPLETADO (2026-07-09)
> **Fecha**: 2026-07-09
> **Proyecto**: ChatVenti (chatventi.com)
> **PRP padre**: `prp-chatventi.md` (Fases 0–8 completadas; esta Ola cierra brechas del criterio "el agente agenda/reagenda/cancela desde el chat")

---

## Objetivo

Cerrar el ciclo completo del recepcionista IA en el chat (cancelar y reagendar citas, no solo crear), hacerlo **confiable ante fallos** (fallback estático + escalamiento) y **menos fatigante** (máx 3 horarios, botones interactivos de WhatsApp, confirmación estructurada), además de unificar la navegación del dashboard en un componente compartido (sidebar desktop + bottom-nav móvil) eliminando las mini-navs duplicadas de cada página.

## Por Qué

| Problema | Solución |
|----------|----------|
| El agente solo puede CREAR citas; si el cliente pide cancelar/reagendar, no puede y el negocio pierde confianza | Nuevas RPCs SECURITY DEFINER `*_from_chat` (validan propiedad por teléfono) + tools `cancel_appointment` y `reschedule_appointment` |
| Conversaciones fatigosas: listas largas de horarios, re-preguntas de datos ya dados, insistencia ante off-topic | Reglas de prompt anti-fatiga (máx 3 horarios, no re-preguntar, escalar tras 2 off-topic) + reply buttons de WhatsApp |
| Si el modelo falla (`generateText` lanza), el cliente se queda SIN respuesta (hoy `handled:false` y silencio) | Fallback: respuesta estática amable + `create_ai_approval` para que un humano retome |
| Tras reservar, la confirmación depende del texto libre del modelo (puede omitir fecha/hora/servicio) | Confirmación estructurada determinista construida por código (servicio, fecha, hora local, negocio) |
| Media entrante (audio/imagen/documento) se guarda como `[image]` y el agente ni responde ni escala | Aviso amable al cliente + escalamiento a humano (pausa IA + aprobación pendiente) |
| Cada página del dashboard tiene su propia mini-nav `<nav>` distinta (Panel/Agenda/Conversaciones/…) — inconsistente y duplicada en ~8 páginas | Componente compartido de navegación en el layout `(main)`: sidebar en desktop + bottom-nav en móvil |

**Valor de negocio**: el criterio de venta central de ChatVenti es "recepcionista IA 24/7 confiable". Sin cancelar/reagendar y sin fallback, el agente decepciona en el primer caso real y el negocio apaga la IA (churn). Los botones y la confirmación estructurada suben la tasa de cierre de reservas por chat. La navegación unificada es requisito de calidad percibida para el App Review de Meta y las demos de venta.

## Qué

### Criterios de Éxito
- [ ] Un cliente puede **cancelar** su cita desde WhatsApp/Telegram; la RPC rechaza (excepción controlada) si la cita no pertenece al teléfono de la conversación.
- [ ] Un cliente puede **reagendar** su cita desde el chat: el agente consulta disponibilidad, mueve la cita y confirma; revalida no-solapamiento en servidor.
- [ ] El agente **nunca ofrece más de 3 horarios** por mensaje, no re-pregunta datos ya presentes en el historial, y **escala a humano tras 2 mensajes off-topic** consecutivos.
- [ ] Tras reservar/reagendar/cancelar llega una **confirmación estructurada** con servicio, fecha y hora en la zona horaria de la sucursal (formato fijo, no texto libre del modelo).
- [ ] En WhatsApp, el agente puede enviar **reply buttons** (p.ej. Confirmar / Elegir otro horario) y la pulsación del botón entra al historial y dispara respuesta del agente.
- [ ] Si `generateText` falla, el cliente recibe una **respuesta estática amable** y se crea una `ai_approval` (el negocio recibe la alerta por Telegram si tiene chat configurado).
- [ ] Un mensaje con **media** (imagen/audio/documento/video) recibe aviso amable ("un humano te atenderá") y la conversación queda escalada (IA pausada, estado pendiente).
- [ ] Todas las páginas del dashboard usan **un solo componente de navegación** (sidebar ≥md + bottom-nav <md con item activo resaltado); cero mini-navs `<nav>` duplicadas en páginas.
- [ ] `npm run typecheck` y `npm run build` pasan; Playwright confirma la navegación en desktop y móvil.

### Comportamiento Esperado (Happy Path)

**Cancelar**: Cliente escribe "quiero cancelar mi cita". El agente ve las citas próximas del cliente (contexto), identifica la cita (si hay varias, pregunta cuál UNA vez), llama `cancel_appointment` y responde con confirmación estructurada: "❌ Cita cancelada: Corte de cabello — jue 10 jul, 16:00".

**Reagendar**: "¿puedo moverla al viernes?" → agente llama `check_availability`, ofrece **máx 3 horarios** como reply buttons en WhatsApp (texto numerado en Telegram), el cliente pulsa uno, el agente llama `reschedule_appointment` y confirma con formato estructurado.

**Fallo del modelo**: OpenRouter da timeout → el cliente recibe "Dame un momento, una persona del equipo te atenderá en breve 🙏" y el dueño recibe en Telegram la solicitud de aprobación/intervención.

**Media**: Cliente manda un audio → "Por ahora no puedo escuchar audios; ya avisé a una persona del equipo para que te atienda 🙏" + conversación escalada.

**Navegación**: El dueño entra a /dashboard en su teléfono → bottom-nav fija con Panel · Agenda · Chats · Clientes · Más; en desktop, sidebar persistente con las 8 secciones y su item activo.

---

## Contexto

### Referencias (código existente — patrones a seguir)
- `src/features/agente-ia/agent.ts` — orquestador `runAgent` + tools existentes (`check_availability`, `book_appointment`, `request_human_approval`); las nuevas tools siguen este patrón exacto (RPC vía cliente anon del webhook). Hoy 235 líneas: al crecer, extraer tools a `src/features/agente-ia/tools.ts` (regla max 500 líneas).
- `src/features/agente-ia/senders.ts` — `waSendMessage` (Cloud API v21.0, token por canal desde `channels.credentials` con service client) y `tgSendMessage` (acepta `reply_markup`). Aquí se agrega `waSendInteractiveButtons`.
- `src/features/agente-ia/types.ts` — `AgentContext`, `AgentSenders`, `RunAgentResult`; se extienden (citas próximas, sender de botones).
- `src/app/api/webhooks/whatsapp/route.ts` — webhook WA: firma HMAC, Zod del payload, `route_inbound_message` (ANON), `after()` para responder tras el 200. **Gotcha**: hoy solo `msg.text` entra a `toAnswer` (línea 127) y el Zod NO parsea `type: 'interactive'` → los botones y la media deben incorporarse aquí.
- `src/app/api/channels/telegram/route.ts` — patrón de manejo de `callback_query` (`appr:<id>:<1|0>`) como referencia para el manejo de `button_reply` en WA.
- `supabase/migrations/20260704000100_fase2_agenda_rpcs.sql` — `create_appointment_from_chat` es EL patrón para las nuevas RPCs: resolver org por canal (`channels.type + external_id`), upsert/lookup de cliente por teléfono, advisory lock por branch+staff, errores `slot_taken`/`*_not_found`. `reschedule_appointment` y `set_appointment_status` existen pero son **solo authenticated** (el anon fue revocado a propósito en `20260704000200`): NO reutilizarlas desde el webhook; crear variantes `_from_chat`.
- `supabase/migrations/20260704010000_fase3_ai_agent.sql` — `get_agent_context` (extender con citas próximas del cliente), `create_ai_approval` (pausa la conversación en `pending`), patrón de GRANTS (revoke public → grant anon, authenticated).
- `src/app/(main)/layout.tsx` — layout del dashboard (solo header con logout); aquí se monta la navegación compartida.
- `src/app/(main)/dashboard/*/page.tsx` — ~8 páginas con mini-navs `<nav>` inline duplicadas (p.ej. `conversaciones/page.tsx:39-49`) a eliminar.
- Docs Meta: [Interactive Reply Buttons](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages) — `type: 'interactive'`, `interactive.type: 'button'`, **máx 3 botones**, título ≤20 chars, id ≤256 chars; el entrante llega como `messages[].type = 'interactive'` con `interactive.button_reply.{id,title}`.

### Arquitectura Propuesta (Feature-First)

```
src/features/agente-ia/
├── agent.ts            # runAgent: + tools cancel/reschedule, prompt anti-fatiga,
│                       #   confirmación estructurada, fallback en catch
├── tools.ts            # (nuevo, si agent.ts supera ~500 líneas) definición de tools
├── senders.ts          # + waSendInteractiveButtons(phoneNumberId, token, to, body, buttons[≤3])
│                       # + sendButtonsToCustomer en AgentSenders (Telegram: inline_keyboard)
└── types.ts            # AgentContext.upcoming_appointments, AgentSenders.sendButtons

src/app/api/webhooks/whatsapp/route.ts
    # Zod: + interactive.button_reply; button_reply → route_inbound_message(body=title)
    #   y entra a toAnswer (dispara agente)
    # Media: route_inbound_message('[tipo]') + aviso amable + escalate (NO corre el LLM)

src/shared/components/
└── dashboard-nav.tsx   # 'use client'; usePathname; sidebar ≥md + bottom-nav <md
                        # (src/shared/components existe y está vacío — es su lugar)

src/app/(main)/layout.tsx   # monta DashboardNav; páginas pierden sus mini-navs
```

Decisiones clave:
1. **Camino ANON del webhook → RPC SECURITY DEFINER** (patrón validado del motor SastrePro2): las nuevas RPCs resuelven org por canal y **validan propiedad**: la cita debe pertenecer al `client` cuyo `phone = trim(p_client_phone)` dentro de esa org. Nunca aceptar un `appointment_id` sin ese cruce.
2. **El agente conoce las citas del cliente por contexto**, no por tool de búsqueda: se extiende `get_agent_context` con `upcoming_appointments` (id, servicios, starts_at, status de citas futuras no canceladas del cliente). Menos round-trips, menos alucinación de ids.
3. **Confirmación estructurada por código, no por el modelo**: cuando `book/reschedule/cancel` tienen éxito, el orquestador construye y envía el mensaje de confirmación determinista (con `Intl.DateTimeFormat` en la tz de la sucursal) además de/EN VEZ DE el texto libre del turno.
4. **Anti-fatiga en el prompt** (sin estado nuevo en BD): reglas explícitas en `buildSystemPrompt` — ofrecer máx 3 horarios, no re-preguntar datos presentes en el historial (el modelo ya ve los últimos 20 mensajes), y tras 2 mensajes off-topic consecutivos llamar `request_human_approval`. `check_availability` pasa a devolver máx 3 slots (hoy 12) para reforzarlo estructuralmente.
5. **Fallback ante error del modelo**: en el `catch` de `generateText`, enviar respuesta estática por `senders.sendToCustomer`, loguearla con `log_outbound_message (sender='system')` y crear `create_ai_approval` (deja la conversación `pending` → la IA no insiste).
6. **Media**: decidir en el webhook (no gastar tokens del LLM): registrar el mensaje (ya se hace con placeholder `[tipo]`), responder aviso estático y escalar vía `create_ai_approval`. La descarga real de media (proxy firmado) queda fuera de esta ola (patrón SastrePro2 diferido).
7. **Navegación**: un único client component compartido; el layout `(main)` server component lo renderiza. Bottom-nav móvil con 4–5 items principales + "Más"; sidebar desktop con las 8 secciones. Padding-bottom en `<main>` móvil para no tapar contenido.

### Modelo de Datos (migración nueva, sin tablas nuevas)

```sql
-- 20260709000000_ola1_chat_actions.sql (nombres finales en implementación)

-- 1) cancel_appointment_from_chat(p_channel_type, p_external_id, p_client_phone, p_appointment_id)
--    SECURITY DEFINER; resuelve org por canal; exige que la cita pertenezca al
--    cliente (org, phone) y esté en estado cancelable ('scheduled','confirmed')
--    y futura; set status='cancelled'. Errores: channel_not_found,
--    appointment_not_found (cubre "no es tuya"), not_cancellable.

-- 2) reschedule_appointment_from_chat(p_channel_type, p_external_id, p_client_phone,
--    p_appointment_id, p_new_starts_at)
--    Igual validación de propiedad + lógica de reschedule_appointment
--    (advisory lock, no-solapamiento excluyendo la propia cita, slot_taken).

-- 3) get_agent_context: agregar clave 'upcoming_appointments' =
--    citas futuras del cliente (status not in ('cancelled','no_show')) con
--    id, starts_at, status y nombres de servicios agregados.

-- GRANTS (patrón harden): revoke all ... from public;
-- grant execute ... to anon, authenticated;   -- las usa el webhook (ANON)
```

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo fases. Las subtareas se generan al entrar a cada fase
> con el bucle agéntico (mapear contexto → generar subtareas → ejecutar).

### Fase 1: RPCs de acciones desde chat (BD)
**Objetivo**: Migración con `cancel_appointment_from_chat` y `reschedule_appointment_from_chat` (SECURITY DEFINER, validación de propiedad por teléfono, grants anon+authenticated con patrón harden) y `get_agent_context` extendido con `upcoming_appointments`. Types TS regenerados/actualizados.
**Validación**: `execute_sql` de prueba: cancelar/reagendar una cita propia funciona; con teléfono ajeno lanza excepción; `get_agent_context` devuelve las citas próximas; `get_advisors` sin alertas nuevas.

### Fase 2: Tools + prompt anti-fatiga + confirmación estructurada + fallback
**Objetivo**: `agent.ts` con tools `cancel_appointment` y `reschedule_appointment` (consumen las RPCs de Fase 1), reglas anti-fatiga en `buildSystemPrompt` (máx 3 horarios — también recortar `check_availability` a 3 slots —, no re-preguntar, escalar tras 2 off-topic), confirmación estructurada post book/reschedule/cancel construida por código en la tz de la sucursal, y fallback en el `catch` de `generateText` (respuesta estática + `log_outbound_message` + `create_ai_approval`). Extraer tools a `tools.ts` si se supera el límite de 500 líneas.
**Validación**: Conversación real por Telegram (canal de prueba): cancelar y reagendar una cita end-to-end; forzar error del modelo (modelo inválido) y verificar respuesta estática + `ai_approvals` pendiente; el agente nunca lista más de 3 horarios.

### Fase 3: Mensajes interactivos de WhatsApp (reply buttons)
**Objetivo**: `waSendInteractiveButtons` en `senders.ts` (máx 3 botones, títulos ≤20 chars) + `sendButtons` en `AgentSenders` (Telegram lo mapea a `inline_keyboard` o texto numerado); webhook WA parsea `type:'interactive'` con `interactive.button_reply` y lo enruta como mensaje entrante (body = title del botón) que SÍ dispara al agente; el orquestador usa botones para ofrecer horarios (≤3) y para la confirmación (p.ej. "Confirmar" / "Cambiar horario").
**Validación**: En el número real de WhatsApp (validado en PROD): el agente ofrece horarios como botones, la pulsación llega al historial de la conversación en el dashboard y el agente completa la reserva.

### Fase 4: Confianza operativa — media entrante
**Objetivo**: El webhook WA (y Telegram si aplica) detecta media (`image/audio/document/video`), conserva el registro placeholder, envía aviso amable estático al cliente y escala (crea `ai_approval` → conversación `pending`, IA en pausa) sin invocar al LLM.
**Validación**: Enviar imagen y audio al número de prueba: cliente recibe el aviso, la conversación queda `pending` en el dashboard y llega alerta al Telegram del negocio.

### Fase 5: Navegación unificada del dashboard
**Objetivo**: `src/shared/components/dashboard-nav.tsx` (client, `usePathname`, item activo) con sidebar ≥md y bottom-nav <md; montado en `src/app/(main)/layout.tsx`; eliminadas TODAS las mini-navs inline de las páginas de dashboard (panel, agenda, agenda/configuracion, conversaciones, clientes, agente, conexiones, reservas-web, facturacion).
**Validación**: `grep` confirma cero mini-navs residuales; Playwright screenshots en 1280px (sidebar) y 390px (bottom-nav) con item activo correcto en 3 rutas distintas.

### Fase 6: Validación final
**Objetivo**: Sistema funcionando end-to-end con todos los criterios de éxito.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Flujo completo por chat: agendar → confirmar con botón → reagendar → cancelar (con confirmaciones estructuradas)
- [ ] Playwright confirma navegación desktop y móvil
- [ ] Criterios de éxito del PRP cumplidos

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.
> El conocimiento persiste para futuros PRPs. El mismo error NUNCA ocurre dos veces.

### 2026-07-09: Validación completada — resumen E2E
- **BD**: migración `ola1_chat_actions` aplicada y probada con DO-block transaccional que hace ROLLBACK forzado (patrón seguro para probar RPCs en PROD sin dejar datos): reagendar propio ✅, cancelar ajeno → `appointment_not_found` ✅, re-cancelar → `not_actionable` ✅, `upcoming_appointments` en contexto ✅. `get_advisors`: solo el WARN esperado de SECURITY DEFINER+anon (arquitectura intencional del webhook).
- **Chat E2E real** (webhook Telegram simulado + gpt-4o-mini, org de prueba `7ab0c2ea`): agendar (3 horarios repartidos mañana/mediodía/tarde) → confirmación estructurada ✅ → reagendar 🔄 ✅ → cancelar (pide confirmación antes, luego ❌) ✅. Media (photo) → aviso estático + conversación `pending` + approval, sin invocar LLM ✅. Modelo inválido → `FALLBACK_REPLY` + approval ✅.
- **Navegación**: Playwright 1280px (sidebar, item activo) y 390px (bottom-nav + panel "Más") ✅. `typecheck` + `build` verdes.

### 2026-07-09: `npm run lint` roto en Next 16
- **Error**: `next lint` fue eliminado en Next 16; el script lo interpreta como directorio (`no such directory: ...\lint`). Además ESLint 9 exige `eslint.config.js` (flat) y el repo no lo tiene.
- **Fix**: pendiente — migrar el script a `eslint` directo con flat config (`eslint.config.mjs` + `eslint-config-next`). Mientras tanto las puertas de calidad son `typecheck` + `build`.
- **Aplicar en**: cualquier proyecto del template al subir a Next 16.

### 2026-07-09: scripts Node sueltos no resuelven node_modules del proyecto
- **Error**: un `.mjs` en un directorio temporal falla con `ERR_MODULE_NOT_FOUND` al importar `@supabase/supabase-js` (ESM resuelve desde la ubicación del archivo, no el cwd).
- **Fix**: copiar el script dentro del proyecto, ejecutarlo y borrarlo (o usar `createRequire` desde una ruta del proyecto).
- **Aplicar en**: scripts admin puntuales (crear usuarios de prueba, etc.).

### 2026-07-09: probar RPCs en PROD con DO-block + RAISE (rollback garantizado)
- **Patrón**: crear datos de prueba + ejercer las RPCs + capturar resultados en variables + `raise exception 'TEST_RESULTS | ...'` al final. La excepción revierte TODO y el mensaje lleva los asserts.
- **Aplicar en**: cualquier validación de migraciones contra la BD de producción.

---

## Gotchas

> Cosas críticas a tener en cuenta ANTES de implementar

- [ ] **El webhook corre como ANON** (`createWebhookClient`): toda RPC nueva que use necesita `grant execute ... to anon` explícito (patrón `_harden_function_grants`). Y al revés: NO dar anon a RPCs de UI (aprendizaje Fase 2, migración `20260704000200`).
- [ ] `reschedule_appointment` y `set_appointment_status` existentes son **solo authenticated** — desde el chat usar SIEMPRE las nuevas variantes `_from_chat` con validación de propiedad por teléfono; no "abrir" las existentes a anon.
- [ ] El Zod del webhook WA (`route.ts`) es estricto al shape conocido: sin agregar `interactive` al `messageSchema`, los button_reply se descartan silenciosamente. Además hoy solo `msg.text` empuja a `toAnswer` — los botones deben empujar también o el agente no responde.
- [ ] WhatsApp reply buttons: **máx 3 botones**, `title` ≤20 caracteres, `id` ≤256; solo válidos dentro de la ventana de servicio de 24h (ok: siempre respondemos a un mensaje entrante). Payload: `type:'interactive'`, `interactive:{type:'button',body:{text},action:{buttons:[{type:'reply',reply:{id,title}}]}}`.
- [ ] Responder al webhook SIEMPRE 200 rápido y trabajar en `after()` (evita reintentos de Meta); ya es el patrón de ambos webhooks — mantenerlo para botones/media/fallback.
- [ ] `create_ai_approval` deja la conversación en `pending` y `should_respond=false` → tras el fallback/escalamiento la IA no insistirá sola; el humano resuelve por Telegram (o desde el panel). No crear aprobaciones duplicadas si ya hay una `pending`.
- [ ] Confirmaciones de hora: usar SIEMPRE la `timezone` de la sucursal (`fmtTime`/`Intl.DateTimeFormat`), nunca la del servidor (Vercel = UTC).
- [ ] Si la org tiene `approval_telegram_chat_id` nulo, `sendApproval` no puede notificar: el fallback debe seguir funcionando (respuesta estática + approval en BD visible en el panel) sin lanzar.
- [ ] `agent.ts` (235 líneas) crecerá: si supera ~500 líneas, extraer tools a `tools.ts` (regla del proyecto).
- [ ] Layout `(main)` es server component: la nav con `usePathname` debe ser un client component separado importado por el layout.
- [ ] `agenda-board.tsx` y otras páginas enlazan rutas internas: al quitar mini-navs, no romper links funcionales dentro del contenido (solo remover las `<nav>` de navegación duplicada).

## Anti-Patrones

- NO crear nuevos patrones si los existentes funcionan (seguir `create_appointment_from_chat` para las RPCs, `appr:<id>:<1|0>` para callbacks).
- NO aceptar `appointment_id` del chat sin validar propiedad por (org, teléfono) en la RPC.
- NO dejar que el modelo redacte confirmaciones de fecha/hora (determinista por código).
- NO invocar al LLM para media entrante (respuesta estática decidida en el webhook).
- NO ignorar errores de TypeScript; NO usar `any` (usar `unknown`).
- NO hardcodear textos de horarios/fechas sin timezone de sucursal.
- NO duplicar navegación por página nunca más: un solo componente compartido.

---

*PRP pendiente aprobación. No se ha modificado código.*
