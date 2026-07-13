// Plantillas de correo de ciclo de vida. Estilo e imagen consistentes con los
// correos de autenticación (mismo logotipo oficial). HTML inline (compatibilidad
// con clientes de correo). El logo se referencia por URL pública absoluta.

const LOGO = 'https://www.chatventi.com/brand/chatventi-logo.png'

interface Built {
  subject: string
  html: string
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
    <p style="margin:0 0 14px">Desde tu panel puedes empezar a llenar tu agenda hoy mismo. Esto es lo que tienes disponible:</p>
    <table style="margin:0 0 8px;font-size:14.5px;line-height:1.5">
      ${check('Agenda de citas con disponibilidad y anti-solape')}
      ${check('Recepcionista con IA por WhatsApp, Telegram y tu web')}
      ${check('CRM de clientes con historial y notas')}
      ${check('Tu página de reservas online, lista en minutos')}
    </table>
    <p style="margin:14px 0 0"><strong>Siguiente paso:</strong> configura tu negocio en unos minutos y empieza a recibir reservas.</p>`
  return {
    subject: '¡Bienvenido a ChatVenti! 🎉',
    html: layout({
      title: `¡Bienvenido a ChatVenti, ${o.orgName}!`,
      bodyHtml: body,
      cta: { label: 'Configurar mi negocio →', href: `${o.siteUrl}/dashboard` },
      note: 'Recibes este correo porque creaste una cuenta en ChatVenti.',
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

/** Recordatorio a ~48h de que termina la prueba gratuita. */
export function trialEndingEmail(o: {
  orgName: string
  trialEndLabel: string
  siteUrl: string
}): Built {
  const body = `
    <p style="margin:0 0 14px">Hola <strong>${o.orgName}</strong>, tu prueba gratuita de ChatVenti termina el <strong>${o.trialEndLabel}</strong>.</p>
    <p style="margin:0 0 14px">No tienes que hacer nada: al finalizar la prueba, tu plan <strong>continúa automáticamente</strong> para que tu agenda y tu recepcionista IA sigan trabajando sin cortes. Conservas todo tu historial, tu configuración y tus datos.</p>
    <p style="margin:0 0 14px">Si prefieres cambiar de plan o cancelar, puedes hacerlo en cualquier momento desde tu panel — sin penalizaciones.</p>`
  return {
    subject: '⏰ Tu prueba de ChatVenti termina pronto',
    html: layout({
      title: 'Tu prueba gratuita está por terminar',
      bodyHtml: body,
      cta: { label: 'Ver mi plan →', href: `${o.siteUrl}/dashboard/facturacion` },
      note: 'Puedes cambiar de plan o cancelar cuando quieras desde “Administrar suscripción”.',
    }),
  }
}
