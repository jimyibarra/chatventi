import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

export const signupSchema = z
  .object({
    // Sobre tu negocio
    orgName: z.string().min(2, 'Nombre del negocio requerido'),
    country: z.string().min(2, 'País requerido'),
    city: z.string().min(2, 'Ciudad requerida'),
    // Sobre ti
    ownerName: z.string().min(2, 'Tu nombre requerido'),
    phone: z
      .string()
      .min(8, 'Teléfono de al menos 8 dígitos')
      .max(20, 'Teléfono demasiado largo')
      .regex(/^[+\d][\d\s-]+$/, 'Solo números, espacios o guiones'),
    email: z.string().email('Correo inválido'),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmPassword: z.string().min(6, 'Confirma tu contraseña'),
    // Click-wrap: sin aceptación explícita no se puede crear la cuenta.
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'Debes aceptar los Términos y la Política de privacidad' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
