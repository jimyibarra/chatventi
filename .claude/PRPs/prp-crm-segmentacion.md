# PRP · CRM: segmentación automática + estadísticas + import/export

> Brecha #4 del roadmap de paridad CitaFlow. Las #1, #2, #3 y las 4 imágenes
> de Juan ya están en prod.

## Objetivo

Que el CRM deje de ser una lista plana de contactos y empiece a **decir algo**:
quién es cliente fiel, quién es nuevo, y quién lleva tiempo sin volver (para
reactivarlo). Más poder sacar y meter clientes en CSV.

## Qué falta hoy (mapeado)

`/dashboard/clientes` ya tiene: listado con búsqueda, etiquetas manuales
(`tags`/`client_tags`), y ficha con historial de citas + conversaciones +
expediente. **Falta**: segmentación automática, estadísticas e import/export.

## Decisiones de diseño

### Segmentación AUTOMÁTICA (derivada), no manual

Las etiquetas manuales ya existen para lo manual. El valor nuevo es un segmento
**calculado del comportamiento**, siempre al día, sin que nadie lo mantenga. Se
calcula en SQL, **no se almacena** (nada de triggers ni columnas que se
desincronizan).

**Eje principal — por nº de citas que cuentan como relación** (scheduled +
confirmed + completed; las `cancelled` y `no_show` NO cuentan):

| Segmento | Citas | Idea |
|---|---|---|
| **Nuevo** | 0–1 | Aún no es cliente recurrente |
| **Regular** | 2–4 | Vuelve |
| **VIP** | ≥5 | Cliente fiel |

Umbrales en constantes visibles (`crm/segments.ts`), fáciles de ajustar luego.

**Eje transversal — Inactivo** (para reactivación, la palanca de marketing que
pide el roadmap): tiene ≥1 cita, **ninguna futura**, y la última fue hace **>60
días**. Es un flag, no un cuarto segmento excluyente (un VIP puede estar
inactivo — justo al que más interesa reactivar).

### Estadísticas

Panel arriba del listado: total de clientes y desglose Nuevo/Regular/VIP +
cuántos inactivos. Cada contador es un **filtro** (clic → lista ese segmento):
así "ver mis VIP" o "ver inactivos para reactivar" es un clic. Base para campañas.

### Import / Export CSV

- **Export**: todos los clientes con nombre, teléfono, segmento, nº de citas,
  última visita, gasto registrado, etiquetas y alta. Route handler autenticado.
- **Import**: nombre + teléfono. Upsert por `phone_canonical` reusando la
  normalización MX de esta mañana (`normalize_phone_mx` + índice único
  `(org, phone_canonical)`). Reporta nuevos / actualizados / inválidos. NO pisa
  el nombre existente con vacío.

## Modelo / RPCs (sin tablas nuevas)

- `get_crm_overview(p_search text)` → jsonb `{ stats, clients[] }`. Por cliente:
  id, name, phone, created_at, tags, `appt_count`, `last_visit`, `spent`,
  `segment`, `inactive`. `stats`: totales por segmento + inactivos. Todo
  org-scoped (`get_my_org`), excluye los contactos `sandbox:`.
- `upsert_client_manual(p_name text, p_phone text)` → `'inserted'|'updated'|'invalid'`.
  SECURITY DEFINER, normaliza el teléfono, upsert por canónico, no pisa nombre
  con vacío. La usa el import (y sirve para alta manual futura).

## Fases

1. **BD**: las 2 RPCs + grants (authenticated).
2. **Listado**: panel de stats con filtros + badge de segmento por cliente, sobre
   `get_crm_overview`. Mantiene la búsqueda actual.
3. **Export CSV**: route handler.
4. **Import CSV**: componente (parseo cliente) + server action + `upsert_client_manual`.
5. **E2E en prod** + limpieza.

## Validación

- [ ] Segmento correcto por nº de citas (cuenta scheduled/confirmed/completed, no canceladas)
- [ ] Inactivo: ≥1 cita, sin futura, última >60d
- [ ] Los contadores filtran el listado
- [ ] Export: CSV descargable con los campos y el segmento
- [ ] Import: upsert por canónico (mismo cliente en 2 formatos → 1 fila), no pisa nombre con vacío, filas inválidas reportadas
- [ ] Aislamiento entre orgs (RLS/SECURITY DEFINER org-scoped)
- [ ] typecheck + lint + build verdes; advisors sin ERROR nuevo

## 🧠 Aprendizajes

(Se llena durante la implementación.)
