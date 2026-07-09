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
          <h1 className="text-xl font-bold text-gray-900">Conexiones</h1>
          <p className="text-sm text-gray-500">
            Conecta el WhatsApp de tu negocio para que el asistente atienda por ese canal. Usa el
            inicio de sesión de Meta: eliges (o creas) tu cuenta de WhatsApp Business y tu número.
          </p>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h2 className="font-semibold text-gray-900">WhatsApp</h2>
          </div>

          {channels && channels.length > 0 ? (
            <ul className="mb-4 space-y-2">
              {channels.map((ch) => (
                <li
                  key={ch.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {ch.display_name ?? 'Número de WhatsApp'}
                    </p>
                    <p className="text-gray-500">
                      ID: {ch.external_id}
                      {ch.waba_id ? ` · WABA ${ch.waba_id}` : ''}
                    </p>
                  </div>
                  <span
                    className={
                      ch.status === 'active'
                        ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'
                        : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700'
                    }
                  >
                    {STATUS_LABEL[ch.status] ?? ch.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-gray-500">Todavía no has conectado ningún WhatsApp.</p>
          )}

          <EmbeddedSignupButton appId={appId} configId={configId} />
        </section>
      </div>
    </>
  )
}
