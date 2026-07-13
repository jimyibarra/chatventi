// =====================================================================
// ChatVenti · Provisión de cuenta Super Admin (god mode del panel /admin)
//   Uso:  node --env-file=.env.local scripts/create-super-admin.mjs correo@dominio.com
//
//   - Crea (o reutiliza) el usuario vía Admin API (NUNCA por SQL directo:
//     insertar en auth.users por SQL rompe GoTrue por falta de identity).
//   - Le asigna el perfil con rol super_admin (sin organización: no es tenant).
//   - Envía el correo de recuperación para que el dueño fije su contraseña
//     (flujo "por correo", sin contraseñas en texto). Aterriza en
//     /auth/confirm?type=recovery -> /nueva-clave.
// =====================================================================
import { createClient } from '@supabase/supabase-js'

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.chatventi.com').trim()
const email = (process.argv[2] || '').trim().toLowerCase()

if (!url || !serviceKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}
if (!email || !email.includes('@')) {
  console.error('Uso: node --env-file=.env.local scripts/create-super-admin.mjs correo@dominio.com')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

async function findUserByEmail(target) {
  // listUsers pagina de 50 en 50; suficiente para el volumen actual.
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 50 })
    if (error) throw error
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < 50) break
  }
  return null
}

async function main() {
  let user = null

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true, // no requiere confirmar correo; fija clave por recovery
  })

  if (createErr) {
    // Ya existe: lo reutilizamos y solo ajustamos su rol.
    if (/already|registered|exists/i.test(createErr.message)) {
      user = await findUserByEmail(email)
      if (!user) throw new Error(`El correo existe pero no se pudo localizar: ${createErr.message}`)
      console.log('• Usuario ya existía; se reutiliza y se promueve a super_admin.')
    } else {
      throw createErr
    }
  } else {
    user = created.user
    console.log('• Usuario creado vía Admin API.')
  }

  // Perfil super_admin, sin organización (no es un negocio/tenant).
  const { error: upsertErr } = await admin.from('profiles').upsert(
    { id: user.id, email, role: 'super_admin', organization_id: null, full_name: 'Super Admin' },
    { onConflict: 'id' },
  )
  if (upsertErr) throw upsertErr
  console.log('• Perfil con rol super_admin asignado.')

  // Correo para fijar la contraseña (SMTP ya configurado en el proyecto).
  const { error: mailErr } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/auth/confirm?type=recovery`,
  })
  if (mailErr) {
    console.warn('⚠️  No se pudo enviar el correo de recuperación:', mailErr.message)
    console.warn('    Entra a /recuperar en el sitio y pídelo desde ahí.')
  } else {
    console.log(`• Correo para definir contraseña enviado a ${email}.`)
  }

  console.log('\n✅ Listo. Revisa el correo, define tu contraseña y entra a /admin.')
}

main().catch((e) => {
  console.error('❌ Error:', e.message || e)
  process.exit(1)
})
