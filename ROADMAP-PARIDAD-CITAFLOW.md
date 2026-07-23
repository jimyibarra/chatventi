# Roadmap de paridad ChatVenti vs. CitaFlow

> Análisis hecho el 2026-07-14 a partir de 58 capturas de CitaFlow (`_Screen/`), 2 correos del funnel (`Correo_oferta1/2.pdf`) y el inventario técnico actual de ChatVenti.
> Objetivo: cerrar las brechas de **Equipo/Profesionales, Roles, CRM y Branding** + mejoras de marketing. Producto **horizontal** (sirve a peluquería, clínica dental, etc.).

---

## Estado (actualizado 2026-07-22)

| # | Brecha | Estado |
|---|--------|--------|
| 1 | Profesionales/Recursos | ✅ **Hecho y en prod** (Ola 4, `4158e99`) |
| 2 | Equipo + Roles | ✅ **Hecho y en prod** (Ola 4, `4158e99`) |
| + | Sandbox "Prueba el Chat IA en vivo" | ✅ **Hecho y en prod** (`c7d4fab`) — extra detectado del demo de CitaFlow |
| 3 | Branding real (logo a Storage) | ⏳ Pendiente — **siguiente candidato a PRP** |
| 4 | CRM: estadísticas/segmentación/import-export | ⏳ Pendiente |
| 5 | Funnel de marketing | ⏳ Parcial (trial+correos ya viven; falta quiz/upsell) |

> 🔴 Correcciones a este documento (eran optimistas/erróneas): (a) el proyecto **NO usa Resend**, usa **nodemailer + SMTP de Hostinger** (`src/features/emails/mailer.ts`); (b) el backend **NO** "ya soportaba Equipo": hizo falta una RPC `SECURITY DEFINER` nueva.

---

## TL;DR

ChatVenti tiene un núcleo sólido (recepcionista IA omnicanal + agenda + CRM básico + billing + Super Admin). Lo que falta es la **capa de "gestión del negocio"** que CitaFlow ya tiene madura. **La mayoría de brechas ya están soportadas en el esquema de datos; falta la interfaz.** No hay que reinventar, hay que construir UI encima de lo existente.

**Orden recomendado:** (1) Profesionales/Recursos → (2) Equipo + Roles → (3) Branding real → (4) CRM estadísticas → (5) Funnel de marketing.

---

## 1. EQUIPO / Profesionales — brecha #1 · ✅ HECHO (Ola 4, `4158e99`)

> Construido: entidad `resources` desacoplada del login (foto, servicios que presta, horario propio), `/dashboard/profesionales` (CRUD), agenda con columna por profesional y "el que sea", selector en `/r/[slug]`, y el agente IA pregunta "¿con quién?" y respeta el horario individual. Etiqueta por vertical en `branding.resource_label`. Regla: recurso sin `resource_services` presta TODOS los servicios. Detalle en `.claude/PRPs/prp-profesionales-equipo.md`. (Pendiente sólo la Fase 7 CONTRACT: dropear el viejo `staff_id`.)

**CitaFlow:** modela un **"Recurso" genérico** ("Personal que realiza los servicios") y lo re-etiqueta según vertical: *Nuestros Profesionales / Salas / Equipos / Personalizado*. A cada recurso le asigna qué servicios presta y un horario individual (se cruza con el del negocio). El cliente puede elegir profesional al reservar (o "el que sea"). Atribución en Cobros: "Quién atendió" vs "Quién cobró".

**ChatVenti hoy:** NO existe entidad "profesional" separada del login. El staff son `profiles` (usuarios con cuenta). `staff_schedules`, `staff_time_off` y `appointments.staff_id` apuntan a `profiles`, pero **no hay UI para crear/gestionar staff** ni para asignar servicios por profesional. El agente IA es genérico por negocio; no ofrece elegir profesional ni respeta agendas individuales.

**Recomendación (arquitectura):**
- Crear entidad **`resources` (profesional/recurso) desacoplada del login** — nombre, foto, servicios que presta, horario propio, sucursal.
- Vinculable **opcionalmente** a un `profile` si esa persona necesita entrar al panel (un peluquero normalmente NO necesita login).
- Cubre los 3 casos: elegir peluquero, elegir dentista de tratamiento, o "el que sea / primera cita = cualquiera disponible".
- El **agente IA** debe usarlo: si varios prestan el servicio, pregunta "¿con quién?" o asigna el primero libre; respeta horario individual.
- La página pública `/r/[slug]` muestra selección de profesional con etiqueta genérica configurable.

---

## 2. ROLES y permisos — brecha #2 · ✅ HECHO (Ola 4, `4158e99`)

> Construido: `/dashboard/equipo` (invitar por email, invitaciones pendientes, reenviar/revocar, contador "X de N accesos" con gate por `team_seats` = 1 + team_seats, dueño incluido) + `/invitacion/[token]`. 4 roles planos **Dueño / Administrador / Recepción / Profesional** sobre `owner|manager|staff` + `profiles.resource_scope`. Requirió una RPC `SECURITY DEFINER` nueva (el backend NO lo soportaba solo con `profile_update_self`). Gate de rol en el proxy (no en layouts). Fichaje horario: diferido.

**CitaFlow:** módulo **Equipo** con pestañas *Miembros · Organización · Roles y permisos · Fichaje horario*. Invitar por email + invitaciones pendientes + límite por plan ("1 de 2 accesos en uso"). Matriz granular de ~7 roles × acciones (Ver/Crear/Editar/Eliminar/Invitar/Gestionar permisos/Ver datos sensibles) por módulo, con alcance "Ver lo propio / de su sucursal / todo". Fichaje horario.

**ChatVenti hoy:** roles existen en esquema (`super_admin/owner/manager/staff`), RLS los aplica, add-on `team_seats` existe en billing. Pero **NO hay UI para invitar/gestionar equipo ni asignar roles.** Solo se crea el `owner` en el registro.

**Recomendación:**
- Construir la página **"Equipo"**: invitar por email (por **SMTP de Hostinger**, no Resend) → asignar rol → invitación pendiente; cambiar rol desde tabla de miembros. (Nota: el backend NO lo soportaba solo; hizo falta una RPC `SECURITY DEFINER`.)
- Empezar simple, sin matriz de 7 roles. Con **Dueño / Administrador (delega todo) / Recepción-Asistente (agenda + CRM, no billing/config) / Profesional (solo su agenda)** se cubre el 95%.
- Fichaje horario: diferir (nice-to-have).

---

## 3. BRANDING / marca del negocio — brecha #3

**CitaFlow:** branding real en **Página Web → Apariencia** — plantillas, colores por rol (botones/enlaces/acentos), tipografía, galería (subida de archivos), dominio propio. El logo se propaga a emails a clientes y web pública.

**ChatVenti hoy:** `organizations.branding` (jsonb) con `primary_color`, `logo_url`, descripción, whatsapp, en `/dashboard/reservas-web`. **Limitación: el logo se guarda como URL de texto, no hay subida de archivo a Storage** (fricción enorme para un dueño no técnico).

**Recomendación:**
1. **Subida de logo a Supabase Storage** (drag & drop) — lo primero, lo que más se nota.
2. Añadir color secundario/acento + imagen de portada + galería.
3. **Meter el logo en los correos** (SMTP de Hostinger, `src/features/emails/`) y en `/r/[slug]` y `/c/[token]`. Que el cliente final vea la marca del negocio, no "ChatVenti".
4. (Estrategia) Evaluar white-label parcial como argumento de venta diferenciador.

---

## + Sandbox "Prueba el Chat IA en vivo" — extra del demo · ✅ HECHO (`c7d4fab`)

**CitaFlow:** página `/demo/chatbot` dentro del panel donde el dueño prueba SU propio agente (misma IA que reciben sus clientes por WhatsApp), con panel lateral de "base de conocimiento del negocio" y preguntas sugeridas.

**ChatVenti:** `/dashboard/agente/probar`. Reusa el motor de producción (`runAgent`) contra el contexto REAL de la org (servicios/conocimiento/profesionales/prompt). **Disponibilidad REAL de solo lectura + escrituras SIMULADAS** → cero efectos secundarios (0 citas reales, sin notificaciones, hilo excluido del inbox). Sin migraciones. Validado E2E. PRP: `.claude/PRPs/prp-sandbox-chat-ia.md`.

---

## 4. CRM — mejora incremental (ya es decente)

ChatVenti ya tiene `clients` + `conversations` + `tags`/`client_tags` + `/dashboard/clientes`. Falta vs CitaFlow:
- **Estadísticas del CRM**: segmentación VIP/Regular/Nuevo (por nº de citas), frecuencia de visitas, top clientes, ingresos por cliente, tendencias.
- **Importar/Exportar clientes** (CSV).
- Ficha de cliente con historial de citas + facturación.

Prioridad media. La **segmentación** es la de mayor valor de marketing (permite campañas: "reactivar clientes que no vienen hace 60 días").

---

## Otras brechas (mapa completo, prioridad menor)

| Módulo CitaFlow | ChatVenti | Comentario |
|---|---|---|
| **Cobros a clientes** (Stripe Connect, TPV, quién atendió/cobró) | Solo billing de la suscripción SaaS | CitaFlow deja que el negocio cobre a SUS clientes. Decisión de negocio, no urgente. |
| **Analíticas/BI** (KPIs citas, origen, demanda por horario) | Dashboard básico | Ampliable después. |
| **Multi-sucursal** | Tabla `branches` existe, UI mínima | Diferir hasta demanda real. |
| **Web builder** (SEO, pixels, galería, dominio, e-commerce Shopify) | Config reservas + productos | Los **pixels Meta/Google/TikTok** sí valen para marketing. |
| **Marketing WhatsApp** (plantillas) | — | Ligado a plantillas UTILITY (ya diferido). |
| **Voz / Telefonía IA** | Diferido a propósito | Correcto, sigue diferido. |

---

## Sugerencias de MARKETING (de los 2 correos del funnel + criterio)

1. **Quiz → plan recomendado.** CitaFlow hace quiz y el email dice "según lo que nos contaste, este es tu plan" (Starter + Chatbot IA, 41€/mes). Personalización = más conversión. Implementar quiz corto de onboarding.
2. **Secuencia de trial (ChatVenti ya tiene 30 días):**
   - Email "tu plan recomendado te espera" (reactivación).
   - Email "tu prueba acaba hoy" con **dos salidas**: (A) extender 7 días más, ó (B) agendar llamada con el equipo. La doble opción reduce abandono.
3. **Value props que venden** (repetidas por CitaFlow): Reservas 24/7 · CRM con clientes organizados · Recordatorios automáticos · Tu propia página de reservas personalizada · Sin compromiso, cancela cuando quieras.
4. **Upsell de onboarding asistido**: CitaFlow vende "sesión de ayuda por 39€, configuramos tu cuenta por TeamViewer". Ingreso extra + palanca de activación (menos churn). Muy recomendable para público no técnico.
5. **Bloqueos que empujan a pagar**: módulos en "Vista previa" y features "bloqueadas en prueba" (WhatsApp/SMS) generan deseo. Usar con cuidado para no frustrar.

---

## Prioridad final

1. ✅ ~~**Equipo/Profesionales como recurso**~~ — HECHO y en prod (Ola 4, `4158e99`).
2. ✅ ~~**Gestión de Equipo + Roles**~~ — HECHO y en prod (Ola 4, `4158e99`).
   - ✅ Extra: **Sandbox "Prueba el Chat IA"** — HECHO y en prod (`c7d4fab`).
3. ⏳ **Branding real** (subir logo a Storage + logo en emails/web). ← **siguiente candidato a PRP.**
4. ⏳ **CRM: estadísticas + segmentación + import/export.**
5. ⏳ **Funnel de marketing** (quiz, email fin de trial con extender/llamada, upsell 39€). Trial 30d + correos de ciclo de vida ya viven; falta el quiz y el upsell.

---

## Siguiente paso propuesto

Convertir la **Brecha #3 (Branding real: subida de logo a Supabase Storage + logo en correos y web pública)** en un PRP. Ojo: `organizations.branding` es un jsonb compartido con ≥2 escritores que hacen merge (`saveWebConfig`, `saveResourceLabel`) — cualquier escritor nuevo debe hacer merge también o borrará claves ajenas.
