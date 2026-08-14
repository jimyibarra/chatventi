# Guion del video para el App Review de ChatVenti

> Borrador de Meta `2271937250276475` con 4 permisos: `whatsapp_business_management`,
> `whatsapp_business_messaging`, `pages_messaging`, `instagram_manage_messages`.
> Un solo screencast (~5 min) cubre los 4; se sube el mismo archivo en cada permiso.
> El revisor necesita ver, sin cortes dentro de un flujo y con la barra de URL visible,
> que cada permiso se usa de verdad: quién lo usa, desde dónde y qué pasa de punta a punta.

## 🔴 Tres cosas que hay que hacer ANTES de grabar (verificado 2026-08-13)

1. **Apagar Dark Reader.** La extensión está repintando la app: el fondo sale negro y el
   botón verde de WhatsApp (`#25D366`) se pinta gris. ChatVenti **no tiene modo oscuro**;
   el diseño real es claro (Bento Grid). Desactivarla al menos en `chatventi.com`,
   `facebook.com` e `instagram.com`, y recargar. Si no, el revisor ve una app con los
   colores rotos que no es la que existe.
2. **No usar `m.me` ni `messenger.com`**: redirigen a `messenger.com/login.php` porque ahí
   **no hay sesión iniciada** (la sesión está en `facebook.com`). Escribir a la página
   desde el propio Facebook (botón **Mensaje** de la página), no por el enlace corto.
3. **`@chatventi` NO existe en Facebook.** Ese handle es solo de **Instagram**. En Facebook
   el negocio es la **página "ChatVenti Demo"**, que no tiene @usuario, ni foto, ni
   publicaciones, ni seguidores → el buscador de Facebook no la muestra. Hay que entrar
   por URL directa.

### Enlaces directos (comprobados hoy)

| Para | URL |
|---|---|
| Dashboard del negocio | `https://www.chatventi.com/dashboard` |
| Conexiones (Escena 2) | `https://www.chatventi.com/dashboard/conexiones` |
| Bandeja (Escenas 3-6) | `https://www.chatventi.com/dashboard/conversaciones` |
| Página de Facebook | `https://www.facebook.com/1335718816281135` |
| Perfil de Instagram | `https://www.instagram.com/chatventi/` |

## Preparación (antes de grabar, ~20 min)

Sesiones ya iniciadas (para no teclear contraseñas en cámara):

1. **Chrome ventana 1** — `www.chatventi.com` como dueño del negocio
   (`zztest-composer@chatventi.com`, dueño de la org de prueba con los 3 canales). Dejar `/dashboard` abierto. ✅ sesión activa
2. **Chrome ventana 2** — sesión de Facebook (Juan Ibarra, para Messenger) ✅ e Instagram ✅.
   WhatsApp Web para la escena 3 (más fácil que grabar el teléfono).

Grabación: Barra de juegos de Windows (`Win+G`) u OBS · pantalla completa · 1920×1080 ·
notificaciones de Windows en No molestar · sin pestañas de `.env`/Supabase/Vercel/Meta developers.
Idioma: app en español OK; rótulos en inglés (o solo el README con timestamps del final).
**Ensayo en seco primero**, sobre todo el Embedded Signup (única escena no re-verificada).

### Estado técnico verificado hoy (2026-08-13)

| Elemento | Estado |
|---|---|
| Token WhatsApp | Válido, System User, **no caduca**, scopes correctos |
| Token Messenger / Instagram | Válido (page token de "ChatVenti Demo") |
| Página FB ↔ IG @chatventi | Vinculados correctamente |
| Webhook suscrito (página) | `messages`, `messaging_postbacks` ✅ |
| Webhook suscrito (WABA) | App ChatVenti ✅ |
| Webhooks en producción | `/api/webhooks/meta` y `/api/webhooks/whatsapp` → 200 ✅ |
| Número de WhatsApp | +1 555-151-7434 · calidad **GREEN** |
| Suscripción de la org | **Activa** hasta 2026-08-20 (no se corta a media grabación) |

### ⚠️ La ventana de 24 horas

Meta solo deja responder a un cliente dentro de las **24 h** desde su último mensaje.
Por eso el composer daba *"No se pudo enviar el mensaje"* en el hilo de Messenger: el
último mensaje era del 7-ago. **No es un fallo.** En el video no molesta porque siempre
se responde justo después del mensaje del cliente. Regla práctica: si vas a mostrar la
respuesta manual desde el dashboard, hazlo **en el mismo minuto** en que el cliente escribió.

## Escenas

### 1 · Contexto (0:00–0:30)
Home `www.chatventi.com` → scroll a los planes → Iniciar sesión (ya logueado) → `/dashboard`, pasear cursor 3 s.
Rótulo: *"ChatVenti — SaaS appointment-booking platform with an AI receptionist. A business owner logs into their dashboard."*

### 2 · whatsapp_business_management — Embedded Signup (0:30–1:45)
`/dashboard/conexiones` → "Conectar WhatsApp" → popup de FB Login for Business →
recorrer DESPACIO: portafolio → WABA → número → confirmar → canal en estado conectado.
Rótulo: *"whatsapp_business_management: the business connects its own WhatsApp number via Embedded Signup. ChatVenti (Tech Provider) registers the WABA and subscribes the app."*
⚠️ Si el popup pide contraseña: cortar, iniciar sesión con calma, regrabar la escena.

🔴 **Grabar la Escena 3 ANTES que la 2.** El endpoint hace `upsert` sobre `(type, external_id)`
y **sobrescribe las credenciales del canal**. Si en el Embedded Signup eliges el mismo número
de prueba (+1 555 151-7434), reemplaza el token de System User —permanente— por el token que
Meta acabe de emitir. Si ese paso falla a medias, el canal de WhatsApp que hoy funciona queda
tocado y la Escena 3 ya no se puede grabar. Grabando la 3 primero, el peor caso es tener que
restaurar, no perder la toma. (Hay copia de seguridad de los 3 canales del 2026-08-13.)

### 3 · whatsapp_business_messaging (1:45–2:45)
WhatsApp Web → enviar al número del negocio: **"Hola, ¿me pueden atender mañana?"** →
esperar respuesta del agente en cámara (~5-10 s) → contestar lo que pregunte para ver una 2ª respuesta con horarios →
ventana 1: Conversaciones del dashboard, abrir el hilo; opcional: respuesta manual desde el composer y verla llegar.
Rótulo: *"whatsapp_business_messaging: a customer messages the business on WhatsApp; the AI receptionist replies within the 24-hour window and offers appointment slots."*

### 4 · pages_messaging — Messenger (2:45–3:45)
Ir por URL directa a `https://www.facebook.com/1335718816281135` (**no** buscar "@chatventi":
en Facebook no existe ese handle) → botón **Mensaje** de la página → **"Hola, ¿qué servicios ofrecen?"** →
esperar respuesta en cámara → ventana 1: mostrar el hilo en el dashboard.
Rótulo: *"pages_messaging: a customer messages the business's Facebook Page; the AI receptionist answers automatically."*

### 5 · instagram_manage_messages (3:45–4:45)
instagram.com/chatventi (sesión @jimjimy321) → Enviar mensaje → **"Hola, quiero reservar un corte para el viernes"** →
esperar respuesta (~5 s, verificado 2026-08-12) → ventana 1: hilo de Instagram en la bandeja.
Rótulo: *"instagram_manage_messages: a customer sends an Instagram DM; the AI receptionist replies and the conversation syncs to the dashboard."*

> El agente pedirá tu nombre una vez antes de ofrecer horarios ("¿me podrías compartir tu
> nombre?"). Contéstalo con un nombre cualquiera: se ve bien en cámara porque demuestra que
> el CRM captura al cliente. Después ofrece 3 horarios reales de la agenda.

### Qué preguntar (y qué no)

Probado hoy en el chat de prueba; estas respuestas salen bien:

- "¿Qué servicios ofrecen?" → lista los 3 con precio y duración
- "¿Cuál es su horario?" → "todos los días de 9:00 a 18:00 h"
- "¿Dónde están ubicados?" / "¿aceptan tarjeta?" / "¿puedo cancelar?" → responde desde la base de conocimiento
- "Quiero reservar un corte para mañana" → pide el nombre y ofrece 3 horarios reales

### 6 · Cierre (4:45–5:00)
Lista de conversaciones del dashboard con los 3 canales visibles. Cortar.
Rótulo: *"One inbox: all channels reach the same AI receptionist and dashboard."*

## Ajustes hechos al escenario el 2026-08-13 (solo datos de la org de prueba)

Ninguno toca código; todos son reversibles desde el panel o con SQL.

| Antes | Ahora | Por qué |
|---|---|---|
| `approval_mode = low_confidence` | **`off`** | Con "low_confidence" el agente puede dejar la respuesta esperando aprobación y **no contestar al cliente**. En cámara eso es un silencio inexplicable. |
| Base de conocimiento **vacía** | 5 entradas (horario, dirección, pagos, cancelaciones, orden de llegada) | Por eso el agente dijo *"no tengo información sobre horarios"* el 7-ago. |
| 1 servicio ("Corte") | 3 servicios (Corte $150, Corte+Barba $220, Afeitado clásico $180) | "¿Qué servicios ofrecen?" es la pregunta de la Escena 4. |
| Org "ChatVenti — Org de Prueba (Fase 1)" | **"ChatVenti Demo"** | El nombre salía en el chat del agente y en el panel. |
| Agente: "la Barbería de Prueba" | "ChatVenti Demo, una barbería en CDMX" | Coincide con la página de FB y el perfil de IG que ve el revisor. |
| Respuestas con `**markdown**` | Texto plano | En Instagram y Messenger los `**` se ven **literales**. |
| Clientes con IGSID/PSID crudos | "Jimmy (Instagram)", "Juan Ibarra" | La bandeja mostraba `1722961845679377` y `28238978069071044`. |
| Profesional "Estilista Prueba" | "Carlos Méndez" | Sale en la agenda. |

## Después de grabar

- Revisar: URL legible, respuestas del agente completas en cuadro, nada sensible visible.
- Ediciones OK: recortar esperas y añadir rótulos. NO cortar dentro de un flujo (p. ej. el popup del signup).
- Exportar MP4 1080p, ideal < 5 min. Subir el MISMO archivo en los 4 permisos del borrador.

> **Decisión 2026-08-13: sin rótulos quemados.** Meta no exige texto en el video; el revisor
> lee el campo *"instrucciones para el revisor"*, y ahí van los timestamps (abajo). El video se
> sube tal como salió de la grabación. Si algún día se quieren rótulos, quedó un `.srt` con los
> 12 textos en inglés listo para importar en CapCut: `docs/rotulos-video-app-review.srt`.

## Instrucciones para el revisor (pegar en cada permiso, ajustando timestamps)

```
All flows are demonstrated in a single screencast:
0:00 – Product overview and business owner login (www.chatventi.com)
0:30 – whatsapp_business_management: Embedded Signup (business connects its WhatsApp)
1:45 – whatsapp_business_messaging: customer messages on WhatsApp, AI receptionist replies with appointment slots
2:45 – pages_messaging: customer messages the Facebook Page, AI receptionist replies
3:45 – instagram_manage_messages: customer sends an Instagram DM, AI receptionist replies
4:45 – Unified inbox in the business dashboard
The app is in Development Mode, so all demo accounts have roles on the app,
as required. ChatVenti operates as an Independent Tech Provider: each business
connects its own WhatsApp number; ChatVenti never charges per message.
```
