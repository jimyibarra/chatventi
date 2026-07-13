import { createClient } from '@/lib/supabase/server'
import { EmbeddedSignupButton } from '@/features/conexiones/components/embedded-signup-button'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  pending: 'Pendiente de activación',
  disabled: 'Desactivado',
}

export default async function ConexionesPage() {
  const supabase = await createClient()

  // Solo columnas NO secretas (nunca `credentials`, que trae el access_token).
  const { data: channels } = await supabase
    .from('channels')
    .select('id, type, external_id, waba_id, display_name, status')
    .eq('type', 'whatsapp')
    .order('created_at', { ascending: false })

  const appId = process.env.NEXT_PUBLIC_META_APP_ID ?? ''
  const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID ?? ''

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="text-xl font-bold text-ink">Conexiones</h1>
          <p className="text-sm text-ink-soft">
            Conecta el WhatsApp de tu negocio para que el asistente atienda por ese canal. Usa el
            inicio de sesión de Meta: eliges (o creas) tu cuenta de WhatsApp Business y tu número.
          </p>
        </div>

        <section className="rounded-card border border-line bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h2 className="font-semibold text-ink">WhatsApp</h2>
          </div>

          {channels && channels.length > 0 ? (
            <ul className="mb-4 space-y-2">
              {channels.map((ch) => (
                <li
                  key={ch.id}
                  className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-ink">
                      {ch.display_name ?? 'Número de WhatsApp'}
                    </p>
                    <p className="text-ink-soft">
                      ID: {ch.external_id}
                      {ch.waba_id ? ` · WABA ${ch.waba_id}` : ''}
                    </p>
                  </div>
                  <span
                    className={
                      ch.status === 'active'
                        ? 'rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success'
                        : 'rounded-full bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn'
                    }
                  >
                    {STATUS_LABEL[ch.status] ?? ch.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-ink-soft">Todavía no has conectado ningún WhatsApp.</p>
          )}

          <EmbeddedSignupButton appId={appId} configId={configId} />
        </section>
      </div>
    </>
  )
}
