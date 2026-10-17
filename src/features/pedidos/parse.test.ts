import { describe, expect, it } from 'vitest'
import { nextStatuses, orderConfirmationText, orderReadyText, parseOrderMessage } from './parse'

// Mismo formato que arma ¡Pasen! (src/features/sites/lib/orders.ts en su repo).
const PASEN = [
  'Hola, soy Ana López. Quiero hacer un pedido:',
  '• 2 × Comida del día ($110)',
  '• 1 × Jugos y licuados (Desde $45)',
  '• 1 × Agua fresca',
  'Total: $265 aprox. + precio por confirmar',
  'Para entrega a domicilio en: Av. Juárez 120, Centro',
  'Notas: sin cebolla',
].join('\n')

describe('parseOrderMessage', () => {
  it('lee el pedido completo del carrito', () => {
    expect(parseOrderMessage(PASEN)).toEqual({
      customerName: 'Ana López',
      items: [
        { qty: 2, name: 'Comida del día', priceText: '$110' },
        { qty: 1, name: 'Jugos y licuados', priceText: 'Desde $45' },
        { qty: 1, name: 'Agua fresca', priceText: null },
      ],
      totalText: '$265 aprox. + precio por confirmar',
      mode: 'delivery',
      address: 'Av. Juárez 120, Centro',
      notes: 'sin cebolla',
    })
  })

  it('para recoger, sin notas, con saltos de Windows y espacios', () => {
    const o = parseOrderMessage('Hola, soy Beto. Quiero hacer un pedido:\r\n  • 3 × Tacos al pastor ($18)\r\nTotal: $54\r\nPaso a recogerlo.\r\n')
    expect(o?.mode).toBe('pickup')
    expect(o?.address).toBeNull()
    expect(o?.items).toEqual([{ qty: 3, name: 'Tacos al pastor', priceText: '$18' }])
  })

  it('un nombre con punto y un platillo con paréntesis que no es precio', () => {
    const o = parseOrderMessage('Hola, soy Sr. Ruiz. Quiero hacer un pedido:\n• 1 × Jugo (naranja)\nTotal: por confirmar\nPaso a recogerlo.')
    expect(o?.customerName).toBe('Sr. Ruiz')
    expect(o?.items[0]).toEqual({ qty: 1, name: 'Jugo (naranja)', priceText: null })
  })

  it('no confunde una plática normal con un pedido', () => {
    expect(parseOrderMessage('Hola, quiero hacer un pedido de 2 tortas')).toBeNull()
    expect(parseOrderMessage('Hola, soy Ana. Quiero hacer un pedido:')).toBeNull()
    expect(parseOrderMessage('Hola, soy Ana. Quiero hacer un pedido:\n• 2 × Torta')).toBeNull()
    expect(parseOrderMessage(null)).toBeNull()
  })
})

describe('textos al cliente', () => {
  it('confirma con el tiempo del negocio y avisa si falta precio', () => {
    const t = orderConfirmationText(parseOrderMessage(PASEN)!, 35)
    expect(t).toContain('¡Gracias, Ana López! Recibimos tu pedido:')
    expect(t).toContain('• 2 × Comida del día')
    expect(t).toContain('unos 35 minutos y te lo llevamos a: Av. Juárez 120, Centro')
    expect(t).toContain('El negocio te confirma el total')
  })

  it('listo: para recoger o en camino', () => {
    expect(orderReadyText({ customerName: 'Beto', mode: 'pickup' })).toBe('¡Beto, tu pedido está listo! Ya puedes pasar por él. 🍽️')
    expect(orderReadyText({ customerName: null, mode: 'delivery' })).toContain('ya va en camino')
  })

  it('el tablero solo avanza y no reabre un entregado', () => {
    expect(nextStatuses('new')).toEqual(['preparing', 'ready', 'cancelled'])
    expect(nextStatuses('delivered')).toEqual([])
  })
})
