import { describe, expect, it } from 'vitest'
import { addDays, endsOn, membershipState, renewalStart, todayMx } from './logic'

describe('membresías', () => {
  it('30 días desde el 1 vencen el 30', () => {
    expect(endsOn('2026-10-01', 30)).toBe('2026-10-30')
    expect(endsOn('2026-12-15', 30)).toBe('2027-01-13')
  })

  it('estado según la fecha de hoy', () => {
    const m = { starts_on: '2026-10-01', ends_on: '2026-10-30', cancelled: false }
    expect(membershipState(m, '2026-10-10')).toBe('active')
    expect(membershipState(m, '2026-10-25')).toBe('expiring')
    expect(membershipState(m, '2026-10-30')).toBe('expiring')
    expect(membershipState(m, '2026-10-31')).toBe('expired')
    expect(membershipState(m, '2026-09-30')).toBe('future')
    expect(membershipState({ ...m, cancelled: true }, '2026-10-10')).toBe('cancelled')
  })

  it('renovar: sigue al vencimiento vigente; si ya venció, empieza hoy', () => {
    expect(renewalStart('2026-10-30', '2026-10-25')).toBe('2026-10-31')
    expect(renewalStart('2026-10-30', '2026-11-05')).toBe('2026-11-05')
    expect(renewalStart(null, '2026-11-05')).toBe('2026-11-05')
  })

  it('hoy en México, no en UTC', () => {
    // 2026-10-18 04:00 UTC = 2026-10-17 22:00 en CDMX
    expect(todayMx(new Date('2026-10-18T04:00:00Z'))).toBe('2026-10-17')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})
