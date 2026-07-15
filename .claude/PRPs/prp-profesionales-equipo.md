# PRP: Profesionales/Recursos + Equipo y Roles

> **Estado**: APROBADO (2026-07-15, por Juan)
> **Fecha**: 2026-07-15
> **Decisiones confirmadas**: 4 roles planos (Dueño/Administrador/Recepción/Profesional), no matriz granular · "el que sea" = primer profesional libre, no reparto de carga
> **Proyecto**: ChatVenti
> **Origen**: `ROADMAP-PARIDAD-CITAFLOW.md` — prioridades 1 y 2 (se agrupan porque comparten modelo de datos)

---

## Objetivo

Dar a ChatVenti la **capa de gestión del negocio** que hoy no tiene: (a) una entidad **Profesional/Recurso desacoplada del login** con sus servicios y horario propio, usable por la agenda, la web pública y el agente IA; y (b) una página de **Equipo** para invitar personas por email y asignarles rol, delegando la operación sin dar las llaves del negocio.

## Por Qué

| Problema | Solución |
|----------|----------|
| Un peluquero/dentista **no puede existir en el sistema sin una cuenta de login** (`staff_id` → `profiles` → `auth.users`). Una peluquería de 4 sillas no puede modelarse. | Tabla `resources` propia, con vínculo **opcional** a `profiles` para quien sí necesite entrar al panel. |
| No hay UI para crear/gestionar profesionales ni para decir **qué servicios presta cada uno**. La disponibilidad se configura a mano contra usuarios con login. | Módulo "Profesionales" con alta, foto, servicios asignados y horario individual. |
| El cliente **no puede elegir profesional** al reservar (ni en `/r/[slug]` ni por chat). El agente IA es genérico por negocio e ignora agendas individuales. | Selección de profesional (o "el que sea") en web pública + tool del agente que respeta horario y servicios por profesional. |
| El dueño **no puede delegar**: no hay forma de invitar a una recepcionista. Los roles existen en el esquema (`owner/manager/staff`) y en RLS, pero solo se crea el `owner` en el registro. | Página "Equipo": invitar por email → rol → invitación pendiente; cambiar rol y desactivar desde la tabla de miembros. |
| El add-on `team_seats` ($19/mes) se **cobra pero no se usa**: no hay nada que consuma asientos. | Contador "X de N accesos en uso" ligado a `subscriptions.team_seats`, con gate al invitar. |

**Valor de negocio**:
- **Desbloquea el mercado real** (peluquerías, clínicas, barberías multi-silla). Hoy ChatVenti solo sirve a negocios de una sola persona/recurso — es el techo de ventas más duro que tenemos.
- **Activa el add-on `team_seats`** ($19/mes por asiento): ingreso incremental sobre el Starter de $29.
- Reduce churn: "delegar a mi asistente" es la razón nº1 por la que un dueño mantiene la herramienta.

## Qué

### Criterios de Éxito

**Fase A — Profesionales/Recursos**
- [ ] El dueño puede crear un profesional **sin crear una cuenta de usuario** y verlo listado en `/dashboard/profesionales`.
- [ ] A cada profesional se le asignan N servicios y un horario semanal por sucursal; `get_available_slots` **solo devuelve huecos de profesionales que prestan ese servicio**.
- [ ] En `/r/[slug]` el cliente elige profesional o "el que sea"; reservar con "el que sea" asigna un profesional libre real (no `NULL`).
- [ ] El agente IA ofrece elegir profesional cuando ≥2 lo prestan, y reserva respetando el horario individual.
- [ ] La etiqueta del módulo es configurable por vertical (Profesionales / Salas / Equipos / personalizada) y se refleja en el panel y en `/r/[slug]`.
- [ ] Las citas y horarios existentes siguen funcionando tras la migración (cero pérdida de datos).

**Fase B — Equipo y Roles**
- [ ] El dueño invita por email desde `/dashboard/equipo`; el invitado recibe correo, crea contraseña y entra **ya dentro de la org** con el rol asignado.
- [ ] Las invitaciones pendientes se listan, se pueden reenviar y revocar.
- [ ] Cambiar el rol de un miembro cambia lo que ve (verificable: `recepcion` no ve Facturación).
- [ ] Un miembro se puede desactivar y pierde el acceso.
- [ ] Se muestra "X de N accesos en uso" y **no se puede invitar** por encima de los asientos contratados (con `BILLING_ENFORCED=true`).
- [ ] Un profesional puede vincularse a un miembro del equipo (y viceversa) para que vea solo su propia agenda.

### Comportamiento Esperado (Happy Path)

**A. Alta de profesional**
1. Dueño → `/dashboard/profesionales` → "Añadir profesional".
2. Nombre, foto (opcional), sucursal, servicios que presta (multi-select del catálogo), horario semanal.
3. Guarda. Aparece en la agenda como columna/filtro y en `/r/[slug]` como opción.

**B. Reserva pública eligiendo profesional**
1. Cliente en `/r/[slug]` elige servicio → aparece "¿Con quién?" con las fotos + "El que sea".
2. Elige "Ana" → los horarios mostrados son los de Ana ∩ horario de sucursal, menos sus citas y ausencias.
3. Reserva → cita creada con `resource_id = Ana`. Con "El que sea" → se asigna el primer profesional libre en ese horario.

**C. Reserva por chat**
1. Cliente: "quiero corte el jueves". Agente: `check_availability(service_ids, date)` devuelve huecos **con el profesional de cada hueco**.
2. Si ≥2 profesionales prestan el servicio, el agente pregunta con quién **una sola vez** (o acepta "me da igual").
3. `book_appointment(service_ids, starts_at, resource_id?)` → confirmación estructurada incluye "Con: Ana".

**D. Invitar a la recepcionista**
1. Dueño → `/dashboard/equipo` → "Invitar" → email + rol `recepcion`.
2. Se crea `team_invitations(status='pending', token)` y sale correo con `/invitacion/[token]`.
3. La invitada abre el link, define contraseña, y `accept_team_invitation` crea su `profile` con `organization_id` + rol. Entra al dashboard sin Facturación ni Conexiones.

---

## Contexto

### Referencias (código real leído)

| Archivo | Por qué importa |
|---|---|
| `supabase/migrations/20260702000000_fase0_baseline.sql` | `profiles` (roles `super_admin/owner/manager/staff`), helpers `get_my_org()/get_my_role()/get_my_branch()`, patrón RLS `select` + `write` por rol, `create_organization_with_owner` (patrón de RPC transaccional de onboarding). |
| `supabase/migrations/20260704000100_fase2_agenda_rpcs.sql` | **Núcleo a modificar**: `get_available_slots`, `create_appointment`, `create_appointment_from_chat`, `reschedule_appointment`, `set_appointment_status`, guard `assert_org_access`, advisory lock `hashtext(branch||staff)`, patrón de GRANTS. |
| `supabase/migrations/20260704030000_fase4_fix_slots_staffless.sql` | Versión vigente de `get_available_slots`: cita con `staff_id IS NULL` bloquea toda la sucursal. Esta semántica **cambia** al haber recursos reales. |
| `supabase/migrations/20260704020000_fase4_reservas_web.sql` | `get_public_booking_context(slug)` y `create_public_appointment(...)` — RPCs anónimas de la web pública. Ambas deben exponer/aceptar profesional. |
| `supabase/migrations/20260704010000_fase3_ai_agent.sql` + `20260709000000_ola1_chat_actions.sql` + `20260710040000_ola3_fase_d_agent_products.sql` | `get_agent_context` (evolucionada 3 veces con `create or replace`) — hay que añadirle `resources`. |
| `src/features/agenda/{services,types,actions}.ts` | `getStaff()` lee `profiles`; `Slot = {slot_start, slot_end, staff_id}`; schemas Zod (`createAppointmentSchema.staffId`, `staffScheduleSchema`). |
| `src/features/agenda/components/config/staff-availability.tsx` | UI actual de disponibilidad — se sustituye por la del profesional. |
| `src/features/agente-ia/agent.ts` | Tools `check_availability` / `book_appointment` / `reschedule_appointment`, `buildSystemPrompt`, `buildConfirmation`, marca `[slot:<iso>]`. |
| `src/app/r/[slug]/page.tsx` + `src/features/reservas-web/components/public-booking.tsx` | Web pública de reservas. |
| `src/shared/components/dashboard-nav.tsx` | `PRIMARY` (4) + `SECONDARY` (4). Aquí entran "Profesionales" y "Equipo". |
| `src/features/billing/{gating,plans}.ts` | `subIsActive`, `isBillingEnforced()`, `ADDON_TEAM_USD = 19`, `subscriptions.team_seats`. |
| `src/features/emails/{mailer,templates}.ts` | `sendEmail({to,subject,html})` (nodemailer/SMTP Hostinger, **no Resend**) + factory de plantillas `Built`. La invitación sigue este patrón. |
| `src/features/admin/service.ts`, `20260713020000_admin_panel_rpcs.sql` | Patrón de RPCs privilegiadas + service client. |

### Estado actual del modelo (verificado en la BD de producción)

```
profiles(id → auth.users, role, organization_id, assigned_branch_id, is_active)
staff_schedules(branch_id, staff_id → profiles, weekday, start_time, end_time)   -- 16 filas
staff_time_off(staff_id → profiles, starts_at, ends_at)                           -- 0 filas
appointments(..., staff_id → profiles NULLABLE, branch_id, status, source)        -- 2 filas
service_catalogs(organization_id, name, duration_minutes, price, active)          -- 9 filas
```

**El problema en una línea**: `staff_id` apunta a `profiles`, y `profiles.id` es FK de `auth.users` → **todo profesional exige una cuenta de login**.

### Arquitectura Propuesta

**Decisión 1 — `resources` nueva + `staff_id` → `resource_id` vía expand/contract.**
No se "recicla" `profiles`: un profesional no es un usuario. `resources.profile_id` es un vínculo **opcional** (la recepcionista que además atiende).

**REVISADO 2026-07-15 (Juan)**: el rename directo NO es viable. La BD del MCP **es producción** (chatventi.com en vivo, sin staging: no hay `supabase/config.toml`, `list_branches` vacío, ramas requieren Pro que está diferido). El código desplegado hace `.select('staff_id')` y llama `p_staff_id` (`agenda/actions.ts:46,92,113,235` + 5 componentes). Renombrar rompe agenda + `/r/[slug]` + chat desde el instante de la migración hasta el deploy de las Fases 2–5 — días de caída con el App Review de Meta pendiente.

**Migración en dos tiempos (expand/contract)**:
- **Expand (Fase 1)**: solo aditivo. Tablas nuevas + `resource_id` **junto a** `staff_id` (backfilleado) + RPCs nuevas con sufijo, **sin tocar las viejas**. Producción sigue viva con el código actual.
- **Contract (Fase 7)**: tras desplegar las Fases 2–5, se borra `staff_id` y las RPCs viejas.

**Por qué es seguro convivir**: un `resource` solo puede crearse desde la UI de la Fase 3, que llega con el código nuevo. Durante la ventana, **ninguna org tiene recursos** → la rama "org sin recursos" conserva la semántica actual exacta → el código viejo y el esquema nuevo no divergen. Las 2 citas actuales tienen `staff_id` NULL y `staff_time_off` está vacía, así que el único backfill real son los 16 horarios de 4 profiles.

**Decisión 2 — `resource_id NULL` deja de bloquear la sucursal entera.**
Hoy una cita sin staff bloquea todo (fix de Fase 4). Con recursos reales, esa semántica solo debe aplicar a las orgs **sin ningún recurso configurado** (negocio de una sola persona — el caso actual y el default tras el registro). Con ≥1 recurso, el no-solapamiento pasa a ser **por recurso** y la reserva "el que sea" resuelve a un recurso concreto en el momento de crear. Esta bifurcación es el punto de mayor riesgo del PRP.

**Decisión 3 — Roles: 4 planos, sin matriz de permisos.**
Se mapean sobre los existentes para no tocar las políticas RLS ya desplegadas:

| Rol UI | Valor en `profiles.role` | Ve |
|---|---|---|
| Dueño | `owner` | Todo, incl. Facturación y Conexiones |
| Administrador | `manager` | Todo menos Facturación |
| Recepción | `staff` + `resource_scope='all'` | Agenda, Chats, Clientes |
| Profesional | `staff` + `resource_scope='own'` | Solo su propia agenda |

`super_admin` queda intacto (es de ChatVenti, no del tenant). La matriz granular 7×N de CitaFlow se descarta explícitamente (YAGNI).

**Decisión 4 — Invitaciones propias, no `inviteUserByEmail` de Supabase.**
El proyecto ya tiene mailer SMTP + patrón de token público (`appointments.manage_token`, `/c/[token]`). Una tabla `team_invitations` con token da control del rol, del reenvío/revocado, del gate de asientos y del copy en español.

```
src/features/profesionales/            # NUEVO
├── components/{resource-list,resource-form,resource-schedule,resource-services}.tsx
├── actions.ts        # CRUD + horario + servicios (Server Actions + Zod)
├── services.ts       # lecturas por RLS
└── types.ts

src/features/equipo/                   # NUEVO
├── components/{member-list,invite-form,pending-invitations,role-badge}.tsx
├── actions.ts        # invitar / revocar / reenviar / cambiar rol / desactivar
├── services.ts
└── types.ts

src/app/(main)/dashboard/profesionales/page.tsx     # NUEVO
src/app/(main)/dashboard/equipo/page.tsx            # NUEVO
src/app/invitacion/[token]/page.tsx                 # NUEVO (público, patrón /c/[token])

# Modificados
src/features/agenda/{services,types,actions}.ts
src/features/agenda/components/config/staff-availability.tsx  → se retira
src/features/agente-ia/agent.ts
src/features/reservas-web/components/public-booking.tsx
src/app/r/[slug]/page.tsx
src/shared/components/dashboard-nav.tsx
src/lib/supabase/database.types.ts    # regenerar
```

### Modelo de Datos

```sql
-- 1. RECURSOS (profesional / sala / equipo) — desacoplado del login
create table public.resources (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  profile_id      uuid references public.profiles(id) on delete set null,  -- OPCIONAL
  name            text not null,
  photo_url       text,
  active          boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index resources_org_idx on public.resources(organization_id);
create unique index resources_profile_uniq on public.resources(profile_id)
  where profile_id is not null;   -- un profile = máx un recurso

-- 2. QUÉ SERVICIOS PRESTA CADA RECURSO
create table public.resource_services (
  resource_id uuid not null references public.resources(id) on delete cascade,
  service_id  uuid not null references public.service_catalogs(id) on delete cascade,
  primary key (resource_id, service_id)
);

-- 3. INVITACIONES DE EQUIPO
create table public.team_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null,
  role            text not null check (role in ('owner','manager','staff')),
  resource_scope  text not null default 'all' check (resource_scope in ('all','own')),
  resource_id     uuid references public.resources(id) on delete set null,
  token           uuid not null unique default gen_random_uuid(),
  invited_by      uuid references public.profiles(id) on delete set null,
  status          text not null default 'pending'
                    check (status in ('pending','accepted','revoked','expired')),
  expires_at      timestamptz not null default now() + interval '7 days',
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz
);
create unique index team_invitations_pending_uniq
  on public.team_invitations(organization_id, lower(email)) where status = 'pending';

-- 4. ALCANCE DEL ROL (sobre profiles, sin tocar el check de role)
alter table public.profiles
  add column resource_scope text not null default 'all'
    check (resource_scope in ('all','own'));

-- 5. MIGRACIÓN staff → resource — EXPAND (Fase 1, aditivo: staff_id se conserva)
--    a) un resource por cada profile con horario o citas (4 profiles → 4 resources)
--    b) columna nueva junto a la vieja + FK → resources + backfill
alter table public.staff_schedules add column resource_id uuid references public.resources(id) on delete cascade;
alter table public.staff_time_off  add column resource_id uuid references public.resources(id) on delete cascade;
alter table public.appointments    add column resource_id uuid references public.resources(id) on delete set null;
-- backfill: resource_id := el resource cuyo profile_id = staff_id
-- CONTRACT (Fase 7, tras el deploy): drop column staff_id en las tres tablas.

-- RLS: mismo patrón que products/service_catalogs
alter table public.resources         enable row level security;
alter table public.resource_services enable row level security;
alter table public.team_invitations  enable row level security;

create policy resource_select on public.resources for select
  using (organization_id = public.get_my_org() or public.get_my_role() = 'super_admin');
create policy resource_write on public.resources for all
  using ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager'))
         or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() in ('owner','manager'))
         or public.get_my_role() = 'super_admin');

-- team_invitations: SOLO owner (invitar es dar llaves del negocio)
create policy invitation_rw on public.team_invitations for all
  using ((organization_id = public.get_my_org() and public.get_my_role() = 'owner')
         or public.get_my_role() = 'super_admin')
  with check ((organization_id = public.get_my_org() and public.get_my_role() = 'owner')
         or public.get_my_role() = 'super_admin');
```

**RPCs nuevas / modificadas**

> **Convivencia (expand/contract)**: las RPCs de agenda **no se modifican in-place**. Postgres identifica una función por nombre + **tipos** de argumentos, así que `get_available_slots(p_staff_id uuid, …)` y `get_available_slots(p_resource_id uuid, …)` son la misma firma con distinto nombre de parámetro → `create or replace` falla con *"cannot change name of input parameter"*. Por tanto la Fase 2 **crea funciones nuevas con sufijo `_v2`** (`get_available_slots_v2`, `create_appointment_v2`, …) y **deja intactas las viejas**, que son las que sirve producción hasta el deploy.
>
> El sufijo `_v2` se queda como **nombre definitivo**. Renombrarlas a su nombre canónico en la Fase 7 exigiría dropear la vieja y renombrar en una ventana coordinada con el deploy — es decir, reintroducir en pequeño justo el riesgo que expand/contract elimina, a cambio de estética. No vale la pena.

| RPC | Cambio | Grants |
|---|---|---|
| `get_available_slots` | `p_staff_id` → `p_resource_id`; cruza `resource_services` (solo recursos que prestan TODOS los servicios pedidos); org sin recursos → comportamiento actual | anon, authenticated |
| `create_appointment` | `p_staff_id` → `p_resource_id`; si NULL y la org tiene recursos → elige el primer libre dentro del lock | authenticated |
| `create_appointment_from_chat` | + `p_resource_id` | anon, authenticated |
| `create_public_appointment` | + `p_resource_id` | anon, authenticated |
| `reschedule_appointment` | `p_new_staff_id` → `p_new_resource_id` | authenticated |
| `get_public_booking_context` | + `resources[]` (id, name, photo_url, service_ids) + `branding.resource_label` | anon, authenticated |
| `get_agent_context` | + `resources[]`; `upcoming_appointments[].resource_name` | anon, authenticated |
| `create_team_invitation(email, role, scope, resource_id)` | NUEVA. Valida owner + asientos disponibles. Devuelve token | authenticated |
| `accept_team_invitation(p_token)` | NUEVA. `SECURITY DEFINER`. Crea el `profile` del `auth.uid()` recién registrado con org+rol de la invitación. Valida `expires_at`/`status` | authenticated |
| `get_invitation_preview(p_token)` | NUEVA. Datos públicos para la landing de invitación (nombre de la org, email, rol) | anon, authenticated |
| `org_seats_used(p_org)` | NUEVA. Cuenta `profiles` activos + invitaciones pendientes | authenticated |

**Etiqueta por vertical**: `organizations.branding.resource_label` (jsonb ya existente) — sin columna nueva. Default `"Profesionales"`.

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (mapear contexto → subtareas → ejecutar).
> **Orden no negociable**: la Fase 1 es una migración con backfill; nada de UI antes de que la BD esté sana.

### Fase 1: Modelo de datos — EXPAND (aditivo, no rompe producción)
**Objetivo**: `resources` + `resource_services` + `team_invitations` existen con RLS; `staff_schedules`/`staff_time_off`/`appointments` ganan `resource_id` **junto a** `staff_id` (que se conserva); los 16 horarios se backfillean a 4 recursos.
**Regla dura**: cero cambios destructivos. Nada de `rename`, `drop column` ni `drop function` en esta fase — producción corre contra este esquema con el código actual.
**Validación**:
- Migración aplicada; `list_tables` muestra `resource_id` nuevo y `staff_id` intacto.
- Toda fila con `resource_id` no nulo resuelve a un `resources` de la misma org (0 huérfanos).
- `staff_schedules`: las 16 filas tienen `resource_id` poblado y coherente con su `staff_id`.
- **No regresión**: `get_available_slots` (versión vieja, la que usa prod) devuelve lo mismo que antes de la migración.
- `get_advisors` sin nuevas alertas de RLS.
- `npm run typecheck` pasa con `database.types.ts` regenerado.

### Fase 2: RPCs de agenda conscientes del recurso
**Objetivo**: `get_available_slots`, `create_appointment`, `reschedule_appointment` y las variantes `_from_chat`/`_public` operan por recurso, filtran por `resource_services`, resuelven "el que sea" dentro del advisory lock, y conservan el fallback de org sin recursos.
**Validación**:
- SQL de prueba: 2 recursos, 1 servicio que solo presta uno → `get_available_slots` solo devuelve huecos de ese.
- Doble reserva concurrente del mismo recurso/horario → una falla con `slot_taken`.
- Reserva con `p_resource_id = NULL` en org con recursos → cita con `resource_id` asignado (no NULL).
- Org sin recursos (caso actual) → mismos resultados que hoy (no regresión).

### Fase 3: UI de Profesionales
**Objetivo**: `/dashboard/profesionales` con CRUD, foto, servicios por profesional, horario semanal y etiqueta por vertical. La agenda muestra/filtra por profesional. `staff-availability.tsx` se retira.
**Validación**:
- Alta de profesional sin login → aparece en la lista y en el selector de la agenda.
- Asignar servicios y horario → se refleja en los huecos de la agenda.
- Playwright: screenshot de la lista, el formulario y la agenda filtrada.

### Fase 4: Selección de profesional en web pública + agente IA
**Objetivo**: `/r/[slug]` ofrece profesional o "el que sea"; el agente IA ofrece elegir cuando hay ≥2 y respeta horarios individuales; las confirmaciones nombran al profesional.
**Validación**:
- Playwright en `/r/[slug]`: elegir "Ana" → horarios de Ana → reserva → cita con `resource_id` de Ana.
- Reserva "el que sea" → asigna un profesional libre real.
- Prueba de chat (widget web): el agente pregunta "¿con quién?" una sola vez y reserva; la confirmación incluye el nombre.

### Fase 5: Equipo — invitaciones y roles
**Objetivo**: `/dashboard/equipo` con tabla de miembros, invitar por email (rol + alcance), pendientes con reenviar/revocar, cambiar rol, desactivar. `/invitacion/[token]` completa el alta. Contador de asientos con gate por `team_seats`.
**Validación**:
- Invitar a un email real → llega el correo → aceptar → `profile` creado con la org y el rol correctos.
- Invitación expirada/revocada/reusada → rechazada con mensaje claro.
- Con `BILLING_ENFORCED=true` y asientos agotados → invitar bloqueado con CTA a Facturación.
- Playwright: la nav de un `staff` no muestra Facturación.

### Fase 6: Validación Final (pre-deploy)
**Objetivo**: Sistema end-to-end en un negocio multi-profesional real.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run lint` pasa
- [ ] `npm run build` exitoso
- [ ] `get_advisors` (security + performance) sin nuevas alertas
- [ ] Recorrido completo: alta de 2 profesionales → reserva web con elección → reserva por chat con "el que sea" → invitar recepcionista → la recepcionista ve la agenda de ambos
- [ ] La org de prueba existente (sin recursos) sigue reservando igual que antes
- [ ] Todos los criterios de éxito cumplidos

### Fase 7: CONTRACT — retirar el camino viejo
**Objetivo**: eliminar la deuda de la convivencia una vez que el código nuevo está **desplegado y verificado en producción**.
**Precondición no negociable**: Fases 2–5 en `main`, deploy de Vercel verde, y humo manual OK en chatventi.com. Esta fase NO se ejecuta el mismo día que el deploy.
**Trabajo**:
- `drop` de las RPCs viejas (`get_available_slots(p_staff_id...)`, `create_appointment(p_staff_id...)`, `reschedule_appointment(p_new_staff_id...)` y variantes `_from_chat`/`_public` viejas).
- `alter table ... drop column staff_id` en `staff_schedules`, `staff_time_off`, `appointments`.
- Regenerar `database.types.ts`.
**Validación**:
- `grep staff_id src/` = 0 resultados (salvo `database.types.ts` ya regenerado).
- Reserva end-to-end sigue funcionando tras el drop.
- `get_advisors` limpio.
**Riesgo si se olvida**: el esquema queda con dos columnas para siempre y el próximo que lea `appointments` no sabrá cuál manda. Si esta fase se pospone, dejarlo escrito en la memoria del proyecto, no en la cabeza de nadie.

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece durante la implementación. El mismo error NUNCA ocurre dos veces.

### 2026-07-15: La BD del MCP de Supabase ES producción — no hay staging
- **Error**: el PRP planificó un `rename column staff_id → resource_id` en la Fase 1 como si la BD fuera un entorno de desarrollo. No lo es: el MCP apunta al único proyecto Supabase, el mismo que sirve a chatventi.com en vivo. Aplicarlo habría roto la agenda, `/r/[slug]` y el booking por chat desde el instante de la migración hasta el deploy de las Fases 2–5 (días), con el App Review de Meta pendiente.
- **Detección**: al mapear contexto de la Fase 1 — `list_migrations` mostró las 26 migraciones del producto vivo, `list_branches` vacío, no existe `supabase/config.toml`, y `grep staff_id src/` dio 8 archivos desplegados.
- **Fix**: migración en dos tiempos (expand/contract). Fase 1 solo aditiva; Fase 7 borra el camino viejo tras el deploy verificado.
- **Regla general**: **toda migración destructiva (`rename`/`drop column`/`drop function`) sobre una tabla o RPC que el código desplegado usa, exige expand/contract** mientras no haya staging. El esquema viejo debe seguir sirviendo al código viejo hasta que el nuevo esté en producción.
- **Aplicar en**: cualquier PRP futuro que toque el esquema. Verificar SIEMPRE antes de planificar una migración: ¿esta BD es producción? ¿el código vivo usa lo que voy a renombrar?

### 2026-07-15: `min(uuid)` no existe en Postgres
- **Error**: el backfill usaba `min(s.branch_id)` para elegir sucursal → `ERROR 42883: function min(uuid) does not exist`. Postgres no define orden agregable para `uuid`.
- **Fix**: `(array_agg(s.branch_id))[1]`. Equivalente aquí porque cada profile tiene una sola sucursal (verificado antes con una query, no asumido).
- **Aplicar en**: cualquier agregación sobre uuid. Alternativas: `min(x::text)::uuid` si de verdad hace falta ordenar.

### 2026-07-15: una función de TRIGGER `SECURITY DEFINER` queda expuesta como RPC
- **Error**: `tr_sync_resource_from_staff()` disparó dos alertas nuevas del linter (0028/0029): PostgREST expone **toda** función de `public` en `/rest/v1/rpc/<nombre>`, incluidas las de trigger, y `anon` podía invocarla.
- **Detección**: `get_advisors` tras la migración (el PRP exige "sin nuevas alertas" — por eso se detectó en el momento y no meses después).
- **Fix**: `revoke execute on function ... from anon, authenticated, public`. Un trigger NO necesita `EXECUTE` de ningún rol: Postgres lo invoca como dueño de la tabla. Verificado: el trigger sigue funcionando tras el revoke.
- **Aplicar en**: TODA función nueva en `public`, incluidas las de trigger. Es el patrón que ya establecía `fase0_harden_function_grants.sql` — extenderlo, no reinventarlo.

### 2026-07-15: `database.types.ts` llevaba meses desincronizado de la BD
- **Error**: el archivo en repo NO tenía `appointments.manage_token`, `confirmed_by_client_at` ni `profiles.terms_version/terms_accepted_at` — columnas vivas desde la ola 2 y desde `terms_acceptance`. El gotcha del PRP avisaba ("o el typecheck mentirá") y de hecho ya mentía.
- **Por qué no explotó**: esos campos se leen vía RPCs que devuelven `Json`, no por `select` tipado sobre la tabla. El drift era silencioso.
- **Fix**: regenerar el archivo completo (no editar quirúrgicamente) al aplicar la migración de la Fase 1. `npm run typecheck` pasa con los tipos frescos.
- **Aplicar en**: regenerar SIEMPRE tras `apply_migration`, en la misma tanda. No hay script `gen:types` en `package.json` — **candidato a añadirlo** para que esto no dependa de la disciplina de nadie.

### 2026-07-15: `staff_schedules.staff_id` era NOT NULL — bloqueaba el objetivo del PRP
- **Error**: `staff_schedules.staff_id` y `staff_time_off.staff_id` son `not null` desde `fase2_agenda_schema.sql`. Con eso, **un profesional sin cuenta de login NO puede tener horario** — exactamente lo que este PRP existe para resolver. Ni la Fase 1 ni el PRP original lo detectaron: el modelo de datos del PRP solo hablaba de añadir `resource_id`.
- **Detección**: al escribir la prueba funcional de la Fase 2 (el primer `insert` de un horario con `resource_id` y sin `staff_id` habría reventado). La prueba encontró el fallo antes que la UI de la Fase 3.
- **Fix**: `alter column staff_id drop not null` en ambas tablas + check `staff_id is not null or resource_id is not null`. Es una relajación → compatible con expand/contract (el código desplegado siempre envía `staff_id`).
- **Aplicar en**: al planificar una entidad que sustituye a otra, revisar **las restricciones NOT NULL de las FKs viejas**, no solo las columnas. Y escribir la prueba funcional ANTES de la UI: es más barata y encuentra lo mismo.

### 2026-07-15: un recurso SIN `resource_services` debe prestar TODOS los servicios
- **Error potencial (evitado)**: filtrar estrictamente por `resource_services` habría devuelto **cero huecos** para las 4 orgs en producción, porque los 4 recursos backfilleados en la Fase 1 no tienen ninguna fila en esa tabla. Al desplegar, las 4 orgs se habrían quedado sin agenda.
- **Fix**: regla explícita "sin servicios configurados = presta todo" (`not exists (...) or not exists (...)`). Verificado: la `_v2` devuelve exactamente los mismos 270 huecos que la vieja sobre los datos reales.
- **Consecuencia a tener presente en la Fase 3**: la regla implica que no basta con configurar los servicios de UN profesional para restringirlo — mientras otro siga sin configurar, ese otro seguirá ofreciéndose para todo. La UI debe dejarlo claro (mostrar "todos los servicios" cuando no hay config).

### 2026-07-15: el fallback "org sin recursos" era menos arriesgado de lo que decía el PRP
- **Hallazgo**: la Decisión 2 marcaba esta bifurcación como "el punto de mayor riesgo del PRP". Al mapear resultó casi vacía para los huecos: `get_available_slots` parte de `staff_schedules`, y **una org sin horarios ya no devolvía huecos**. Como toda org con horarios recibió recursos en el backfill, "org sin recursos" ≡ "org sin horarios" ≡ "sin huecos". No hubo que bifurcar nada en `get_available_slots_v2`.
- Donde SÍ importa es en `create_appointment_v2`, que no consulta horarios: con `v_resource` NULL conserva la exclusividad de sucursal de hoy (`v_resource is null or ...`).
- **Aplicar en**: no dar por buena la evaluación de riesgo de un PRP escrito antes de mapear. El riesgo real estaba en otro sitio (el NOT NULL y la regla de `resource_services`).

### 2026-07-15: la `create_appointment` vieja tenía una asimetría con `get_available_slots`
- **Hallazgo**: con `p_staff_id` informado, la vieja `create_appointment` comprobaba `a.staff_id = p_staff_id`, así que **una cita sin staff NO bloqueaba** la reserva; en cambio `get_available_slots` sí ocultaba ese hueco (`or a.staff_id is null`). Incoherencia preexistente, poco visible porque el hueco no se ofrecía.
- **Fix**: `create_appointment_v2` usa `(v_resource is null or a.resource_id = v_resource or a.resource_id is null)`, coherente con los huecos y conservador con las citas heredadas.

### 2026-07-15: `saveWebConfig` REEMPLAZA el jsonb `branding` entero
- **Error potencial (evitado)**: el PRP decide guardar la etiqueta del vertical en `organizations.branding.resource_label` "sin columna nueva". Pero `saveWebConfig` (`reservas-web/actions.ts`) construye un objeto `branding` **desde cero** y lo escribe: guardar la config de Reservas Web habría **borrado `resource_label`** silenciosamente.
- **Fix**: leer el `branding` actual y hacer merge (`{...current, ...cambios}`) en **ambos** escritores (`saveWebConfig` y `saveResourceLabel`).
- **Aplicar en**: cualquier columna jsonb compartida por varias pantallas. Un `update` de jsonb es un **reemplazo**, no un merge. Antes de meter una clave nueva en un jsonb existente, buscar TODOS los sitios que lo escriben.

### 2026-07-15: con varios profesionales, un mismo instante devuelve N huecos
- **Error potencial (evitado)**: el gotcha del PRP lo advertía para la marca `[slot:<iso>]` del agente (Fase 4), pero aplica igual al **panel**: `get_available_slots_v2` devuelve una fila por profesional libre, así que el diálogo de nueva cita habría pintado la misma hora repetida N veces, y `setPickedSlot(slot_start)` no sabría con quién reservar.
- **Fix**: con "El que sea" seleccionado, deduplicar por `slot_start` y enviar `resourceId: null` — el motor resuelve a quién asignar dentro del lock. Con un profesional concreto, los huecos ya vienen filtrados.
- **Aplicar en**: cualquier consumidor de `get_available_slots_v2`. El hueco ya NO es único por instante: la clave es `(slot_start, resource_id)`.

### 2026-07-15: verificar la CAPACIDAD antes de declararla ausente (Playwright SÍ está)
- **Error MÍO (corregido por Juan)**: afirmé "no hay Playwright instalado" tras mirar `package.json` y no encontrar carpeta de tests. **Falso**. El **MCP de Playwright está conectado** y ofrece un navegador real (`mcp__playwright__browser_navigate/click/snapshot/...`). CLAUDE.md lo documenta y yo lo ignoré.
- **Qué es cierto**: no hay `playwright` como dependencia del proyecto ni arnés de tests en repo. **Es irrelevante**: el MCP no lo necesita.
- **Por qué falló mi razonamiento**: comprobé el *artefacto equivocado* (dependencia del repo) para una capacidad que vive en las **herramientas de la sesión**, y convertí una ausencia local en una conclusión global. Peor: lo escribí como "aprendizaje", que es como se fosiliza un error.
- **Aplicar en**: antes de decir "no existe X", mirar la lista de herramientas disponibles, no solo el repo. Y ante la duda, **intentarlo** (cargar la tool y usarla) en vez de deducirlo. Un `grep` que no encuentra algo prueba que no está *ahí*, no que no exista.
- **Complemento válido**: probar el contrato por SQL suplantando roles (`set local role authenticated` + `request.jwt.claims`) sigue siendo una gran validación de RLS — más determinista que un screenshot. Pero es un COMPLEMENTO del navegador, no su sustituto.

### 2026-07-15: el gotcha de `get_agent_context` era REAL (confirmado)
- **Confirmado al volcarla**: la definición viva en la BD contiene `products`, `knowledge` y `upcoming_appointments` que **no** están completos en `20260710040000_ola3_fase_d_agent_products.sql`. Reescribirla partiendo del repo habría borrado esas tres claves y dejado al agente sin memoria de citas ni catálogo de productos.
- **Regla**: para CUALQUIER función reemplazada con `create or replace` más de una vez, `pg_get_functiondef` es la única fuente de verdad. El repo miente.

### 2026-07-15: `create or replace` SÍ conserva los grants si la firma no cambia
- **Matiz importante frente al gotcha del PRP**: el PRP avisaba "create or replace no conserva los GRANTS si cambia la firma". Cierto, pero la consecuencia práctica es la contraria de lo que parecía: si la firma **no** cambia, el replace **conserva la ACL** y el cambio es 100% seguro.
- Por eso `get_public_booking_context` y `get_agent_context` se reemplazaron **en sitio** (solo añaden claves al jsonb; el código viejo las ignora) en lugar de crear `_v2`. Verificado tras aplicar: ambas siguen con `anon+authenticated`.
- **Regla**: `_v2` solo cuando cambia la firma. Añadir claves a un jsonb de retorno es aditivo y compatible con expand/contract.

### 2026-07-15: leer `appointments` desde el agente NO funciona (el webhook es anon)
- **Error mío (detectado antes de terminar)**: escribí `fetchResourceName` leyendo `appointments` con el cliente del agente. En el webhook ese cliente es **anon**, y la RLS de `appointments` exige `get_my_org()`, que para anon es null → habría devuelto `null` **en silencio** y la confirmación de WhatsApp jamás habría dicho "Con Ana". Sin error, sin log: el peor tipo de fallo.
- **Fix**: usar `createServiceClient()` (el patrón que ya usa el gate de billing en ese mismo archivo, con el comentario "el webhook es anon"), envuelto en try/catch: un nombre cosmético jamás debe tumbar una reserva.
- **Aplicar en**: TODA lectura nueva desde `agent.ts`. El gotcha del PRP lo decía y aun así caí: el código de un webhook anon *parece* normal. Antes de añadir un `.from(...)` ahí, preguntarse **como qué rol corre esto**.

### 2026-07-15: `BILLING_ENFORCED` es una env var de Node, NO un GUC de Postgres
- **Error mío**: escribí el gate de asientos con `current_setting('app.billing_enforced', true) = 'true'` dentro de `create_team_invitation`. Ese GUC no lo fija nadie → `current_setting` devuelve null → **el gate jamás se habría aplicado**, en silencio. Un límite de facturación que no limita es peor que no tenerlo: se factura de menos y nadie se entera.
- **Fix**: pasar `p_enforce_seats boolean` desde la Server Action, que sí lee `isBillingEnforced()`. Se mantiene la comprobación **dentro de la transacción** que inserta (sin ventana de carrera entre "compruebo asientos" e "inserto invitación").
- **Aplicar en**: las banderas de entorno de la app **no** existen dentro de Postgres. Si una RPC necesita una, se le pasa como parámetro (o se usa un GUC fijado explícitamente por sesión, que aquí no aplica: PostgREST no lo hace).

### 2026-07-15: el gate de rol podía crear un bucle infinito de redirecciones
- **Error potencial (evitado)**: el gate de trial manda a CUALQUIER usuario sin acceso a `/dashboard/facturacion`. Si el gate de rol nuevo bloquea Facturación a los no-dueños, un `staff` con la prueba vencida entraría en bucle: facturación → (rol) → dashboard → (trial) → facturación → ...
- **Fix**: el gate de rol solo se aplica **cuando la org tiene acceso**. Sin acceso, todos aterrizan en Facturación y el no-dueño ve la pantalla de bloqueo (que le explica por qué no puede entrar) en vez de rebotar.
- **Aplicar en**: al añadir un redirect en el proxy, listar los redirects que YA existen y comprobar que no se cruzan. Dos guardas correctas por separado pueden componer un bucle.

### 2026-07-15: los tipos de las RPCs nuevas hay que añadirlos a mano (y el typecheck lo caza)
- `supabase.rpc('nombre_nuevo')` **no compila** hasta que la función está en `database.types.ts`: TypeScript acota el nombre a una unión literal. Los 9 errores de typecheck de la Fase 5 eran exactamente eso.
- Es la cara buena del gotcha de los tipos: aquí el typecheck **no mintió**, avisó. Refuerza la conclusión de la Fase 1: falta un script `gen:types`.

### 2026-07-15: `.maybeSingle()` sobre `profiles` SIN `.eq('id', uid)` desactivó los gates del proxy
- **Error MÍO, el más grave de la ola.** En el proxy escribí `supabase.from('profiles').select('role').maybeSingle()`. Pero la policy `profile_select` es `(id = auth.uid() OR organization_id = get_my_org() OR ...)`: deja ver **todos los perfiles de la org**. Con 2+ miembros, `maybeSingle()` recibe N filas → devuelve **error**, `data = null` → `role = null` → **los dos gates de dentro se saltaron en silencio**.
- **Impacto real**: no solo el gate de rol nuevo (un `staff` entraba a Facturación). Al refactorizar metí el **gate de trial** dentro del mismo `if (role && ...)`, así que **cualquier org con más de un miembro habría burlado el bloqueo por prueba vencida**: un fallo de facturación introducido por mí, invisible hasta que la org tuviera equipo — justo lo que este PRP viene a habilitar.
- **Cómo se detectó**: NO por typecheck, NO por lint, NO por SQL. Solo apareció al entrar con el navegador como la usuaria invitada y pedir `/dashboard/facturacion` a mano. Todas las pruebas verdes y el producto roto. (Y yo había llegado a afirmar que no había Playwright — ver el aprendizaje de más arriba.)
- **Fix**: `.eq('id', user.id)` antes de `maybeSingle()`, como ya hacía `(main)/layout.tsx`.
- **Reglas que deja**:
  1. **`maybeSingle()`/`single()` exigen una cláusula que garantice ≤1 fila.** No basta con que "lógicamente sea una": la RLS decide cuántas filas ves, no tu intención.
  2. Un fallo de lectura que devuelve `null` **abre** la guarda en vez de cerrarla. Al escribir un gate, preguntarse: *si esta query falla, ¿qué pasa?* Si la respuesta es "pasa todo el mundo", el gate está al revés.
  3. **Refactorizar una guarda que ya funcionaba es cambiar código de seguridad.** El gate de trial llevaba meses bien; lo metí dentro de un `if` nuevo y lo rompí sin tocar su lógica.
- **Aplicar en**: todo `select` en el proxy y en cualquier guarda. Y validar SIEMPRE los gates con un usuario real del rol restringido, no razonando sobre el código.

---

## Gotchas

> Verificar ANTES de implementar. Extraídos del código real de este repo.

- [ ] **`get_available_slots` está definida DOS veces** (fase2 y el fix de fase4 con `create or replace`). La versión viva es la de `20260704030000_fase4_fix_slots_staffless.sql`. Partir de ESA, no de la de fase2.
- [ ] **`create or replace function` no conserva los GRANTS si cambia la firma**. Renombrar `p_staff_id` → `p_resource_id` **crea una función nueva** (Postgres identifica por nombre+tipos, pero los nombres de parámetros importan para las llamadas con `=>`). Hay que `drop function` la vieja y **re-emitir todos los GRANTS** siguiendo `_harden_function_grants` (revoke public → grant por rol). Un GRANT olvidado = webhook anon caído en producción.
- [ ] **El webhook corre como ANON**: cualquier lectura nueva que necesite el agente (recursos) va por RPC `SECURITY DEFINER` con grant a `anon`, nunca por RLS.
- [ ] **`assert_org_access` deja pasar a anon a propósito** (org resuelta por canal). Al añadir `p_resource_id` desde el chat hay que **validar que el recurso pertenece a la org resuelta**, o un atacante podría reservar contra recursos ajenos.
- [ ] **Advisory lock**: hoy es `hashtext(branch || coalesce(staff,'any'))`. Para "el que sea" con recursos hay que lockear a nivel **branch** (no por recurso) antes de elegir, o dos reservas concurrentes eligen el mismo profesional libre.
- [ ] **Semántica de `NULL`**: la cita sin staff bloquea hoy toda la sucursal (fix documentado de Fase 4). Al bifurcar por "org tiene recursos", la rama sin recursos DEBE conservar esa semántica exacta o se rompen las orgs en producción.
- [ ] **`get_agent_context` ya fue reemplazada 3 veces** (fase3 → ola1 → ola3) y la migración de ola3 **no contiene el cuerpo completo** (comenta que el cuerpo vivo está en la BD). Hay que **volcar la definición real desde Supabase** antes de tocarla, o se pierden `upcoming_appointments` y `products`.
- [ ] **Emails: es nodemailer/SMTP Hostinger, NO Resend** (el roadmap dice "Resend ya existe" — es incorrecto). Usar `sendEmail({to,subject,html})` de `src/features/emails/mailer.ts` y el factory `Built` de `templates.ts`. Si faltan las envs SMTP, `sendEmail` devuelve `false` sin romper: la invitación debe **mostrar el link para copiar** en ese caso.
- [ ] **`profiles` solo tiene `profile_update_self`**: no existe policy para que un `owner` actualice el rol de OTRO miembro. Cambiar rol y desactivar necesitan **policy nueva o RPC `SECURITY DEFINER`** (preferir RPC, más auditable).
- [ ] **`create_organization_with_owner` lanza `already_onboarded`** si ya existe el profile. `accept_team_invitation` es un camino distinto: crea el profile **sin** crear org. No reutilizar esa RPC.
- [ ] **El `super_admin` se redirige a `/admin`** en `(main)/layout.tsx` y no tiene org. No debe aparecer en el contador de asientos ni en la tabla de Equipo.
- [ ] **El gate de trial vive en el proxy/middleware**, no en los layouts (aprendizaje de `5e2ce80`: los layouts no re-renderizan en soft-nav). Cualquier gate de rol nuevo (ej. `staff` fuera de Facturación) va en el **proxy**, no en el layout.
- [ ] **Nav**: `PRIMARY` tiene 4 items y la bottom-nav móvil es `grid-cols-5` (4 + "Más"). Añadir "Profesionales"/"Equipo" a `SECONDARY`; NO tocar `PRIMARY` sin rehacer el grid.
- [ ] **Foto del profesional**: hoy el proyecto **no usa Supabase Storage para assets de UI** (`products.image_url` y `branding.logo_url` son URLs de texto). Para v1, seguir con URL de texto y dejar la subida real para la Fase 3 del roadmap (Branding) — o el PRP se contamina con el trabajo de Storage.
- [ ] **La marca `[slot:<iso>]`** del agente asume 1 hueco = 1 hora. Con varios profesionales, el mismo instante puede tener N huecos: la marca debe llevar también el recurso (`[slot:<iso>|<resource_id>]`) o el agente reservará con el profesional equivocado.
- [ ] **`database.types.ts` se regenera** tras cada migración (`generate_typescript_types`), o `Tables<'appointments'>` seguirá diciendo `staff_id` y el typecheck mentirá.
- [ ] **`resources_profile_uniq` es un índice parcial** (`where profile_id is not null`): sin el `where`, solo un recurso podría existir sin login.

## Anti-Patrones

- NO mantener `staff_id` y `resource_id` en paralelo **como estado final** — duplica la lógica de solapamiento y garantiza bugs de doble reserva. La convivencia de la Fase 1 es una **ventana de transición con fecha de caducidad** (Fase 7), no un modelo dual: `resource_id` es la única columna autoritativa para la lógica de solapamiento desde la Fase 2; `staff_id` solo sobrevive para que el código desplegado no se caiga, y nadie escribe lógica nueva contra ella.
- NO construir la matriz de permisos 7×N de CitaFlow (YAGNI). 4 roles planos cubren el 95%.
- NO crear profesionales como usuarios de `auth.users` fantasma (emails falsos): es justo el problema que este PRP resuelve.
- NO meter Fichaje horario, multi-sucursal ni Cobros a clientes aquí (diferidos en el roadmap).
- NO meter subida de logo/Storage aquí (es la Fase 3 del roadmap: Branding).
- NO usar `any` — `unknown` + narrowing.
- NO omitir Zod en las Server Actions nuevas.
- NO escribir tablas nuevas sin RLS.
- NO ignorar errores de TypeScript ni saltarse la regeneración de tipos.

---

*PRP pendiente de aprobación. No se ha modificado código.*
