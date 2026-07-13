'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveAgentConfig } from '../actions'

type Config = {
  enabled: boolean
  model: string
  approval_mode: string
  approval_telegram_chat_id: string | null
  system_prompt: string | null
} | null

export function AgentConfigForm({ config }: { config: Config }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [enabled, setEnabled] = useState(config?.enabled ?? false)
  const [model, setModel] = useState(config?.model ?? 'openai/gpt-4o-mini')
  const [approvalMode, setApprovalMode] = useState(config?.approval_mode ?? 'low_confidence')
  const [chatId, setChatId] = useState(config?.approval_telegram_chat_id ?? '')
  const [systemPrompt, setSystemPrompt] = useState(config?.system_prompt ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await saveAgentConfig({
        enabled,
        model,
        approvalMode,
        approvalTelegramChatId: chatId || undefined,
        systemPrompt: systemPrompt || undefined,
      })
      if (res.ok) {
        setMsg({ ok: true, text: 'Configuración guardada.' })
        router.refresh()
      } else {
        setMsg({ ok: false, text: res.error })
      }
    })
  }

  return (
    <section className="rounded-card border border-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Recepcionista IA</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            data-testid="agent-enabled"
          />
          <span className={enabled ? 'font-medium text-success' : 'text-ink-soft'}>
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-muted">
            Instrucciones del agente (prompt del sistema)
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            data-testid="system-prompt"
            placeholder="Ej: Eres la recepcionista de la Barbería El Corte. Tono cercano y profesional…"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-400"
          />
          <p className="mt-1 text-xs text-ink-faint">
            El agente siempre queda acotado a tu negocio (servicios, citas y base de conocimiento).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-muted">Modelo</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              data-testid="agent-model"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-400"
            />
            <p className="mt-1 text-xs text-ink-faint">Id de OpenRouter (ej. openai/gpt-4o-mini).</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-muted">
              Aprobación humana
            </label>
            <select
              value={approvalMode}
              onChange={(e) => setApprovalMode(e.target.value)}
              data-testid="approval-mode"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-400"
            >
              <option value="off">Nunca (el agente responde solo)</option>
              <option value="low_confidence">Cuando el agente lo pida (recomendado)</option>
              <option value="always">Siempre (revisar cada respuesta)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink-muted">
            Chat de Telegram para aprobaciones
          </label>
          <input
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            data-testid="approval-chat"
            placeholder="Ej: 123456789 (chat id donde llegan las propuestas)"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-400"
          />
          <p className="mt-1 text-xs text-ink-faint">
            Escribe al bot desde ese chat para que pueda enviarte las aprobaciones.
          </p>
        </div>

        {msg && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.ok ? 'bg-success-bg text-success' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {msg.text}
          </p>
        )}

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={pending}
            data-testid="save-agent"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </section>
  )
}
