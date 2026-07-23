import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CrmClient, Segment } from '@/features/crm/segments'
import { SEGMENT_META } from '@/features/crm/segments'

export const dynamic = 'force-dynamic'

// Escapa un campo para CSV: comillas dobles y envuelve si hay coma/comilla/salto.
function cell(value: string | number | null): string {
  const s = value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function dateOnly(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : ''
}

// Exporta los clientes del CRM (respeta el filtro de segmento activo). La RPC es
// INVOKER, así que solo devuelve los de la org del usuario autenticado.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data } = await supabase.rpc('get_crm_overview')
  const clients = ((data as unknown as { clients: CrmClient[] } | null)?.clients ?? []) as CrmClient[]

  const segParam = request.nextUrl.searchParams.get('seg')
  const rows = clients.filter((c) => {
    if (segParam === 'inactive') return c.inactive
    if (segParam === 'nuevo' || segParam === 'regular' || segParam === 'vip')
      return c.segment === segParam
    return true
  })

  const header = [
    'Nombre',
    'Telefono',
    'Segmento',
    'Citas',
    'Ultima visita',
    'Gasto registrado',
    'Inactivo',
    'Etiquetas',
    'Alta',
  ]
  const lines = [header.join(',')]
  for (const c of rows) {
    lines.push(
      [
        cell(c.name),
        cell(c.phone),
        cell(SEGMENT_META[c.segment as Segment]?.label ?? c.segment),
        cell(c.appt_count),
        cell(dateOnly(c.last_visit)),
        cell(c.spent || ''),
        cell(c.inactive ? 'si' : ''),
        cell((c.tags ?? []).map((t) => t.name).join(' | ')),
        cell(dateOnly(c.created_at)),
      ].join(',')
    )
  }

  // BOM para que Excel abra los acentos en UTF-8.
  const csv = '﻿' + lines.join('\r\n')
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="clientes-chatventi-${stamp}.csv"`,
    },
  })
}
