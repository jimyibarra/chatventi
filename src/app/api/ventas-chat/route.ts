import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { salesReply, type SalesTurn } from '@/features/ventas-agente/brain'
import { consumeRateLimit } from '@/shared/security/rate-limit'
import { getClientIp } from '@/shared/security/request-context'
import { ONE_HOUR_SECONDS, VENTAS_MAX_PER_IP_PER_HOUR } from '@/shared/security/limits'

export const runtime = 'nodejs'

// Agente de VENTAS de la landing (Pieza A). Sin estado en BD: el historial viaja
// desde el navegador. Acotado por IP para proteger el saldo de OpenRouter.
const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        // Las respuestas del asesor pueden ser largas (los pasos para conectar
        // WhatsApp pasan de 600 caracteres). Con el tope antiguo de 600 para
        // todo, el mensaje SIGUIENTE a una respuesta larga se rechazaba y el
        // chat se rompía. El tope corto se aplica solo a lo que escribe el
        // visitante.
        content: z.string().trim().min(1).max(2400),
      })
    )
    .min(1)
    .max(24)
    .refine((list) => list.every((m) => m.role === 'assistant' || m.content.length <= 600), {
      message: 'mensaje demasiado largo',
    }),
})

const FALLBACK =
  'Perdona, se me cruzaron los cables un segundo 😅 ¿Me repites tu pregunta? Mientras, puedes empezar tu prueba gratis en el botón de arriba.'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  // Último mensaje debe ser del usuario (es a lo que respondemos).
  const history = parsed.data.messages as SalesTurn[]
  if (history[history.length - 1]?.role !== 'user') {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const ip = getClientIp(request.headers)
  const ok = await consumeRateLimit({
    bucket: 'ventas_ip',
    key: ip,
    limit: VENTAS_MAX_PER_IP_PER_HOUR,
    windowSeconds: ONE_HOUR_SECONDS,
  })
  if (!ok) {
    return NextResponse.json({
      reply:
        'Has preguntado bastante 😊 Para seguir, lo mejor es crear tu cuenta gratis (14 días, sin tarjeta) y probarlo con tu propio negocio.',
      limited: true,
    })
  }

  const reply = await salesReply(history)
  return NextResponse.json({ reply: reply ?? FALLBACK })
}
