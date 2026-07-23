# PRP — Agente por tipo de negocio (plantillas por rubro) + Modelo a SUPERADMIN

> Origen: feedback de Juan sobre `Base Conocimiento.png`.
> Rubros elegidos por Juan: peluquería/barbería/estética, dentista, veterinaria,
> spa/uñas/médico y genérico.

## Objetivo

1. Al configurar el agente de un negocio nuevo, **proponer las instrucciones (prompt)**
   y una **base de conocimiento base** según el **tipo de negocio**, que el dueño puede
   editar o reemplazar.
2. **Textos de ayuda** en el módulo para que el dueño lo configure solo.
3. **Quitar el campo "Modelo" del UI del dueño** (es del sistema) y moverlo a una pantalla
   de **SUPERADMIN**.

## Decisiones de diseño

- **`organizations.business_type`** (columna nueva, texto). NO se toca la RPC
  `create_organization_with_owner` (evita reescribir su cuerpo + regenerar tipos).
- **Captura del rubro:** un select en el **signup** guarda `pending_business_type` en el
  metadata del usuario (como los demás `pending_*`). El **módulo del Agente** lo persiste
  al aplicar la plantilla; si `business_type` es null, el picker usa como sugerencia el
  valor del metadata (leído server-side en la página). Así el rubro viaja de signup →
  agente sin tocar la RPC ni sufrir el read-after-write lag.
- **Plantillas en código** (`business-templates.ts`): por rubro → prompt(orgName) +
  conocimiento base (frases editables). El motor ya acota al negocio y añade
  servicios/citas/knowledge, así que el prompt es solo el "carácter" del recepcionista.
- **Modelo:** `agent_configs.model` sigue existiendo (NOT NULL, default
  `openai/gpt-4o-mini`). Se quita del form del dueño; `saveAgentConfig` deja de tocarlo
  (en upsert, omitir la columna la preserva en conflicto y usa el default al insertar).
  Un **panel SUPERADMIN** (`/admin/agente`) lista las orgs y su modelo, con RPCs admin
  `admin_list_agent_models` / `admin_set_agent_model` (SECURITY DEFINER, gated a
  `super_admin`, mismo patrón que el resto del panel admin).

## Piezas

| Archivo | Rol |
|---|---|
| `supabase/migrations/20260723000000_agente_por_rubro.sql` | `organizations.business_type` + RPCs admin de modelo |
| `src/features/agente-ia/business-templates.ts` | Catálogo de rubros (prompt + conocimiento base) |
| `src/features/agente-ia/actions.ts` | `applyBusinessTemplate`, `setBusinessType`; `saveAgentConfig` sin `model` |
| `src/features/agente-ia/components/business-template-picker.tsx` | Card "Plantilla por tipo de negocio" (preview + aplicar) |
| `src/features/agente-ia/components/agent-config-form.tsx` | Quita el campo "Modelo"; añade ayuda |
| `src/app/(main)/dashboard/agente/page.tsx` | Lee `business_type` (o metadata) y monta el picker |
| `src/features/auth/components/signup-form.tsx` + `lib/validations/auth` | Select "Tipo de negocio" → metadata |
| `src/app/(admin)/admin/agente/page.tsx` + componente + acción | Pantalla SUPERADMIN del modelo |
| `src/app/(admin)/layout.tsx` | Enlace de nav "Agente IA" |

## Flujo del dueño

1. Entra a **Recepcionista IA**. Si aún no configuró el prompt, ve arriba la card
   **"Empieza con una plantilla"** con su rubro preseleccionado.
2. Elige rubro → ve el preview del prompt + las frases de conocimiento sugeridas.
3. "Usar esta plantilla" → rellena el prompt y agrega el conocimiento base (sin duplicar
   lo ya existente). Luego lo edita a su gusto en el form de abajo.
4. Si ya tenía un prompt propio, el botón avisa que lo **reemplazará**.

## Gotchas

- `saveAgentConfig` omite `model` en el upsert → lo preserva (default en insert). Verificar
  que un guardado del dueño NO ponga el modelo en null.
- `applyBusinessTemplate` NO pisa el conocimiento existente: solo agrega frases nuevas
  (dedup por contenido exacto).
- Las RPC admin devuelven también orgs SIN fila en `agent_configs` (left join → modelo
  default); `admin_set_agent_model` hace upsert (crea la fila si falta).
- Reemplazar el prompt es destructivo para el texto del dueño: requiere confirmación.

## Fuera de alcance (después)

- Sembrar servicios sugeridos por rubro (aquí solo prompt + conocimiento).
- CRM inteligente (nombre por el agente) y historial clínico — PRPs 3 y 4.
