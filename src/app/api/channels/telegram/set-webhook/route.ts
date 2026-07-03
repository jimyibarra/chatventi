import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------
// POST /api/channels/telegram/set-webhook
// Registra (o re-registra) el webhook del bot en la Bot API de Telegram.
// Protegido con CRON_SECRET (header Authorization: Bearer <CRON_SECRET>).
// Body opcional: { url?: string } para override del callback.
// ---------------------------------------------------------------------
const bodySchema = z.object({ url: z.string().url().optional() }).optional()

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!botToken || !webhookSecret) {
    return NextResponse.json(
      { error: 'faltan TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET' },
      { status: 500 }
    )
  }

  let parsedBody: z.infer<typeof bodySchema> = undefined
  try {
    const json = await request.json().catch(() => ({}))
    parsedBody = bodySchema.parse(json)
  } catch {
    parsedBody = undefined
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const callbackUrl = parsedBody?.url ?? `${siteUrl}/api/channels/telegram`
  if (!callbackUrl.startsWith('https://')) {
    return NextResponse.json(
      { error: 'la URL del webhook debe ser https', callbackUrl },
      { status: 400 }
    )
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: callbackUrl,
      secret_token: webhookSecret,
      allowed_updates: ['message', 'edited_message'],
    }),
  })

  const result: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    return NextResponse.json({ error: 'telegram setWebhook fallo', result }, { status: 502 })
  }
  return NextResponse.json({ ok: true, callbackUrl, result })
}
