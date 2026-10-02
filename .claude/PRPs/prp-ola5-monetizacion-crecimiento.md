# PRP — Ola 5: abrir la puerta, medir y cobrar

> **Estado**: EN PROGRESO (GO de Juan el 2026-10-03, modo Full Autonomy)
> **Fecha**: 2026-10-03
> **Proyecto**: ChatVenti

---

## Objetivo

Dejar ChatVenti listo para vender: una página principal que dice la verdad, recordatorios
puntuales, consumo medido y excedentes cobrados, plan anual, referidos, prueba del dinero que
trae la IA, reseñas en Google y un acceso para socios (PASEN) al que se le factura lo que consume.

## Por Qué

| Problema | Solución |
|----------|----------|
| La home describe el modelo de precios anterior y muestra testimonios de negocios que no existen | Texto alineado con los 4 planes; testimonios sustituidos por prueba verificable y el programa de fundadores |
| «Tu App» y «Dominio propio» se cobran y no existen | Dejan de venderse hasta estar construidos |
| Los recordatorios de 24 h y 2 h corren una vez al día | Corrida cada 15 minutos con `pg_cron` + `pg_net` (gratis) |
| Nadie mide el consumo en planes de pago ni cobra el excedente | Medición por organización y cierre mensual con cargo en Stripe |
| No hay plan anual ni programa de referidos | 12 meses por 10 y «recomienda y gana un mes» con saldo a favor en Stripe |
| El dueño no ve cuánto dinero le trajo la recepcionista | Cifra en el Panel y en el resumen diario |
| No se piden reseñas | Enlace a Google tras la encuesta post-cita, a todos (Google prohíbe filtrar) |
| PASEN revende ChatVenti sin acceso técnico ni forma de facturarle | Socios con clave, alta de negocios por API y consumo consolidado al socio |

**Valor de negocio**: hoy hay 6 organizaciones y 0 clientes de pago. Cada punto ataca una razón
por la que un prospecto no entra, no se queda o no paga lo que consume.

## Qué

### Criterios de Éxito
- [ ] La home no menciona el modelo viejo ni testimonios inventados; ningún complemento sin construir se puede contratar.
- [ ] Un recordatorio de 2 h sale con menos de 15 minutos de retraso, sin duplicarse y sin disparar a deshoras los envíos diarios.
- [ ] Cada organización ve su consumo del mes; el cierre mensual crea un cargo de excedente idempotente.
- [ ] El checkout acepta periodo anual; la suscripción anual se refleja en la base.
- [ ] Un alta con código de referido acredita un mes a quien recomendó, una sola vez, tras el primer pago.
- [ ] El Panel muestra las citas agendadas por la IA en el mes y su importe.
- [ ] Con el enlace de reseñas configurado, quien responde la encuesta recibe el enlace.
- [ ] Un socio con clave puede crear un negocio y consultar su consumo; nada de eso es accesible sin clave.

### Decisiones tomadas (cambiables en una línea)
- **Unidad de consumo**: respuestas de la IA (`messages.sender = 'ai'`) y mensajes salientes por WhatsApp, contados desde `messages`. No se añade escritura nueva al camino del agente.
- **Quién paga a Meta**: hoy el cliente (regla de Tech Provider). Constante `META_PAID_BY = 'client'`; con ella el costo medido es solo IA. Si pasa a `'chatventi'`, el mismo cierre cobra WhatsApp.
- **Excedente** = (costo medido − crédito del plan) × (1 + `USAGE_COMMISSION_PCT`). Valor inicial 30 %: lo fija Juan.
- **Anual** = 10 mensualidades. Precios de Stripe resueltos por `lookup_key` (sin variables nuevas en Vercel).
- **Referido** = un mes del plan de quien recomienda, como saldo a favor en Stripe (mismo molde que PASEN).
- **Reseñas**: se piden a todos los que responden la encuesta, nunca solo a los contentos.

---

## Contexto

### Referencias
- `src/features/billing/` (plans, gating, actions), `src/lib/stripe.ts`, `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/cron/appointment-reminders/route.ts` — todas las etapas ya son idempotentes por RPC de reclamo
- `src/features/dashboard/metrics.ts`, `src/features/agente-ia/csat.ts`, `outreach-jobs.ts`
- PASEN (solo lectura): `src/features/billing/services/sync.ts` (referidos con `createBalanceTransaction` + clave de idempotencia), `src/features/prospects/services/places.ts` (Places API New, Text Search)
- CLAUDE.md: `revoke ... from public, anon, authenticated` en toda RPC nueva; índices en FKs; `(select fn())` en policies; guardas por función SECURITY DEFINER

### Modelo de Datos (aditivo)
- `usage_periods(organization_id, period_start date, ai_replies, wa_messages, cost_usd, credit_usd, overage_usd, charge_usd, stripe_invoice_item_id, status, closed_at)` PK (org, periodo)
- `organizations`: `referral_code` único, `referred_by` (org), `google_review_url`, `google_place_id`, `partner_id`
- `subscriptions.billing_interval` ('month' | 'year')
- `referral_rewards(referrer_org, referred_org único, amount_cents, status, stripe_txn_id)`
- `partners(id, name, api_key_hash, stripe_customer_id, status)`

---

## Blueprint (Assembly Line)

### Fase 1: Home veraz
**Objetivo**: precios y preguntas alineados con el catálogo; testimonios sustituidos; complementos sin construir fuera de la venta.
**Validación**: HTML de producción sin el texto viejo; build verde.

### Fase 2: Recordatorios cada 15 minutos
**Objetivo**: `?scope=reminders` solo envía 24 h y 2 h; `pg_cron` lo llama cada 15 min con el secreto en Vault.
**Validación**: fila en `cron.job`, respuesta 200 en `net._http_response`, 401 sin secreto, la corrida diaria intacta.

### Fase 3: El dinero que trajo la IA + reseñas en Google
**Objetivo**: métrica mensual en Panel y resumen diario; ajuste de enlace de reseñas (pegado o buscado con Places) y envío tras la encuesta.
**Validación**: consulta contra datos reales con control (org sin citas de IA = 0); webhook de encuesta con y sin enlace.

### Fase 4: Consumo, excedentes, plan anual y referidos
**Objetivo**: medición por organización, cierre mensual con cargo en Stripe (modo prueba), checkout anual y recompensa de referidos.
**Validación**: cierre ejecutado dos veces = un solo cargo; suscripción anual de prueba sincronizada; referido acreditado una vez.

### Fase 5: Acceso para socios (PASEN)
**Objetivo**: clave de socio, alta de negocio por API, consulta de consumo, consumo de sus negocios facturado al socio.
**Validación**: sin clave 401; clave de otro socio no ve negocios ajenos; alta crea org + dueño + sucursal.

### Fase 6: Rediseño «Líneas» de Panel y Agenda
**Objetivo**: llevar al código el diseño elegido por Juan, en computadora y celular.
**Validación**: recorrido con navegador como dueño y como staff; detector de Impeccable; `DESIGN.md`.

### Fase 7: Instagram y Messenger por el dueño
**Objetivo**: conectar la página de Facebook y su Instagram desde Conexiones.
**Validación**: canal creado con `page_id`; prueba real del popup por Juan.

### Fase 8: Inglés
**Objetivo**: home y alta en inglés primero; panel después.
**Validación**: `/en` servido con `hreflang`; ninguna cadena en español en la versión inglesa de la home.

### Fase N: Validación Final
- [ ] `npm run typecheck`, `npm run lint`, `npm run build`
- [ ] Verificación en producción de cada fase desplegada
- [ ] RPC nuevas probadas con la anon key: `permission denied`

---

## 🧠 Aprendizajes (Self-Annealing)

_(se llena durante la ejecución)_

## Gotchas

- [ ] El webhook de Stripe en producción solo recibe `customer.subscription.*`: para referidos hay que suscribirlo a `invoice.paid`.
- [ ] `messages` no guarda el canal: sale de `conversations.channel_id → channels.type`.
- [ ] Vercel no deja editar variables secretas con prefijo público; evitar variables nuevas siempre que se pueda.
- [ ] El login tiene captcha: la verificación con navegador usa una sesión creada por la API de administración para la cuenta de prueba, solo en local.
- [ ] La corrida diaria mezcla envíos que no deben salir de madrugada: la corrida de 15 minutos nunca los toca.
- [ ] Google prohíbe pedir reseñas solo a clientes satisfechos.
