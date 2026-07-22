# PRP — Sandbox "Prueba el Chat IA en vivo" (paridad CitaFlow)

> Estado: **IMPLEMENTADO en one-shot** (esta sesión). Sin migraciones de BD.
> Origen: análisis del demo de la competencia `https://admin.citaflow.com/demo/chatbot`.

## Objetivo

Que el dueño del negocio pueda **chatear con SU propio agente** desde el dashboard,
con la MISMA IA que reciben sus clientes por WhatsApp/Telegram, para validar cómo
responde **antes** de conectarlo. Equivalente a la página `/demo/chatbot` de CitaFlow.

Gap detectado: hoy `/dashboard/agente` solo **configura** el agente (prompt + base de
conocimiento) y el único chat de demostración vive en la **landing pública** conversando
con una org demo COMPARTIDA (`/api/demo-chat`). No existía forma de probar la
configuración REAL del negocio logueado.

## Comportamiento

- Ruta `/dashboard/agente/probar`: mockup de teléfono estilo WhatsApp + panel lateral
  con la información REAL que la IA tiene disponible (servicios y precios, equipo,
  base de conocimiento) + preguntas sugeridas + "¿Cómo funciona?".
- El chat usa `runAgent` (el motor de producción) contra el **contexto real** de la org
  (prompt, servicios, conocimiento, profesionales, horario, zona horaria).
- Botones: "Reiniciar conversación" y "Configurar Chat IA" (→ `/dashboard/agente`).
- Tope de mensajes por conversación (protege el saldo de OpenRouter); el reinicio
  limpia el hilo.

## Decisión de diseño CLAVE — cero efectos secundarios

El sandbox corre contra la org REAL, así que **NO debe** crear citas reales, notificar a
los dueños, ni ensuciar la agenda/CRM/inbox. Solución:

- **Disponibilidad = REAL y de solo lectura** (`check_availability` consulta huecos de
  verdad → experiencia fiel e impactante).
- **Escrituras = SIMULADAS**: `book_appointment` / `cancel_appointment` /
  `reschedule_appointment` NO tocan la BD; solo construyen la confirmación
  determinista (misma UI: fecha/hora/servicio exactos en la tz de la sucursal).
- **Sin aprobaciones ni notificaciones**: en sandbox se ignora `approval_mode` y no se
  crea `ai_approvals` ni se llama `notifyOrgOwners`.
- **Sin gate de habilitación ni de billing**: responde aunque el agente esté apagado o
  el módulo IA no esté contratado (es una prueba, no atención real).

Persistencia mínima necesaria: el hilo del sandbox SÍ se guarda en `conversations` /
`messages` (lo exige `get_agent_context` para la memoria multi-turno), pero:

- Vive en un **canal dedicado por org**: `channels(type='web', external_id='sandbox:<orgId>')`.
- El contacto es `sandbox:<userId>` (un hilo por usuario, reseteable).
- Se **excluye del inbox** (`/dashboard/conversaciones` filtra los canales `sandbox:%`).

## Modelo de datos

Ninguna migración. Reutiliza:
- `channels` (fila creada al vuelo con service_role; UNIQUE(type, external_id) la hace idempotente).
- `route_inbound_message` / `get_agent_context` (resuelven org por canal, sin cambios).
- `runAgent` gana un flag opcional `sandbox` (aditivo, no afecta a los llamadores existentes:
  webhooks WA/TG y `/api/demo-chat`).

## Piezas

| Archivo | Rol |
|---|---|
| `src/features/agente-ia/agent.ts` | `runAgent({ sandbox })`: salta gates, simula escrituras, sin approvals/notify |
| `src/app/api/agente/probar/route.ts` | POST autenticado: asegura canal sandbox → route_inbound → runAgent(sandbox) |
| `src/app/api/agente/probar/reset/route.ts` | POST: borra el hilo sandbox del usuario |
| `src/app/(main)/dashboard/agente/probar/page.tsx` | Página: mockup + paneles con datos reales |
| `src/features/agente-ia/components/probar-chat.tsx` | UI cliente del chat (mockup teléfono) |
| `src/app/(main)/dashboard/agente/page.tsx` | Botón "Probar Chat IA" |
| `src/app/(main)/dashboard/conversaciones/page.tsx` | Excluye conversaciones sandbox del inbox |

## Seguridad / aislamiento

- La API resuelve la org por el cliente autenticado (RLS) y usa service_role SOLO para
  el canal sandbox y el motor (igual patrón que el webhook, que es anon).
- El canal sandbox es `web` y su `external_id` lleva el `org_id`: no hay fuga entre tenants.
- Acceso: `/dashboard/agente` no tiene role-gate propio (cualquier rol con acceso a la
  org lo ve); el sandbox hereda eso. Es solo lectura sobre datos reales + escrituras simuladas.

## Aprendizajes / gotchas

- `get_agent_context` calcula `should_respond` con `agent_configs.enabled`. Un sandbox que
  reusa el motor sin el flag NO respondería con el agente apagado → por eso `sandbox`
  salta ese early-return (y el de billing).
- Simular las escrituras (en vez de crear datos demo) evita 4 focos de contaminación
  (agenda, CRM, recordatorios cron, inbox) con una sola decisión.
- El inbox se filtra en JS (no con filtro embebido PostgREST) para evitar los bordes del
  `!inner` + `not.like` sobre recursos embebidos.
