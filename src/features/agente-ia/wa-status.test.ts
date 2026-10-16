import { describe, expect, it } from 'vitest'
import { parseWaStatuses, waStatusLabel } from './wa-status'

describe('parseWaStatuses', () => {
  it('lee entregado y leído con su hora', () => {
    const out = parseWaStatuses({
      statuses: [
        { id: 'wamid.A', status: 'delivered', timestamp: '1760630400', recipient_id: '5215500000000' },
        { id: 'wamid.B', status: 'read', timestamp: '1760630460' },
      ],
    })
    expect(out).toEqual([
      { extId: 'wamid.A', status: 'delivered', at: new Date(1760630400 * 1000).toISOString(), error: null },
      { extId: 'wamid.B', status: 'read', at: new Date(1760630460 * 1000).toISOString(), error: null },
    ])
  })

  it('guarda código y título cuando falla', () => {
    const [s] = parseWaStatuses({
      statuses: [{ id: 'wamid.C', status: 'failed', timestamp: '1760630400', errors: [{ code: 131042, title: 'Business eligibility payment issue' }] }],
    })
    expect(s.error).toBe('131042|Business eligibility payment issue')
  })

  it('salta lo que no entiende sin romper', () => {
    expect(parseWaStatuses({ statuses: [{ status: 'sent' }, { id: 'x', status: 'deleted' }, null, 'basura'] })).toEqual([])
    expect(parseWaStatuses({})).toEqual([])
    expect(parseWaStatuses(null)).toEqual([])
  })
})

describe('waStatusLabel', () => {
  it('traduce los estados normales', () => {
    expect(waStatusLabel('sent', null)).toEqual({ text: 'Enviado', failed: false })
    expect(waStatusLabel('delivered', null)).toEqual({ text: 'Entregado', failed: false })
    expect(waStatusLabel('read', null)).toEqual({ text: 'Leído', failed: false })
    expect(waStatusLabel(null, null)).toBeNull()
  })

  it('explica los fallos conocidos y deja el texto de Meta en los demás', () => {
    expect(waStatusLabel('failed', '131042|Business eligibility payment issue')?.text).toMatch(/tarjeta/)
    expect(waStatusLabel('failed', '999|Algo raro')).toEqual({ text: 'No se entregó: Meta respondió: Algo raro', failed: true })
    expect(waStatusLabel('failed', null)).toEqual({ text: 'No se entregó', failed: true })
  })
})
