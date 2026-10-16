// Interruptores de canales. Archivo sin dependencias: lo leen la página de
// Conexiones, las rutas de Meta, los planes y la landing.
//
// Facebook (Messenger) e Instagram: APAGADOS desde el 16-oct-2026 (decisión de
// Juan): se sale a producción solo con citas por WhatsApp. Meta todavía no
// concede pages_show_list ni pages_manage_metadata a cuentas sin rol en la app,
// así que un cliente real no puede conectar su página (prueba del 16-oct).
// Los canales ya conectados (ChatVenti Ventas) siguen funcionando: el webhook
// no mira este interruptor. Para volver a ofrecerlos: true y redeploy.
export const SOCIAL_CHANNELS_ENABLED = false
