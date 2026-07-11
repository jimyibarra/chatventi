# Correo de confirmación con marca ChatVenti (SMTP propio)

## Qué ya está arreglado (2026-07-11)

- **Site URL** de Supabase Auth: `https://www.chatventi.com` (antes `localhost:3000` — por eso el botón del correo daba error de conexión).
- **Redirect URLs permitidas**: `https://www.chatventi.com/**`, `http://localhost:3000/**`, `http://localhost:3001/**`.
- **Ruta `/auth/confirm`** en la app: canjea el token del correo, deja la sesión iniciada y manda a `/dashboard` (ahí se crea el negocio pendiente). Soporta `?code=` (plantilla default) y `?token_hash=&type=` (plantilla personalizada).
- El signup ahora manda `emailRedirectTo` → el clic en el correo entra directo al panel.

## Lo que falta y SOLO puede hacer Juan (contraseñas)

Supabase **no permite editar las plantillas ni el remitente sin SMTP propio**. Para que el correo diga "ChatVenti <no-reply@chatventi.com>" en español:

1. **Opción A (recomendada): Resend** — crear cuenta en resend.com, verificar el dominio `chatventi.com` (agregar los registros DNS que Resend indique, en Hostinger), crear API key. SMTP: host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = la API key.
   **Opción B: Hostinger** — usar el buzón existente (p. ej. `contacto@chatventi.com`): host `smtp.hostinger.com`, puerto `465`, usuario el correo completo, contraseña la del buzón.
2. En Supabase → Authentication → **Emails → SMTP Settings**: activar custom SMTP, llenar host/puerto/usuario/contraseña, **Sender name**: `ChatVenti`, **Sender email**: `no-reply@chatventi.com` (o `contacto@`).
3. En **Emails → Templates → Confirm sign up**:
   - **Subject**: `Confirma tu cuenta de ChatVenti`
   - **Body (HTML)**: pegar el bloque de abajo. Usa `token_hash`, que además evita que Gmail "consuma" el enlace al pre-cargarlo.

```html
<div style="max-width:480px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="padding:28px 8px 12px;text-align:center">
    <div style="display:inline-block;width:44px;height:44px;border-radius:12px;background:#5b4fe0;color:#ffffff;font-size:24px;font-weight:bold;line-height:44px">C</div>
    <h1 style="margin:12px 0 0;font-size:22px;color:#111827">ChatVenti</h1>
  </div>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:24px">
    <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Confirma tu cuenta</h2>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6">¡Bienvenido! Solo falta un paso para crear tu negocio en ChatVenti. Confirma que este es tu correo:</p>
    <p style="text-align:center;margin:0 0 20px">
      <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup" style="display:inline-block;background:#5b4fe0;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 28px;border-radius:10px">Confirmar mi cuenta</a>
    </p>
    <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6">Si tú no creaste esta cuenta, ignora este correo. El enlace expira pronto por seguridad.</p>
  </div>
  <p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0">ChatVenti · Agenda + recepcionista IA para tu negocio · chatventi.com</p>
</div>
```

4. Probar: registrarse con un correo real → debe llegar "Confirma tu cuenta de ChatVenti" de `ChatVenti <no-reply@...>` → clic → entra directo al panel con el negocio creado.
