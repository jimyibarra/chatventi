'use client'

import { useMemo, useState, useTransition } from 'react'
import { BUSINESS_TEMPLATES, getTemplate, DEFAULT_TEMPLATE_KEY } from '../business-templates'
import { applyBusinessTemplate } from '../actions'

// Card "Empieza con una plantilla": propone el prompt + conocimiento base según
// el tipo de negocio. El dueño lo aplica y luego lo edita a su gusto.
export function BusinessTemplatePicker({
  orgName,
  currentBusinessType,
  suggestedType,
  hasCustomPrompt,
}: {
  orgName: string
  currentBusinessType: string | null
  suggestedType: string | null
  hasCustomPrompt: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState(
    currentBusinessType ?? suggestedType ?? DEFAULT_TEMPLATE_KEY
  )
  const [includeKnowledge, setIncludeKnowledge] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const template = useMemo(() => getTemplate(selected), [selected])
  const promptPreview = useMemo(() => template.prompt(orgName), [template, orgName])

  function apply() {
    if (hasCustomPrompt) {
      const ok = window.confirm(
        'Esto REEMPLAZARÁ tus instrucciones actuales del agente con la plantilla. ¿Continuar?'
      )
      if (!ok) return
    }
    setMsg(null)
    startTransition(async () => {
      const res = await applyBusinessTemplate(selected, includeKnowledge)
      if (res.ok) {
        // Reload DURO (no router.refresh): el form de config guarda su prompt en
        // useState y no se re-inicializa por props; sin recargar mostraría el
        // prompt viejo y un "Guardar" pisaría la plantilla recién aplicada.
        window.location.reload()
      } else {
        setMsg({ ok: false, text: res.error })
      }
    })
  }

  return (
    <section className="rounded-card border border-brand-200 bg-brand-50/50 p-5">
      <h2 className="text-base font-semibold text-ink">
        {hasCustomPrompt ? '¿Cambiar de plantilla?' : '✨ Empieza con una plantilla'}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Elige tu tipo de negocio y te proponemos las instrucciones del agente y una base de
        conocimiento. Es un punto de partida: lo puedes editar o reemplazar cuando quieras.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-muted">Tipo de negocio</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            data-testid="business-type"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-brand-400"
          >
            {BUSINESS_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.emoji} {t.label}
              </option>
            ))}
          </select>

          <label className="mt-3 flex items-start gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={includeKnowledge}
              onChange={(e) => setIncludeKnowledge(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>
              Agregar también la base de conocimiento sugerida
              <span className="block text-xs text-ink-faint">
                {template.knowledge.length} frase(s), sin duplicar lo que ya tengas.
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={apply}
            disabled={pending}
            data-testid="apply-template"
            className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
          >
            {pending
              ? 'Aplicando…'
              : hasCustomPrompt
                ? 'Reemplazar con esta plantilla'
                : 'Usar esta plantilla'}
          </button>

          {msg && (
            <p
              className={`mt-2 rounded-lg px-3 py-2 text-sm ${
                msg.ok ? 'bg-success-bg text-success' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {msg.text}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink-muted">Vista previa</label>
          <div className="rounded-lg border border-line bg-white p-3 text-xs leading-relaxed text-ink-soft">
            <p className="mb-2 whitespace-pre-wrap">{promptPreview}</p>
            {template.knowledge.length > 0 && (
              <ul className="ml-4 list-disc space-y-0.5 text-ink-faint">
                {template.knowledge.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
