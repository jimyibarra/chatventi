import { notFound } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  AppointmentManager,
  type PublicAppointment,
} from '@/features/cita-publica/components/appointment-manager'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Tu cita' }

const tokenSchema = z.string().uuid()

export default async function CitaPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const parsed = tokenSchema.safeParse(token)
  if (!parsed.success) notFound()

  const supabase = await createClient()
  const { data } = await supabase.rpc('get_appointment_by_token', { p_token: parsed.data })
  const ctx = data as unknown as PublicAppointment | null
  if (!ctx?.appointment) notFound()

  return (
    <div className="cv-panel min-h-screen bg-surface text-ink">
      <div className="mx-auto max-w-[520px] px-4 pb-10 pt-6 sm:pt-12">
        <AppointmentManager token={parsed.data} data={ctx} />
        <p className="mt-8 text-center text-[13px] text-ink-muted">Citas con tecnología de ChatVenti</p>
      </div>
    </div>
  )
}
