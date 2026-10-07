# API de socios de ChatVenti (v1)

Para sistemas que revenden ChatVenti dentro de su propio producto. El primero es **PASEN**.

Un socio da de alta negocios en ChatVenti con una clave, sin que el dueño pase por el registro.
Hay dos tipos de socio:

- **Externo** (otra empresa): ChatVenti le factura **al socio** el plan y el uso de IA de esos
  negocios, una vez al mes. El socio cobra a sus clientes como quiera.
- **Interno** (otra plataforma de Grupo ELRI, como **PASEN**): es la misma empresa, así que
  ChatVenti **no le factura nada**. La plataforma vende ChatVenti dentro de su paquete, le cobra
  a su cliente (incluido el uso de IA adicional) y emite la factura con su propio concepto.
  ChatVenti solo da el acceso y mide el consumo. En las respuestas, `billing` llega en `null`.

- **Base:** `https://www.chatventi.com/api/partners/v1`
- **Autenticación:** cabecera `Authorization: Bearer cvp_…` en todas las llamadas.
- **Formato:** JSON. Los errores llegan como `{ "error": "<código>", "message": "…" }`.
- **Límite:** 600 llamadas por hora por socio (`429 rate_limited` al pasarlo).

## La clave

La genera el superadministrador de ChatVenti en **/admin/socios** («Crear y generar clave»).
Se muestra **una sola vez**: en la base solo queda su huella. Guárdala como variable de entorno
del servidor del socio (por ejemplo `CHATVENTI_PARTNER_KEY`); **nunca** en el navegador ni en el
repositorio. Si se pierde o se filtra, se suspende el socio y se crea otro.

## Alta de un negocio

`POST /organizations`

```json
{
  "externalId": "tenant-8f2a",
  "name": "Estética Lumen",
  "ownerEmail": "duena@esteticalumen.mx",
  "ownerName": "Mariana López",
  "plan": "negocio",
  "businessType": "spa_unas",
  "country": "MX",
  "city": "Puebla",
  "phone": "2221234567",
  "siteUrl": "https://esteticalumen.pasen.mx"
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `externalId` | sí | Id del negocio en el sistema del socio. **Repetir el alta con el mismo id devuelve el mismo negocio** (`created: false`), así que es seguro reintentar. |
| `name` | sí | 2–80 caracteres. |
| `ownerEmail` | sí | Debe ser un correo **sin cuenta previa** en ChatVenti (`409 owner_email_in_use` si ya existe). Se compara sin «+etiqueta» y, en Gmail, sin puntos: `ana+pasen@x.com` cuenta como `ana@x.com`. |
| `plan` | no | `arranque` (por defecto), `negocio`, `profesional` o `multisede`. |
| `businessType` | no | Plantilla del agente: `barberia_estetica`, `dental`, `veterinaria`, `spa_unas`, `medico`, `generico`. |
| `country` | no | Código de dos letras (`MX`, `US`, `ES`…). |
| `ownerName`, `city`, `phone` | no | |
| `siteUrl` | no | La página web del negocio en el sistema del socio (`https://…`, máx. 300). Con ella, ChatVenti le dice al dueño que sus reservas viven en esa página y deja de ofrecerle el enlace `chatventi.com/r/…` como principal. |

Respuesta `201`:

```json
{
  "id": "b48b51e9-be83-4558-8d9a-12e2eb103ce3",
  "externalId": "tenant-8f2a",
  "name": "Estética Lumen",
  "plan": "negocio",
  "status": "active",
  "siteUrl": "https://esteticalumen.pasen.mx",
  "bookingUrl": "https://www.chatventi.com/r/estetica-lumen-3fa1",
  "widgetSnippet": "<script src=\"https://www.chatventi.com/widget.js\" data-slug=\"estetica-lumen-3fa1\" async></script>",
  "dashboardUrl": "https://www.chatventi.com/dashboard",
  "created": true,
  "setPasswordUrl": "https://www.chatventi.com/auth/confirm?token_hash=…&type=recovery"
}
```

- `widgetSnippet` es lo que el socio pega en el sitio del negocio: pone un botón «Reservar cita» que abre la agenda encima de la página, sin que el visitante salga del sitio. Es la forma recomendada: la visita se queda en la página del negocio y la agenda es la misma que usa la recepcionista en WhatsApp (no hay citas dobles). El socio **no** necesita un módulo de citas propio.
- `bookingUrl` es la misma agenda como página suelta (`chatventi.com/r/…`). Sirve para Instagram o Google cuando el negocio no tiene página; con `siteUrl`, el dueño ya no la ve como principal.
- `setPasswordUrl` es un enlace **de un solo uso** para que el dueño elija su contraseña y entre a su panel. Solo llega en el alta (`created: true`). Trátalo como una credencial: mándaselo al dueño y no lo guardes.

El negocio nace con el plan activo: no tiene periodo de prueba ni se le pide tarjeta. Nace **listo para agendar**: con los servicios típicos de su giro (`businessType`), horario de lunes a sábado de 9:00 a 19:00, un primer profesional (el dueño) y la recepcionista encendida. El dueño lo ajusta después en su panel; nada de eso se vuelve a sembrar si ya lo cambió.

## Listado

`GET /organizations` → `{ "organizations": [ { id, externalId, name, plan, status, siteUrl, bookingUrl, widgetSnippet, dashboardUrl } ] }`

## Estado, consumo y actividad de un negocio

`GET /organizations/{id}?period=2026-10` (sin `period`, el mes en curso; meses en UTC)

```json
{
  "id": "…", "externalId": "tenant-8f2a", "name": "Estética Lumen",
  "plan": "negocio", "status": "active",
  "period": "2026-10",
  "usage": {
    "aiReplies": 412,
    "includedReplies": 9285,
    "extraReplies": 0,
    "extraReplyPriceUsd": 0.00182,
    "overageUsd": 0,
    "closed": false
  },
  "activity": { "appointmentsCreated": 37, "conversationsActive": 96 },
  "billing": { "planPriceUsd": 39, "currency": "usd" }
}
```

- `usage` es lo que ChatVenti mide y factura: respuestas de la recepcionista con IA.
- `activity` es informativo: sirve para que el socio aplique **sus propios** topes comerciales (por ejemplo «150 citas y 300 conversaciones al mes»). ChatVenti no corta nada por esas cifras.
- `billing.planPriceUsd` ya lleva el descuento de mayoreo del socio. **Socio interno:** `billing`
  es `null` (no le paga nada a ChatVenti).
- `usage.extraReplies` es lo que el socio interno le cobra a su cliente, al precio que él fije
  (referencia: $0.037 MXN por respuesta, $37 por cada 1,000, más IVA). Léelo cuando
  `usage.closed` sea `true`: el mes ya cerró y la cifra no cambia. Un mes ya terminado sin ninguna respuesta (por ejemplo, anterior al alta) responde `closed: true` con ceros. `extraReplyPriceUsd` y
  `overageUsd` son el precio de ChatVenti a un socio externo, en dólares; un interno los ignora.

## Suspender, reactivar o cambiar de plan

`PATCH /organizations/{id}` con `{ "status": "suspended" }`, `{ "status": "active" }`, `{ "plan": "profesional" }` o `{ "siteUrl": "https://…" }` (`null` la quita). Se pueden combinar.

Un negocio suspendido pierde el acceso al panel y su recepcionista deja de responder; **sus datos se conservan**. Al dueño se le dice que escriba a su proveedor, no se le ofrece contratar directo con ChatVenti.

## Cómo factura ChatVenti al socio externo

Al socio **interno** no se le factura: su mes se cierra igual (`usage.closed` pasa a `true`)
para que lea el excedente y se lo cobre a su cliente.

Al **externo**, el día 1 de cada mes (o el siguiente en que corra el cierre) se cierra el mes anterior:

- Por cada negocio **activo al cierre** que ya existía antes de empezar el mes en curso: el precio del plan con el descuento del socio.
- Más el uso de IA por encima de lo incluido en su plan (`extraReplies × extraReplyPriceUsd`).
- El **mes de alta no se cobra**.
- Todo va en **una sola factura mensual** al correo de facturación del socio, pagadera por enlace a 15 días, en USD.

### Lo que no entra en esa factura: los mensajes de WhatsApp

Los mensajes de WhatsApp se los cobra **Meta directamente a la cuenta de WhatsApp Business de cada negocio**. Ni ChatVenti ni el socio pueden cobrarlos ni revenderlos: lo prohíben los términos de Meta para proveedores tecnológicos (cláusula «No Resale»). Lo que el socio vende es el servicio (sitio, agenda, recepcionista), no los mensajes.

## Catálogo del negocio desde el socio

`PUT /organizations/{id}/catalog` — el dueño captura servicios y horario **una sola vez**, en el panel del socio; el socio los manda aquí al dar de alta y cada vez que el dueño guarda. Lo recibido **reemplaza** lo anterior.

```json
{
  "services": [
    { "externalId": "svc-8f2a", "name": "Corte de cabello", "description": null,
      "durationMinutes": 30, "price": 250, "priceText": "Desde $250", "active": true, "position": 0 }
  ],
  "hours": [
    { "weekday": 1, "opens": "09:00", "closes": "19:00", "closed": false }
  ]
}
```

- Las dos llaves son opcionales: sin `services` no se tocan los servicios; sin `hours`, no se toca el horario.
- `services` es la lista completa (máximo 100; nombre de 1 a 120, descripción hasta 600, `durationMinutes` de 5 a 600). Se crea o actualiza por `externalId`; lo que ya no venga queda **inactivo** (no se borra: tiene citas). `price` en MXN o `null`; `priceText` es el precio tal como lo escribió el dueño y manda al mostrarlo.
- `hours` trae los 7 días (`weekday` 0–6, domingo = 0), un tramo por día, `HH:MM` con `opens < closes`; `closed: true` lleva `opens` y `closes` en `null`. Se escribe en la sucursal principal. Si el negocio solo tiene el profesional que sembró el alta y nadie le editó su horario, ese horario se alinea al nuevo.
- Idempotente: mandar lo mismo dos veces no cambia nada.
- Desde la primera llamada, los servicios y el horario quedan **de solo lectura** en el panel de ChatVenti («se editan en tu panel de ¡Pasen!»). Profesionales, anticipos y recepcionista siguen editables.
- Respuesta `200`: `{ "services": [ { "externalId", "id" } ], "hoursUpdated": true|false }`.

## Pase de entrada (el dueño entra desde el socio, sin contraseña)

`POST /organizations/{id}/login-link` (cuerpo vacío) → `200 { "url", "expiresAt" }`.

- Solo lo pide el socio cuando **el dueño**, ya identificado en el sistema del socio, toca «Mi agenda»; el socio redirige el navegador a `url`. El personal del socio nunca recibe pases.
- La `url` lleva un ticket de **un solo uso, válido 60 segundos**, ligado al dueño de esa organización. Se guarda solo su huella. El canje crea la sesión del lado del servidor; ningún token de Supabase viaja en la URL. Si el navegador traía la sesión de otra persona, se cierra antes.
- La `url` apunta al dominio del panel del socio (`app_domain`, p. ej. `https://agenda.pasen.mx/…`) o, si no tiene, a `https://www.chatventi.com/…`. Se puede pedir `?next=` con `/dashboard`, `/dashboard/agenda` o `/dashboard/conexiones`.
- La respuesta va con `Cache-Control: no-store` y `Referrer-Policy: no-referrer`. No guardes ni registres la `url`.
- Errores: `404 not_found`, `409 suspended` (negocio suspendido), `429 rate_limited` (más de 10 pases por minuto por negocio).
- Los dueños de negocios de socio no necesitan contraseña; `setPasswordUrl` del alta sigue existiendo para socios externos.

## Códigos de error

| HTTP | `error` | Significado |
|---|---|---|
| 400 | `invalid_body` | Falta un campo o no tiene el formato esperado (`message` dice cuál). |
| 401 | `unauthorized` | Clave ausente o incorrecta. |
| 403 | `partner_suspended` | El socio está suspendido. |
| 404 | `not_found` | El negocio no existe **o no es de este socio**. |
| 409 | `owner_email_in_use` | El correo del dueño ya tiene cuenta en ChatVenti. |
| 409 | `suspended` | El negocio está suspendido (pase de entrada). |
| 429 | `rate_limited` | Demasiadas llamadas en la última hora. |
| 500 | `create_failed`, `update_failed` | Error interno; reintentar es seguro. |

## Lo que todavía no cubre esta API

Pendiente para una v2, en este orden: avisos salientes (webhooks) cuando se crea o cambia una cita, y carga por API de servicios, horarios y profesionales. Hoy eso lo captura el dueño en su panel, o se trae desde su ficha de Google en *Recepcionista IA → Reseñas en Google*.
