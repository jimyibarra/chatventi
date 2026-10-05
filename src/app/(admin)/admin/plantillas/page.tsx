import type { Metadata } from 'next'
import { WA_TEMPLATES } from '@/features/agente-ia/wa-templates'
import { getTemplateBoard } from '@/features/wa-plantillas/service'
import { getPartnerOrigins } from '@/features/admin/service'
import { TemplateChip } from '@/features/wa-plantillas/components/template-chip'
import { PublishButton } from '@/features/wa-plantillas/components/publish-button'
import { AdminTable, STICKY, TD, TH, TR } from '@/features/admin/components/admin-table'
import { EmptyState, Notice, Page, PageHeader, StatusChip } from '@/shared/components/ui'

export const metadata: Metadata = { title: 'Super Admin · Plantillas' }
export const dynamic = 'force-dynamic'

/** Muestra «{{1}}» como «[1]»: se lee como hueco que llena ChatVenti. */
const preview = (body: string) => body.replace(/\{\{(\d+)\}\}/g, '[$1]')

/** Plantillas de WhatsApp: qué usa ChatVenti y en qué estado las tiene Meta en cada negocio. */
export default async function AdminPlantillasPage() {
  const [board, origins] = await Promise.all([getTemplateBoard(), getPartnerOrigins()])
  const missing = board.some((c) => !c.error && Object.values(c.states).some((s) => s.state === 'missing'))

  return (
    <Page width="wide">
      <PageHeader
        title="Plantillas de WhatsApp"
        subtitle="Fuera de las 24 horas desde el último mensaje del cliente, Meta solo deja escribirle con una plantilla aprobada. ChatVenti las da de alta en la cuenta de WhatsApp de cada negocio (también los de socios como PASEN); Meta las revisa en minutos."
        actions={board.length > 0 ? <PublishButton scope="admin" label="Pedir las que falten en todos" variant={missing ? 'primary' : 'secondary'} /> : undefined}
      />

      <h2 className="mb-2.5 text-[1.15rem] font-bold leading-tight text-ink">Por negocio</h2>
      {board.length === 0 ? (
        <EmptyState icon="whatsapp" title="Ningún negocio ha conectado WhatsApp">
          Cuando un negocio conecte su número desde Conexiones, aquí verás si Meta aprobó sus plantillas.
        </EmptyState>
      ) : (
        <AdminTable label="Estado de las plantillas por negocio" minWidth={1080}>
          <thead>
            <tr>
              <th scope="col" className={`${TH} ${STICKY}`}>Negocio</th>
              {WA_TEMPLATES.map((t) => (
                <th key={t.key} scope="col" className={TH} title={t.label}>{t.short}</th>
              ))}
              <th scope="col" className={TH}><span className="sr-only">Acción</span></th>
            </tr>
          </thead>
          <tbody>
            {board.map((c) => {
              const partner = origins.get(c.orgId)
              const lacks = Object.values(c.states).some((s) => s.state === 'missing')
              return (
                <tr key={c.channelId} className={TR} data-testid="tpl-row">
                  <th scope="row" className={`${TD} ${STICKY} max-w-[15rem] text-left font-normal`}>
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                      {c.orgName}
                      {partner && <StatusChip tone="brand">{partner.name}</StatusChip>}
                    </p>
                    <p className="truncate text-[12.5px] text-ink-muted">{c.phone ?? 'WhatsApp'}</p>
                  </th>
                  {c.error ? (
                    <td colSpan={WA_TEMPLATES.length} className={TD}>
                      <Notice tone="danger">No se pudo consultar a Meta: {c.error}</Notice>
                    </td>
                  ) : (
                    WA_TEMPLATES.map((t) => (
                      <td key={t.key} className={`${TD} whitespace-nowrap`}>
                        <TemplateChip state={c.states[t.key].state} reason={c.states[t.key].reason} />
                        {c.states[t.key].reason && <p className="mt-1 max-w-[11rem] whitespace-normal text-[12px] leading-snug text-[#a51b18]">{c.states[t.key].reason}</p>}
                      </td>
                    ))
                  )}
                  <td className={`${TD} whitespace-nowrap`}>
                    {(lacks || c.error) && <PublishButton scope="admin" channelId={c.channelId} label="Pedir las que falten" variant="secondary" size="sm" />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </AdminTable>
      )}

      <h2 className="mb-2.5 mt-8 text-[1.15rem] font-bold leading-tight text-ink">Catálogo</h2>
      <p className="mb-3 max-w-[70ch] text-[14px] text-ink-muted">
        Cada plantilla es de un mensaje automático y ChatVenti llena sus huecos ([1], [2]…) al enviarla. Las de
        Marketing las cobra Meta más caras, al negocio. Cambiar un texto es una plantilla nueva (sube su versión, _v2).
      </p>
      <AdminTable label="Catálogo de plantillas" minWidth={900}>
        <thead>
          <tr>
            <th scope="col" className={`${TH} ${STICKY}`}>Para qué</th>
            <th scope="col" className={TH}>Categoría</th>
            <th scope="col" className={TH}>Texto</th>
          </tr>
        </thead>
        <tbody>
          {WA_TEMPLATES.map((t) => (
            <tr key={t.key} className={TR}>
              <th scope="row" className={`${TD} ${STICKY} max-w-[16rem] text-left font-normal`}>
                <p className="font-semibold">{t.label}</p>
                <p className="font-mono text-[12px] text-ink-muted">{t.name}</p>
              </th>
              <td className={TD}>
                <StatusChip tone={t.category === 'UTILITY' ? 'neutral' : 'brand'}>{t.category === 'UTILITY' ? 'Aviso' : 'Marketing'}</StatusChip>
              </td>
              <td className={`${TD} max-w-[34rem] whitespace-pre-line text-[13.5px] leading-snug`}>
                {preview(t.body)}
                {t.buttons && <span className="mt-1 block text-ink-muted">Botones: {t.buttons.map((b) => b.text).join(' · ')}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </Page>
  )
}
