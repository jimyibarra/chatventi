import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError, authenticatePartner } from '@/features/socios/service'
import { clearWebhook, getWebhookConfig, setWebhook, validateWebhookUrl } from '@/features/socios/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/** GET /api/partners/v1/webhook — el endpoint registrado (sin el secreto). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticatePartner(request)
  if (auth instanceof NextResponse) return auth
  return NextResponse.json(await getWebhookConfig(auth.service, auth.partner.id), { headers: NO_STORE })
}

/** PUT /api/partners/v1/webhook { url } — registra (o reemplaza) el endpoint y devuelve un secreto NUEVO, una sola vez. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticatePartner(request)
  if (auth instanceof NextResponse) return auth
  const parsed = z.object({ url: z.string().trim().min(1).max(500) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return apiError('invalid_body', 400, 'url: obligatoria (https).')
  const valid = validateWebhookUrl(parsed.data.url)
  if (!valid.ok) return apiError('invalid_body', 400, `url: ${valid.error}`)
  try {
    const { secret, createdAt } = await setWebhook(auth.service, auth.partner.id, valid.url)
    return NextResponse.json({ url: valid.url, secret, createdAt }, { headers: NO_STORE })
  } catch (err) {
    console.error('[socios] webhook put', err instanceof Error ? err.message : err)
    return apiError('update_failed', 500)
  }
}

/** DELETE /api/partners/v1/webhook — quita el endpoint; lo pendiente se descarta. */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticatePartner(request)
  if (auth instanceof NextResponse) return auth
  try {
    await clearWebhook(auth.service, auth.partner.id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[socios] webhook delete', err instanceof Error ? err.message : err)
    return apiError('update_failed', 500)
  }
}
