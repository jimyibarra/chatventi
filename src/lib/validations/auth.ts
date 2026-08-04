import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

/** Mínimo de contraseña para cuentas NUEVAS. El login sigue en 6 a propósito:
 *  subirlo ahí dejaría fuera a quien ya tiene una contraseña más corta. */
export const PASSWORD_MIN = 8

// Alta en DOS pasos (2026-08-03). Aquí solo se crea la CUENTA: correo,
// contraseña y aceptación de términos. Los datos del negocio (nombre, giro,
// país, ciudad, teléfono) se piden en /bienvenida, ya con el correo
// verificado — pedirlos antes de mostrar valor cuesta conversión.
//
// El click-wrap SÍ se queda aquí: el valor legal de profiles.terms_version /
// terms_accepted_at depende de que la aceptación ocurra ANTES de crear la
// cuenta. Es un solo checkbox y no añade fricción real.
export const signupSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(PASSWORD_MIN, `Mínimo ${PASSWORD_MIN} caracteres`),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar los Términos y la Política de privacidad' }),
  }),
  // Token del widget de Cloudflare. Opcional en el esquema porque en
  // desarrollo (sin claves) no hay widget; el servidor decide si lo exige.
  turnstileToken: z.string().optional(),
})

export const recoverSchema = z.object({
  email: z.string().email('Correo inválido'),
})

export const newPasswordSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN, `Mínimo ${PASSWORD_MIN} caracteres`),
    confirmPassword: z.string().min(PASSWORD_MIN, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type RecoverInput = z.infer<typeof recoverSchema>
export type NewPasswordInput = z.infer<typeof newPasswordSchema>
