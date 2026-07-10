# PRP-OLA3: Calidad percibida + adquisición

> **Estado**: 🕐 APROBADA EN PRINCIPIO (Juan pidió "empezar Olas 2 y 3") — alcance detallado listo para ejecución
> **Fecha**: 2026-07-10
> **PRP padre**: `prp-chatventi.md` · **Antecesor**: `prp-ola2-cliente-confianza.md` (✅ 2026-07-10)
> **Insumo**: auditoría UX vs CitaFlow 2026-07-09.

---

## Objetivo

Que ChatVenti **se vea y se sienta un producto premium** (design system unificado dashboard↔landing, PWA instalable) y que **la landing venda sola** (demo del chat IA en vivo). Cierra los gaps restantes de la auditoría.

## Fases

1. **Fase A — Design system unificado.** El dashboard usa `blue-600` genérico; la landing usa violeta `#5B4FE0`. Definir tokens en `tailwind.config.ts` (primary = violeta de la landing, escalas, radios, sombras) y migrar el dashboard a los tokens (nav, botones, badges, cards). shadcn está configurado y sin usar: adoptarlo SOLO donde reduzca código (Dialog/Select), sin reescrituras masivas. Criterio: cero `blue-600` hardcodeado en `(main)`; contraste AA; Playwright visual smoke desktop+móvil.
2. **Fase B — PWA + push para el dueño.** Ejecutar el skill `add-mobile` (PWA instalable + notificaciones push con VAPID, iOS compatible). Caso de uso: notificar al dueño cuando hay aprobación pendiente o mensaje escalado (hoy solo llega por Telegram). Criterio: instalable en Android/iOS; push de prueba recibida; fallback si el navegador no soporta.
3. **Fase C — Demo del chat IA en vivo en la landing.** Widget de chat en la landing que conversa con un negocio DEMO (org semilla "Estética Demo") usando el agente real con rate-limit por IP y tope de mensajes/sesión (proteger saldo OpenRouter), sin escrituras de citas reales (org demo aislada, citas se limpian por cron o se marcan demo). Acierto #1 de CitaFlow. Criterio: visitante conversa 3-5 turnos y "agenda" en la demo; costo acotado.
4. **Fase D — Pedidos de productos por chat.** Los productos de `/r/[slug]` son escaparate; añadir "Pedir por WhatsApp" (deep link `wa.me` con mensaje prellenado del producto) y que el agente entienda consultas de productos (contexto ya disponible en `get_agent_context`… verificar; si no, extender). SIN checkout propio en v1. Criterio: clic en producto → chat abierto con mensaje del producto; el agente responde precio/disponibilidad.

**Dependencias/notas**: Fase C depende de saldo OpenRouter (Juan debe recargar). Fase B usa el skill `add-mobile` (14 commits de gotchas resueltos). Orden recomendado: A → D → B → C (C al final por el costo/riesgo de abuso).

## Fuera de alcance
Voz/Teléfono IA (roadmap post-v1), checkout de productos, sync Google/Apple Calendar, plantillas UTILITY (bloqueado por App Review de Meta).
