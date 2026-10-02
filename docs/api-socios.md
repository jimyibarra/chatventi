# API de socios de ChatVenti (v1)

Para sistemas que revenden ChatVenti dentro de su propio producto. El primero es **PASEN**.

Un socio da de alta negocios en ChatVenti con una clave, sin que el dueño pase por el registro.
ChatVenti le factura **al socio** el plan y el uso de IA de esos negocios, una vez al mes.
El socio cobra a sus clientes como quiera.

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
  "phone": "2221234567"
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `externalId` | sí | Id del negocio en el sistema del socio. **Repetir el alta con el mismo id devuelve el mismo negocio** (`created: false`), así que es seguro reintentar. |
| `name` | sí | 2–80 caracteres. |
| `ownerEmail` | sí | Debe ser un correo **sin cuenta previa** en ChatVenti (`409 owner_email_in_use` si ya existe). |
| `plan` | no | `arranque` (por defecto), `negocio`, `profesional` o `multisede`. |
| `businessType` | no | Plantilla del agente: `barberia_estetica`, `dental`, `veterinaria`, `spa_unas`, `medico`, `generico`. |
| `country` | no | Código de dos letras (`MX`, `US`, `ES`…). |
| `ownerName`, `city`, `phone` | no | |

Respuesta `201`:

```json
{
  "id": "b48b51e9-be83-4558-8d9a-12e2eb103ce3",
  "externalId": "tenant-8f2a",
  "name": "Estética Lumen",
  "plan": "negocio",
  "status": "active",
  "bookingUrl": "https://www.chatventi.com/r/estetica-lumen-3fa1",
  "dashboardUrl": "https://www.chatventi.com/dashboard",
  "created": true,
  "setPasswordUrl": "https://www.chatventi.com/auth/confirm?token_hash=…&type=recovery"
}
```

- `bookingUrl` es la página de reservas del negocio: sirve para incrustarla o enlazarla desde el sitio que arma el socio.
- `setPasswordUrl` es un enlace **de un solo uso** para que el dueño elija su contraseña y entre a su panel. Solo llega en el alta (`created: true`). Trátalo como una credencial: mándaselo al dueño y no lo guardes.

El negocio nace con el plan activo: no tiene periodo de prueba ni se le pide tarjeta.

## Listado

`GET /organizations` → `{ "organizations": [ { id, externalId, name, plan, status, bookingUrl, dashboardUrl } ] }`

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
- `billing.planPriceUsd` ya lleva el descuento de mayoreo del socio.

## Suspender, reactivar o cambiar de plan

`PATCH /organizations/{id}` con `{ "status": "suspended" }`, `{ "status": "active" }` o `{ "plan": "profesional" }` (se pueden combinar).

Un negocio suspendido pierde el acceso al panel y su recepcionista deja de responder; **sus datos se conservan**. Al dueño se le dice que escriba a su proveedor, no se le ofrece contratar directo con ChatVenti.

## Cómo factura ChatVenti al socio

El día 1 de cada mes (o el siguiente en que corra el cierre) se cierra el mes anterior:

- Por cada negocio **activo al cierre** que ya existía antes de empezar el mes en curso: el precio del plan con el descuento del socio.
- Más el uso de IA por encima de lo incluido en su plan (`extraReplies × extraReplyPriceUsd`).
- El **mes de alta no se cobra**.
- Todo va en **una sola factura mensual** al correo de facturación del socio, pagadera por enlace a 15 días, en USD.

### Lo que no entra en esa factura: los mensajes de WhatsApp

Los mensajes de WhatsApp se los cobra **Meta directamente a la cuenta de WhatsApp Business de cada negocio**. Ni ChatVenti ni el socio pueden cobrarlos ni revenderlos: lo prohíben los términos de Meta para proveedores tecnológicos (cláusula «No Resale»). Lo que el socio vende es el servicio (sitio, agenda, recepcionista), no los mensajes.

## Códigos de error

| HTTP | `error` | Significado |
|---|---|---|
| 400 | `invalid_body` | Falta un campo o no tiene el formato esperado (`message` dice cuál). |
| 401 | `unauthorized` | Clave ausente o incorrecta. |
| 403 | `partner_suspended` | El socio está suspendido. |
| 404 | `not_found` | El negocio no existe **o no es de este socio**. |
| 409 | `owner_email_in_use` | El correo del dueño ya tiene cuenta en ChatVenti. |
| 429 | `rate_limited` | Demasiadas llamadas en la última hora. |
| 500 | `create_failed`, `update_failed` | Error interno; reintentar es seguro. |

## Lo que todavía no cubre esta API

Pendiente para una v2, en este orden: avisos salientes (webhooks) cuando se crea o cambia una cita, y carga por API de servicios, horarios y profesionales. Hoy eso lo captura el dueño en su panel, o se trae desde su ficha de Google en *Recepcionista IA → Reseñas en Google*.
