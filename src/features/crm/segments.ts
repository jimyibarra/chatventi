// Segmentación automática del CRM. Los umbrales son de negocio y viven aquí,
// visibles y fáciles de ajustar. El cálculo real está en la RPC get_crm_overview
// (mismos cortes); este módulo es solo la presentación.

export type Segment = 'nuevo' | 'regular' | 'vip'

// Cortes por nº de citas que cuentan como relación (scheduled+confirmed+completed).
export const SEGMENT_THRESHOLDS = { regular: 2, vip: 5 } as const

// Un cliente se considera inactivo si no tiene cita futura y su última visita
// fue hace más de estos días (palanca de reactivación).
export const INACTIVE_DAYS = 60

export const SEGMENT_META: Record<Segment, { label: string; badge: string }> = {
  vip: { label: 'VIP', badge: 'border-amber-300 bg-amber-50 text-amber-700' },
  regular: { label: 'Regular', badge: 'border-brand-200 bg-brand-50 text-brand-700' },
  nuevo: { label: 'Nuevo', badge: 'border-line bg-line-soft text-ink-muted' },
}

export type CrmClient = {
  id: string
  name: string | null
  phone: string | null
  created_at: string
  appt_count: number
  last_visit: string | null
  spent: number
  segment: Segment
  inactive: boolean
  tags: { id: string; name: string; color: string }[]
}

export type CrmStats = {
  total: number
  nuevo: number
  regular: number
  vip: number
  inactive: number
}
