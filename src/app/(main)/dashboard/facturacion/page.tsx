import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMySubscription, subIsActive } from '@/features/billing/gating'
import { BillingClient } from '@/features/billing/components/billing-client'

export const dynamic = 'force-dynamic'

export default async function FacturacionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sub = await getMySubscription()
  const active = subIsActive(sub)

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Facturación</h1>
        <p className="mt-1 text-gray-600">
          Paga solo por lo que usas. Base con agenda, CRM y reservas web; suma el módulo de
          Recepcionista IA cuando lo necesites.
        </p>
      </div>

      <BillingClient
        sub={
          sub
            ? {
                status: sub.status,
                ai_tier: sub.ai_tier,
                current_period_end: sub.current_period_end,
                cancel_at_period_end: sub.cancel_at_period_end,
              }
            : null
        }
        active={active}
      />
    </div>
  )
}
