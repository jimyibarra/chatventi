import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

// Reinicia el hilo del sandbox del usuario: borra su conversación de prueba
// (los mensajes caen en cascada) y su contacto sandbox. No hay citas que
// limpiar porque en sandbox las reservas son simuladas (ver runAgent).
export async function POST(): Promise<NextResponse> {
  const supabaseAuth = await createClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()
  const orgId = profile?.organization_id
  if (!orgId) return NextResponse.json({ error: 'sin_organizacion' }, { status: 400 })

  const externalId = `sandbox:${orgId}`
  const fromHandle = `sandbox:${user.id}`
  const admin = createServiceClient()

  const { data: channel } = await admin
    .from('channels')
    .select('id')
    .eq('type', 'web')
    .eq('external_id', externalId)
    .maybeSingle()

  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('organization_id', orgId)
    .eq('phone', fromHandle)
    .maybeSingle()

  if (channel?.id && client?.id) {
    await admin
      .from('conversations')
      .delete()
      .eq('channel_id', channel.id)
      .eq('client_id', client.id)
  }
  if (client?.id) {
    await admin.from('clients').delete().eq('id', client.id)
  }

  return NextResponse.json({ ok: true })
}
