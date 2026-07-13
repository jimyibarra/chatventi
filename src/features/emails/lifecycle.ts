import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from './mailer'
import { welcomeEmail, onboardingEmail } from './templates'

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.chatventi.com').replace(/\/$/, '')

/**
 * Envía (una sola vez) los correos de bienvenida y de onboarding completo del
 * dueño de una org. Idempotente vía `organizations.welcome_email_sent_at` /
 * `onboarding_email_sent_at`. Pensado para llamarse con `after()` desde el
 * dashboard: no debe lanzar (envuelto en try/catch) para no afectar el render.
 *
 * - Bienvenida: al aterrizar por primera vez con la org ya creada.
 * - Onboarding: cuando la agenda base está lista (servicio + horario +
 *   disponibilidad). NO exige WhatsApp ni cita real (dependen de Meta/uso).
 */
export async function runDashboardLifecycleEmails(userId: string): Promise<void> {
  try {
    const admin = createServiceClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .maybeSingle()
    const orgId = profile?.organization_id
    if (!orgId) return

    const { data: org } = await admin
      .from('organizations')
      .select('name, contact_email, welcome_email_sent_at, onboarding_email_sent_at')
      .eq('id', orgId)
      .maybeSingle()
    if (!org?.contact_email) return
    if (org.welcome_email_sent_at && org.onboarding_email_sent_at) return

    // 1) Bienvenida.
    if (!org.welcome_email_sent_at) {
      const { subject, html } = welcomeEmail({ orgName: org.name, siteUrl: SITE })
      if (await sendEmail({ to: org.contact_email, subject, html })) {
        await admin
          .from('organizations')
          .update({ welcome_email_sent_at: new Date().toISOString() })
          .eq('id', orgId)
      }
    }

    // 2) Onboarding completo = agenda base lista (servicio + horario + disponibilidad).
    if (!org.onboarding_email_sent_at) {
      const { data: branches } = await admin
        .from('branches')
        .select('id')
        .eq('organization_id', orgId)
      const branchIds = (branches ?? []).map((b) => b.id)

      const [svc, hrs, sch] = await Promise.all([
        admin
          .from('service_catalogs')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId),
        // .in con lista vacía cuenta 0 (no hay sucursales aún).
        admin.from('business_hours').select('id', { count: 'exact', head: true }).in('branch_id', branchIds),
        admin.from('staff_schedules').select('id', { count: 'exact', head: true }).in('branch_id', branchIds),
      ])

      const coreDone = (svc.count ?? 0) > 0 && (hrs.count ?? 0) > 0 && (sch.count ?? 0) > 0
      if (coreDone) {
        const { subject, html } = onboardingEmail({ orgName: org.name, siteUrl: SITE })
        if (await sendEmail({ to: org.contact_email, subject, html })) {
          await admin
            .from('organizations')
            .update({ onboarding_email_sent_at: new Date().toISOString() })
            .eq('id', orgId)
        }
      }
    }
  } catch (e) {
    console.error('[emails] runDashboardLifecycleEmails error', e)
  }
}
