import type { ChipTone } from '@/shared/components/ui/status-chip'
import type { MembershipState } from './logic'

// Piezas de vista compartidas por la ficha (cliente) y el tablero (servidor):
// viven fuera de los componentes 'use client' para poder usarse en ambos lados.

export type PlanOption = { id: string; name: string; duration_days: number; price: number | null }

export const STATE_TONE: Record<MembershipState, ChipTone> = {
  active: 'ok',
  expiring: 'wait',
  expired: 'noshow',
  cancelled: 'off',
  future: 'brand',
}

export const fmtDay = (ymd: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ymd}T12:00:00Z`))
