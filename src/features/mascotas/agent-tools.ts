import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { AgentContext } from '@/features/agente-ia/types'

// =====================================================================
// Mascotas en la recepcionista (fase 3, 17-oct-2026). Solo en veterinarias:
//   · save_pet guarda en la ficha del cliente la mascota que menciona.
//   · Al reservar, `mascota` liga la cita a esa mascota (y el recordatorio
//     del servicio la nombra: «A Firulais ya le toca su baño»).
// Cumple lo que la landing de veterinarias ya prometía.
// =====================================================================

type Db = SupabaseClient<Database>

const norm = (s: string) => s.trim().toLowerCase()

/** Bloque del prompt: las mascotas del cliente con su próxima vacuna. */
export function petsPromptBlock(pets: NonNullable<AgentContext['pets']>, fmtDate: (iso: string) => string): string {
  if (pets.length === 0) return '(ninguna registrada)'
  return pets
    .map((p) => {
      const what = [p.species, p.breed].filter(Boolean).join(', ')
      const vac = p.next_vaccine ? ` — próxima vacuna: ${p.next_vaccine.name}, ${fmtDate(p.next_vaccine.due_on)}` : ''
      return `- ${p.name}${what ? ` (${what})` : ''}${vac}`
    })
    .join('\n')
}

export const PET_RULES = [
  '- MASCOTAS: llama a cada mascota por su nombre (MASCOTAS DEL CLIENTE). Si el cliente menciona una que no está en la lista, guárdala con save_pet (pregunta su especie solo si no la dijo). Si tiene varias, pregunta para cuál es la cita y pasa su nombre en `mascota` al reservar.',
]

export function buildPetTools(p: { supabase: Db; orgId: string; clientId: string | null; sandbox: boolean; pets: AgentContext['pets'] }) {
  return {
    save_pet: tool({
      description: 'Guarda en la ficha del cliente una mascota nueva (nombre y especie; raza si la dijo). Úsala cuando el cliente mencione una mascota que no está en MASCOTAS DEL CLIENTE.',
      inputSchema: z.object({
        nombre: z.string().trim().min(1).max(60),
        especie: z.string().trim().max(40).optional().describe('perro, gato, ave…'),
        raza: z.string().trim().max(60).optional(),
      }),
      execute: async ({ nombre, especie, raza }) => {
        if ((p.pets ?? []).some((x) => norm(x.name) === norm(nombre))) return { ok: true, ya_estaba: true }
        if (p.sandbox || !p.clientId) return { ok: true }
        const { error } = await p.supabase.from('pets').insert({
          organization_id: p.orgId,
          client_id: p.clientId,
          name: nombre,
          species: especie ?? null,
          breed: raza ?? null,
        })
        if (error) {
          console.error('[mascotas] save_pet', error.message)
          return { ok: false }
        }
        return { ok: true }
      },
    }),
  }
}

/** Liga la cita a la mascota por su nombre (si existe en la ficha del cliente). */
export async function linkPetToAppointment(supabase: Db, p: { orgId: string; clientId: string | null; appointmentId: string; petName: string }) {
  if (!p.clientId) return
  const { data: pets } = await supabase.from('pets').select('id, name').eq('organization_id', p.orgId).eq('client_id', p.clientId).eq('active', true)
  const pet = (pets ?? []).find((x) => norm(x.name) === norm(p.petName))
  if (pet) await supabase.from('appointments').update({ pet_id: pet.id }).eq('id', p.appointmentId).eq('organization_id', p.orgId)
}
