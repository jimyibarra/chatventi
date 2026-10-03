'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveAgentConfig } from '../actions'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Field, Input, Select, Switch, Textarea } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'

type Config = {
  enabled: boolean
  approval_mode: string
  approval_telegram_chat_id: string | null
  system_prompt: string | null
} | null

export function AgentConfigForm({ config }: { config: Config }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [enabled, setEnabled] = useState(config?.enabled ?? false)
  const [approvalMode, setApprovalMode] = useState(config?.approval_mode ?? 'low_confidence')
  const [chatId, setChatId] = useState(config?.approval_telegram_chat_id ?? '')
  const [systemPrompt, setSystemPrompt] = useState(config?.system_prompt ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await saveAgentConfig({
        enabled,
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
    <Card as="section" padded={false} className="overflow-hidden" aria-label="Recepcionista IA">
      {/* Cabecera de tinta: la misma tarjeta de énfasis que la recepcionista del Panel. */}
      <div className="flex flex-wrap items-center gap-3 bg-ink px-4 py-4 text-white md:px-5">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-brand-500" aria-hidden>
          <Icon name="robot" className="h-[22px] w-[22px]" />
        </span>
        <div className="mr-auto min-w-0">
          <h2 className="text-[1.15rem] font-bold leading-tight">Recepcionista IA</h2>
          <p className="text-[13.5px] text-[#dcd8f7]">
            {config?.enabled
              ? 'Atiende a tus clientes por ti.'
              : 'En pausa: los mensajes esperan a que alguien del equipo conteste.'}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-[13px] bg-white/10 py-2 pl-3 pr-2.5">
          <span className={`text-[14px] font-semibold ${enabled ? 'text-[#4ade80]' : 'text-white/80'}`}>
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
          <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} data-testid="agent-enabled" />
        </label>
      </div>

      <div className="space-y-4 p-4 md:p-5">
        <Field
          label="Instrucciones del agente (prompt del sistema)"
          hint="El agente siempre queda acotado a tu negocio (servicios, citas y base de conocimiento)."
        >
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={6}
            data-testid="system-prompt"
            placeholder="Ej: Eres la recepcionista de la Barbería El Corte. Tono cercano y profesional…"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Aprobación humana" hint="Cuándo una respuesta espera tu visto bueno antes de enviarse.">
            <Select value={approvalMode} onChange={(e) => setApprovalMode(e.target.value)} data-testid="approval-mode">
              <option value="off">Nunca (el agente responde solo)</option>
              <option value="low_confidence">Cuando el agente lo pida (recomendado)</option>
              <option value="always">Siempre (revisar cada respuesta)</option>
            </Select>
          </Field>

          <Field label="Chat de Telegram para aprobaciones" hint="Escribe al bot desde ese chat para que pueda enviarte las aprobaciones.">
            <Input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              data-testid="approval-chat"
              placeholder="Ej: 123456789"
              className="tabular-nums"
            />
          </Field>
        </div>

        {msg && (
          <Notice tone={msg.ok ? 'success' : 'danger'} size="sm">
            {msg.text}
          </Notice>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
          <p className="mr-auto text-[13px] text-ink-muted">El interruptor de arriba se aplica al guardar.</p>
          <Button onClick={save} disabled={pending} data-testid="save-agent">
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
