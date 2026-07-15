import { z } from 'zod'
import type { Tables } from '@/lib/supabase/database.types'

export type Profile = Tables<'profiles'>
export type TeamInvitation = Tables<'team_invitations'>

// -------------------------------------------------------------------
// Los 4 roles planos del producto, mapeados sobre lo que YA existe en la BD
// (profiles.role + profiles.resource_scope). No se toca el check de `role`
// ni las políticas RLS ya desplegadas.
//
// Se descarta la matriz 7×N de CitaFlow a propósito (YAGNI): estos 4 cubren
// el 95% de los casos y se pueden granularizar después sin migrar datos.
// -------------------------------------------------------------------
export type TeamRoleKey = 'owner' | 'admin' | 'recepcion' | 'profesional'

export const TEAM_ROLES: Record<
  TeamRoleKey,
  { label: string; description: string; role: string; scope: 'all' | 'own'; badge: string }
> = {
  owner: {
    label: 'Dueño',
    description: 'Todo, incluida Facturación y Conexiones. Puede invitar.',
    role: 'owner',
    scope: 'all',
    badge: 'bg-brand-100 text-brand-800 border-brand-200',
  },
  admin: {
    label: 'Administrador',
    description: 'Todo menos Facturación y Conexiones.',
    role: 'manager',
    scope: 'all',
    badge: 'bg-success-bg text-success border-success-bg',
  },
  recepcion: {
    label: 'Recepción',
    description: 'Agenda, Chats y Clientes de todo el equipo.',
    role: 'staff',
    scope: 'all',
    badge: 'bg-line-soft text-ink-muted border-line',
  },
  profesional: {
    label: 'Profesional',
    description: 'Solo su propia agenda.',
    role: 'staff',
    scope: 'own',
    badge: 'bg-warn-bg text-warn border-warn-bg',
  },
}

// role + scope -> clave de UI. `manager` con scope 'own' no existe en la UI;
// se muestra como Administrador (el scope no aplica a quien lo ve todo).
export function roleKeyOf(role: string, scope: string | null): TeamRoleKey {
  if (role === 'owner') return 'owner'
  if (role === 'manager') return 'admin'
  return scope === 'own' ? 'profesional' : 'recepcion'
}

export type Member = {
  id: string
  email: string | null
  full_name: string | null
  role: string
  resource_scope: string
  is_active: boolean
  created_at: string
  resourceId: string | null
  resourceName: string | null
}

export type Seats = {
  used: number
  /** Incluidos en el plan: el dueño (1) + los asientos contratados. */
  allowed: number
  enforced: boolean
}

// -------------------------------------------------------------------
// Schemas Zod
// -------------------------------------------------------------------
const uuid = z.string().uuid()
const roleKey = z.enum(['owner', 'admin', 'recepcion', 'profesional'])

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  roleKey,
  resourceId: uuid.nullish(),
})

export const changeRoleSchema = z.object({
  profileId: uuid,
  roleKey,
  resourceId: uuid.nullish(),
})

export const acceptInvitationSchema = z.object({
  token: uuid,
  fullName: z.string().trim().min(2, 'Escribe tu nombre').max(120),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72),
})
