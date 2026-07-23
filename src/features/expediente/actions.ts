'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { signRecordUrl, removeRecordByPath } from '@/features/storage/records'

export type ActionResult = { ok: true } | { ok: false; error: string }

function revalidateClient(clientId: string): void {
  revalidatePath(`/dashboard/clientes/${clientId}`)
}

// El expediente vive dentro de una org: toda alta necesita org + pertenencia
// del cliente. La RLS ya lo blinda; esto da el mensaje humano y evita insertar
// filas con organization_id ajeno.
async function orgOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string
): Promise<string | null> {
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return null
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('organization_id', orgId)
    .maybeSingle()
  return client ? (orgId as string) : null
}

// -------------------------------------------------------------------
// Archivos
// -------------------------------------------------------------------
const fileSchema = z.object({
  clientId: z.string().uuid(),
  path: z.string().trim().min(1).max(500),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  note: z.string().trim().max(300).optional(),
})

export async function addClientFile(raw: unknown): Promise<ActionResult> {
  const parsed = fileSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { clientId, path, fileName, mimeType, sizeBytes, note } = parsed.data
  const supabase = await createClient()
  const orgId = await orgOf(supabase, clientId)
  if (!orgId) return { ok: false, error: 'No se encontró el cliente.' }

  // La ruta la construye el browser; se verifica que caiga dentro de la carpeta
  // de ESTA org antes de guardarla (defensa en profundidad sobre la RLS).
  if (!path.startsWith(`${orgId}/`)) {
    return { ok: false, error: 'Ruta de archivo inválida.' }
  }

  const { data: user } = await supabase.auth.getUser()
  const { error } = await supabase.from('client_files').insert({
    organization_id: orgId,
    client_id: clientId,
    path,
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    note: note || null,
    created_by: user.user?.id ?? null,
  })
  if (error) {
    // La fila no se guardó: el objeto ya subido quedaría huérfano e invisible.
    await removeRecordByPath(path)
    return { ok: false, error: 'No se pudo guardar el archivo.' }
  }
  revalidateClient(clientId)
  return { ok: true }
}

export async function deleteClientFile(id: string, clientId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: file } = await supabase
    .from('client_files')
    .select('path')
    .eq('id', id)
    .maybeSingle()
  const { error } = await supabase.from('client_files').delete().eq('id', id)
  if (error) return { ok: false, error: 'No se pudo eliminar el archivo.' }
  // Solo se borra el objeto si la fila se fue: al revés dejaría una fila
  // apuntando a un archivo inexistente.
  await removeRecordByPath(file?.path)
  revalidateClient(clientId)
  return { ok: true }
}

// URL temporal de lectura. Se firma bajo demanda (al hacer clic), no al pintar
// la ficha: así los enlaces no caducan mientras el usuario mira la página.
export async function getClientFileUrl(id: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  // El select pasa por RLS: si el archivo es de otra org, no aparece y no se firma.
  const { data: file } = await supabase
    .from('client_files')
    .select('path')
    .eq('id', id)
    .maybeSingle()
  if (!file) return { error: 'Archivo no encontrado.' }
  const url = await signRecordUrl(file.path)
  if (!url) return { error: 'No se pudo abrir el archivo.' }
  return { url }
}

// -------------------------------------------------------------------
// Historial de atención (servicios / compras / notas)
// -------------------------------------------------------------------
const recordSchema = z.object({
  clientId: z.string().uuid(),
  kind: z.enum(['service', 'purchase', 'note']),
  title: z.string().trim().min(1, 'Escribe qué se hizo o se vendió.').max(120),
  detail: z.string().trim().max(1000).optional(),
  amount: z.number().nonnegative().max(9999999).optional(),
  occurredAt: z.string().datetime({ offset: true }),
})

export async function addClientRecord(raw: unknown): Promise<ActionResult> {
  const parsed = recordSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { clientId, kind, title, detail, amount, occurredAt } = parsed.data
  const supabase = await createClient()
  const orgId = await orgOf(supabase, clientId)
  if (!orgId) return { ok: false, error: 'No se encontró el cliente.' }

  const { data: user } = await supabase.auth.getUser()
  const { error } = await supabase.from('client_records').insert({
    organization_id: orgId,
    client_id: clientId,
    kind,
    title,
    detail: detail || null,
    amount: amount ?? null,
    occurred_at: occurredAt,
    created_by: user.user?.id ?? null,
  })
  if (error) return { ok: false, error: 'No se pudo guardar el registro.' }
  revalidateClient(clientId)
  return { ok: true }
}

export async function deleteClientRecord(id: string, clientId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('client_records').delete().eq('id', id)
  if (error) return { ok: false, error: 'No se pudo eliminar el registro.' }
  revalidateClient(clientId)
  return { ok: true }
}

// -------------------------------------------------------------------
// Recordatorios recurrentes
// -------------------------------------------------------------------
const reminderSchema = z.object({
  clientId: z.string().uuid(),
  message: z.string().trim().min(1, 'Escribe el mensaje que recibirá el cliente.').max(500),
  intervalDays: z.number().int().min(1).max(3650),
  firstDueAt: z.string().datetime({ offset: true }),
})

export async function addClientReminder(raw: unknown): Promise<ActionResult> {
  const parsed = reminderSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { clientId, message, intervalDays, firstDueAt } = parsed.data
  const supabase = await createClient()
  const orgId = await orgOf(supabase, clientId)
  if (!orgId) return { ok: false, error: 'No se encontró el cliente.' }

  const { error } = await supabase.from('client_reminders').insert({
    organization_id: orgId,
    client_id: clientId,
    message,
    interval_days: intervalDays,
    next_due_at: firstDueAt,
  })
  if (error) return { ok: false, error: 'No se pudo crear el recordatorio.' }
  revalidateClient(clientId)
  return { ok: true }
}

export async function setClientReminderActive(
  id: string,
  clientId: string,
  active: boolean
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('client_reminders').update({ active }).eq('id', id)
  if (error) return { ok: false, error: 'No se pudo actualizar el recordatorio.' }
  revalidateClient(clientId)
  return { ok: true }
}

export async function deleteClientReminder(id: string, clientId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('client_reminders').delete().eq('id', id)
  if (error) return { ok: false, error: 'No se pudo eliminar el recordatorio.' }
  revalidateClient(clientId)
  return { ok: true }
}
