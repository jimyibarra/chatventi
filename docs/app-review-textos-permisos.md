# Textos para los 4 permisos del App Review

> Borrador `2271937250276475` · app ChatVenti `2268338090636391`.
> Cada permiso pide **dos** cosas: (A) descripción detallada del uso y (B) instrucciones
> para probar la integración. En inglés a propósito: es lo que lee el revisor de Meta.
>
> En los dos permisos de Meta (`pages_messaging`, `instagram_manage_messages`) hay además
> un desplegable **"Selecciona una página"** → elegir **ChatVenti Demo**.

---

## 1 · pages_messaging

### A) Descripción del uso

```
ChatVenti is a SaaS appointment-booking platform for small service businesses
(barbershops, salons, clinics). Each business connects its OWN Facebook Page to
ChatVenti so that customers who message the Page are answered automatically by an
AI receptionist.

We use pages_messaging to (1) receive the messages customers send to the business's
Page through the "messages" webhook, and (2) send the business's replies back to
that customer inside the 24-hour customer service window. Those replies answer
questions about services, prices and opening hours, and let the customer book,
reschedule or cancel an appointment in the business's own calendar.

Value for people: small businesses lose bookings because nobody answers Messenger
outside working hours. With ChatVenti every customer gets an immediate, accurate
answer and can book on the spot instead of waiting. The business sees the full
thread in its ChatVenti dashboard and can take the conversation over at any time.

Why it is necessary: without pages_messaging ChatVenti cannot receive or reply to
Page messages at all, so the Messenger channel of the product cannot exist. We only
handle conversations for the Page that each business explicitly connected, we never
message people who have not written to the business first, and we never charge per
message.
```

### B) Instrucciones para probar

```
Page to test: "ChatVenti Demo"
Direct link: https://www.facebook.com/1335718816281135

Step 1. Open https://www.facebook.com/1335718816281135 from a Facebook account that
        has a role on this app (the app is in Development Mode).
Step 2. Click the "Message" button on the Page.
Step 3. Send: "Hi, what services do you offer?" (Spanish also works:
        "Hola, que servicios ofrecen?").
Step 4. Within about 5-10 seconds the AI receptionist replies with the list of
        services, prices and durations.
Step 5. Reply: "I want to book a haircut for tomorrow". The assistant asks for your
        name once, then offers three real available time slots taken from the
        business calendar.
Step 6. Pick one of the offered times. The appointment is created and confirmed.
Step 7. (Business side) Sign in at https://www.chatventi.com and open "Chats" in the
        dashboard: the same conversation is there, and the business can reply
        manually from the composer.

Note: the demo business is a barbershop, so the assistant only answers questions
about that business, as required.
```

---

## 2 · instagram_manage_messages

### A) Descripción del uso

```
ChatVenti is a SaaS appointment-booking platform for small service businesses.
Each business connects its OWN Instagram professional account (linked to its
Facebook Page) so that customers who send a Direct Message are answered
automatically by an AI receptionist.

We use instagram_manage_messages to (1) receive the Direct Messages customers send
to the business's Instagram account through the "messages" webhook, and (2) send the
business's replies back to that customer. The replies answer questions about
services, prices and opening hours, and let the customer book, reschedule or cancel
an appointment in the business's own calendar.

Value for people: most of these businesses get their bookings through Instagram, but
DMs go unanswered for hours. With ChatVenti the customer is answered in seconds, at
any time, and can confirm a real appointment without leaving the conversation. Every
thread is mirrored in the business dashboard so a human can step in whenever needed.

Why it is necessary: without instagram_manage_messages ChatVenti cannot read or
answer Instagram Direct messages, so the Instagram channel of the product cannot
exist. We only handle conversations for the Instagram account that each business
explicitly connected, and only with people who messaged the business first.
```

### B) Instrucciones para probar

```
Instagram account to test: @chatventi
Direct link: https://www.instagram.com/chatventi/

Step 1. Open https://www.instagram.com/chatventi/ from an Instagram account whose
        linked Facebook account has a role on this app (the app is in Development
        Mode).
Step 2. Click "Message".
Step 3. Send: "Hi, can you help me book an appointment?" (Spanish also works:
        "Hola, me ayudas a agendar una cita?").
Step 4. Within about 5 seconds the AI receptionist replies and asks which service
        you want.
Step 5. Reply: "A haircut, what times do you have tomorrow?". The assistant offers
        three real available time slots from the business calendar.
Step 6. Pick one of the offered times. The appointment is created and confirmed.
Step 7. (Business side) Sign in at https://www.chatventi.com and open "Chats": the
        same Instagram conversation appears in the business inbox.
```

---

## 3 · whatsapp_business_messaging

### A) Descripción del uso

```
ChatVenti is a SaaS appointment-booking platform for small service businesses. Each
business connects its OWN WhatsApp Business number through Embedded Signup, and
ChatVenti answers its customers with an AI receptionist.

We use whatsapp_business_messaging to (1) receive the messages customers send to the
business's WhatsApp number through the "messages" webhook, and (2) send the
business's replies inside the 24-hour customer service window. The assistant answers
questions about services, prices and opening hours, offers real availability from
the business calendar, and books, reschedules or cancels appointments. It also sends
appointment reminders that the customer's own booking made relevant.

Value for people: the customer books an appointment in the app they already use,
in seconds, at any hour, without phone calls or waiting. The business stops losing
bookings to unanswered messages and sees every conversation in one dashboard, where
a human can take over at any moment.

Why it is necessary: without whatsapp_business_messaging ChatVenti cannot receive or
send WhatsApp messages on behalf of the business, which is the core of the product.
ChatVenti acts as an Independent Tech Provider: each business uses its own phone
number and its own WhatsApp Business Account, and we never charge per message.
```

### B) Instrucciones para probar

```
Test number (Meta test phone number, Cloud API): +1 555 151-7434

Step 1. From WhatsApp, send a message to the business number above.
Step 2. Send: "Hi, can you see me tomorrow?" (Spanish also works:
        "Hola, me pueden atender manana?").
Step 3. Within about 5-10 seconds the AI receptionist replies, asks which service
        you want, and offers three real available time slots from the business
        calendar.
Step 4. Pick one of the offered times. The appointment is created and confirmed with
        the exact date and time.
Step 5. (Business side) Sign in at https://www.chatventi.com and open "Chats": the
        same conversation is there and the business can reply manually; its reply is
        delivered to the customer on WhatsApp.

The full flow is also shown in the attached screencast.
```

---

## 4 · whatsapp_business_management

### A) Descripción del uso

```
ChatVenti operates as an Independent Tech Provider: every business that signs up
connects its OWN WhatsApp Business Account and phone number through Meta's Embedded
Signup, from the "Conexiones" (Connections) screen of the ChatVenti dashboard.

We use whatsapp_business_management to complete that onboarding on behalf of the
business, with its explicit consent given in the Facebook Login for Business dialog:
we subscribe our app to the webhooks of the business's WABA so that incoming
customer messages reach ChatVenti, and we register the business's phone number with
the Cloud API so it can send and receive. We also read the WABA and phone number
metadata we need to show the business which number is connected and whether it is
active.

Value for people: without this, a small business owner would have to configure
webhooks, tokens and phone registration by hand in Meta's developer tools, which is
out of reach for a barbershop or a salon. Embedded Signup turns it into a two-minute
guided flow, and the business keeps full ownership of its WhatsApp assets.

Why it is necessary: without whatsapp_business_management ChatVenti cannot subscribe
to the business's webhooks or register its number, so no business could ever connect
its WhatsApp and the product would not work. We only touch the assets of businesses
that granted access through Embedded Signup, and never charge per message.
```

### B) Instrucciones para probar

```
Step 1. Sign in at https://www.chatventi.com as a business owner.
Step 2. Go to "Conexiones" (Connections) in the dashboard menu.
Step 3. Click "Conectar WhatsApp" (Connect WhatsApp). The Facebook Login for
        Business dialog opens (Embedded Signup).
Step 4. Choose the business portfolio, the WhatsApp Business Account and the phone
        number, then confirm.
Step 5. When the dialog closes, ChatVenti exchanges the code, subscribes the app to
        that WABA's webhooks and registers the phone number. The Connections screen
        then shows the number with status "Activo" (Active).

This whole flow is recorded in the attached screencast.
```

---

## 5 · instagram_basic (DEPENDENCIA OBLIGATORIA)

> Detectado el 2026-08-13: el checklist de `instagram_manage_messages` deja sin palomear
> *"La solicitud debe incluir instagram_basic para usar instagram_manage_messages"*.
> Hay que añadirlo desde **Revisión de la aplicación → Permisos y funciones →
> instagram_basic → "Solicitar acceso avanzado"**. La solicitud pasa de 4 a 5 permisos.

### A) Descripción del uso

```
ChatVenti is a SaaS appointment-booking platform for small service businesses.
Each business connects its OWN Instagram professional account, linked to its own
Facebook Page, so that customers who send a Direct Message are answered by an AI
receptionist.

We request instagram_basic because it is a required dependency of
instagram_manage_messages, and because we use it for the minimum profile data the
messaging feature needs: to read the Instagram Business Account ID linked to the
Page the business connected, and its username, so that ChatVenti can (1) store the
correct account as the business's Instagram channel, (2) route each incoming Direct
Message to the right business, and (3) show the business which Instagram account is
connected in its "Conexiones" (Connections) screen.

Value for people: the business owner sees exactly which Instagram account is
answering its customers and can confirm it is the right one before enabling the
channel. Without it, connecting Instagram would be an opaque step the owner cannot
verify.

Why it is necessary: instagram_manage_messages cannot be granted without
instagram_basic, and without the account ID and username ChatVenti cannot identify
which business an incoming Direct Message belongs to. We only read profile
information for the Instagram accounts that businesses explicitly connected, we do
not read or publish media, and we never charge per message.
```

### B) Video

El mismo `Chatventi.mp4`: la escena de Instagram muestra el uso.

---

## Notas de Meta que salen en el formulario

- **"Selecciona una página"** (en `pages_messaging` y `instagram_manage_messages`):
  elegir **ChatVenti Demo**.
- Meta advierte: *"crea una cuenta real en Facebook y concédele el rol de evaluador
  en Roles de la aplicación. No envíes un usuario de prueba creado en Roles de la
  aplicación, no pueden recibir mensajes del bot."* Es decir: la cuenta con la que se
  prueba debe ser **real** y tener rol en la app — no un "usuario de prueba" generado.
  La cuenta de Juan Ibarra y @jimjimy321 ya cumplen (son las del video).
- Campo opcional de **credenciales de prueba**: si se quiere que el revisor entre al
  dashboard, hay que darle correo y contraseña de la cuenta demo. Lo rellena Juan.
- **El video va en CADA permiso**, no una sola vez. El uploader de la plataforma web
  (sección "Instrucciones para el revisor") es documentación de apoyo opcional; el
  obligatorio es el de cada permiso, dentro de su checklist.
- **Cada permiso tiene su propio checklist de 3-4 puntos.** Revisarlos TODOS: un punto
  sin palomear bloquea el envío aunque los campos estén llenos. Así apareció la
  dependencia `instagram_basic`. Puede haber más en `pages_messaging`.
