import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { dispatchPartnerWebhooks } from '@/features/socios/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/partner-webhooks — despacha las entregas pendientes de los
 * webhooks de socios. Lo despierta el disparador de citas (pg_net) y, de
 * respaldo, la corrida de cada 15 min. Mismo secreto que el resto del cron.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const summary = await dispatchPartnerWebhooks(createServiceClient(), { limit: 50 })
  return NextResponse.json({ ok: true, ...summary })
}
