import 'server-only'
import { getStripe } from '@/lib/stripe'

// Historial de pagos del negocio, leído de Stripe (la fuente de verdad del
// cobro). Lo muestra Facturación; cada fila puede abrir una aclaración.

export type PaymentRow = {
  id: string
  number: string | null
  /** ISO de la fecha de la factura. */
  date: string
  concept: string
  total: number
  currency: string
  /** paid | open | void | uncollectible */
  status: string
  /** Página de Stripe con el recibo (y el botón de pagar si está pendiente). */
  url: string | null
  pdf: string | null
}

// Concepto en español según por qué se emitió la factura. Las descripciones
// automáticas de Stripe salen en inglés («Unused time on…», «1 × … (at $799.00
// / month)»); las nuestras (excedente de IA) ya vienen en español.
const REASON_LABEL: Record<string, string> = {
  subscription_create: 'Alta de tu plan',
  subscription_cycle: 'Renovación de tu plan',
  subscription_update: 'Cambio de plan · ajuste proporcional',
}

/** Últimas 24 facturas del cliente de Stripe (sin borradores). Nunca lanza. */
export async function listPayments(customerId: string): Promise<PaymentRow[]> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return []
  try {
    const list = await getStripe().invoices.list({ customer: customerId, limit: 24 })
    return list.data
      .filter((i) => i.status !== 'draft')
      .map((i) => ({
        id: i.id ?? '',
        number: i.number ?? null,
        date: new Date(i.created * 1000).toISOString(),
        concept:
          REASON_LABEL[i.billing_reason ?? ''] ?? i.description ?? i.lines.data[0]?.description ?? 'Cargo de ChatVenti',
        total: i.total / 100,
        currency: i.currency,
        status: i.status ?? 'open',
        url: i.hosted_invoice_url ?? null,
        pdf: i.invoice_pdf ?? null,
      }))
  } catch (e) {
    console.error('[pagos] no se pudo leer el historial', e)
    return []
  }
}
