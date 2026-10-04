'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe'
import { consumeRateLimit } from '@/shared/security/rate-limit'
import { sendEmail } from '@/features/emails/mailer'
import { LEGAL } from '@/shared/constants/legal'
import { fmtAmount } from './plans'

const REASONS = {
  duplicado: 'Me cobraron dos veces',
  no_reconozco: 'No reconozco este cargo',
  monto: 'El monto no es el correcto',
  otro: 'Otro motivo',
} as const

const schema = z.object({
  invoiceId: z.string().regex(/^in_[A-Za-z0-9]+$/),
  reason: z.enum(['duplicado', 'no_reconozco', 'monto', 'otro']),
  message: z.string().trim().min(5, 'Cuéntanos qué pasó (al menos 5 letras).').max(1000),
})

export type ClarifyResult = { ok: true } | { ok: false; error: string }

/** Escapa lo que escribe el usuario antes de meterlo en el correo HTML. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/**
 * «Aclarar este pago»: el dueño o gerente reporta un problema con un cobro.
 * Se comprueba en Stripe que la factura sea SUYA, se guarda el caso y le
 * llega a soporte con todos los datos para resolverlo.
 */
export async function requestPaymentClarification(raw: unknown): Promise<ClarifyResult> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisa los datos.' }
  const { invoiceId, reason, message } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado.' }
  const [{ data: orgId }, { data: role }] = await Promise.all([supabase.rpc('get_my_org'), supabase.rpc('get_my_role')])
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }
  if (role !== 'owner' && role !== 'manager') return { ok: false, error: 'Solo el dueño o el gerente pueden aclarar un pago.' }

  const allowed = await consumeRateLimit({ bucket: 'billing_inquiry', key: orgId, limit: 5, windowSeconds: 24 * 60 * 60 })
  if (!allowed) return { ok: false, error: 'Ya enviaste varias aclaraciones hoy. Te respondemos pronto; si es urgente, escribe a soporte.' }

  const admin = createServiceClient()
  const [{ data: sub }, { data: org }, { data: open }] = await Promise.all([
    admin.from('subscriptions').select('stripe_customer_id').eq('organization_id', orgId).maybeSingle(),
    admin.from('organizations').select('name').eq('id', orgId).maybeSingle(),
    admin
      .from('billing_inquiries')
      .select('id')
      .eq('organization_id', orgId)
      .eq('stripe_invoice_id', invoiceId)
      .eq('status', 'open')
      .limit(1),
  ])
  if (open?.length) return { ok: false, error: 'Ya hay una aclaración abierta para este pago. Te respondemos pronto.' }

  // La factura debe ser del cliente de Stripe de ESTA organización.
  let invoice
  try {
    invoice = await getStripe().invoices.retrieve(invoiceId)
  } catch {
    return { ok: false, error: 'No encontramos ese pago.' }
  }
  if (!sub?.stripe_customer_id || invoice.customer !== sub.stripe_customer_id) {
    return { ok: false, error: 'No encontramos ese pago.' }
  }

  const amount = invoice.total / 100
  const { error } = await admin.from('billing_inquiries').insert({
    organization_id: orgId,
    created_by: user.id,
    stripe_invoice_id: invoiceId,
    invoice_number: invoice.number,
    amount,
    currency: invoice.currency,
    reason,
    message,
  })
  if (error) {
    console.error('[aclaracion] no se pudo guardar', error.message)
    return { ok: false, error: 'No se pudo enviar. Inténtalo de nuevo.' }
  }

  const amountLabel = `${fmtAmount(amount)} ${invoice.currency.toUpperCase()}`
  await sendEmail({
    to: LEGAL.contactEmail,
    subject: `Aclaración de pago · ${org?.name ?? 'Negocio'} · ${amountLabel}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1f2937">
      <p><strong>${esc(org?.name ?? 'Negocio')}</strong> pidió aclarar un pago.</p>
      <p>Motivo: <strong>${REASONS[reason]}</strong><br/>Factura: ${esc(invoice.number ?? invoiceId)} · ${amountLabel}<br/>
      Quién: ${esc(user.email ?? '')}</p>
      <p style="white-space:pre-wrap;background:#f4f2fe;border-radius:8px;padding:10px 12px">${esc(message)}</p>
      <p>Resuélvelo en Stripe (Clientes → la factura) y márcalo como resuelto en /admin.</p>
    </div>`,
  })

  revalidatePath('/dashboard/facturacion')
  return { ok: true }
}
