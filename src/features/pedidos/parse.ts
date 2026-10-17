// =====================================================================
// Pedidos por WhatsApp (17-oct-2026): el carrito de las páginas de ¡Pasen!
// (restaurantes y fruterías) manda SIEMPRE este formato (código de PASEN,
// src/features/sites/lib/orders.ts):
//
//   Hola, soy <nombre>. Quiero hacer un pedido:
//   • 2 × Comida del día ($110)
//   • 1 × Jugos y licuados
//   Total: $265            («$240 aprox.», «… + precio por confirmar», «por confirmar»)
//   Para entrega a domicilio en: <dirección>      (o «Paso a recogerlo.»)
//   Notas: <texto>          (opcional)
//
// Lo reconoce el CÓDIGO, no la IA: así nadie inventa platillos ni precios.
// Si el cliente editó el mensaje y ya no cuadra, devuelve null y la plática
// sigue con la recepcionista de siempre. Lógica pura (se prueba sola).
// =====================================================================

export type OrderItem = { qty: number; name: string; priceText: string | null }

export type ParsedOrder = {
  customerName: string | null
  items: OrderItem[]
  totalText: string | null
  mode: 'pickup' | 'delivery'
  address: string | null
  notes: string | null
}

const HEADER = /^hola,?\s+soy\s+(.+?)\.?\s+quiero hacer un pedido:?$/i
const ITEM = /^[•·\-*]\s*(\d{1,3})\s*[×xX]\s*(.+)$/
const TOTAL = /^total:\s*(.+)$/i
const DELIVERY = /^para entrega a domicilio en:\s*(.+)$/i
const PICKUP = /^paso a recogerlo\.?$/i
const NOTES = /^notas:\s*(.+)$/i

const MAX_ITEMS = 60

/** «Comida del día ($110)» → nombre y el precio que vio el cliente (el último paréntesis). */
function splitPrice(raw: string): { name: string; priceText: string | null } {
  const m = raw.match(/^(.*\S)\s*\(([^()]*)\)\s*$/)
  if (m && /\d|\$/.test(m[2])) return { name: m[1].trim(), priceText: m[2].trim() }
  return { name: raw.trim(), priceText: null }
}

export function parseOrderMessage(text: string | null | undefined): ParsedOrder | null {
  if (!text) return null
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const head = lines[0]?.match(HEADER)
  if (!head) return null

  const order: ParsedOrder = { customerName: head[1].trim().slice(0, 80) || null, items: [], totalText: null, mode: 'pickup', address: null, notes: null }
  let sawMode = false
  for (const line of lines.slice(1)) {
    const item = line.match(ITEM)
    if (item) {
      const qty = Number(item[1])
      const { name, priceText } = splitPrice(item[2])
      if (qty > 0 && name && order.items.length < MAX_ITEMS) order.items.push({ qty, name: name.slice(0, 120), priceText: priceText?.slice(0, 40) ?? null })
      continue
    }
    const total = line.match(TOTAL)
    if (total) {
      order.totalText = total[1].trim().slice(0, 80)
      continue
    }
    const delivery = line.match(DELIVERY)
    if (delivery) {
      order.mode = 'delivery'
      order.address = delivery[1].trim().slice(0, 200)
      sawMode = true
      continue
    }
    if (PICKUP.test(line)) {
      order.mode = 'pickup'
      sawMode = true
      continue
    }
    const notes = line.match(NOTES)
    if (notes) order.notes = notes[1].trim().slice(0, 200)
  }
  // Sin platillos o sin total ni forma de entrega, no es un pedido del carrito.
  if (order.items.length === 0 || (!order.totalText && !sawMode)) return null
  return order
}

export const ORDER_STATUSES = ['new', 'preparing', 'ready', 'delivered', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Nuevo',
  preparing: 'En preparación',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

/** A qué estado puede pasar un pedido desde el actual (el tablero solo avanza; cancelar, mientras no se entregue). */
export function nextStatuses(s: OrderStatus): OrderStatus[] {
  if (s === 'new') return ['preparing', 'ready', 'cancelled']
  if (s === 'preparing') return ['ready', 'cancelled']
  if (s === 'ready') return ['delivered', 'cancelled']
  return []
}

export function itemsSummary(items: OrderItem[]): string {
  return items.map((i) => `${i.qty} × ${i.name}`).join(', ')
}

/** Confirmación que recibe el cliente al llegar su pedido. */
export function orderConfirmationText(o: ParsedOrder, etaMinutes: number): string {
  const hello = o.customerName ? `¡Gracias, ${o.customerName}!` : '¡Gracias!'
  const lines = o.items.map((i) => `• ${i.qty} × ${i.name}`)
  const total = o.totalText ? `Total: ${o.totalText}` : null
  const pending = /confirmar/i.test(o.totalText ?? '') || !o.totalText ? 'El negocio te confirma el total por aquí.' : null
  const when =
    o.mode === 'delivery'
      ? `Estará listo en unos ${etaMinutes} minutos y te lo llevamos a: ${o.address ?? 'la dirección que nos diste'}.`
      : `Estará listo en unos ${etaMinutes} minutos para que pases por él.`
  return [`${hello} Recibimos tu pedido:`, ...lines, ...(total ? [total] : []), '', when, ...(pending ? [pending] : []), 'Te avisamos por aquí cuando esté listo.'].join('\n')
}

/** Aviso al cliente cuando el negocio lo marca «Listo». */
export function orderReadyText(o: { customerName: string | null; mode: 'pickup' | 'delivery' }): string {
  const name = o.customerName ? `${o.customerName}, ` : ''
  return o.mode === 'delivery' ? `¡${name}tu pedido está listo y ya va en camino! 🛵` : `¡${name}tu pedido está listo! Ya puedes pasar por él. 🍽️`
}
