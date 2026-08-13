# Guion del video para el App Review de ChatVenti

> Borrador de Meta `2271937250276475` con 4 permisos: `whatsapp_business_management`,
> `whatsapp_business_messaging`, `pages_messaging`, `instagram_manage_messages`.
> Un solo screencast (~5 min) cubre los 4; se sube el mismo archivo en cada permiso.
> El revisor necesita ver, sin cortes dentro de un flujo y con la barra de URL visible,
> que cada permiso se usa de verdad: quién lo usa, desde dónde y qué pasa de punta a punta.

## Preparación (antes de grabar, ~20 min)

Sesiones ya iniciadas (para no teclear contraseñas en cámara):

1. **Chrome ventana 1** — `www.chatventi.com` como dueño del negocio
   (`zztest-composer@chatventi.com`, dueño de la org de prueba con los 3 canales). Dejar `/dashboard` abierto.
2. **Chrome ventana 2** — sesión de Facebook (Juan Ibarra, para Messenger) y de Instagram
   (@jimjimy321, para el DM). WhatsApp Web para la escena 3 (más fácil que grabar el teléfono).

Grabación: Barra de juegos de Windows (`Win+G`) u OBS · pantalla completa · 1920×1080 ·
notificaciones de Windows en No molestar · sin pestañas de `.env`/Supabase/Vercel/Meta developers.
Idioma: app en español OK; rótulos en inglés (o solo el README con timestamps del final).
**Ensayo en seco primero**, sobre todo el Embedded Signup (única escena no re-verificada).

## Escenas

### 1 · Contexto (0:00–0:30)
Home `www.chatventi.com` → scroll a los planes → Iniciar sesión (ya logueado) → `/dashboard`, pasear cursor 3 s.
Rótulo: *"ChatVenti — SaaS appointment-booking platform with an AI receptionist. A business owner logs into their dashboard."*

### 2 · whatsapp_business_management — Embedded Signup (0:30–1:45)
`/dashboard/conexiones` → "Conectar WhatsApp" → popup de FB Login for Business →
recorrer DESPACIO: portafolio → WABA → número → confirmar → canal en estado conectado.
Rótulo: *"whatsapp_business_management: the business connects its own WhatsApp number via Embedded Signup. ChatVenti (Tech Provider) registers the WABA and subscribes the app."*
⚠️ Si el popup pide contraseña: cortar, iniciar sesión con calma, regrabar la escena.

### 3 · whatsapp_business_messaging (1:45–2:45)
WhatsApp Web → enviar al número del negocio: **"Hola, ¿me pueden atender mañana?"** →
esperar respuesta del agente en cámara (~5-10 s) → contestar lo que pregunte para ver una 2ª respuesta con horarios →
ventana 1: Conversaciones del dashboard, abrir el hilo; opcional: respuesta manual desde el composer y verla llegar.
Rótulo: *"whatsapp_business_messaging: a customer messages the business on WhatsApp; the AI receptionist replies within the 24-hour window and offers appointment slots."*

### 4 · pages_messaging — Messenger (2:45–3:45)
facebook.com (Juan Ibarra) → página "ChatVenti Demo" → Enviar mensaje → **"Hola, ¿qué servicios ofrecen?"** →
esperar respuesta en cámara → ventana 1: mostrar el hilo en el dashboard.
Rótulo: *"pages_messaging: a customer messages the business's Facebook Page; the AI receptionist answers automatically."*

### 5 · instagram_manage_messages (3:45–4:45)
instagram.com/chatventi (sesión @jimjimy321) → Enviar mensaje → **"Hola, quiero reservar un corte para el viernes"** →
esperar respuesta (~5 s, verificado 2026-08-12) → ventana 1: hilo de Instagram en la bandeja.
Rótulo: *"instagram_manage_messages: a customer sends an Instagram DM; the AI receptionist replies and the conversation syncs to the dashboard."*

### 6 · Cierre (4:45–5:00)
Lista de conversaciones del dashboard con los 3 canales visibles. Cortar.
Rótulo: *"One inbox: all channels reach the same AI receptionist and dashboard."*

## Después de grabar

- Revisar: URL legible, respuestas del agente completas en cuadro, nada sensible visible.
- Ediciones OK: recortar esperas y añadir rótulos. NO cortar dentro de un flujo (p. ej. el popup del signup).
- Exportar MP4 1080p, ideal < 5 min. Subir el MISMO archivo en los 4 permisos del borrador.

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
