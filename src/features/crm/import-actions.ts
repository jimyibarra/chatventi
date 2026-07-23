'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export type ImportResult =
  | { ok: true; inserted: number; updated: number; invalid: number }
  | { ok: false; error: string }

const rowSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(1).max(40),
})

const payloadSchema = z.array(rowSchema).max(2000)

// Importa clientes desde CSV ya parseado en el cliente. Cada fila pasa por
// upsert_client_manual, que normaliza el teléfono y hace upsert por canónico
// (mismo cliente en dos formatos → una sola fila) sin pisar el nombre con vacío.
export async function importClients(raw: unknown): Promise<ImportResult> {
  const parsed = payloadSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: 'El archivo no tiene el formato esperado.' }
  }
  const rows = parsed.data
  if (rows.length === 0) return { ok: false, error: 'No hay filas para importar.' }

  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }

  let inserted = 0
  let updated = 0
  let invalid = 0

  for (const r of rows) {
    const { data, error } = await supabase.rpc('upsert_client_manual', {
      p_name: r.name ?? '',
      p_phone: r.phone,
    })
    if (error) {
      invalid++
      continue
    }
    if (data === 'inserted') inserted++
    else if (data === 'updated') updated++
    else invalid++
  }

  revalidatePath('/dashboard/clientes')
  return { ok: true, inserted, updated, invalid }
}
