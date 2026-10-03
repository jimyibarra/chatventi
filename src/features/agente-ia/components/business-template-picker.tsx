'use client'

import { useMemo, useState, useTransition } from 'react'
import { BUSINESS_TEMPLATES, getTemplate, DEFAULT_TEMPLATE_KEY } from '../business-templates'
import { applyBusinessTemplate } from '../actions'
import { Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { CHECKBOX, Field, Select } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'

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
    <Section
      title={hasCustomPrompt ? '¿Cambiar de plantilla?' : 'Empieza con una plantilla'}
      description="Elige tu tipo de negocio y te proponemos las instrucciones del agente y una base de conocimiento. Es un punto de partida: lo puedes editar o reemplazar cuando quieras."
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <Field label="Tipo de negocio">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)} data-testid="business-type">
              {BUSINESS_TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[14.5px] text-ink">
            <input
              type="checkbox"
              checked={includeKnowledge}
              onChange={(e) => setIncludeKnowledge(e.target.checked)}
              className={`${CHECKBOX} mt-0.5`}
            />
            <span>
              Agregar también la base de conocimiento sugerida
              <span className="block text-[13px] text-ink-muted">
                {template.knowledge.length} frase(s), sin duplicar lo que ya tengas.
              </span>
            </span>
          </label>

          <Button onClick={apply} disabled={pending} data-testid="apply-template" variant={hasCustomPrompt ? 'secondary' : 'primary'} className="mt-4">
            <Icon name="sparkle" />
            {pending
              ? 'Aplicando…'
              : hasCustomPrompt
                ? 'Reemplazar con esta plantilla'
                : 'Usar esta plantilla'}
          </Button>

          {msg && (
            <p className={`mt-2.5 text-sm ${msg.ok ? 'text-[#0b5d36]' : 'text-[#a51b18]'}`} role={msg.ok ? 'status' : 'alert'}>
              {msg.text}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <p className="mb-1.5 text-[13.5px] font-semibold text-ink">Vista previa</p>
          <div className="max-h-64 overflow-y-auto rounded-[16px] bg-surface p-3.5 text-[13.5px] leading-relaxed text-ink-muted">
            <p className="mb-2 whitespace-pre-wrap">{promptPreview}</p>
            {template.knowledge.length > 0 && (
              <ul className="space-y-1">
                {template.knowledge.map((k) => (
                  <li key={k} className="flex gap-2">
                    <Icon name="book" className="mt-0.5 h-3.5 w-3.5 text-brand-500" />
                    <span>{k}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Section>
  )
}
