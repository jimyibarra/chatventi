# Informe estratégico AutomatizaPro — Jimylo, Voz IA, Citas y el panorama completo

> Fecha: 2026-06-29 · Lente: financiero + marketing + viabilidad técnica
> Basado en: análisis de CitaFlow (capturas) + investigación web de Whaticket, Leadsales, Whato, Callbell, Simla, ActiveCampaign, modelo Meta BSP/Tech Provider, y stack de voicebots IA.

---

## 0. Veredicto en una frase

Tu visión es **correcta y comercialmente válida** (CitaFlow ya la ejecuta y vive de ella), pero el plan ganador **no es construir 4 productos separados**, sino **una sola plataforma con un cerebro compartido** donde Jimylo (WhatsApp), la Voz IA y Citas son **módulos/canales** del mismo motor — y vender cada uno con su propia marca y landing. Eso es lo que minimiza tu trabajo diario y maximiza el margen.

---

## 1. Las 4 ideas, una por una: ¿viables? ¿correctas? ¿mejor camino?

### IDEA 1 — Jimylo (conexión WhatsApp para cualquier giro) → **VIABLE y es tu mejor activo**

**Qué confirmé:** el producto que describes = **Callbell** (inbox omnicanal multiagente + CRM ligero), no Simla (CRM de ventas pesado) ni ActiveCampaign (que es otra liga: automatización de email marketing, NO sirve de modelo aquí).

**El eje que decide todo: API oficial vs no oficial.**
- Whaticket y Whato se conectan por **QR / WhatsApp Web no oficial** → baratos pero con **riesgo de baneo ALTO**. Whato hasta vende un "verificador de riesgo de bloqueo": eso confirma que el baneo es su talón de Aquiles.
- Leadsales y Callbell usan **Cloud API oficial de Meta** → riesgo bajo, legítimo.
- **Tú ya tienes la pieza difícil:** estás en proceso de ser **Tech Provider oficial con Embedded Signup** (App Review enviado). Ese es el foso (moat) que los demás subcontratan a un BSP. **No tires eso conectando por QR jamás.**

**El hallazgo financiero más importante (y contraintuitivo):**
Como **Tech Provider**, el cliente conecta su propio WhatsApp y **paga su mensajería directo a Meta con su tarjeta**. Tú **no tocas ese dinero** → **no puedes cobrar margen sobre los mensajes**. Eso no es un problema, es una bendición: **cobras por el software** (suscripción), igual que ya cobras por sucursal en SastrePro, y te quitas el riesgo de tesorería. El cliente paga su WhatsApp a Meta + te paga a ti el SaaS.

**Bonus a tu favor:** con el nuevo modelo per-message de Meta (julio 2025), los **recordatorios y confirmaciones de cita (utility) dentro de la ventana de 24h son GRATIS**, y todas las respuestas (service) también. Para citas/CRM, el costo de WhatsApp para tu cliente es casi nada. Marketing en México: $0.0305 USD/mensaje (confirmado).

**Veredicto:** Construir Jimylo modelo Callbell, oficial, en español, con soporte mexicano y precio claro **por agente/número** → ataca justo los huecos de los 3 (Callbell tiene quejas de soporte, Simla precios opacos, ActiveCampaign caro y no conversacional).

---

### IDEA 2 — Voz IA (agente que contesta llamadas) → **VIABLE, con un giro inesperado a tu favor**

**La tecnología está madura.** Se monta con plataformas **no-code** (Synthflow, Retell, Vapi, ElevenLabs Agents) sin mantener infraestructura. Costo real **$0.12–$0.25 USD/min** todo incluido; una cita de 3 min cuesta producirla **~$7–19 MXN**.

**El cuello de botella NO es la IA, es la telefonía mexicana:** números +52 piden KYC/domicilio, hay filtro anti-spoofing (jul-2025) y registro de líneas móviles (ene-2026). Conseguir número limpio tiene fricción.

**🎯 El giro que lo cambia todo — WhatsApp Business Calling API:**
Meta lanzó (GA 1-jul-2025) llamadas de voz **dentro de WhatsApp**, y **México es de los primeros países soportados**. Esto significa que tu Voz IA puede atender **llamadas de WhatsApp** reusando tu infraestructura de Tech Provider que **ya tienes**, **esquivando todo el lío regulatorio de telefonía +52**. Es la jugada perfecta: voz IA sin comprar números, sin Twilio, sin anti-spoofing.

**Calidad en español mexicano:** la voz suena bien (ElevenLabs lidera). El eslabón débil es **entender al cliente** (STT con ruido de secadoras, "ahorita", "¿mande?", capturar teléfonos de 10 dígitos) → se resuelve con prompts de confirmación explícita y fallback a humano.

**Mantenimiento:** bajo pero **no cero**. Hay un **afinado fuerte de 1-3 semanas por cliente nuevo**, luego soporte por excepción. Honestamente: no es "instalar y olvidar", pero sí "pocas horas/semana" una vez estabilizado.

**Veredicto:** Sí, va como **módulo dentro de la misma plataforma** (no producto aparte). Empieza con la vía WhatsApp Calling para esquivar telefonía; ofrece número +52 solo a clientes que lo pidan.

---

### IDEA 3 — automatizapro.mx (landing de la agencia) → **CORRECTO, sin cambios**

Tu definición es la correcta: landing que **menciona** los productos (Citas, Jimylo, Voz) pero **no los integra**. Habla de QUÉ hace la agencia (automatizar procesos, ahorrar tiempo/dinero) y dirige a cada producto. Cada producto vive en su propio subdominio/marca. Esto es exactamente el patrón sano (la agencia es el paraguas; los SaaS son productos con vida propia).

---

### IDEA 4 — App de Citas que consume Jimylo → **VIABLE, ya tienes el 70%**

Todas las funciones que listaste (agenda, agente IA WhatsApp, recordatorios, catálogo, ficha, PWA, multi-sucursal) **ya existen en SastrePro** o son port directo. CitaFlow valida el feature set exacto. **Lo que CitaFlow tiene y tú no habías considerado** (y deberías robar):
- **Telegram** como canal extra (casi gratis de añadir, sin costos de Meta).
- **Email** como canal de recordatorios (gratis e ilimitado — su arma secreta para no pagar mensajes).
- **Web por negocio en 2 min** con branding + **widget embebible** para webs existentes.
- **Sincronización bidireccional** Google/Apple/Outlook Calendar.
- **Fianza anti-no-show** vía Stripe (cobra 10% al reservar → reduce ausencias).

---

## 2. La gran recomendación de arquitectura (esto es lo que te ahorra trabajo diario)

CitaFlow te está dando la lección sin querer: **NO vende "Jimylo" y "Citas" por separado. Vende UNA plataforma modular** donde Voz IA (+29-169€) y Chat IA (+19-109€) son **add-ons** que suben el ticket sobre un núcleo de €29.

```
            ┌─────────────────────────────────────────┐
            │   CEREBRO ÚNICO (tu backend Supabase)     │
            │  agenda · clientes · reglas · disponib.   │
            │  RPC: get_slots, create_appt, find_client │
            └───────┬─────────┬──────────┬──────────────┘
                    │         │          │
         ┌──────────┘    ┌────┘     ┌────┘
    ┌────▼────┐    ┌─────▼────┐  ┌──▼──────┐   ← CANALES (entradas)
    │ Jimylo  │    │  Voz IA  │  │   Web    │
    │WhatsApp │    │(WA Call) │  │  / PWA   │
    │+Telegram│    │          │  │ +widget  │
    └─────────┘    └──────────┘  └──────────┘
```

**Por qué esto es la clave de "mínimo trabajo diario":**
- **Un solo prompt / una sola lógica de negocio** que mantener (no 3 cerebros desincronizados).
- **Una sola fuente de verdad** de agenda → cero doble-reserva entre voz y chat.
- Cada producto nuevo (CRM papelerías, etc.) es **otro canal/vertical sobre el mismo motor**, no un sistema nuevo.

**Comercialmente, sin embargo, sí los separas:** marca + landing + precio independientes (Jimylo se vende solo a terceros que NO quieren citas; Citas se vende a peluquerías/dentistas). Mismo motor por dentro, productos distintos por fuera. **Lo mejor de los dos mundos.**

---

## 3. Modelo financiero y de precios (en pesos, lente de margen)

### Jimylo (modelo Callbell, adaptado a México)
- **Cobra por software, NO por mensaje** (recuerda: la mensajería la paga el cliente a Meta).
- Sugerido: **$499–$699 MXN/mes por número/agente**, mínimo nada (a diferencia de Callbell que exige 3). Add-on CRM con embudo: +$300/mes.
- Setup/onboarding único: **$1,500–$3,000 MXN** (cubre el Embedded Signup asistido + plantillas).
- Margen ~90% (es software puro; tu único costo es infra Supabase/Vercel, ya pagada).

### Voz IA (modelo CitaFlow, en pesos)
- Tu costo: **~$4–4.5 MXN/min**.
- Revende **híbrido con bolsa + tope**: ej. **$1,500 MXN/mes con 400 min incluidos**, excedente $7–9 MXN/min.
- Como la mayoría de negocios usan 30–50% de la bolsa, **margen efectivo 60–80%**.
- **Blindaje obligatorio:** nunca minutos ilimitados a precio plano; alerta al 80%; hard-cap configurable; filtrado de spam. (Riesgo real: un cliente con mucho volumen quema la bolsa.)

### Citas (ya definido en tu propuesta previa)
- Peluquería setup $6,900 + $1,290/mes; Dentista $9,900 + $1,690/mes. **Mantenlo**, y vende Voz IA y CRM como add-ons que suben el ticket (la jugada de CitaFlow).

**Regla de oro de pricing:** nunca pegues tu precio de reventa al costo del proveedor. Los precios de las plataformas de voz **cambiaron varias veces en 2025**. Deja 15-30% de colchón.

---

## 4. Nombres para el producto de Voz

"Jimylo" funciona para el WhatsApp. Para la voz, opciones (puedes mantener todo bajo Jimylo como "Jimylo Voz" o separar):

| Nombre | Lectura |
|--------|---------|
| **Jimylo Voz** | Más simple: un solo paraguas de marca, sub-módulo. **Recomendado** para no fragmentar. |
| **VozPro / VocePro** | Alinea con "AutomatizaPro"; suena a producto serio. |
| **Lumai / Lumi** | Corto, "habla" en abstracto, marca registrable. |
| **Atiende / Atenda** | Descriptivo en español, fácil de recordar. |
| **Recepcio / RecepIA** | Apunta al beneficio: recepcionista IA. |

Mi consejo: **un solo paraguas de marca por canal de Jimylo** ("Jimylo Chat", "Jimylo Voz") reduce costo de marketing y de mente del cliente. Marcas separadas solo si vas a venderlas a públicos muy distintos.

---

## 5. Riesgos que NO debes ignorar (sin optimismo ciego)

1. **Meta prohíbe chatbots de IA de propósito general en WhatsApp desde el 15-ene-2026.** Tu agente IA debe estar **acotado al negocio** (la peluquería, el dentista), NO un ChatGPT genérico. Afecta directo tu feature de Agente IA — manténlo en dominio.
2. **Telefonía MX** (si usas números +52): KYC, anti-spoofing, registro de líneas. Por eso recomiendo **WhatsApp Calling API primero**.
3. **STT español mexicano** con ruido → exige confirmación explícita y fallback a humano. No lo vendas como infalible.
4. **Dependencia de Meta:** cambian reglas/precios varias veces al año. Ten a **360dialog identificado como plan B** (BSP con €49/mes y $0 markup) si el mantenimiento del Tech Provider directo se vuelve pesado.
5. **Precios de plataformas de voz volátiles** → colchón en tu pricing.

---

## 6. Carga operativa diaria (tu premisa central): veredicto honesto

| Pieza | Trabajo de una vez | Trabajo diario/recurrente |
|-------|--------------------|-----------------------------|
| Jimylo (Tech Provider) | Embedded Signup, webhooks, tokens (✅ casi hecho) | Bajo: monitorear quality rating, soporte. El cambio Meta oct-2025 (sin downgrades automáticos) reduce el riesgo de "se cayó el número". |
| Voz IA | Afinado del prompt + flujos | **Medio al alta de cada cliente** (1-3 sem), luego por excepción |
| Citas | Ya construido (70%) | Bajo |
| Cerebro compartido | Diseñarlo UNA vez | Mínimo: un solo sistema que mantener |

**Conclusión:** Sí se puede operar con poco trabajo diario, **a condición de** (a) cerebro compartido (un solo sistema), (b) bolsas de minutos con tope, (c) onboarding asistido cobrado, (d) soporte por excepción, no rutinario.

---

## 7. Lo que yo haría (ruta sugerida, mínimo esfuerzo / máximo retorno)

1. **Cerrar el estatus Tech Provider** (confirmar Business Verification + App Review + Access verification en verde → sube onboarding de 10 a 200 clientes/7 días).
2. **Construir Jimylo como producto comercial** sobre tu motor actual (inbox multiagente + CRM ligero, Cloud API oficial). Es tu activo más defendible y el que vendes a terceros.
3. **Citas = vertical sobre el mismo motor** (ya casi listo); añade Telegram + email + widget + fianza Stripe robados de CitaFlow.
4. **Voz IA = piloto con WhatsApp Calling API** (esquiva telefonía MX), Retell/Vapi con function-calling a tus RPC de Supabase. Mismo cerebro.
5. **automatizapro.mx** como landing paraguas que dirige a cada producto.
6. Monetiza **por software/suscripción + bolsas de minutos con tope + setup**. Nunca por mensaje.

---

### Decisiones abiertas para ti
- ¿Jimylo "Chat" y "Voz" bajo un solo paraguas de marca, o marcas separadas?
- ¿Voz IA arranca solo por WhatsApp Calling, o también ofreces número +52 desde el día 1?
- ¿Robamos de CitaFlow el canal **Telegram + email** para Citas (casi gratis, sin costo Meta)?
- ¿Construimos Jimylo como producto comercial completo ya, o primero lo dejamos como la capa interna que sostiene Citas y lo "producto-izamos" después?
