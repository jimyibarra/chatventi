import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'
import type { Brand } from '@/features/marca/brand-shared'

/**
 * Mailer transaccional (correos de ciclo de vida: bienvenida, onboarding, fin
 * de prueba). Reutiliza el SMTP de Hostinger ya configurado para Supabase Auth
 * (no-reply@chatventi.com con Contraseña de apps). Si faltan las variables SMTP,
 * NO rompe: registra un aviso y omite el envío (deploy seguro sin credenciales).
 *
 * Env requeridas para activar el envío (Vercel Production + .env.local):
 *   SMTP_HOST=smtp.hostinger.com  SMTP_PORT=465
 *   SMTP_USER=hola@chatventi.com   ← BUZÓN REAL con login (NO el alias no-reply@,
 *                                     un alias no puede autenticarse → error 535)
 *   SMTP_PASS=<Contraseña de apps de hola@ (2FA); la normal da 535>
 *   EMAIL_FROM=ChatVenti <no-reply@chatventi.com>  ← alias, solo como remitente
 * Son las MISMAS credenciales que ya usa el SMTP de Supabase Auth.
 */
let transport: Transporter | null = null

function getTransport(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  if (!host || !user || !pass) return null
  if (!transport) {
    const port = Number(process.env.SMTP_PORT ?? 465)
    transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = SSL directo; 587 = STARTTLS
      auth: { user, pass },
    })
  }
  return transport
}

export function emailsEnabled(): boolean {
  return getTransport() !== null
}

/**
 * Verifica la conexión/autenticación con el SMTP (handshake real, SIN enviar
 * correo). Útil para confirmar que las credenciales de producción son correctas.
 */
export async function verifyTransport(): Promise<{ configured: boolean; ok: boolean; error?: string }> {
  const t = getTransport()
  if (!t) return { configured: false, ok: false }
  try {
    await t.verify()
    return { configured: true, ok: true }
  } catch (e) {
    return { configured: true, ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Correos de un negocio de socio con marca propia (¡Pasen!): salen por Resend
 * con la clave de solo envío de la cuenta del socio (PASEN_RESEND_API_KEY) y
 * desde su remitente (partners.email_from). Sin la clave, se avisa y no se
 * manda: nunca salen con la marca de ChatVenti.
 */
async function sendViaResend(brand: Brand, opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const key = process.env.PASEN_RESEND_API_KEY?.trim()
  if (!key) {
    console.warn('[emails] falta PASEN_RESEND_API_KEY; se omite correo con marca', brand.name, 'a', opts.to)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: brand.emailFrom, to: [opts.to], subject: opts.subject, html: opts.html, reply_to: brand.supportEmail }),
    })
    if (!res.ok) console.error('[emails] Resend', res.status, (await res.text()).slice(0, 200))
    return res.ok
  } catch (e) {
    console.error('[emails] Resend error', e)
    return false
  }
}

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  /** Marca del socio del negocio: cambia remitente y transporte. */
  brand?: Brand | null
}): Promise<boolean> {
  if (opts.brand?.partnerId) return sendViaResend(opts.brand, opts)
  const t = getTransport()
  if (!t) {
    console.warn('[emails] SMTP no configurado; se omite envío a', opts.to)
    return false
  }
  const from = process.env.EMAIL_FROM?.trim() || 'ChatVenti <no-reply@chatventi.com>'
  try {
    await t.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html })
    return true
  } catch (e) {
    console.error('[emails] error enviando a', opts.to, e)
    return false
  }
}
