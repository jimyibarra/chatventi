import { z } from 'zod'

// 🔴 En archivo PROPIO, no dentro de welcome-actions.ts: un módulo marcado
// con 'use server' solo puede exportar funciones async. Al exportar de ahí el
// esquema, al cliente le llegaba algo que no era un esquema de Zod y
// /bienvenida reventaba con 500 ("Invalid input: not a Zod schema").
// Mismo patrón que features/equipo/types.ts.
//
// Datos del NEGOCIO. Se piden aquí y no en el alta: pedirlos antes de que el
// usuario haya visto nada de valor cuesta conversión.
export const welcomeSchema = z.object({
  orgName: z
    .string()
    .trim()
    .min(2, 'Nombre del negocio requerido')
    .max(80, 'Nombre demasiado largo'),
  businessType: z.string().min(1, 'Elige tu tipo de negocio'),
  country: z.string().min(2, 'País requerido'),
  city: z.string().trim().min(2, 'Ciudad requerida').max(60, 'Ciudad demasiado larga'),
  ownerName: z.string().trim().min(2, 'Tu nombre requerido').max(60, 'Nombre demasiado largo'),
  phone: z
    .string()
    .trim()
    .min(8, 'Teléfono de al menos 8 dígitos')
    .max(20, 'Teléfono demasiado largo')
    .regex(/^[+\d][\d\s-]+$/, 'Solo números, espacios o guiones'),
})

export type WelcomeInput = z.infer<typeof welcomeSchema>
