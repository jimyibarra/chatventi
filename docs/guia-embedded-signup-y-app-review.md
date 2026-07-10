# Guía: Probar Embedded Signup en producción + video y envío del App Review de Meta

> Actualizada: 2026-07-10.
> App de Meta: **ChatVenti** (`2268338090636391`) · config_id `1498382898694876` · Borrador de App Review `2271937250276475` (permisos `whatsapp_business_messaging` + `whatsapp_business_management`).
> Situación nueva (2026-07-09): la app se movió a un **portafolio empresarial propio de ChatVenti** y la **verificación de empresa está EN CURSO**.

---

## 0. Prerrequisito que manda sobre todo: la verificación de empresa

El **envío** del App Review requiere que el portafolio dueño de la app tenga la verificación de empresa **aprobada**. Como ChatVenti ahora tiene portafolio propio y la verificación está en trámite:

- ✅ **SÍ puedes hacer ya**: probar el Embedded Signup en prod con tu cuenta admin (la app en modo desarrollo permite a admins/testers usar el flujo) y **grabar el video**.
- ⛔ **NO puedes todavía**: pulsar "Enviar a revisión". Espera el correo/notificación de Meta de que la empresa quedó verificada.
- 🔎 **Revisar tras el cambio de portafolio** (checklist de 2 min en [developers.facebook.com](https://developers.facebook.com) → app ChatVenti):
  1. **WhatsApp → Configuración de la API**: ¿sigue apareciendo el número de prueba `+52 1 442 530 2649` (`phone_number_id 1090070170857969`, WABA `1280449610662720`)? Si cambió, avísale a Claude para actualizar el canal en la base de datos.
  2. **Inicio de sesión con Facebook para empresas → Configuración**: "Iniciar sesión con el SDK de JavaScript" = **Sí** y dominio `https://www.chatventi.com/` presente.
  3. **Configuraciones (Embedded Signup)**: la configuración `1498382898694876` sigue existiendo y activa.
  4. **WhatsApp → Configuración → Webhook**: URL `https://www.chatventi.com/api/webhooks/whatsapp` (con `www`) y campo `messages` suscrito.
  5. **App Review → Solicitudes**: el borrador `2271937250276475` sigue ahí (si el cambio de portafolio lo borró, se crea de nuevo con los mismos 2 permisos; los textos están abajo).

---

## 1. Qué necesitas tener a la mano antes de grabar

| Cosa | Detalle |
|------|---------|
| Cuenta de Facebook **admin** de la app ChatVenti | El flujo en modo desarrollo solo funciona para admins/developers/testers de la app. |
| Un **número de teléfono real** para conectar | Que reciba SMS o llamada, y que **NO esté registrado en la app de WhatsApp** (o estar dispuesto a darlo de baja de la app primero: WhatsApp → Ajustes → Cuenta → Eliminar cuenta). Este será "el WhatsApp del negocio" en la demo. **No uses tu número personal principal.** |
| Un **segundo teléfono** (o el tuyo personal) | Para mandar un mensaje de WhatsApp al número recién conectado y demostrar el permiso de mensajería. |
| Grabador de pantalla | En Windows: **Win+G** (Game Bar) graba la ventana; u OBS Studio si quieres pantalla completa. Resolución 1080p, con audio no es necesario. |
| Sesión iniciada en `https://www.chatventi.com` | Con una organización real tuya (no la org de prueba, que se va a limpiar). |

---

## 2. Paso a paso: probar Embedded Signup en producción

1. Abre Chrome, inicia sesión en Facebook con tu cuenta admin (misma sesión del navegador).
2. Ve a `https://www.chatventi.com/login` y entra a tu cuenta de ChatVenti.
3. Navega a **Dashboard → Conexiones** (`/dashboard/conexiones`).
4. Pulsa **"Conectar WhatsApp"**. Se abre el diálogo de Meta (popup). Nota: el título del diálogo mostrará el nombre del portafolio — tras la migración debe decir **ChatVenti**.
5. Dentro del diálogo:
   1. Confirma/elige el **portafolio empresarial** (ChatVenti).
   2. Crea o elige la **cuenta de WhatsApp Business (WABA)**.
   3. Escribe el **nombre visible del negocio** y la categoría.
   4. Ingresa el **número de teléfono** y verifícalo por SMS/llamada.
   5. Finaliza. El popup se cierra y manda el resultado a ChatVenti por `postMessage`.
6. La página de Conexiones debe refrescar y mostrar el número con estado **"Activo"** (o "Pendiente de activación" si el registro con PIN quedó pendiente — también es resultado válido; avísale a Claude para diagnosticarlo).
7. Desde el segundo teléfono, manda un WhatsApp al número conectado: "Hola, quiero una cita". Abre **Dashboard → Chats** y verifica que el mensaje entró (y que el agente contestó, si la IA está activada para esa org).

Si el popup da error de permisos o dominio: revisa el checklist del punto 0. Si aparece el aviso "public_profile requiere acceso avanzado", en modo desarrollo con admin **no bloquea** — continúa.

---

## 3. Guión del video demo (lo que Meta quiere ver)

Meta evalúa que el video muestre **el flujo completo, sin cortes, y cómo se usa cada permiso solicitado**. Duración ideal: 2–4 minutos. Graba TODO en una sola toma con la barra de URL visible.

**Escena 1 — Contexto (15 s).** Navegador en `https://www.chatventi.com`. Baja un poco por la landing para que se vea qué es el producto. Haz login.

**Escena 2 — Embedded Signup = `whatsapp_business_management` (90 s).** Dashboard → Conexiones → botón "Conectar WhatsApp" → diálogo de Meta completo (portafolio → WABA → número → verificación SMS → finalizar) → de regreso en Conexiones se ve el número **Activo**. *Esto demuestra la gestión de activos de WhatsApp Business en nombre del cliente.*

**Escena 3 — Mensajería = `whatsapp_business_messaging` (60 s).** Desde un teléfono (grábalo con la cámara del PC apuntando al teléfono, o muestra WhatsApp Web en otra pestaña), manda "Hola, ¿tienen cita mañana?" al número conectado. Cambia a **Dashboard → Chats**: se ve el mensaje entrante y la **respuesta automática del recepcionista IA** ofreciendo horarios. Si la cita se agenda, muestra **Dashboard → Agenda** con la cita creada.

**Escena 4 — Cierre (15 s).** Muestra **Dashboard → Agente IA** (configuración del asistente) para reforzar el caso de uso de negocio.

Consejos: interfaz puede estar en español (Meta lo acepta), pero en las **notas para el revisor** escribe en inglés qué se ve en cada momento (plantilla abajo). No edites ni aceleres la parte del diálogo de Meta.

---

## 4. Completar las 3 secciones del App Review y enviar

En [developers.facebook.com](https://developers.facebook.com) → app ChatVenti → **Revisión de la app → Solicitudes** → borrador `2271937250276475`:

### 4.1 Configuración de la app
- **Icono** 1024×1024 (logo ChatVenti sobre fondo sólido, sin texto pequeño). Si no tienes uno, pídeselo a Claude (skill de generación de imágenes).
- **Email de contacto**: ibarram321@gmail.com (o el de soporte).
- **Categoría**: Business.
- **URL de la política de privacidad**: `https://www.chatventi.com/privacy` (ya está en línea).
- **URL de condiciones**: `https://www.chatventi.com/terms`.

### 4.2 Uso permitido (por permiso) + video
Sube el MISMO video a ambos permisos. Textos sugeridos (inglés):

`whatsapp_business_messaging`:
> ChatVenti is a SaaS appointment-scheduling platform ("AI receptionist") for local businesses (salons, dental clinics, spas). We use whatsapp_business_messaging to receive customer messages sent to our client's WhatsApp Business number and to reply on the business's behalf: answering questions, offering available time slots, and booking, rescheduling or canceling appointments. Businesses onboard their own number via Embedded Signup. See video: minute X shows an end user messaging the connected number and the automated reply flow inside our dashboard.

`whatsapp_business_management`:
> We use whatsapp_business_management to onboard our clients through Embedded Signup: creating/selecting their WhatsApp Business Account, registering their phone number, and subscribing our app to their WABA webhooks so their messages reach our platform. See video: minute X shows the full Embedded Signup flow from our production dashboard at https://www.chatventi.com/dashboard/conexiones.

### 4.3 Gestión de datos (cuestionario legal)
Respuestas orientativas (ajústalas a la verdad de tu operación):
- ¿Compartes datos con terceros? **Sí**: proveedores de infraestructura (Supabase/hosting, Vercel) y proveedor de IA para generar respuestas (OpenRouter). No se venden datos.
- ¿Usas los datos para IA? **Sí**, los mensajes se procesan con un modelo de lenguaje para generar la respuesta del asistente; no se usan para entrenar modelos propios.
- Retención/borrado: los datos se conservan mientras el negocio tenga cuenta activa y se eliminan a solicitud.
- Seguridad: cifrado en tránsito (HTTPS), acceso restringido por roles (RLS), secretos en variables de entorno.

### 4.4 Enviar
Cuando la **verificación de empresa** del portafolio ChatVenti esté aprobada: botón **"Enviar a revisión"**. Meta suele responder en ~5 días hábiles. Mientras esté "En revisión" la app sigue funcionando en modo desarrollo.

---

## 5. Token de la WABA para el envío saliente (channels.credentials)

Para que el agente responda por WhatsApp, ChatVenti necesita un **access token** guardado en el canal (la app lo lee de `channels.credentials.access_token`). Hay dos caminos:

### Opción A — Token temporal (24 h, sirve para probar HOY)
1. developers.facebook.com → app ChatVenti → **WhatsApp → Configuración de la API**.
2. Botón **"Generar token de acceso"** (si el bug de UI persiste, prueba en otro navegador o ventana de incógnito).
3. Copia el token y pégaselo a Claude en el chat: él lo guarda en la base de datos. Caduca en 24 h — solo para pruebas.

### Opción B — Token de usuario del sistema (permanente, el bueno)
1. [business.facebook.com](https://business.facebook.com) → portafolio **ChatVenti** → **Configuración del negocio → Usuarios → Usuarios del sistema**.
2. **Agregar** → nombre `chatventi-backend`, rol **Administrador**.
3. Con el usuario del sistema creado → **Agregar activos**: la app **ChatVenti** (control total) **y** la WABA del número (control total). ⚠️ Si la WABA de prueba `1280449610662720` quedó en el portafolio viejo (GRUPO ELRI), el usuario del sistema debe crearse ahí, o usar la Opción A para pruebas y dejar la B para las WABAs reales de clientes.
4. **Generar token** → app: ChatVenti → caducidad: **Nunca** → permisos: `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`.
5. Copia el token y pégaselo a Claude: lo guarda en `channels.credentials`, en `.env.local` (`META_SYSTEM_USER_TOKEN`) y te dirá cargarlo en Vercel Production.

---

## Resumen del orden recomendado

1. Checklist post-migración de portafolio (punto 0.🔎) — 2 min.
2. Generar token (Opción A basta para hoy) y pasárselo a Claude → prueba de outbound del agente por WhatsApp.
3. Probar Embedded Signup en prod (punto 2) **grabando la pantalla** desde antes de hacer clic (así la toma buena ya queda hecha).
4. Completar sección 4.1 y 4.2 del App Review (el video ya lo tienes del paso 3).
5. Cuando Meta apruebe la verificación de empresa → contestar 4.3 y **Enviar a revisión**.
