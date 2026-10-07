import { layout, type EmailBrand } from './templates'

// Correos de Supabase Auth, armados aquí (Send Email Hook) para que lleven la
// marca del socio cuando el usuario es de un negocio suyo. Mismos textos que
// las plantillas que vivían en la configuración de Supabase.

export type AuthEmailType = 'signup' | 'recovery' | 'magiclink' | 'invite' | 'email_change' | 'reauthentication'

export function authEmail(opts: {
  type: AuthEmailType
  brand: EmailBrand
  /** Enlace ya armado a /auth/confirm (vacío para reauthentication). */
  link: string
  /** Código de 6 dígitos (reauthentication). */
  code?: string
}): { subject: string; html: string } {
  const b = opts.brand
  const common = { brand: b }
  switch (opts.type) {
    case 'signup':
      return {
        subject: `Confirma tu cuenta de ${b.name}`,
        html: layout({ ...common, title: 'Confirma tu cuenta', bodyHtml: `<p style="margin:0">¡Bienvenido! Solo falta un paso para crear tu negocio en ${b.name}. Confirma que este es tu correo:</p>`, cta: { label: 'Confirmar mi cuenta', href: opts.link }, note: 'Si tú no creaste esta cuenta, ignora este correo. El enlace expira pronto por seguridad.' }),
      }
    case 'recovery':
      return {
        subject: `Restablece tu contraseña de ${b.name}`,
        html: layout({ ...common, title: 'Restablece tu contraseña', bodyHtml: `<p style="margin:0">Recibimos una solicitud para restablecer la contraseña de tu cuenta de ${b.name}. Haz clic en el botón para definir una nueva:</p>`, cta: { label: 'Definir nueva contraseña', href: opts.link }, note: 'Si tú no solicitaste este cambio, ignora este correo: tu contraseña seguirá igual. El enlace expira pronto por seguridad.' }),
      }
    case 'magiclink':
      return {
        subject: `Tu enlace para entrar a ${b.name}`,
        html: layout({ ...common, title: `Entra a ${b.name}`, bodyHtml: `<p style="margin:0">Haz clic en el botón para iniciar sesión en tu cuenta de ${b.name}:</p>`, cta: { label: 'Iniciar sesión', href: opts.link }, note: 'Si tú no solicitaste este enlace, ignora este correo.' }),
      }
    case 'invite':
      return {
        subject: `Te dieron acceso a ${b.name}`,
        html: layout({ ...common, title: `Te dieron acceso a ${b.name}`, bodyHtml: `<p style="margin:0">Te invitaron a colaborar en ${b.name}. Acepta la invitación para definir tu contraseña y entrar:</p>`, cta: { label: 'Aceptar invitación', href: opts.link }, note: 'Si no esperabas esta invitación, puedes ignorar este correo.' }),
      }
    case 'email_change':
      return {
        subject: `Confirma tu nuevo correo en ${b.name}`,
        html: layout({ ...common, title: 'Confirma tu nuevo correo', bodyHtml: `<p style="margin:0">Solicitaste cambiar el correo de tu cuenta de ${b.name}. Confirma este nuevo correo para aplicar el cambio:</p>`, cta: { label: 'Confirmar correo', href: opts.link }, note: 'Si tú no solicitaste este cambio, ignora este correo.' }),
      }
    case 'reauthentication':
      return {
        subject: `Tu código de ${b.name}`,
        html: layout({ ...common, title: 'Confirma que eres tú', bodyHtml: `<p style="margin:0 0 10px">Escribe este código en ${b.name} para continuar:</p><p style="margin:0;font-size:28px;font-weight:bold;letter-spacing:6px;font-family:monospace">${opts.code ?? ''}</p>`, note: 'El código expira en unos minutos. Si no fuiste tú, ignora este correo.' }),
      }
  }
}
