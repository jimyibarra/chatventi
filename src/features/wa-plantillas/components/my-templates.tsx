import { WA_TEMPLATES } from '@/features/agente-ia/wa-templates'
import { Section } from '@/shared/components/ui/card'
import { Notice } from '@/shared/components/ui/notice'
import { getTemplateBoard } from '../service'
import { TemplateChip } from './template-chip'
import { PublishButton } from './publish-button'

// Conexiones → estado de las plantillas del WhatsApp del negocio. Solo lectura
// más un botón para pedir las que falten; el texto lo define ChatVenti.
export async function MyTemplates({ orgId }: { orgId: string }) {
  const board = await getTemplateBoard({ orgId }).catch(() => [])
  if (board.length === 0) return null
  const lacks = board.some((c) => c.error || Object.values(c.states).some((s) => s.state === 'missing'))

  return (
    <Section
      title="Mensajes automáticos por WhatsApp"
      description="Para escribirle a un cliente después de 24 horas sin mensajes (recordatorios, seguimiento), Meta pide plantillas aprobadas. Las pedimos por ti y Meta las revisa en unos minutos. Por Instagram, Messenger y Telegram no hacen falta."
      data-testid="my-templates"
    >
      {board.map((c) => (
        <div key={c.channelId} className="mb-4">
          {board.length > 1 && <p className="mb-2 text-[13.5px] font-semibold text-ink-muted">{c.phone ?? 'WhatsApp'}</p>}
          {c.error ? (
            <Notice tone="danger">No pudimos consultar tus plantillas en Meta: {c.error}</Notice>
          ) : (
            <ul className="divide-y divide-line-row rounded-[14px] bg-surface">
              {WA_TEMPLATES.map((t) => (
                <li key={t.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3.5 py-2.5">
                  <span className="min-w-0 flex-1 basis-[14rem] text-[14.5px] text-ink">
                    {t.label}
                    {c.states[t.key].reason && <span className="block text-[12.5px] text-[#a51b18]">{c.states[t.key].reason}</span>}
                  </span>
                  <TemplateChip state={c.states[t.key].state} reason={c.states[t.key].reason} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {lacks && <PublishButton scope="owner" label="Pedir las que faltan" variant="secondary" />}
      <p className="mt-3 max-w-[65ch] text-[13px] leading-snug text-ink-muted">
        El rescate de interesados y los recordatorios del expediente son de categoría Marketing: Meta los cobra a tu
        cuenta de WhatsApp como mensaje de marketing.
      </p>
    </Section>
  )
}
