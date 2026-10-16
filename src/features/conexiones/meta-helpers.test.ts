import { describe, expect, it } from 'vitest'
import { buildSignupPrefill, parseWabaHealth, wabaBillingUrl } from './meta-helpers'

describe('estado de la cuenta de WhatsApp', () => {
  it('error 141006 (método de pago) → payment missing y bloqueada', () => {
    const h = parseWabaHealth({
      health_status: {
        can_send_message: 'BLOCKED',
        entities: [
          { entity_type: 'WABA', id: '1', can_send_message: 'BLOCKED', errors: [{ error_code: 141006, error_description: 'There is an error with the payment method.' }] },
          { entity_type: 'BUSINESS', id: '9', can_send_message: 'AVAILABLE' },
        ],
      },
      owner_business_info: { id: '9' },
    })
    expect(h).toEqual({ canSend: 'BLOCKED', payment: 'missing', businessId: '9' })
  })
  it('sin errores → payment ok', () => {
    expect(parseWabaHealth({ health_status: { can_send_message: 'AVAILABLE', entities: [] } }).payment).toBe('ok')
  })
  it('otro bloqueo que no es de pago → ok en pago, bloqueada', () => {
    const h = parseWabaHealth({ health_status: { can_send_message: 'BLOCKED', entities: [{ errors: [{ error_code: 141001, error_description: 'Display name not approved' }] }] } })
    expect(h).toMatchObject({ canSend: 'BLOCKED', payment: 'ok' })
  })
  it('sin respuesta de Meta → unknown', () => {
    expect(parseWabaHealth(null)).toEqual({ canSend: null, payment: 'unknown', businessId: null })
  })
  it('enlace a pagos con la cuenta y el portafolio', () => {
    const u = new URL(wabaBillingUrl('123', '9'))
    expect(u.host).toBe('business.facebook.com')
    expect(u.searchParams.get('asset_id')).toBe('123')
    expect(u.searchParams.get('business_id')).toBe('9')
  })
})

describe('datos precargados de la ventana de WhatsApp', () => {
  it('negocio completo de México', () => {
    expect(
      buildSignupPrefill({ name: ' Clínica Sonríe ', email: 'dra@sonrie.mx', website: 'https://sonrie.pasen.mx', phone: '442 862 0925', country: 'MX', businessType: 'dental' })
    ).toEqual({
      business: { name: 'Clínica Sonríe', email: 'dra@sonrie.mx', website: 'https://sonrie.pasen.mx', phone: { code: 52, number: '4428620925' } },
      phone: { displayName: 'Clínica Sonríe', category: 'HEALTH' },
    })
  })
  it('descarta lo dudoso: teléfono con lada, web sin https, correo inválido, giro sin categoría', () => {
    expect(buildSignupPrefill({ name: 'Barbería Norte', email: 'no-es-correo', website: 'http://x.mx', phone: '+52 1 55 1234 5678', country: 'MX', businessType: 'generico' })).toEqual({
      business: { name: 'Barbería Norte' },
      phone: { displayName: 'Barbería Norte' },
    })
  })
  it('sin nombre no hay precarga', () => {
    expect(buildSignupPrefill({ name: ' ' })).toBeNull()
  })
})
