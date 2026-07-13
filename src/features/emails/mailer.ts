import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Mailer transaccional (correos de ciclo de vida: bienvenida, onboarding, fin
 * de prueba). Reutiliza el SMTP de Hostinger ya configurado para Supabase Auth
 * (no-reply@chatventi.com con Contraseña de apps). Si faltan las variables SMTP,
 * NO rompe: registra un aviso y omite el envío (deploy seguro sin credenciales).
 *
 * Env requeridas para activar el envío (Vercel Production + .env.local):
 *   SMTP_HOST=smtp.hostinger.com  SMTP_PORT=465
 *   SMTP_USER=no-reply@chatventi.com  SMTP_PASS=<contraseña de apps>
 *   EMAIL_FROM=ChatVenti <no-reply@chatventi.com>
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

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<boolean> {
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
