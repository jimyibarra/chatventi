# Roadmap de paridad ChatVenti vs. CitaFlow

> Análisis hecho el 2026-07-14 a partir de 58 capturas de CitaFlow (`_Screen/`), 2 correos del funnel (`Correo_oferta1/2.pdf`) y el inventario técnico actual de ChatVenti.
> Objetivo: cerrar las brechas de **Equipo/Profesionales, Roles, CRM y Branding** + mejoras de marketing. Producto **horizontal** (sirve a peluquería, clínica dental, etc.).

---

## TL;DR

ChatVenti tiene un núcleo sólido (recepcionista IA omnicanal + agenda + CRM básico + billing + Super Admin). Lo que falta es la **capa de "gestión del negocio"** que CitaFlow ya tiene madura. **La mayoría de brechas ya están soportadas en el esquema de datos; falta la interfaz.** No hay que reinventar, hay que construir UI encima de lo existente.

**Orden recomendado:** (1) Profesionales/Recursos → (2) Equipo + Roles → (3) Branding real → (4) CRM estadísticas → (5) Funnel de marketing.

---

## 1. EQUIPO / Profesionales — brecha #1

**CitaFlow:** modela un **"Recurso" genérico** ("Personal que realiza los servicios") y lo re-etiqueta según vertical: *Nuestros Profesionales / Salas / Equipos / Personalizado*. A cada recurso le asigna qué servicios presta y un horario individual (se cruza con el del negocio). El cliente puede elegir profesional al reservar (o "el que sea"). Atribución en Cobros: "Quién atendió" vs "Quién cobró".

**ChatVenti hoy:** NO existe entidad "profesional" separada del login. El staff son `profiles` (usuarios con cuenta). `staff_schedules`, `staff_time_off` y `appointments.staff_id` apuntan a `profiles`, pero **no hay UI para crear/gestionar staff** ni para asignar servicios por profesional. El agente IA es genérico por negocio; no ofrece elegir profesional ni respeta agendas individuales.

**Recomendación (arquitectura):**
- Crear entidad **`resources` (profesional/recurso) desacoplada del login** — nombre, foto, servicios que presta, horario propio, sucursal.
- Vinculable **opcionalmente** a un `profile` si esa persona necesita entrar al panel (un peluquero normalmente NO necesita login).
- Cubre los 3 casos: elegir peluquero, elegir dentista de tratamiento, o "el que sea / primera cita = cualquiera disponible".
- El **agente IA** debe usarlo: si varios prestan el servicio, pregunta "¿con quién?" o asigna el primero libre; respeta horario individual.
- La página pública `/r/[slug]` muestra selección de profesional con etiqueta genérica configurable.

---

## 2. ROLES y permisos — brecha #2 (delegar el negocio)

**CitaFlow:** módulo **Equipo** con pestañas *Miembros · Organización · Roles y permisos · Fichaje horario*. Invitar por email + invitaciones pendientes + límite por plan ("1 de 2 accesos en uso"). Matriz granular de ~7 roles × acciones (Ver/Crear/Editar/Eliminar/Invitar/Gestionar permisos/Ver datos sensibles) por módulo, con alcance "Ver lo propio / de su sucursal / todo". Fichaje horario.

**ChatVenti hoy:** roles existen en esquema (`super_admin/owner/manager/staff`), RLS los aplica, add-on `team_seats` existe en billing. Pero **NO hay UI para invitar/gestionar equipo ni asignar roles.** Solo se crea el `owner` en el registro.

**Recomendación:**
- Construir la página **"Equipo"** (backend ya la soporta): invitar por email (Resend ya existe) → asignar rol → invitación pendiente; cambiar rol desde tabla de miembros.
- Empezar simple, sin matriz de 7 roles. Con **Dueño / Administrador (delega todo) / Recepción-Asistente (agenda + CRM, no billing/config) / Profesional (solo su agenda)** se cubre el 95%.
- Fichaje horario: diferir (nice-to-have).

---

## 3. BRANDING / marca del negocio — brecha #3

**CitaFlow:** branding real en **Página Web → Apariencia** — plantillas, colores por rol (botones/enlaces/acentos), tipografía, galería (subida de archivos), dominio propio. El logo se propaga a emails a clientes y web pública.

**ChatVenti hoy:** `organizations.branding` (jsonb) con `primary_color`, `logo_url`, descripción, whatsapp, en `/dashboard/reservas-web`. **Limitación: el logo se guarda como URL de texto, no hay subida de archivo a Storage** (fricción enorme para un dueño no técnico).

**Recomendación:**
1. **Subida de logo a Supabase Storage** (drag & drop) — lo primero, lo que más se nota.
2. Añadir color secundario/acento + imagen de portada + galería.
3. **Meter el logo en los correos** (Resend) y en `/r/[slug]` y `/c/[token]`. Que el cliente final vea la marca del negocio, no "ChatVenti".
4. (Estrategia) Evaluar white-label parcial como argumento de venta diferenciador.

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

1. **Equipo/Profesionales como recurso** (entidad + servicios por profesional + selección al reservar + que el agente IA lo use). ← lo más pedido; desbloquea peluquerías/clínicas reales.
2. **Gestión de Equipo + Roles** (invitar, asignar rol, delegar). ← desbloquea "delegar a una asistente".
3. **Branding real** (subir logo a Storage + logo en emails/web).
4. **CRM: estadísticas + segmentación + import/export.**
5. **Funnel de marketing** (quiz, email fin de trial con extender/llamada, upsell 39€).

---

## Siguiente paso propuesto

Convertir la **Fase 1 (Profesionales/Recursos)** en un PRP (plan por fases) para aprobar y arrancar. Alternativa: PRP que agrupe Fase 1 + Fase 2 (Equipo/Roles) porque comparten el modelo de datos.
