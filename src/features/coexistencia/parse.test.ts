import { describe, expect, it } from 'vitest'
import { alertLevel, disconnectReason, historyWindowOpen, messageText, parseEchoes, parseHistory, parseStateSync } from './parse'

describe('ecos del dueño (smb_message_echoes)', () => {
  it('texto y destino = cliente, salida', () => {
    const out = parseEchoes({ message_echoes: [{ from: '5215578437260', to: '5215512345678', id: 'wamid.A', timestamp: '1760000000', type: 'text', text: { body: 'Sí, te espero' } }] })
    expect(out).toEqual([{ customer: '5215512345678', direction: 'outbound', body: 'Sí, te espero', extId: 'wamid.A', at: new Date(1760000000 * 1000) }])
  })
  it('imagen con pie y mensaje sin destino', () => {
    const out = parseEchoes({ message_echoes: [{ to: '521', type: 'image', image: { caption: 'Promo' } }, { type: 'text', text: { body: 'x' } }] })
    expect(out).toHaveLength(1)
    expect(out[0].body).toBe('[imagen] Promo')
  })
  it('tipo desconocido', () => {
    expect(messageText({ type: 'poll' })).toBe('[poll]')
  })
})

describe('historial', () => {
  const now = new Date('2026-10-16T12:00:00Z')
  const ts = (d: string) => String(Date.parse(d) / 1000)
  it('solo últimos 90 días, dirección por remitente, progreso', () => {
    const r = parseHistory(
      {
        history: [
          {
            metadata: { phase: 0, chunk_order: 1, progress: 40 },
            threads: [
              {
                id: '5215511111111',
                messages: [
                  { from: '5215511111111', id: 'h1', timestamp: ts('2026-10-10T10:00:00Z'), type: 'text', text: { body: 'Hola' } },
                  { from: '5215578437260', id: 'h2', timestamp: ts('2026-10-10T10:05:00Z'), type: 'text', text: { body: 'Hola, dime' } },
                  { from: '5215511111111', id: 'viejo', timestamp: ts('2026-05-01T10:00:00Z'), type: 'text', text: { body: 'viejo' } },
                ],
              },
            ],
          },
        ],
      },
      now
    )
    expect(r.progress).toBe(40)
    expect(r.messages.map((m) => [m.extId, m.direction])).toEqual([['h1', 'inbound'], ['h2', 'outbound']])
  })
  it('2593109 = el dueño no compartió', () => {
    expect(parseHistory({ history: [{ errors: [{ code: 2593109 }] }] }, now).declined).toBe(true)
  })
})

describe('contactos (smb_app_state_sync)', () => {
  it('nombre y teléfono en dígitos', () => {
    expect(parseStateSync({ state_sync: [{ type: 'contact', action: 'add', contact: { full_name: 'Luis Pérez', phone_number: '+52 1 55 1234 5678' } }] })).toEqual([
      { phone: '5215512345678', name: 'Luis Pérez', action: 'add' },
    ])
  })
})

describe('desconexión y alertas', () => {
  it('solo eventos de baja cuentan como desconexión', () => {
    expect(disconnectReason('account_update', { event: 'PARTNER_REMOVED' })).toBe('PARTNER_REMOVED')
    expect(disconnectReason('account_update', { event: 'VERIFIED_ACCOUNT' })).toBeNull()
    expect(disconnectReason('account_offboarded', {})).toBe('ACCOUNT_OFFBOARDED')
    expect(disconnectReason('history', {})).toBeNull()
  })
  it('niveles 7, 10 y 12 días', () => {
    expect([0, 6.9, 7, 9.9, 10, 11.9, 12, 30].map(alertLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
  })
  it('ventana de 24 h para el historial', () => {
    const now = new Date('2026-10-16T12:00:00Z')
    expect(historyWindowOpen('2026-10-16T00:00:00Z', now)).toBe(true)
    expect(historyWindowOpen('2026-10-15T11:00:00Z', now)).toBe(false)
    expect(historyWindowOpen(null, now)).toBe(false)
  })
})
