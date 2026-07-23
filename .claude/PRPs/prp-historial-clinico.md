# PRP · Historial del cliente + recordatorios recurrentes

> PRP 4 (el último) de las imágenes de Juan. Los otros 3 ya están en prod:
> sandbox del chat, subida de imágenes, agente por rubro, CRM con nombre.

## Objetivo

Que la ficha de cada cliente deje de ser solo "teléfono + citas" y se convierta en
su **expediente**: qué se le hizo y cuándo, qué archivos tiene (radiografías,
consentimientos, recetas, fotos de antes/después) y cuándo toca volver.

Tres piezas, en una sola ficha:

1. **Archivos del cliente** — PDF / PNG / JPG subidos desde el dispositivo.
2. **Historial de atención** — servicios prestados y compras, con fecha y hora,
   escritos a mano por el negocio (complementa el historial de citas, que ya existe
   y es automático).
3. **Recordatorios recurrentes** — "vuelve a cortarte en 3 semanas", "limpieza
   dental cada 6 meses". Se envían solos por el canal del cliente.

## Decisiones de diseño (y por qué)

### 🔴 Bucket PRIVADO nuevo, no el `media` existente

`media` es **público de lectura** (`public: true`, policy `media_read_public`):
cualquiera con la URL ve el objeto, sin sesión. Sirve para un logo o la foto de un
peluquero. Un historial clínico es **dato de salud**: no puede vivir ahí. Basta con
que alguien filtre o adivine una URL.

Por eso: bucket **`records`**, privado. Se lee solo por **URL firmada** generada en
el servidor, con caducidad corta (5 min). La subida sí va directa desde el browser
(como en `media`), aislada por org vía RLS de `storage.objects`.

Consecuencia deliberada: los archivos **no** se pueden incrustar en correos ni
mostrar en páginas públicas. Es el precio correcto.

### El historial de citas ya existe — esto es otra cosa

`/dashboard/clientes/[id]` ya lista las citas (automático, desde `appointments`).
Lo que falta es lo que el negocio anota: "se le aplicó tinte X", "compró cera",
"molar 26 con caries". Tabla aparte (`client_records`), no se mezcla con la agenda.

### Recordatorios: intervalo en días, no cron por cliente

Un recordatorio recurrente = mensaje + cada N días + próxima fecha. Al enviarse,
`next_due_at` avanza N días. Eso lo hace **idempotente sin columnas de "ya enviado"**:
si el cron corre dos veces, la segunda ya no lo ve vencido. Mismo patrón de reclamo
atómico que `claim_reminder`.

Limitación heredada (misma que los recordatorios de cita): solo llega a clientes
**con conversación** en algún canal. Un cliente que nunca escribió no tiene por dónde
recibirlo; se reporta como `no_channel`, no se pierde en silencio.

## Modelo de datos

```sql
client_files      (id, organization_id, client_id, path, file_name, mime_type,
                   size_bytes, note, created_at, created_by)
client_records    (id, organization_id, client_id, kind[service|purchase|note],
                   title, detail, amount, occurred_at, created_at, created_by)
client_reminders  (id, organization_id, client_id, message, interval_days,
                   next_due_at, active, last_sent_at, created_at)
```

RLS: patrón de la org (`get_my_org()`), igual que `products` / `service_catalogs`.
Todas con `on delete cascade` desde `clients`.

RPCs nuevas (solo `service_role`, para el cron):
- `get_due_client_reminders()` → vencidos + canal del cliente
- `claim_client_reminder(p_id)` → avanza `next_due_at`, sella `last_sent_at`

### 🔴 wipe_organization_business_data

Las 3 tablas nuevas se agregan al wipe. Si no, al borrar los datos de una org que
no pagó quedarían **archivos clínicos y expedientes huérfanos** — exactamente los
datos que más importa no dejar tirados.

## Fases

1. **BD**: bucket `records` + 3 tablas + RLS + 2 RPCs + wipe actualizado.
2. **Subida de archivos**: componente `FileUpload` (hermano de `ImageUpload`, pero
   privado y con PDF) + Server Actions + firma de URLs.
3. **Ficha del cliente**: 3 secciones nuevas.
4. **Cron**: envío de los recordatorios recurrentes.
5. **E2E en producción** + limpieza de datos de prueba.

## Validación

- [ ] Un archivo subido NO es accesible por URL directa sin firmar (403)
- [ ] La URL firmada sí abre, y caduca
- [ ] Una org no ve los archivos ni el expediente de otra (RLS suplantando usuarios)
- [ ] Alta/baja de registro de atención y de recordatorio desde la ficha
- [ ] El cron envía un recordatorio vencido y avanza `next_due_at` (no repite)
- [ ] `wipe_organization_business_data` limpia las 3 tablas
- [ ] typecheck + lint + build verdes; advisors sin ERROR nuevo

## 🧠 Aprendizajes

### 2026-07-23: buscar por NOMBRE de función, no por el parámetro que se retira
Viene de la Fase 7 (Ola 4), en la misma sesión: antes de dropear las RPCs v1 se
verificó `prosrc ilike '%staff_id%'` y dio 0 dependientes. Pero
`reschedule_appointment_by_token` y `reschedule_appointment_from_chat` llamaban a la
v1 pasando el tercer argumento como `null` **posicional**, sin nombrarlo → el chequeo
no las vio y quedaron rotas en producción (enlace mágico + reagenda del agente IA).
Lo cazó el E2E con navegador, no el typecheck ni el SQL.
**Regla**: antes de dropear cualquier función, buscar quién la invoca **por su nombre**
en `pg_proc.prosrc`, no por el parámetro que estás quitando.
