# App Review · acceso avanzado de `pages_manage_metadata` y `pages_show_list` (oct-2026)

> App ChatVenti `2268338090636391`, ajuste de inicio de sesión para empresas `904116956101183`.
> Motivo: un cliente real (sin rol en la app) no recibe estos permisos en acceso estándar, así que
> `POST /{page-id}/subscribed_apps` falla y sus mensajes de Messenger/Instagram no llegan.
> Antes de enviar: quitar `pages_read_engagement` del ajuste (no se usa). `business_management` se deja.
> Los textos completos (A: uso, B: prueba) están en el informe para PASEN del 14-oct:
> https://claude.ai/code/artifact/4bc736b9-eccd-4d47-ae5e-59aa18a1611c (sección 4).
> Formato igual que `app-review-textos-permisos.md`. Video: Conexiones → «Conectar Facebook e Instagram» →
> mensaje que entra y se contesta, con la página «ChatVenti Demo». El revisor entra a ChatVenti con una
> cuenta de prueba (la app ya está en producción). Envío: Juan desde el panel de Meta.

| Permiso | Uso real en el código | Estado |
|---|---|---|
| `pages_manage_metadata` | `POST /{page-id}/subscribed_apps?subscribed_fields=messages` en `src/app/api/meta/connect-pages/route.ts` | pedir avanzado |
| `pages_show_list` | **imprescindible**: identifica la página que eligió el dueño (target_ids en `debug_token`) y respalda `me/accounts` | pedir avanzado |
| `pages_read_engagement` | ninguno | quitar del ajuste |
| `business_management` | solo el System User propio (WhatsApp) | dejar |

Comprobado el 14-oct-2026 con Graph: tokens de página guardados `expires_at = 0`; dominios de la app
`chatventi.com` + `agenda.pasen.mx`; webhooks WABA `messages`, page/instagram `messages, messaging_postbacks`.

## Prueba con cuenta SIN rol (16-oct-2026) — confirma la revisión
Cuenta jim.jimy.10 (sin rol), negocio ChatVenti Demo, portafolio «Ideas para Emprender», página «Prueba ChatVenti» (1413991395124182).
- El diálogo solo mostró: perfil de Instagram, conversaciones de Messenger, mensajes de Instagram.
- `debug_token`: `type: SYSTEM_USER`; scopes = `pages_messaging, instagram_basic, instagram_manage_messages, public_profile`.
  **`pages_messaging` sin target_ids**, sin `pages_show_list` ni `pages_manage_metadata`; `me/accounts` = 0.
- Resultado: ChatVenti no puede saber qué página eligió → 422 (ahora `pages_not_visible`, con mensaje claro).
- WhatsApp con la misma cuenta: la ventana abre y avanza hasta verificar el número → OK.
