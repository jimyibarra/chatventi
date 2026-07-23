import type { Tables } from '@/lib/supabase/database.types'

export type ClientFile = Tables<'client_files'>
export type ClientRecord = Tables<'client_records'>
export type ClientReminder = Tables<'client_reminders'>

export type RecordKind = 'service' | 'purchase' | 'note'

export const RECORD_KIND_META: Record<RecordKind, { label: string; badge: string }> = {
  service: { label: 'Servicio', badge: 'border-brand-200 bg-brand-50 text-brand-700' },
  purchase: { label: 'Compra', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  note: { label: 'Nota', badge: 'border-line bg-line-soft text-ink-muted' },
}

// Atajos de periodicidad. Cubren los casos que pidió Juan (volver a cortarse,
// limpieza dental cada 6 meses) sin obligar a pensar en días.
export const REMINDER_PRESETS: { label: string; days: number }[] = [
  { label: 'Cada 2 semanas', days: 14 },
  { label: 'Cada 3 semanas', days: 21 },
  { label: 'Cada mes', days: 30 },
  { label: 'Cada 3 meses', days: 90 },
  { label: 'Cada 6 meses', days: 182 },
  { label: 'Cada año', days: 365 },
]
