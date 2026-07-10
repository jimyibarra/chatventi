# PRP-OLA2: Cierre del ciclo con el cliente final + operación manual del dueño

> **Estado**: 🕐 PENDIENTE DE APROBACIÓN
> **Fecha**: 2026-07-10
> **Proyecto**: ChatVenti (chatventi.com)
> **PRP padre**: `prp-chatventi.md` · **Antecesor**: `prp-ola1-agente-nav.md` (✅ 2026-07-09)
> **Insumo**: auditoría UX vs CitaFlow 2026-07-09 (130 capturas) — "aciertos de CitaFlow a copiar".

---

## Objetivo

Que el **cliente final** pueda gestionar su cita sin fricción (confirmar asistencia con un botón, cancelar/reagendar desde un enlace sin login) y que el **dueño** pueda intervenir manualmente en cualquier conversación (responder desde el dashboard pausando la IA automáticamente) y sepa siempre qué le falta configurar (checklist de onboarding con % + empty states educativos).

## Por Qué

| Problema (auditoría) | Solución (acierto de CitaFlow) |
|----------|----------|
| El dueño NO puede responder un chat desde el dashboard (vista solo-lectura); si la IA se equivoca, no hay forma de intervenir sin el teléfono | Composer en `/dashboard/conversaciones/[id]` + **pausa automática de la IA al responder manualmente** |
| El cliente no tiene forma de gestionar su cita fuera del chat; los no-shows no se confirman | **Enlace mágico por cita** (`/c/[token]`, sin login): ver, confirmar, cancelar, reagendar |
| El recordatorio 24h es texto plano; confirmar asistencia requiere escribir | Botón **"Confirmar asistencia"** (reply button WA / inline TG) en el recordatorio |
| Dashboard nuevo = página vacía sin guía; el dueño no sabe qué configurar primero | **Checklist de onboarding con %** en el panel + empty states educativos |

## Qué (Criterios de Éxito)

- [ ] Desde `/dashboard/conversaciones/[id]` el dueño escribe y envía un mensaje; llega por el canal del cliente (TG validable hoy; WA cuando haya token), queda en `messages` con `sender='agent'`, y la IA queda **pausada automáticamente** (p. ej. 30 min) con indicador visible y botón para reactivarla.
- [ ] Toda cita nueva tiene un **token de gestión** opaco; `/c/[token]` muestra la cita (servicio, fecha, hora local, negocio) sin login y permite: **confirmar asistencia**, **cancelar**, **reagendar** (slots reales, mismas reglas de no-solape del servidor). Token inválido → 404 genérico.
- [ ] El enlace mágico viaja en la **confirmación estructurada** del agente (Ola 1) y en el **recordatorio 24h**.
- [ ] El recordatorio 24h incluye botones: **✅ Confirmar asistencia** (marca `confirmed` + mensaje de gracias) y **📅 Cambiar cita** (manda el enlace mágico). En Telegram, inline keyboard equivalente.
- [ ] El panel `/dashboard` muestra **checklist con %**: servicio creado · horario configurado · canal conectado · IA activada · primera cita registrada. Cada ítem enlaza a su pantalla. Desaparece (colapsa) al 100%.
- [ ] Empty states educativos en Agenda, Chats y Clientes (qué es, cómo se llena, CTA a la acción correcta).
- [ ] `typecheck` + `lint` + `build` verdes; RPCs nuevas con grants blindados (REVOKE anon salvo las públicas por token); `get_advisors` sin ERROR; Playwright E2E de los flujos nuevos.

## Contexto (referencias del código real)

- `src/features/agente-ia/senders.ts` — `tgSendMessage`/`waSendMessage`/`waSendInteractiveButtons` ya existen; el composer y el cron los reutilizan (server-side, token por canal).
- `src/features/agente-ia/agent.ts` — confirmación estructurada determinista (Ola 1): ahí se anexa el enlace mágico.
- `src/app/api/cron/appointment-reminders/route.ts` — cron 24h/2h idempotente; se le agregan los botones + enlace.
- `supabase/migrations/20260709000000_ola1_chat_actions.sql` — `cancel/reschedule_appointment_from_chat` (propiedad por teléfono): patrón para las variantes **por token** (`*_by_token`), SECURITY DEFINER + grants explícitos.
- `src/app/r/[slug]/` + `src/features/reservas-web/` — patrón de página pública anon + RPCs públicas; `/c/[token]` sigue ese molde (incluye el fix de disponibilidad y el selector de slots `public-booking.tsx`).
- `src/app/api/channels/telegram/route.ts` — manejo de `callback_query` (`appr:<id>:<1|0>`): patrón para el callback `conf:<appointment_id>` del botón de confirmación; en WA, `button_reply.id` análogo (webhook ya parsea `interactive` desde Ola 1).
- `src/app/(main)/dashboard/page.tsx` — hub actual del panel donde vive el checklist.
- 🔴 Gotchas heredados obligatorios: REVOKE anon en toda RPC nueva no-pública; webhooks/URLs con `www`; envs nuevas → Vercel Production + redeploy; nunca `credentials` en SELECTs de UI.

## Modelo de datos (delta)

- `appointments.manage_token uuid not null default gen_random_uuid()` + índice único. NO exponer en SELECTs del dashboard (solo lo usan las RPCs por token y los senders server-side).
- `appointments.confirmed_by_client_at timestamptz null` (auditoría de confirmación).
- RPCs nuevas (SECURITY DEFINER): `get_appointment_by_token(p_token)`, `confirm_appointment_by_token(p_token)`, `cancel_appointment_by_token(p_token)`, `reschedule_appointment_by_token(p_token, p_new_starts_at)` — grant `anon` (público por diseño, el token ES la autorización); `send_manual_reply` NO existe como RPC: el composer usa Server Action con service client (patrón senders) + `log_outbound_message` + `pause_ai`.

## Fases

1. **Fase A — Composer + pausa automática**: Server Action `sendManualReply` (valida org por RLS, envía por canal, loguea `sender='agent'`, llama `pause_ai` 30 min), UI composer + indicador "IA pausada hasta HH:MM" en la conversación. Validación: Playwright + SQL (TG real simulado).
2. **Fase B — Enlace mágico `/c/[token]`**: migración (token + RPCs by_token + grants), página pública (ver/confirmar/cancelar/reagendar con slots), integración del enlace en confirmación estructurada del agente. Validación: Playwright anon E2E + intento con token inválido.
3. **Fase C — Recordatorio con botones**: cron 24h manda botones (WA interactive / TG inline) + enlace mágico; callbacks `conf:<id>` en ambos webhooks → `confirmed` + gracias. Validación: seed de cita en ventana + corrida del cron + callback simulado.
4. **Fase D — Checklist onboarding + empty states**: componente de checklist derivado del estado real (queries server-side), % y CTAs; empty states en Agenda/Chats/Clientes. Validación: Playwright con org nueva (0%) y org completa (100%).

**Fuera de alcance (→ Ola 3)**: design system unificado (paleta landing → dashboard, shadcn), PWA + push del dueño (skill add-mobile), demo del chat IA en vivo en la landing, pedidos de productos por chat.

## Riesgos y decisiones tomadas

- El enlace mágico es público por token: tokens uuid v4 (128 bits), 404 genérico, sin enumeración; reagendar por token revalida no-solape en servidor (mismo lock).
- WA saliente sigue sin token en el canal de prueba: las validaciones de envío real se hacen por Telegram; WA se verifica al nivel de "payload correcto construido" + queda listo para el token (tarea del usuario).
- El composer respeta la ventana de 24h de WhatsApp solo informativamente en v1 (aviso si el último inbound > 24h; el envío por plantilla queda para cuando Meta apruebe las UTILITY).
