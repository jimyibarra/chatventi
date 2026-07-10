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
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Recepcionista IA</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            data-testid="agent-enabled"
          />
          <span className={enabled ? 'font-medium text-emerald-700' : 'text-gray-500'}>
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Instrucciones del agente (prompt del sistema)
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            data-testid="system-prompt"
            placeholder="Ej: Eres la recepcionista de la Barbería El Corte. Tono cercano y profesional…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-400">
            El agente siempre queda acotado a tu negocio (servicios, citas y base de conocimiento).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Modelo</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              data-testid="agent-model"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">Id de OpenRouter (ej. openai/gpt-4o-mini).</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Aprobación humana
            </label>
            <select
              value={approvalMode}
              onChange={(e) => setApprovalMode(e.target.value)}
              data-testid="approval-mode"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="off">Nunca (el agente responde solo)</option>
              <option value="low_confidence">Cuando el agente lo pida (recomendado)</option>
              <option value="always">Siempre (revisar cada respuesta)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Chat de Telegram para aprobaciones
          </label>
          <input
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            data-testid="approval-chat"
            placeholder="Ej: 123456789 (chat id donde llegan las propuestas)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-400">
            Escribe al bot desde ese chat para que pueda enviarte las aprobaciones.
          </p>
        </div>

        {msg && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
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
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </section>
  )
}
