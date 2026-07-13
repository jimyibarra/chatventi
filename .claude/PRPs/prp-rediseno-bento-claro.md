# PRP: Rediseño visual Bento Grid (claro) — Dashboard + Páginas Públicas

> **Estado**: APROBADO (2026-07-13, por Juan — con ajuste: 4 KPIs en el Panel)
> **Fecha**: 2026-07-13
> **Proyecto**: ChatVenti
> **Base de diseño**: Tarjeta "Panel — Bento Grid (claro)" aprobada en Claude Design
> (proyecto `ChatVenti — Liquid Glass`, archivo `comparativa/panel-bento.html`)

---

## Objetivo

Aplicar el design system Bento Grid claro (estilo Linear/Vercel: fondo lavanda muy suave, tarjetas blancas con borde sutil, violeta de marca como único acento) a **todo el dashboard y las páginas públicas** de ChatVenti, convirtiendo el Panel principal en un mosaico bento con métricas reales del negocio. **Sin dark mode. Sin tocar la landing.**

## Por Qué

| Problema | Solución |
|----------|----------|
| El dashboard actual es funcional pero genérico (grises Tailwind por defecto, sin identidad) | Tokens propios derivados de la tarjeta aprobada: superficie #f6f6fa, tinta #1a1830, bordes #e8e7f2, violeta #5b4fe0 como acento único |
| El Panel muestra solo 3 contadores estáticos (negocio, sucursales, canales) — no comunica el valor de la IA | Panel bento con 4 KPIs reales (citas hoy, conversaciones, % confirmación, clientes nuevos), celda hero "Tu IA atendió N mensajes", próximas citas |
| Inconsistencia visual entre dashboard, login, /r/[slug] y /c/[token] (cada uno con sus grises) | Un solo sistema de tokens y primitivas compartidas aplicado a todas las superficies del producto |
| Auditoría UX 2026-07 detectó gap de nav y jerarquía vs CitaFlow | Sidebar y bottom-nav re-estilizados según la tarjeta aprobada (activo violeta sobre bg-brand-50) |

**Valor de negocio**: producto con identidad visual coherente de cara al App Review de Meta y a los primeros clientes de pago; el Panel bento vende la IA ("mientras trabajabas, agendó por ti") en la primera pantalla que ve el usuario cada día.

## Qué

### Criterios de Éxito
- [ ] El Panel (`/dashboard`) es un bento grid con datos reales: 4 KPIs (citas hoy, conversaciones, % confirmación, clientes nuevos), celda hero de la Recepcionista IA con gradiente violeta, y celda "Próximas citas" — fiel a la tarjeta aprobada
- [ ] Las 8 secciones del dashboard (Panel, Agenda, Chats, Clientes, Recepcionista IA, Reservas Web, Conexiones, Facturación) + subpáginas usan los tokens nuevos: fondo `#f6f6fa`, cards blancas `border #e8e7f2` `rounded-[18px]`, hover `border-brand-200` + sombra violeta suave
- [ ] Sidebar desktop y bottom-nav móvil re-estilizados según la tarjeta (item activo: `bg-brand-50 text-brand-700`, hover suave)
- [ ] Páginas públicas re-estilizadas con el mismo sistema: `/login`, `/signup`, `/r/[slug]`, `/c/[token]`, `/privacy`, `/terms`
- [ ] La landing (`src/app/page.tsx` + `src/features/landing/`) queda **intacta** (git diff lo confirma)
- [ ] `/r/[slug]` conserva el `primary_color` de branding por negocio y el modo `?embed=1` funciona igual
- [ ] `npm run typecheck` y `npm run build` pasan; screenshots Playwright (desktop + móvil) confirman el resultado
- [ ] Cero clases `gray-*`/`slate-*` residuales en las superficies rediseñadas (los ~343 usos actuales migrados a tokens)

### Comportamiento Esperado (Happy Path)

1. Juan entra a `/dashboard`: fondo lavanda suave, sidebar blanco con "Panel" activo en violeta, saludo "Hola Juan — {fecha}", botón "+ Nueva cita" violeta con sombra.
2. Ve el mosaico bento: cuatro KPIs con mini-sparklines CSS (citas hoy, conversaciones, % confirmación, clientes nuevos), la celda grande con gradiente violeta "Tu IA atendió N mensajes hoy" (agendadas / reagendadas / escaladas / respondidas), y la lista de próximas citas con badges Confirmada/Pendiente.
3. Navega a Agenda, Chats, Clientes, etc.: misma familia visual (cards blancas, mismos radios, mismos badges, mismo botón primario).
4. Un cliente final abre `/r/mi-negocio` o `/c/{token}`: misma calidad visual, respetando el color de marca del negocio.
5. En móvil, la bottom-nav y el panel "Más" siguen el mismo sistema; nada queda tapado ni roto.

---

## Contexto

### Referencias

- **Tarjeta aprobada** (fuente de verdad de tokens): Claude Design → proyecto `ChatVenti — Liquid Glass` → `comparativa/panel-bento.html`
- `.claude/design-systems/bento-grid/bento-grid.md` — recetas de grid/spanning con Tailwind
- `tailwind.config.ts` — ya existe la paleta `brand` (violeta #5b4fe0, 50–900) que coincide con la tarjeta
- `src/app/globals.css` — hoy casi vacío; aquí van base styles (fondo, tabular-nums)
- `src/app/(main)/layout.tsx` — shell del dashboard (header + nav + main)
- `src/shared/components/dashboard-nav.tsx` — nav unificada (sidebar + bottom-nav + panel "Más"); ya usa `bg-brand-50 text-brand-700` en activo, cerca del target
- `src/app/(main)/dashboard/page.tsx` — Panel actual (3 cards + checklist onboarding); mantiene safety-net de onboarding y `data-testid="org-name"` (usado por tests)
- `src/features/onboarding/components/setup-checklist.tsx` — checklist que debe integrarse como celda del bento
- `src/app/r/[slug]/page.tsx` + `src/features/reservas-web/components/public-booking.tsx` — página pública de reservas (branding por org + modo embed)
- `src/app/c/[token]/page.tsx` + `src/features/cita-publica/` — gestión pública de cita
- **NO TOCAR**: `src/app/page.tsx` y `src/features/landing/` (landing en producción)

### Tokens de la tarjeta aprobada (fuente de verdad)

| Token | Valor | Uso |
|-------|-------|-----|
| Superficie app | `#f6f6fa` | Fondo de dashboard y páginas públicas |
| Tinta | `#1a1830` | Texto principal |
| Tinta suave | `#6b6a80` / `#8a89a0` / `#9997ae` | Texto secundario / saludo / labels KPI |
| Borde card | `#e8e7f2` (hover `#c4bff5` = brand-200) | Cards y sidebar |
| Separadores | `#eceaf5` (nav) / `#f1f0f8` (filas) | Divisores internos |
| Éxito | texto `#0d9463`, fondo `#e4f7ef` | Deltas positivos, badge Confirmada |
| Alerta | texto `#a07408`/`#b8860b`, fondo `#fdf3d7` | Badge Pendiente, deltas neutros |
| Radios | card 18px · botón 12px · item nav 11px · pill 999px | `rounded-[18px]`, `rounded-xl`, etc. |
| Sombra hover card | `0 4px 20px rgba(91,79,224,.1)` | Cards interactivas |
| Botón primario | `#5b4fe0`, hover `#4c3fd3`, sombra `0 2px 8px rgba(91,79,224,.3)` | CTA único |
| Celda hero IA | gradiente 150° `#5b4fe0 → #362da3`, texto blanco | Celda 2x2 del bento |
| KPI | label 10.5px uppercase tracking .08em `#9997ae`; valor 30px/800 `tabular-nums` | Celdas de métricas |
| Grid bento | 4 columnas, `grid-auto-rows` ~150px, gap 14px | Panel desktop (colapsa en móvil) |

### Arquitectura Propuesta

Sin tablas nuevas ni features nuevas: es un rediseño transversal. Se agregan tokens y primitivas compartidas; cada página migra a ellas.

```
tailwind.config.ts            # extend: colores ink/surface/success/warn,
                              # borderRadius (card 18px), boxShadow (card-hover, btn)
src/app/globals.css           # fondo base, font-variant-numeric, ajustes globales

src/shared/components/ui/     # primitivas del design system (NUEVO)
├── card.tsx                  # Card bento (borde, radio 18, hover)
├── page-header.tsx           # h1 + subtítulo + acción (patrón "top" de la tarjeta)
├── badge.tsx                 # pills ok/pendiente/neutral
├── button.tsx                # primario violeta / secundario / ghost
└── kpi-cell.tsx              # label + valor + delta + sparkline CSS

src/features/dashboard/       # celdas del Panel bento (hero IA, próximas citas)
```

Reglas de mapeo (migración mecánica en cada página):
`bg-gray-50 → surface` · `text-gray-900 → ink` · `text-gray-500/600 → ink-muted` · `border-gray-200 → borde card` · `rounded-2xl → rounded-[18px]` en cards · verdes/ámbar ad-hoc → tokens success/warn.

### Modelo de Datos

No hay tablas nuevas. El Panel bento consulta datos **existentes** vía RLS: citas de hoy y próximas (`appointments`), conversaciones (`conversations`), actividad de la IA (mensajes/acciones del agente hoy). Si alguna métrica no es consultable de forma barata, la celda se omite o degrada (nunca datos inventados).

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase con el bucle agéntico.
> Orden pensado para que cada fase deje el producto deployable.

### Fase 1: Fundamentos — tokens + primitivas UI
**Objetivo**: `tailwind.config.ts` extendido con los tokens de la tarjeta (ink, surface, bordes, success/warn, radios, sombras), `globals.css` con base styles, y primitivas en `src/shared/components/ui/` (Card, PageHeader, Badge, Button, KpiCell con sparkline CSS).
**Validación**: typecheck + página de prueba temporal renderiza las primitivas idénticas a la tarjeta aprobada (comparación por screenshot).

### Fase 2: Shell del dashboard — layout + navegación
**Objetivo**: `(main)/layout.tsx` (header, fondo surface) y `dashboard-nav.tsx` (sidebar con logo, items 11px radius, separador; bottom-nav y panel "Más" móvil) re-estilizados según la tarjeta.
**Validación**: screenshot desktop + móvil vs tarjeta aprobada; navegación funcional en las 8 secciones.

### Fase 3: Panel bento con datos reales
**Objetivo**: `/dashboard` reconstruido como mosaico bento: header "Hola {nombre} — {fecha}" + botón "+ Nueva cita"; 4 KPIs reales con sparkline — **citas hoy** (`appointments` del día en tz de la sucursal), **conversaciones** (recientes/activas), **% confirmación** (citas confirmadas ÷ totales del rango reciente, p. ej. últimos 30 días), **clientes nuevos** (clientes creados en los últimos 7 días); celda hero IA 2x2 con gradiente y stats del día; celda "Próximas citas" con badges; checklist de onboarding y aviso de suscripción integrados como celdas. Conserva safety-net de onboarding y `data-testid` existentes.
**Validación**: métricas coinciden con la BD; responsive (colapsa a 1 col en móvil); screenshot vs tarjeta.

### Fase 4: Páginas core del dashboard
**Objetivo**: Agenda (+ configuración), Conversaciones (lista + detalle) y Clientes (lista + detalle) migradas a tokens y primitivas (cards, badges, botones, tablas).
**Validación**: flujos funcionan igual (crear cita, responder chat, editar cliente); cero `gray-*` en estas páginas; screenshots.

### Fase 5: Páginas secundarias del dashboard
**Objetivo**: Recepcionista IA, Reservas Web (panel de config), Conexiones y Facturación migradas al sistema.
**Validación**: formularios y acciones intactos; cero `gray-*`; screenshots.

### Fase 6: Páginas públicas
**Objetivo**: `/login`, `/signup`, `/r/[slug]` (respetando `primary_color` por negocio y `?embed=1`), `/c/[token]`, `/privacy` y `/terms` con el mismo sistema.
**Validación**: signup/login funcionan; reserva pública end-to-end con branding del negocio; embed sin fondo/paddings rotos; landing sin cambios en git diff.

### Fase 7: Validación final
**Objetivo**: Sistema completo verificado end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Grep confirma cero `gray-*`/`slate-*` en superficies rediseñadas
- [ ] `git diff` confirma landing intacta
- [ ] Playwright: screenshots desktop + móvil de las 8 secciones y páginas públicas
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Esta sección CRECE con cada error encontrado durante la implementación.

### 2026-07-13: `-translate-` dispara falsos positivos al buscar `slate-`
- **Error**: el grep de verificación `gray-|slate-|...` marcó `-translate-y-1/2` como resto de `slate-`.
- **Fix**: revisar los matches antes de "corregirlos"; o usar `\b(gray|slate|emerald|amber)-`.
- **Aplicar en**: cualquier barrido de clases Tailwind por regex.

### 2026-07-13: el `body` del root layout pinta TODAS las páginas (landing incluida)
- **Error potencial**: migrar `bg-gray-50` del root layout cambia también el fondo de la landing.
- **Fix**: se migró a `bg-surface` (#f6f6fa vs #f9fafb, imperceptible) y se validó la landing por screenshot. Los fondos de sección de la landing los pinta su CSS scoped.
- **Aplicar en**: futuros cambios de tema — el root layout es superficie compartida con la landing.

### 2026-07-13: decisiones deliberadas del Panel bento (no son bugs)
- El desglose del hero IA es **agendadas / escaladas / respondidas** (la BD no distingue "reagendadas"; no se inventan números).
- El punto pulsante del hero usa `bg-emerald-300` a propósito: el token `success` (#0d9463) no contrasta sobre el gradiente violeta. Es el único no-token permitido en superficies rediseñadas.
- `% Confirmación` = (confirmed+completed) ÷ total de citas con inicio en los últimos 30 días; con 0 citas la celda muestra "—".

### 2026-07-13: Turbopack tarda minutos en el primer compile en este disco
- **Error**: Playwright daba timeout (60s) navegando al dev server recién levantado ("Slow filesystem detected").
- **Fix**: reintentar la navegación; el compile de /dashboard tardó ~3-4 min la primera vez.
- **Aplicar en**: cualquier validación visual local en esta máquina.

### 2026-07-13: patrón que ayudó
- `STATUS_META` en `agenda/types.ts` centraliza los colores de badges de estado → la migración fue 1 edit en vez de N. Mantener este patrón para nuevos estados.

---

## Gotchas

> Cosas críticas a tener en cuenta ANTES de implementar

- [ ] **NO tocar la landing**: `src/app/page.tsx` y `src/features/landing/` quedan intactos. Prohibido cualquier find-replace global de clases: los 343 usos de `gray-*` se migran archivo por archivo, excluyendo landing.
- [ ] **Sin dark mode**: no agregar `dark:` ni `prefers-color-scheme`. Un solo tema claro.
- [ ] `/r/[slug]` usa `branding.primary_color` del negocio (default actual `#2563eb`): el rediseño da el marco (surface, cards, radios) pero el acento sigue siendo el del negocio, no el violeta ChatVenti. El modo `?embed=1` no lleva fondo ni min-h-screen.
- [ ] `data-testid="org-name"` (y otros testids) se usan en tests: conservarlos al reconstruir el Panel.
- [ ] El Panel tiene lógica de negocio (safety-net de onboarding, aviso de suscripción, checklist): rediseñar SIN alterar esa lógica.
- [ ] Sparklines con divs CSS puros (como la tarjeta), sin librería de charts.
- [ ] Radio 18px no existe en Tailwind por defecto: definir token en `borderRadius` (no repetir `rounded-[18px]` arbitrario por todos lados).
- [ ] Métricas del bento vía queries RLS baratas (counts/limit 3); si una métrica no existe aún (ej. desglose de acciones IA), degradar la celda — nunca números inventados.
- [ ] Emails, notificaciones push y todo lo server-side quedan fuera de alcance.
- [ ] La bottom-nav móvil tapa contenido: mantener `pb-16` en `<main>` móvil.

## Anti-Patrones

- NO crear nuevos patrones si los existentes funcionan (la nav ya usa brand-50/700: ajustar, no reescribir desde cero)
- NO ignorar errores de TypeScript
- NO hardcodear hex repetidos en componentes (usar tokens de Tailwind)
- NO cambiar comportamiento, rutas, queries ni lógica de negocio: esto es un rediseño visual
- NO agregar dependencias de UI (nada de shadcn, chart libs, CSS-in-JS)

---

*PRP COMPLETADO (2026-07-13). 7 fases ejecutadas con bucle-agentico: gates lint+typecheck+build verdes, landing intacta (verificada por git status y screenshot), screenshots desktop+móvil validados. Pendiente: commit/push y verificación en prod.*
