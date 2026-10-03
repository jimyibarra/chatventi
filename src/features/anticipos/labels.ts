// Anticipos: nombres, tonos y transiciones permitidas. Sin nada de servidor:
// lo usan tanto los componentes como las acciones.

export type DepositStatus =
  | 'pending'
  | 'proof_received'
  | 'paid'
  | 'retained'
  | 'refund_due'
  | 'refunded'
  | 'expired'
  | 'void'
  | 'waived'

export const DEPOSIT_LABEL: Record<DepositStatus, string> = {
  pending: 'Esperando comprobante',
  proof_received: 'Comprobante por revisar',
  paid: 'Anticipo recibido',
  retained: 'Anticipo retenido',
  refund_due: 'Anticipo por devolver',
  refunded: 'Anticipo devuelto',
  expired: 'No llegó a tiempo',
  void: 'Sin efecto',
  waived: 'Anticipo perdonado',
}

/**
 * Tono del chip (mismos estados que `.ln-chip`): amarillo = te toca hacer algo,
 * verde = resuelto a favor, tinta = retenido, gris = cerrado sin dinero.
 */
export const DEPOSIT_TONE: Record<DepositStatus, 'wait' | 'ok' | 'now' | 'noshow' | undefined> = {
  pending: 'wait',
  proof_received: 'wait',
  paid: 'ok',
  retained: 'now',
  refund_due: 'wait',
  refunded: 'ok',
  expired: undefined,
  void: undefined,
  waived: undefined,
}

/** Lo que el negocio puede hacer a mano desde cada estado. */
export const DEPOSIT_NEXT: Record<DepositStatus, { to: DepositStatus; label: string }[]> = {
  pending: [
    { to: 'paid', label: 'Ya me pagó' },
    { to: 'waived', label: 'No pedir anticipo' },
  ],
  proof_received: [
    { to: 'paid', label: 'Confirmar: sí llegó' },
    { to: 'pending', label: 'No llegó el dinero' },
  ],
  paid: [
    { to: 'refund_due', label: 'Hay que devolverlo' },
    { to: 'retained', label: 'Retenerlo' },
  ],
  retained: [{ to: 'refund_due', label: 'Mejor devolverlo' }],
  refund_due: [
    { to: 'refunded', label: 'Ya lo devolví' },
    { to: 'retained', label: 'Retenerlo' },
  ],
  refunded: [],
  expired: [],
  void: [],
  waived: [],
}

export function isDepositStatus(v: unknown): v is DepositStatus {
  return typeof v === 'string' && v in DEPOSIT_LABEL
}

/** "$1,250" (formato de México: coma de miles). */
export function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0)
  return `$${v.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
}
