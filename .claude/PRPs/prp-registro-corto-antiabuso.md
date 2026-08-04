# PRP: Registro corto + /bienvenida + Antiabuso capa 1 + Topes de consumo

> **Estado**: PENDIENTE (no se ha tocado código)
> **Fecha**: 2026-08-03
> **Proyecto**: ChatVenti

---

## Objetivo

Partir el alta en dos: un **registro corto** (correo + contraseña + click-wrap) con verificación
de correo obligatoria, y un **asistente `/bienvenida` de 2 pasos** que recoge los datos del negocio
y crea la organización; todo protegido por una **capa 1 antiabuso** (Turnstile, rate limit por IP
durable, canonicalización de correo, bloqueo de dominios desechables, contraseña mín. 8, registro
de IP/dispositivo) y por **topes de consumo** del trial, del sandbox y de la demo pública.

## Por Qué

| Problema | Solución |
|----------|----------|
| El formulario de alta pide **10 campos** antes de existir la cuenta → fricción máxima en el punto de mayor abandono del funnel | Registro corto de 3 campos; los datos del negocio se piden ya dentro, en `/bienvenida`, cuando el usuario ya invirtió |
| El alta corre **100% en el cliente** (`supabase.auth.signUp` desde `signup-form.tsx`): no hay forma de meter captcha, rate limit ni validación de dominio | Mover el alta a servidor (Server Action / Route Handler) donde sí se puede verificar Turnstile, IP y correo |
| Trial de 10 días **sin tarjeta** → un bot o una persona con `usuario+1@gmail.com` puede farmear pruebas gratis infinitas quemando saldo de OpenRouter | Canonicalización de correo + bloqueo de desechables + rate limit por IP + Turnstile |
| Los topes actuales protegen mal el saldo: el rate limit de `/api/demo-chat` es un `Map` **en memoria por instancia** (en Vercel serverless cada lambda tiene el suyo → el tope real es N×30/h) y el del sandbox es **por hilo**, y "Reiniciar conversación" lo pone a cero → ilimitado | Contadores **durables en BD**: por IP, por org/día y por trial |
| El trial no tiene ningún tope de consumo de IA: 10 días × ilimitado = riesgo de coste abierto | Tope de mensajes de IA durante el trial, con aviso y upsell al llegar |
| `business_type` elegido en el alta **nunca se persiste**: vive solo en `user_metadata.pending_business_type` hasta que el dueño aplica una plantilla en `/dashboard/agente` | `/bienvenida` lo escribe en `organizations.business_type` al crear la org |
| Requisito legal/abuso: hoy no se guarda desde **qué IP/dispositivo** se aceptaron los Términos | Columnas `signup_ip` / `signup_user_agent` selladas en servidor |

**Valor de negocio**: menos fricción en el alta (3 campos vs 10) → más registros; coste de IA acotado
por diseño → el trial gratis deja de ser un riesgo abierto; evidencia legal completa del click-wrap.

## Qué

### Criterios de Éxito

- [ ] `/signup` pide **solo** correo, contraseña y checkbox de Términos; contraseña mínima **8**.
- [ ] El alta se procesa **en el servidor**; enviar el formulario sin token de Turnstile válido devuelve error y **no** crea usuario.
- [ ] Un correo de dominio desechable (p. ej. `mailinator.com`) es rechazado con mensaje claro y sin crear usuario.
- [ ] `juan.perez+test@gmail.com` y `juanperez@gmail.com` se resuelven al mismo canónico: el segundo alta se rechaza como "ya existe una cuenta".
- [ ] Más de N altas desde la misma IP en la ventana configurada → bloqueadas, y el contador **sobrevive a un redeploy** (está en BD, no en memoria).
- [ ] Tras registrarse, el usuario recibe correo de verificación; el enlace lo deja logueado y aterriza en `/bienvenida` (no en `/dashboard`).
- [ ] Un usuario autenticado **sin perfil** siempre acaba en `/bienvenida`; ninguna ruta de `/dashboard` es alcanzable sin organización.
- [ ] `/bienvenida` en 2 pasos crea org + sucursal + perfil owner con `business_type`, `terms_version`, `terms_accepted_at`, `signup_ip` y `signup_user_agent` sellados por el servidor.
- [ ] Durante el trial, al superar el tope de mensajes de IA el agente deja de consumir modelo y el dashboard muestra el aviso + upsell.
- [ ] El sandbox (`/dashboard/agente/probar`) tiene tope **por org y día**, no reseteable con el botón "Reiniciar conversación".
- [ ] `npm run typecheck` y `npm run build` pasan; E2E con navegador cubre alta → correo → bienvenida → dashboard.

### Comportamiento Esperado (Happy Path)

1. Visitante entra a `/signup`: correo, contraseña (≥8, con indicador), checkbox click-wrap y widget Turnstile.
2. Al enviar, el **servidor** valida en este orden: Zod → Turnstile → rate limit por IP → dominio no desechable → correo canónico no registrado. Cualquier fallo → error legible, sin usuario creado, intento registrado.
3. Se crea el usuario en Supabase Auth con `emailRedirectTo` a `/auth/confirm?next=/bienvenida`. Pantalla "revisa tu correo".
4. El usuario abre el enlace → `/auth/confirm` canjea el token, deja sesión → redirige a `/bienvenida`.
5. `/bienvenida` paso 1 (**tu negocio**): nombre, tipo de negocio, país, ciudad. Paso 2 (**sobre ti**): nombre y teléfono. Botón "Crear mi negocio".
6. Server Action llama a `create_organization_with_owner_v2` → org (con `trial_ends_at` = hoy + `TRIAL_DAYS`), sucursal "Principal", perfil `owner`, click-wrap y huella IP/UA.
7. Redirección a `/dashboard`, donde ya funcionan el checklist de setup y los correos de ciclo de vida.
8. Mientras el trial está vivo, cada respuesta de IA descuenta del tope del trial; al agotarse, el agente responde el mensaje de límite y el panel ofrece suscribirse.

---

## Contexto

### Referencias (código real inspeccionado)

| Ruta | Qué es hoy |
|---|---|
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\features\auth\components\signup-form.tsx` | Formulario de 10 campos; llama `supabase.auth.signUp` **desde el cliente** y luego el RPC. Guarda todo como `pending_*` en `user_metadata`. Es la pieza que se parte en dos |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\lib\validations\auth.ts` | `signupSchema` (password `min(6)`), `loginSchema`, `recoverSchema`, `newPasswordSchema` |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\app\(auth)\signup\page.tsx` | Página del alta (15 líneas, envuelve el form) |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\app\auth\confirm\route.ts` | Canjea `code` (PKCE) o `token_hash`; hoy redirige fijo a `/dashboard` o `/nueva-clave`. Necesita soportar `next` |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\app\(main)\dashboard\page.tsx` | Líneas 26-66: "onboarding safety-net" que crea la org desde `user_metadata` si no hay perfil. **Se sustituye** por el gate a `/bienvenida` |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\proxy.ts` | Refresco de sesión + rutas protegidas + `ROLE_GATES`. Aquí va el gate "sin perfil → /bienvenida" (los layouts no sirven: no re-renderizan en soft-nav, aprendizaje `5e2ce80`) |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\shared\constants\legal.ts` | `LEGAL.termsVersion = '2026-07-13'` (click-wrap) |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\features\billing\plans.ts` | `TRIAL_DAYS = 10`, `DATA_RETENTION_DAYS = 30`, `AI_TIERS` (300/1000/3000 conversaciones). Aquí viven las constantes de tope |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\app\api\demo-chat\route.ts` | Demo pública: `MAX_MESSAGES_PER_SESSION = 8` (durable, en BD) + `MAX_PER_IP_PER_HOUR = 30` con `Map` **en memoria** (líneas 16-32) |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\app\api\agente\probar\route.ts` | Sandbox: `MAX_MESSAGES_PER_THREAD = 25`, contado por hilo → el reset lo anula |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\app\api\agente\probar\reset\route.ts` | Borra el hilo del sandbox (es lo que hace reseteable el tope) |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\features\agente-ia\agent.ts` | `runAgent({ sandbox })`: único punto por el que pasa TODO consumo de modelo (webhooks WA/TG, demo, sandbox) → es donde se mete el tope de trial |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\features\billing\gating.ts` | `getMySubscription`, `subIsActive` — patrón de gate de acceso a reutilizar |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\features\onboarding\checklist.ts` | Checklist post-alta ya existente; `/bienvenida` NO lo duplica, lo precede |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\features\agente-ia\business-templates.ts` | `BUSINESS_TEMPLATES` (rubros) — reutilizado en el paso 1 de `/bienvenida` |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\src\app\api\cron\appointment-reminders\route.ts` | `runTrialFunnel` (cron diario 14:00 UTC, `vercel.json`): correos de fin de trial y borrado de datos. El tope de consumo es **complementario**, no lo sustituye |
| `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\supabase\migrations\20260715030000_ola4_fase5_team_rpcs.sql` | `accept_team_invitation`: crea perfil **sin** crear org. Es el camino que NO debe pasar por `/bienvenida` |

Migraciones relevantes en `D:\JIM\Negocios\SaaS\Proyectos\ChatVenti\supabase\migrations\`:

- `20260713000000_auth_signup_fields.sql` — campos del alta.
- `20260713010000_terms_acceptance.sql` — `profiles.terms_version`, `profiles.terms_accepted_at`; sello de tiempo en servidor.
- `20260713050000_free_trial_model.sql` — firma **actual** de `create_organization_with_owner(text,text,text,text,text,text,text)`, `organizations.trial_ends_at/delete_scheduled_at/data_deleted_at`, `wipe_organization_business_data`.
- `20260723000000_agente_por_rubro.sql` — `organizations.business_type`.

Docs externas:
- Cloudflare Turnstile — `https://developers.cloudflare.com/turnstile/` (endpoint `siteverify`).
- Supabase Auth: longitud mínima de contraseña y "Confirm email" son **ajustes del proyecto**, no código.

### Arquitectura Propuesta (Feature-First)

```
src/features/auth/
├── components/
│   ├── signup-form.tsx            # REESCRITO: 3 campos + Turnstile
│   └── turnstile-widget.tsx       # NUEVO: carga el script y expone el token
├── actions.ts                     # NUEVO: Server Action de alta (valida y crea)
src/features/onboarding/
├── components/
│   └── bienvenida-wizard.tsx      # NUEVO: 2 pasos, client component
├── actions.ts                     # NUEVO: crea la organización (RPC v2)
src/app/(auth)/bienvenida/page.tsx  # NUEVO (o (main)/bienvenida: sin nav)
src/shared/security/
├── email-canonical.ts             # NUEVO: canonicalización + normalización
├── disposable-domains.ts          # NUEVO: blocklist estática
├── turnstile.ts                   # NUEVO: verifyTurnstile(token, ip)
├── rate-limit.ts                  # NUEVO: contador durable en BD
└── request-fingerprint.ts         # NUEVO: IP real + user-agent
src/features/billing/usage.ts      # NUEVO: topes de consumo (trial/sandbox/demo)
```

### Modelo de Datos (propuesto)

```sql
-- Contador de ratos/eventos durable y genérico (sustituye los Map en memoria).
create table public.rate_events (
  id          bigserial primary key,
  bucket      text        not null,   -- 'signup_ip' | 'demo_ip' | 'sandbox_org' ...
  key         text        not null,   -- ip / org_id / email canónico
  created_at  timestamptz not null default now()
);
create index on public.rate_events (bucket, key, created_at desc);
alter table public.rate_events enable row level security;  -- sin policies: solo service_role

-- Huella del alta + correo canónico (antiduplicado de trials).
alter table public.profiles add column if not exists email_canonical   text;
alter table public.profiles add column if not exists signup_ip         inet;
alter table public.profiles add column if not exists signup_user_agent text;
create unique index if not exists profiles_email_canonical_key
  on public.profiles (email_canonical) where email_canonical is not null;

-- Consumo de IA del trial (contador por org, no por hilo).
alter table public.organizations add column if not exists trial_ai_messages_used int not null default 0;
alter table public.organizations add column if not exists trial_ai_capped_at     timestamptz;

-- Org creada con rubro + huella del alta (v2; la v1 NO se dropea, ver Gotchas).
create or replace function public.create_organization_with_owner_v2(
  p_org_name text, p_owner_name text, p_business_type text, p_country text,
  p_city text, p_phone text, p_terms_version text,
  p_signup_ip text, p_user_agent text
) returns uuid ...  -- security definer, revoke anon, grant authenticated
```

Decisiones de diseño clave:

1. **El alta se mueve a servidor.** Un captcha o un rate limit verificados en el cliente no valen
   nada. La Server Action usa el cliente **anon** de servidor para `signUp` (no `service_role`
   `admin.createUser`), para que Supabase siga enviando el correo de verificación y NO se cree
   sesión antes de confirmar.
2. **Canonicalización solo donde es correcta.** `+etiqueta` se recorta en todos los dominios;
   los **puntos** solo se colapsan en dominios tipo Gmail (`gmail.com`, `googlemail.com`), donde
   son irrelevantes por diseño. En un dominio corporativo `a.b@empresa.com` y `ab@empresa.com`
   son personas distintas: colapsar ahí sería bloquear clientes legítimos.
3. **La blocklist de desechables es estática en el repo** (KISS, sin llamadas externas en el
   camino crítico del alta). Fácil de ampliar en un commit.
4. **Turnstile falla cerrado si está configurado**, y es no-op explícito solo si `TURNSTILE_SECRET_KEY`
   no existe (dev local). Nunca "si la verificación da error, pasa" — eso es exactamente la
   inversión de gate documentada en CLAUDE.md (2026-07-15).
5. **El gate de onboarding vive en `proxy.ts`**, no en el layout ni en `dashboard/page.tsx`: el
   proxy corre en cada request; los layouts no re-renderizan en navegación suave.
6. **Los topes se cuentan en BD**, nunca en memoria de proceso: Vercel es multi-instancia y
   efímero.

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 1: Cimientos antiabuso (BD + librerías)
**Objetivo**: migración con `rate_events`, columnas `email_canonical` / `signup_ip` /
`signup_user_agent` (+ backfill del canónico para las cuentas existentes) y contadores del trial;
más los módulos puros de `src/shared/security/` (canonicalización, desechables, rate limit durable,
huella de request, verificación de Turnstile) con sus tipos y constantes.
**Validación**: migración aplicada; `npm run typecheck` pasa; el backfill no viola el índice único
(si hubiera duplicados preexistentes, se resuelven antes de crearlo).

### Fase 2: Registro corto en servidor + Turnstile + verificación de correo
**Objetivo**: `signupSchema` reducido a `email` + `password` (≥8) + `acceptTerms`; Server Action de
alta que encadena Zod → Turnstile → rate limit IP → desechables → canónico duplicado → `signUp`
con `emailRedirectTo` a `/auth/confirm?next=/bienvenida`; formulario reescrito con widget Turnstile
y medidor de contraseña; `/auth/confirm` soporta `next`.
**Validación**: alta real en navegador; correo recibido; `curl` directo a la acción sin token de
Turnstile es rechazado; segundo alta con alias `+` del mismo Gmail rechazado; contraseña de 7
caracteres rechazada en cliente **y** en servidor.

### Fase 3: Asistente `/bienvenida` (2 pasos) + creación de la organización
**Objetivo**: ruta `/bienvenida` con wizard de 2 pasos; Server Action que sella IP/UA y llama a
`create_organization_with_owner_v2` (con `business_type`); gate en `proxy.ts` (autenticado sin
perfil → `/bienvenida`; con perfil en `/bienvenida` → `/dashboard`); retirada del safety-net de
`dashboard/page.tsx` y de los `pending_*` de `user_metadata`.
**Validación**: recorrido completo alta → correo → bienvenida → dashboard con el negocio creado;
`business_type` visible en `/dashboard/agente`; intentar `/dashboard/agenda` sin perfil redirige a
`/bienvenida` sin bucle; el gate se prueba **entrando con el navegador**, no solo por lectura de código.

### Fase 4: Topes de consumo (trial, sandbox, demo)
**Objetivo**: tope de mensajes de IA del trial aplicado dentro de `runAgent` (con mensaje de límite
y aviso + upsell en el dashboard); tope del sandbox por **org y día** en BD (inmune al botón de
reinicio); rate limit de `/api/demo-chat` migrado de `Map` en memoria a `rate_events`; todas las
constantes centralizadas junto a `TRIAL_DAYS` en `plans.ts`.
**Validación**: con el contador forzado al límite, el agente responde el texto de tope y **no**
llama a OpenRouter (verificable en logs); reiniciar el sandbox no devuelve mensajes; el tope de IP
de la demo persiste tras reiniciar el servidor.

### Fase 5: Validación final
**Objetivo**: sistema completo funcionando end-to-end en producción.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] E2E con navegador real: alta → verificación → bienvenida → dashboard → tope de sandbox
- [ ] Verificado que el alta antigua (usuarios ya existentes) sigue entrando sin tropezar con el gate
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Se rellena durante la implementación.

---

## Gotchas

- [ ] **NO dropear `create_organization_with_owner` (v1) sin buscar quién la llama POR SU NOMBRE.**
      Hoy la llaman `signup-form.tsx` y `dashboard/page.tsx`. Postgres no registra llamadas dentro
      de cuerpos `plpgsql` como dependencias: el `drop` saldría verde y rompería producción
      (aprendizaje 2026-07-23 de CLAUDE.md). Plan: crear `_v2`, repuntar todos los llamadores,
      y solo entonces plantearse retirar la v1 en una migración aparte.
- [ ] **`TRIAL_DAYS` está duplicado** en `plans.ts` y hardcodeado como `interval '10 days'` dentro
      del RPC. La v2 debe mantener el mismo valor y el comentario de sincronía.
- [ ] **Rate limit en memoria = falso rate limit** en Vercel: cada lambda tiene su `Map` y muere.
      Todo tope nuevo va a BD.
- [ ] **Un gate cuya consulta falla no debe abrir el paso.** Aplica a Turnstile, al gate de
      `/bienvenida` en el proxy y al tope del trial: si la comprobación revienta, se bloquea.
- [ ] **El proxy corre en cada request pero también en assets**: el gate de `/bienvenida` debe
      excluir `/api`, `/auth/confirm`, estáticos y las rutas públicas (`/c/`, `/r/`, `/invitacion`),
      o se romperán los enlaces mágicos de cita y las invitaciones de equipo.
- [ ] **Riesgo de bucle de redirección**: `/bienvenida` es ruta autenticada sin perfil; el gate debe
      permitirla explícitamente. El safety-net actual ya documenta este bucle (`dashboard/page.tsx`).
- [ ] **Read-after-write de Supabase**: tras el RPC de creación hay que **redirigir**, no re-consultar
      (una réplica puede no haber propagado). Patrón ya presente en `dashboard/page.tsx`.
- [ ] **Ajustes del panel de Supabase (fuera del repo)**: "Confirm email" debe estar ON y la longitud
      mínima de contraseña subida a 8. El código solo no lo garantiza.
- [ ] **Envs nuevas en Vercel**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`. Sin ellas
      el widget no aparece; documentarlo como acción pendiente del usuario.
- [ ] **Índice único sobre `email_canonical`**: si ya hay dos cuentas que colapsan al mismo canónico,
      la migración falla. Comprobar y decidir antes (probablemente dejar el índice y limpiar a mano).
- [ ] **Invitaciones de equipo**: un miembro invitado NO debe pasar por `/bienvenida` (no crea org).
      Revisar `src/app/invitacion` antes de tocar el proxy.
- [ ] Blocklist de desechables: mantenerla corta y de alta señal. Bloquear de más = perder clientes.
- [ ] **Los tiers de IA (`subscriptions.ai_tier` 300/1000/3000 "conversaciones/mes") se cobran pero
      NO se miden**: hoy `subHasAi()` solo comprueba `ai_tier !== 'none'`. Este PRP mete el contador
      del **trial**; el de los planes de pago queda fuera de alcance pero el contador debe diseñarse
      para poder extenderse a ellos sin rehacerlo.
- [ ] **La org demo de la landing** (`12974a7a-fb18-4713-9d2c-28c251b09312`, `trial_ends_at = 2099`)
      debe quedar **exenta** del tope de trial, o la demo pública se apagará sola.
- [ ] El gate de trial/suscripción **ya existe** en `proxy.ts` (vencido → `/dashboard/facturacion?bloqueado=1`).
      El nuevo gate de `/bienvenida` debe evaluarse **antes** que él y sin romperlo — es código de
      seguridad ya funcionando: revalidarlo entero tras tocarlo (aprendizaje 2026-07-15).

## Anti-Patrones

- NO validar Turnstile, rate limit ni dominios en el cliente: es decorado, no seguridad.
- NO usar `service_role` para crear el usuario del alta (saltaría la verificación de correo).
- NO contar topes en memoria de proceso.
- NO dejar los `pending_*` en `user_metadata` una vez exista `/bienvenida` (dos fuentes de verdad).
- NO crear nuevos patrones de gate: el sitio de los gates es `proxy.ts`.
- NO ignorar errores de TypeScript ni usar `any`.
- NO hardcodear los topes en las rutas: van en `plans.ts` junto a `TRIAL_DAYS`.

---

*PRP pendiente de aprobación. No se ha modificado código.*
