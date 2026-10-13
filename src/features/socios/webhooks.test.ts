import { describe, expect, it } from 'vitest'
import { newWebhookSecret, signWebhook, validateWebhookUrl, verifyWebhookSignature } from './webhooks-sign'

describe('firma de los webhooks de socios', () => {
  const secret = 'cvw_0123456789abcdef'
  const body = JSON.stringify({ id: 'd1', event: 'appointment.created' })

  it('firma determinista con prefijo v1 y hex de 64', () => {
    const sig = signWebhook(secret, 1760000000, body)
    expect(sig).toMatch(/^v1=[0-9a-f]{64}$/)
    expect(sig).toBe(signWebhook(secret, '1760000000', body))
  })

  it('el socio verifica con el mismo secreto, timestamp y cuerpo', () => {
    const ts = '1760000000'
    const sig = signWebhook(secret, ts, body)
    expect(verifyWebhookSignature(secret, sig, ts, body, 1760000100)).toBe(true)
  })

  it('cuerpo alterado, secreto distinto o timestamp viejo → inválida', () => {
    const ts = '1760000000'
    const sig = signWebhook(secret, ts, body)
    expect(verifyWebhookSignature(secret, sig, ts, body + ' ', 1760000100)).toBe(false)
    expect(verifyWebhookSignature('otro', sig, ts, body, 1760000100)).toBe(false)
    expect(verifyWebhookSignature(secret, sig, ts, body, 1760000000 + 6 * 60)).toBe(false)
    expect(verifyWebhookSignature(secret, null, ts, body, 1760000100)).toBe(false)
  })

  it('el secreto nuevo tiene el prefijo cvw_ y 48 hex', () => {
    expect(newWebhookSecret()).toMatch(/^cvw_[0-9a-f]{48}$/)
  })
})

describe('URL del webhook', () => {
  it('acepta https con dominio público', () => {
    expect(validateWebhookUrl('https://pasen.mx/api/chatventi/webhook')).toEqual({ ok: true, url: 'https://pasen.mx/api/chatventi/webhook' })
  })
  it('rechaza http, IPs, localhost, dominios internos y credenciales en la URL', () => {
    for (const bad of [
      'http://pasen.mx/hook',
      'https://127.0.0.1/hook',
      'https://[::1]/hook',
      'https://localhost/hook',
      'https://api.internal/hook',
      'https://servidor/hook',
      'https://user:pass@pasen.mx/hook',
      'no-es-url',
    ]) {
      expect(validateWebhookUrl(bad).ok, bad).toBe(false)
    }
  })
})
