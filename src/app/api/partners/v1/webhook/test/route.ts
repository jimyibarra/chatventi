import { NextResponse, type NextRequest } from 'next/server'
import { apiError, authenticatePartner } from '@/features/socios/service'
import { getWebhookConfig, sendTestDelivery } from '@/features/socios/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/partners/v1/webhook/test — manda un `webhook.test` firmado y dice cómo le fue. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticatePartner(request)
  if (auth instanceof NextResponse) return auth
  const cfg = await getWebhookConfig(auth.service, auth.partner.id)
  if (!cfg.url) return apiError('no_webhook', 409, 'Primero registra el endpoint con PUT /webhook.')
  try {
    return NextResponse.json(await sendTestDelivery(auth.service, auth.partner.id), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[socios] webhook test', err instanceof Error ? err.message : err)
    return apiError('update_failed', 500)
  }
}
