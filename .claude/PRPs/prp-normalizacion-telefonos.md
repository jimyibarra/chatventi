# PRP — Normalización y fusión de teléfonos duplicados

> Origen: análisis del CRM (feedback `Clientes.png`). Un mismo cliente queda
> duplicado por formato: "Juan" está como `5521410491` (nacional) y como
> `5215521410491` (WhatsApp MX = `52` + `1` + número).
> **Estado: PLAN. NO implementado. Requiere aprobación de Juan antes de ejecutar**
> (toca el motor de WhatsApp EN VIVO + fusiona datos = alto riesgo).

## Decisiones de Juan (2026-07-23)

1. **Regla de normalización: solo México.** Canónico = `52` + 10 dígitos, quitando el
   `1` de los WhatsApp MX (`521…`). Números no-MX: solo dígitos limpios.
2. **Almacenamiento: columna `clients.phone_canonical`.** Se conserva `phone` tal como
   se ingresó (para mostrarlo); el match/dedup se hace por el canónico.
3. **Duplicados existentes: fusión automática + reporte.** Por grupo con el mismo
   canónico: conservar uno (con nombre; si empatan, el más antiguo), repuntar
   citas/conversaciones/etiquetas/notas y borrar el resto. Reporte de lo fusionado.

## Objetivo

- Que un mismo cliente sea **una sola ficha** aunque llegue por WhatsApp (`521…`), web o
  captura manual (nacional / con lada).
- Sin romper el flujo en vivo: el agente y las reservas deben seguir encontrando al
  cliente por su teléfono.

## Alcance real (por qué es delicado)

**9 funciones vivas** resuelven/crean al cliente por teléfono y TODAS deben usar la misma
normalización, o el agente/reservas dejarían de encontrar al cliente:

`route_inbound_message` (write), `get_agent_context`, `create_appointment_from_chat`,
`create_appointment_from_chat_v2`, `create_public_appointment`,
`create_public_appointment_v2`, `confirm_appointment_from_chat`,
`_resolve_chat_appointment`, `set_client_name_from_chat`.

🔴 **Gotcha crítico — Telegram y sandbox NO son teléfonos.** El `from_handle` de Telegram
es un **chat id numérico** (p. ej. `8947338327`), y el del sandbox es `sandbox:<uuid>`.
Normalizarlos con reglas de teléfono MX los corromper­ía. Por eso la canonicalización es
**consciente del canal**: solo se normaliza en `whatsapp` y `web/public`; en `telegram` y
`sandbox`, canónico = handle tal cual.

## Función de normalización (MX)

`normalize_phone_mx(raw text) returns text`:
1. `d := regexp_replace(raw, '\D', '', 'g')` (solo dígitos).
2. Si `d` vacío → devolver `raw` (no tocar).
3. Quitar prefijo internacional `00`.
4. **MX:** si `d` = `521` + 10 díg → `52` + esos 10 díg. Si `d` = `52` + 10 díg → igual.
   Si `d` = 10 díg (nacional) → `52` + `d`. Si empieza con otra lada (no `52`) → `d` tal
   cual (no-MX: solo dígitos limpios).
5. Devolver el canónico.

`client_canonical(p_channel_type text, raw text) returns text`:
- `telegram` o handle que empieza con `sandbox:` → `raw` sin tocar.
- `whatsapp` / `web` / otros de teléfono → `normalize_phone_mx(raw)`.

## Modelo de datos

- `alter table clients add column phone_canonical text;`
- Índice para dedup/lookup: `create index clients_org_canonical_idx on clients(organization_id, phone_canonical);`
- Al final (Fase 4, tras fusionar): `unique (organization_id, phone_canonical)` **parcial**
  (`where phone_canonical is not null`) para blindar contra nuevos duplicados.

## Rollout expand/contract (la BD del MCP ES producción, sin staging)

**Fase 1 — Aditivo (seguro, no cambia comportamiento):**
- Crear `normalize_phone_mx` + `client_canonical`.
- Añadir `phone_canonical` + índice.
- Backfill: por cada cliente, inferir el canal desde sus conversaciones
  (clients→conversations→channels.type); si su único canal es `telegram` → canónico =
  `phone` tal cual; si `phone` empieza con `sandbox:` → tal cual; en cualquier otro caso
  (whatsapp/web/sin conversación) → `normalize_phone_mx(phone)`.

**Fase 2 — Camino de escritura:**
- `route_inbound_message` y `create_public_appointment(_v2)`: setear `phone_canonical` con
  `client_canonical(canal, handle)` al insertar/upsert. (Sin cambiar aún el conflicto ni
  los lectores → todavía compatible.)

**Fase 3 — Lectores por canónico:**
- Cambiar los 7 lectores (`get_agent_context`, `*_from_chat`, `_resolve_chat_appointment`,
  `set_client_name_from_chat`) para resolver por
  `phone_canonical = client_canonical(p_channel_type, p_client_phone)` en vez de
  `phone = btrim(...)`. Validar paridad vieja vs nueva sobre datos reales ANTES de fase 4.

**Fase 4 — Fusión + blindaje (ventana separada, tras días sanos):**
- Ejecutar `merge_duplicate_clients()` (una vez).
- `route_inbound_message`: cambiar el upsert a conflicto por `(org, phone_canonical)`.
- Crear el índice UNIQUE parcial `(org, phone_canonical)`.

## Fusión de duplicados — `merge_duplicate_clients()`

Por cada grupo `(organization_id, phone_canonical)` con >1 fila:
1. **Superviviente:** el que tenga `name` no nulo; si empatan, `min(created_at)`.
2. **Repuntar al superviviente:**
   - `appointments.client_id` → superviviente.
   - `client_tags`: mover; si el superviviente ya tiene el tag, descartar el duplicado
     (PK `(client_id, tag_id)`).
   - `conversations.client_id` → superviviente. 🔴 **Conflicto posible** por
     `unique(channel_id, client_id)`: si el superviviente YA tiene conversación en ese
     `channel_id`, NO repuntar: mover los `messages` de la conversación del duplicado a la
     del superviviente y borrar la del duplicado. (Raro: los duplicados suelen ser de
     canales distintos —WA vs web— y los clientes web casi nunca tienen conversación.)
   - `name`: si el superviviente no tiene, tomar el del duplicado.
   - `notes`: concatenar si ambos tienen.
3. Borrar los duplicados.
4. **Reporte:** insertar en una tabla temporal / `RAISE NOTICE` cuántos grupos y filas se
   fusionaron, con los ids (para auditar).

Se ejecuta con SECURITY DEFINER puntual o vía `apply_migration`; NO se expone como RPC.

## Pruebas (antes de fase 4, sobre datos reales)

- **Unit SQL** de `normalize_phone_mx`: `521 5521410491`→`525521410491`;
  `5521410491`→`525521410491`; `52 55 2141 0491`→`525521410491`; un no-MX (p.ej. `1 415…`)
  → dígitos tal cual; Telegram `8947338327` vía `client_canonical('telegram',…)` → sin
  cambio; `sandbox:…` → sin cambio.
- **Paridad de lectores** (fase 3): para cada cliente real, el lector viejo (por `phone`) y
  el nuevo (por `phone_canonical`) resuelven el MISMO cliente. 0 diferencias.
- **E2E en vivo** (navegador/sandbox): tras fase 3, el agente sigue agendando/cancelando
  para un cliente existente; una reserva web y un mensaje WA del MISMO número caen en UNA
  ficha.
- **Fusión en seco:** correr el SELECT de grupos duplicados y revisar el reporte ANTES de
  borrar; validar el caso real "Juan" (2 filas → 1, conservando el nombre "Juan" y sus
  citas).

## Riesgos y mitigaciones

- **Romper el match en vivo** → expand/contract: los lectores cambian solo tras backfill; se
  valida paridad antes de fusionar.
- **Fusionar personas distintas** → la regla MX es conservadora (no inventa lada salvo el
  caso nacional de 10 díg., que es MX por el mercado actual); no-MX no se fusiona. El
  reporte permite auditar antes del `unique`.
- **Telegram corrompido** → canonicalización consciente del canal (no se normaliza).
- **Conflicto de conversaciones al fusionar** → manejo explícito (mover mensajes).
- **Rollback:** las fases 1–3 son reversibles (la columna y los `_canonical` conviven con
  el `phone`); solo la fase 4 (fusión + unique) quema el rollback → se hace en ventana
  aparte tras días sanos, como la Fase 7 (CONTRACT) de la Ola 4.

## Fuera de alcance

- libphonenumber / normalización perfecta multi-país (si el negocio se internacionaliza,
  se retoma con `organizations.country` y reglas por país).
- Deduplicar por nombre/email (aquí solo por teléfono canónico).
