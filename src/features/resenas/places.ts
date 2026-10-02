import 'server-only'

// =====================================================================
// Google Places API (New) — la ficha del negocio en Google.
//
//   Mismo molde que usa PASEN para prospectar (Text Search con máscara de
//   campos), adaptado a otro fin: aquí el dueño busca SU negocio una vez para
//   (1) obtener el enlace de "dejar reseña" y (2) copiar su horario.
//
//   Dos llamadas, a propósito:
//     · searchPlaces → solo nombre y dirección (tarifa baja).
//     · placeHours   → el horario, que es de tarifa alta: se pide UNA vez y
//                      solo para el negocio que el dueño eligió.
//
//   Sin GOOGLE_PLACES_API_KEY todo esto se apaga solo: el dueño pega su
//   enlace a mano y el resto funciona igual.
// =====================================================================

const BASE = 'https://places.googleapis.com/v1'

export function placesAvailable(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim())
}

/** Enlace directo al formulario de reseña de una ficha de Google. */
export function reviewUrlFor(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
}

export interface PlaceHit {
  placeId: string
  name: string
  address: string
}

export async function searchPlaces(query: string, regionCode?: string | null): Promise<PlaceHit[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim()
  if (!key) return []
  const res = await fetch(`${BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'es',
      pageSize: 5,
      ...(regionCode && /^[A-Za-z]{2}$/.test(regionCode) ? { regionCode: regionCode.toUpperCase() } : {}),
    }),
  })
  if (!res.ok) {
    console.error('[places] searchText', res.status, (await res.text().catch(() => '')).slice(0, 300))
    return []
  }
  const json = (await res.json()) as {
    places?: { id: string; displayName?: { text?: string }; formattedAddress?: string }[]
  }
  return (json.places ?? []).map((p) => ({
    placeId: p.id,
    name: p.displayName?.text ?? 'Sin nombre',
    address: p.formattedAddress ?? '',
  }))
}

export interface DayHours {
  /** 0 = domingo … 6 = sábado (igual que Google y que business_hours). */
  weekday: number
  open: string
  close: string
}

const hhmm = (h?: number, m?: number) => `${String(h ?? 0).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`

/**
 * Horario semanal de la ficha. ChatVenti guarda UN tramo por día, así que un
 * día con horario partido se resume en "de la primera apertura al último
 * cierre"; los tramos que cruzan la medianoche se cortan a las 23:59.
 * Devuelve null si la ficha no tiene horario o si Google falla.
 */
export async function placeHours(placeId: string): Promise<DayHours[] | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim()
  if (!key) return null
  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'regularOpeningHours' },
  })
  if (!res.ok) {
    console.error('[places] details', res.status, (await res.text().catch(() => '')).slice(0, 300))
    return null
  }
  type Point = { day?: number; hour?: number; minute?: number }
  const json = (await res.json()) as { regularOpeningHours?: { periods?: { open?: Point; close?: Point }[] } }
  const periods = json.regularOpeningHours?.periods
  if (!periods?.length) return null

  const byDay = new Map<number, DayHours>()
  for (const p of periods) {
    const day = p.open?.day
    if (day === undefined || day < 0 || day > 6) continue
    const open = hhmm(p.open?.hour, p.open?.minute)
    // Sin cierre = abierto 24 h; cierre en otro día = cruza la medianoche.
    const close = !p.close || p.close.day !== day ? '23:59' : hhmm(p.close.hour, p.close.minute)
    const prev = byDay.get(day)
    byDay.set(day, {
      weekday: day,
      open: prev && prev.open < open ? prev.open : open,
      close: prev && prev.close > close ? prev.close : close,
    })
  }
  return [...byDay.values()].filter((d) => d.close > d.open)
}
