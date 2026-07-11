import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
  deviceInfo: z
    .object({
      platform: z.string().optional(),
      language: z.string().optional(),
      userAgent: z.string().optional(),
    })
    .optional(),
  oldEndpoint: z.string().optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = subscribeSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }
    const { subscription, deviceInfo, oldEndpoint } = parsed.data

    // El usuario se deriva de la SESIÓN (no se confía en el body).
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = createServiceClient()

    // Cambio de suscripción del browser: eliminar la anterior.
    if (oldEndpoint) {
      await service.from('push_subscriptions').delete().eq('endpoint', oldEndpoint)
    }

    const { data: existing } = await service
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', subscription.endpoint)
      .maybeSingle()

    if (existing) {
      await service
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', existing.id)
      return NextResponse.json({ success: true, subscription_id: existing.id })
    }

    const { data, error } = await service
      .from('push_subscriptions')
      .insert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        device_name: deviceInfo?.platform ?? null,
        browser: deviceInfo?.language ?? null,
        user_agent: deviceInfo?.userAgent ?? '',
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, subscription_id: data.id })
  } catch (err) {
    console.error('[notifications/subscribe] error', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { endpoint } = (await request.json()) as { endpoint?: string }
    if (!endpoint) return NextResponse.json({ error: 'endpoint requerido' }, { status: 400 })

    // Solo el dueño de la sesión puede borrar sus suscripciones.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    await service
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notifications/subscribe] delete error', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
