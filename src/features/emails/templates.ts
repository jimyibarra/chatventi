// Plantillas de correo de ciclo de vida. Estilo e imagen consistentes con los
// correos de autenticación (mismo logotipo oficial). HTML inline (compatibilidad
// con clientes de correo). El logo se referencia por URL pública absoluta.

import { PROMO_CODE, PROMO_LABEL, TRIAL_DAYS } from '@/features/billing/plans'

const LOGO = 'https://www.chatventi.com/brand/chatventi-logo.png'

interface Built {
  subject: string
  html: string
}

// Bloque visual con el código de promo (30% off 3 meses) para los correos del
// funnel de conversión.
function promoBox(): string {
  return `<div style="border:1px dashed #c7bff5;background:#f4f2fe;border-radius:10px;padding:14px 16px;margin:16px 0;text-align:center">
    <p style="margin:0;font-size:13px;color:#4a3fc4">Usa este código al suscribirte y obtén</p>
    <p style="margin:4px 0 0;font-size:15px;font-weight:bold;color:#4338ca">${PROMO_LABEL}</p>
    <p style="margin:8px 0 0"><span style="display:inline-block;border:1px dashed #5b4fe0;background:#ffffff;border-radius:8px;padding:6px 16px;font-family:monospace;font-size:16px;font-weight:bold;letter-spacing:2px;color:#4338ca">${PROMO_CODE}</span></p>
  </div>`
}

function layout(opts: {
  title: string
  bodyHtml: string
  cta?: { label: string; href: string }
  note?: string
}): string {
  const { title, bodyHtml, cta, note } = opts
  return `<div style="max-width:520px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="padding:28px 8px 18px;text-align:center">
    <img src="${LOGO}" alt="ChatVenti" width="188" style="width:188px;max-width:72%;height:auto" />
  </div>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:26px">
    <h2 style="margin:0 0 12px;font-size:19px;color:#111827">${title}</h2>
    <div style="font-size:14.5px;line-height:1.6;color:#374151">${bodyHtml}</div>
    ${
      cta
        ? `<p style="text-align:center;margin:24px 0 6px">
      <a href="${cta.href}" style="display:inline-block;background:#5b4fe0;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 30px;border-radius:10px">${cta.label}</a>
    </p>`
        : ''
    }
    ${note ? `<p style="margin:14px 0 0;font-size:12px;color:#6b7280;line-height:1.6">${note}</p>` : ''}
  </div>
  <p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0 4px">
    ChatVenti &middot; Agenda + recepcionista IA para tu negocio &middot; chatventi.com
  </p>
  <p style="text-align:center;font-size:11px;color:#9ca3af;margin:0">
    ¿Dudas? Escríbenos a soporte@chatventi.com
  </p>
</div>`
}

const check = (t: string) =>
  `<tr><td style="padding:3px 0;color:#16a34a;font-weight:bold;width:20px;vertical-align:top">&#10003;</td><td style="padding:3px 0">${t}</td></tr>`

/** Al crear la cuenta (arranca el uso del panel). */
export function welcomeEmail(o: { orgName: string; siteUrl: string }): Built {
  const body = `
    <p style="margin:0 0 14px">Hola <strong>${o.orgName}</strong>, ¡tu cuenta de ChatVenti ya está activa! 🎉</p>
    <p style="margin:0 0 14px">Tienes <strong>${TRIAL_DAYS} días de prueba gratis, sin tarjeta de crédito</strong>. Pruébalo con calma; si te sirve, luego eliges tu plan.</p>
    <table style="margin:0 0 8px;font-size:14.5px;line-height:1.5">
      ${check('Agenda de citas con disponibilidad y anti-solape')}
      ${check('Recepcionista con IA por WhatsApp, Telegram y tu web')}
      ${check('CRM de clientes con historial y notas')}
      ${check('Tu página de reservas online, lista en minutos')}
    </table>
    <p style="margin:14px 0 0"><strong>Siguiente paso:</strong> configura tu negocio en unos minutos y empieza a recibir reservas.</p>`
  return {
    subject: `¡Bienvenido a ChatVenti! ${TRIAL_DAYS} días gratis, sin tarjeta 🎉`,
    html: layout({
      title: `¡Bienvenido a ChatVenti, ${o.orgName}!`,
      bodyHtml: body,
      cta: { label: 'Configurar mi negocio →', href: `${o.siteUrl}/dashboard` },
      note: 'Recibes este correo porque creaste una cuenta en ChatVenti. Sin tarjeta y sin compromiso.',
    }),
  }
}

/** Al terminar la configuración base de la agenda (servicios + horario + disponibilidad). */
export function onboardingEmail(o: { orgName: string; siteUrl: string }): Built {
  const body = `
    <p style="margin:0 0 14px">Hola <strong>${o.orgName}</strong>, ¡tu agenda ya está configurada y lista para recibir reservas! ✅</p>
    <p style="margin:0 0 14px">Ahora, el paso que más impacto tiene: <strong>conectar tu WhatsApp</strong> para que la Recepcionista IA atienda a tus clientes, responda dudas (precios, horarios) y agende citas <strong>24/7</strong>, incluso mientras duermes.</p>
    <table style="margin:0 0 8px;font-size:14.5px;line-height:1.5">
      ${check('Responde al instante y guía la conversación hasta la reserva')}
      ${check('Confirma y envía recordatorios para reducir inasistencias')}
      ${check('Tú tomas el control cuando quieras: la IA se pausa sola')}
    </table>`
  return {
    subject: '✅ Tu agenda ya está lista — conecta WhatsApp y activa la IA',
    html: layout({
      title: '¡Tu agenda está lista para recibir reservas!',
      bodyHtml: body,
      cta: { label: 'Conectar WhatsApp →', href: `${o.siteUrl}/dashboard/conexiones` },
      note: 'El módulo de Recepcionista IA se activa con tu plan; puedes probarlo durante tu prueba gratis.',
    }),
  }
}

/** Al activarse la suscripción (checkout completado; arranca la prueba con plan). */
export function subscriptionActiveEmail(o: {
  orgName: string
  planLine: string
  totalUsd: number
  trialEndLabel: string | null
  siteUrl: string
}): Built {
  const trialNote = o.trialEndLabel
    ? `<p style="margin:0 0 14px">Tu <strong>prueba gratuita</strong> corre hasta el <strong>${o.trialEndLabel}</strong>. No se te cobrará antes de esa fecha, y puedes cambiar de plan o cancelar cuando quieras.</p>`
    : ''
  const body = `
    <p style="margin:0 0 14px">Hola <strong>${o.orgName}</strong>, ¡tu suscripción quedó activa! 🎉 Gracias por confiar en ChatVenti.</p>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:0 0 14px">
      <p style="margin:0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Tu plan</p>
      <p style="margin:4px 0 0;font-size:15px;font-weight:bold;color:#111827">${o.planLine}</p>
      <p style="margin:6px 0 0;font-size:14px;color:#374151">$${o.totalUsd} USD / mes</p>
    </div>
    ${trialNote}
    <p style="margin:0">Desde tu panel puedes conectar WhatsApp, configurar tu Recepcionista IA y administrar tu suscripción cuando lo necesites.</p>`
  return {
    subject: '🎉 Tu suscripción de ChatVenti está activa',
    html: layout({
      title: '¡Tu suscripción está activa!',
      bodyHtml: body,
      cta: { label: 'Ir a mi panel →', href: `${o.siteUrl}/dashboard` },
      note: 'Puedes gestionar tu plan, tarjeta o cancelar desde “Administrar suscripción” en Facturación.',
    }),
  }
}

/** Recordatorio unos días antes de que termine la prueba gratis (con promo). */
export function trialEndingEmail(o: {
  orgName: string
  trialEndLabel: string
  siteUrl: string
}): Built {
  const body = `
    <p style="margin:0 0 14px">Hola <strong>${o.orgName}</strong>, tu prueba gratuita de ChatVenti termina el <strong>${o.trialEndLabel}</strong>.</p>
    <p style="margin:0 0 14px">Si ya viste cómo te ayuda a llenar tu agenda y responder a tus clientes, suscríbete ahora para seguir sin cortes y no perder tu configuración ni tu historial.</p>
    ${promoBox()}`
  return {
    subject: '⏰ Tu prueba gratis de ChatVenti termina pronto',
    html: layout({
      title: 'Tu prueba gratuita está por terminar',
      bodyHtml: body,
      cta: { label: 'Suscribirme ahora →', href: `${o.siteUrl}/dashboard/facturacion` },
      note: 'Sin permanencias: puedes cambiar de plan o cancelar cuando quieras.',
    }),
  }
}

/** Al terminar la prueba (acceso bloqueado). Suscríbete o pierdes tus datos. */
export function trialEndedEmail(o: {
  orgName: string
  deleteLabel: string | null
  siteUrl: string
}): Built {
  const keep = o.deleteLabel
    ? `Conservamos los datos de tu negocio hasta el <strong>${o.deleteLabel}</strong>. Si te suscribes antes de esa fecha, sigues justo donde lo dejaste.`
    : 'Conservamos tus datos por unos días más. Si te suscribes ahora, sigues justo donde lo dejaste.'
  const body = `
    <p style="margin:0 0 14px">Hola <strong>${o.orgName}</strong>, tu prueba gratuita de ChatVenti terminó.</p>
    <p style="margin:0 0 14px">${keep}</p>
    <p style="margin:0 0 14px">Suscríbete para reactivar tu agenda y tu recepcionista con IA:</p>
    ${promoBox()}`
  return {
    subject: '🔔 Tu prueba terminó — suscríbete para no perder tus datos',
    html: layout({
      title: 'Tu prueba gratuita terminó',
      bodyHtml: body,
      cta: { label: 'Suscribirme y continuar →', href: `${o.siteUrl}/dashboard/facturacion` },
      note: 'Tus datos siguen a salvo hasta la fecha indicada. Sin permanencias.',
    }),
  }
}

/** Aviso de que los datos del negocio se eliminarán pronto. */
export function deletionWarningEmail(o: {
  orgName: string
  deleteLabel: string
  siteUrl: string
}): Built {
  const body = `
    <p style="margin:0 0 14px">Hola <strong>${o.orgName}</strong>, este es un aviso importante.</p>
    <p style="margin:0 0 14px">Como tu prueba terminó y aún no tienes una suscripción activa, los <strong>datos de tu negocio</strong> (agenda, clientes, servicios y configuración) se <strong>eliminarán el ${o.deleteLabel}</strong>.</p>
    <p style="margin:0 0 14px">Todavía estás a tiempo: suscríbete antes de esa fecha y conserva todo tal como está.</p>
    ${promoBox()}`
  return {
    subject: '⚠️ Tus datos de ChatVenti se eliminarán pronto',
    html: layout({
      title: 'Tus datos se eliminarán pronto',
      bodyHtml: body,
      cta: { label: 'Suscribirme y conservar mis datos →', href: `${o.siteUrl}/dashboard/facturacion` },
      note: 'Después de la fecha indicada, los datos del negocio no se podrán recuperar.',
    }),
  }
}

/** Tras eliminar los datos (día 30). La cuenta se conserva; sin nuevo trial. */
export function dataDeletedEmail(o: { orgName: string; siteUrl: string }): Built {
  const body = `
    <p style="margin:0 0 14px">Hola <strong>${o.orgName}</strong>, como no se activó una suscripción, los datos de tu negocio se eliminaron según nuestra política.</p>
    <p style="margin:0 0 14px"><strong>Tu cuenta sigue disponible.</strong> Si quieres volver a usar ChatVenti, puedes suscribirte cuando quieras — ten en cuenta que empezarías desde cero (el periodo de prueba ya fue utilizado).</p>`
  return {
    subject: 'Tus datos de ChatVenti fueron eliminados',
    html: layout({
      title: 'Tus datos fueron eliminados',
      bodyHtml: body,
      cta: { label: 'Volver a ChatVenti →', href: `${o.siteUrl}/dashboard/facturacion` },
      note: 'Gracias por probar ChatVenti. Aquí estaremos cuando quieras volver.',
    }),
  }
}
