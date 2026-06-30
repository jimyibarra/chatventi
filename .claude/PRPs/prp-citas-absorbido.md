# PRP-AUTOMATIZAPRO-CITAS: AutomatizaPro Citas — SaaS de Agendamiento Multi-Vertical

> **Estado**: ABSORBIDO en PRP-CHATVENTI (no implementar por separado)
> **Fecha**: 2026-06-29 (superado el 2026-06-30)
>
> **⚠️ ESTE PRP YA NO SE EJECUTA.** Decisión del usuario (2026-06-30): **ChatVenti = equivalente a CitaFlow**, y las citas son el **corazón** de ChatVenti, no un producto aparte. Todo lo de aquí (agenda, no-solapamiento, disponibilidad, recordatorios, RPCs de chat) quedó **fusionado en `prp-chatventi.md`** (la versión unificada). Se conserva este archivo solo como insumo histórico del modelo de datos de agenda. La carpeta `Proyectos\AutomatizaPro` es para el **sitio de la agencia** (automatizapro.mx), no para este producto.

---

## Objetivo

Construir una plataforma SaaS multi-tenant de **agendamiento de citas** para negocios de servicios (peluquería, dentista), reutilizando el motor probado de SastrePro (organizaciones, sucursales, clientes, staff, agente IA por WhatsApp, catálogo, cobros, fidelidad, facturación por sucursal). Lo nuevo a construir: módulo de **agenda/calendario de citas**, **verticalización** (plantillas peluquería vs dentista), **historial clínico** para el vertical dentista, y **PWA instalable** (no app nativa).

## Por Qué

| Problema | Solución |
|----------|----------|
| Peluquerías/dentistas pierden tiempo y citas gestionando agenda por teléfono/papel | Calendario digital + reserva y recordatorios automáticos por WhatsApp |
| Construir un SaaS de citas desde cero es caro y lento | Reutilizar el 70% del motor SastrePro (tenancy, RLS, WhatsApp, cobros, facturación) ya en producción |
| Cada vertical tiene necesidades distintas (corte vs tratamiento dental) | Verticalización: plantillas, catálogos y campos por tipo de negocio; historial clínico solo para dentista |
| El cliente final no quiere instalar una app nativa | PWA instalable (Android/iOS) sobre el stack web actual |

**Valor de negocio**: abre un mercado nuevo (servicios con cita previa) reaprovechando infraestructura amortizada. Reduce no-shows con recordatorios automáticos y monetiza con el mismo modelo de cobro por sucursal de SastrePro (Stripe + trial 14 días).

## Qué

### Criterios de Éxito
- [ ] Un negocio se da de alta eligiendo vertical (peluquería o dentista) y recibe catálogo y plantillas sembradas por defecto para ese vertical.
- [ ] El staff ve una agenda (vista día/semana) por sucursal y puede crear, mover, confirmar, completar, marcar no-show y cancelar citas, con asignación a un profesional.
- [ ] El sistema impide solapamientos: solo ofrece y acepta horarios libres según horario de la sucursal, duración del servicio y disponibilidad del profesional.
- [ ] El agente IA por WhatsApp consulta disponibilidad y agenda/reagenda citas; envía recordatorios automáticos (24 h y 2 h antes) vía plantilla aprobada.
- [ ] En el vertical dentista existe historial clínico por paciente (antecedentes, tratamientos por cita, adjuntos) accesible desde la ficha del cliente; oculto en peluquería.
- [ ] La app es instalable como PWA (manifest + service worker + prompt de instalación) en Android e iOS.
- [ ] RLS aislando por organización/sucursal en todas las tablas nuevas; `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado (Happy Path)
1. El dueño se registra, elige vertical "Dentista", se siembran servicios (limpieza, extracción…) con duración y plantillas de WhatsApp.
2. Configura el horario de cada sucursal y el horario/disponibilidad de cada profesional.
3. Un cliente escribe por WhatsApp "quiero una limpieza el viernes". El agente IA consulta disponibilidad (RPC), ofrece horarios libres, el cliente elige y la cita queda creada en la agenda.
4. 24 h y 2 h antes, un cron envía recordatorio por plantilla; el cliente confirma o reagenda por WhatsApp.
5. El profesional atiende, marca la cita "completada", registra el tratamiento en el historial clínico y (opcional) cobra usando el módulo de cobros existente.

---

## Contexto

### Referencias (código existente a reutilizar / seguir como patrón)
- `src/features/chat/services/aiAgentService.ts` y `aiAssistantService.ts` — agente IA por sucursal (`agent_configs.system_prompt` + `knowledge_base`); extender con herramientas de disponibilidad/reserva.
- `src/app/api/whatsapp/notify-ready/route.ts` — **patrón canónico de envío por plantilla** (carga sucursal → `wa_phone_number_id`/`wa_access_token` → plantilla UTILITY → fallback texto → `log_bot_message`). Los recordatorios de cita se modelan igual.
- `src/app/api/cron/branch-billing/route.ts` — patrón de cron (Vercel) para el job de recordatorios.
- `src/features/dashboard/components/catalog/ServiceCatalogManager.tsx` — catálogo de servicios (`service_catalogs`); se le agrega `duration_minutes`.
- `src/features/saas/services/branchBillingServer.ts` + `src/app/(main)/dashboard/billing` — cobro por sucursal (Stripe, trial 14 días) reutilizable tal cual.
- `src/app/(main)/dashboard/clients` — ficha de cliente; punto de entrada del historial clínico.
- Tablas núcleo ya existentes (vía `.from(...)`): `organizations`, `branches`, `profiles`, `clients`, `service_catalogs`, `agent_configs`, `chat_conversations`, `chat_messages`, `whatsapp_credentials`, `marketing_templates`, `loyalty_balances`, `cash_cuts`, `tickets`.
- **Aprendizaje crítico (memoria)**: el webhook de WhatsApp usa la **ANON key** → toda escritura desde ese flujo debe ir por **RPC `SECURITY DEFINER`**, nunca query directa (ver `chat-autoresponder-dedup-fix`).
- Skill `add-mobile` — generación de PWA (manifest, SW, push). No existe `manifest` hoy (PWA estaba descartado en SastrePro; aquí es requisito).

### Arquitectura Propuesta (Feature-First)
```
src/features/citas/
├── components/      # CalendarView (día/semana), AppointmentModal, SlotPicker, StaffScheduleEditor, BusinessHoursEditor
├── hooks/           # useAgenda, useAvailability, useAppointment
├── services/        # appointmentsService.ts, availabilityService.ts
├── store/           # agendaStore (fecha activa, sucursal, profesional)
└── types/           # Appointment, Slot, StaffSchedule, BusinessHours

src/features/historial-clinico/   # solo vertical dentista
├── components/      # ClinicalRecordPanel, TreatmentForm, OdontogramaLite, AttachmentsList
├── hooks/
├── services/
└── types/

src/app/api/citas/                 # endpoints servidor (validación + RPCs)
src/app/api/cron/appointment-reminders/route.ts
```
La verticalización se modela con `organizations.vertical` y *gating* de UI (el historial clínico y campos clínicos solo aparecen si `vertical = 'dentista'`).

### Modelo de Datos (nuevo; sigue convención multi-tenant + RLS por org/sucursal)
```sql
-- 1) Verticalización
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vertical TEXT
  NOT NULL DEFAULT 'peluqueria' CHECK (vertical IN ('peluqueria','dentista'));
ALTER TABLE service_catalogs ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 30;

-- 2) Horario de atención de la sucursal
CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false
);

-- 3) Disponibilidad del profesional (staff = profiles) + ausencias
CREATE TABLE staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);
CREATE TABLE staff_time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT
);

-- 4) Citas
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  staff_id UUID REFERENCES profiles(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  source TEXT NOT NULL DEFAULT 'staff' CHECK (source IN ('staff','whatsapp','client')),
  notes TEXT,
  reminder_24h_sent_at TIMESTAMPTZ,
  reminder_2h_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE appointment_services (
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES service_catalogs(id),
  PRIMARY KEY (appointment_id, service_id)
);

-- 5) Historial clínico (vertical dentista)
CREATE TABLE clinical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  allergies TEXT, medical_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE clinical_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinical_record_id UUID NOT NULL REFERENCES clinical_records(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id),
  tooth TEXT, description TEXT NOT NULL,
  performed_by UUID REFERENCES profiles(id),
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS en todas las tablas nuevas: aislar por organization_id / branch_id del usuario.
-- RPCs SECURITY DEFINER para el flujo WhatsApp (ANON key):
--   get_available_slots(branch_id, service_ids[], date)  → slots libres
--   create_appointment_from_chat(branch_id, client_phone, service_ids[], starts_at) → cita
```

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 0: Verticalización del motor
**Objetivo**: `organizations.vertical`, `duration_minutes` en servicios, *gating* de UI por vertical, y siembra de catálogo + plantillas WhatsApp por defecto al alta (peluquería vs dentista).
**Validación**: alta de org con vertical elegido siembra datos correctos; la UI muestra/oculta lo clínico según vertical.

### Fase 1: Modelo de datos de agenda + disponibilidad
**Objetivo**: crear tablas (`business_hours`, `staff_schedules`, `staff_time_off`, `appointments`, `appointment_services`) con RLS, y RPCs `get_available_slots` / `create_appointment_from_chat` (`SECURITY DEFINER`) que respetan horario, duración y no-solapamiento.
**Validación**: SQL de prueba confirma que slots ocupados no se ofrecen y que crear una cita solapada falla.

### Fase 2: Agenda / Calendario (UI)
**Objetivo**: feature `citas` con vista día/semana por sucursal y profesional; crear/editar/mover/cancelar/confirmar/completar/no-show; editores de horario de sucursal y disponibilidad de staff.
**Validación**: Playwright crea una cita desde la UI, la reagenda y cambia su estado; no permite solapamientos.

### Fase 3: Agente IA + recordatorios WhatsApp
**Objetivo**: extender el agente (`agent_configs`) con herramientas de disponibilidad/reserva vía las RPCs; cron `appointment-reminders` que envía plantilla 24 h/2 h antes reusando el patrón de `notify-ready` y marca `reminder_*_sent_at`.
**Validación**: conversación de prueba agenda una cita; el cron envía recordatorio una sola vez por ventana y lo registra con `log_bot_message`.

### Fase 4: Historial clínico (vertical dentista)
**Objetivo**: feature `historial-clinico` integrada en la ficha del cliente: antecedentes, tratamientos por cita, odontograma simple y adjuntos; visible solo si `vertical = 'dentista'`.
**Validación**: en org dentista se registra y consulta historial; en org peluquería el módulo no aparece ni es accesible por ruta.

### Fase 5: PWA instalable
**Objetivo**: aplicar skill `add-mobile` — manifest, service worker, prompt de instalación, shell offline de la agenda; compatible iOS/Android.
**Validación**: Lighthouse PWA installable; la app se instala y abre la agenda en móvil.

### Fase 6: Validación Final
**Objetivo**: sistema E2E por vertical.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: flujo completo peluquería (reserva por WhatsApp → agenda → recordatorio → completar)
- [ ] Playwright: flujo completo dentista (idem + historial clínico)
- [ ] `get_advisors` sin hallazgos de RLS en tablas nuevas
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece con cada error durante la implementación.

### 2026-06-29: Punto de partida (heredado de SastrePro)
- **Patrón**: el webhook WhatsApp usa ANON key → escrituras solo por RPC `SECURITY DEFINER`. Aplica directo a `create_appointment_from_chat`.
- **Patrón**: envío de plantillas via sucursal (`wa_phone_number_id`/`wa_access_token`) con fallback a texto y `log_bot_message`. Reusar para recordatorios.
- **Aplicar en**: Fases 1 y 3.

---

## Gotchas

- [ ] **Zona horaria**: `appointments` en `TIMESTAMPTZ`; cálculo de slots y recordatorios debe usar la zona de la sucursal (no UTC del servidor) — definir/heredar `branches.timezone`.
- [ ] **No-solapamiento** debe validarse en la RPC (servidor), no solo en UI; usar bloqueo/transacción para evitar doble reserva concurrente (WhatsApp + staff a la vez).
- [ ] **Recordatorios fuera de ventana 24 h**: solo viajan por **plantilla aprobada** en Meta; texto libre solo si el cliente escribió en <24 h (igual que `notify-ready`).
- [ ] **Cron idempotente**: usar `reminder_24h_sent_at`/`reminder_2h_sent_at` para no reenviar; proteger el endpoint con el secreto de cron de Vercel.
- [ ] **RLS**: habilitar en TODAS las tablas nuevas y verificar con `get_advisors` antes de producción.
- [ ] **Verticalización por dato, no por código**: el gating clínico depende de `organizations.vertical`, evitando ramas hardcodeadas.
- [ ] **`is_active` en sucursales** (convención existente): listas/conteos de agenda filtran `is_active = true`.
- [ ] **PWA en iOS**: limitaciones de push; priorizar instalación + recordatorios por WhatsApp sobre push web.

## Anti-Patrones
- NO crear nuevas tablas de tenancy: reutilizar `organizations`/`branches`/`profiles`/`clients`.
- NO escribir desde el flujo WhatsApp con query directa (ANON key) — siempre RPC `SECURITY DEFINER`.
- NO validar disponibilidad solo en el cliente.
- NO duplicar el catálogo: extender `service_catalogs`, no crear uno paralelo.
- NO ignorar errores de TypeScript ni omitir validación Zod en inputs.

---

*PRP pendiente de aprobación. No se ha modificado código.*
