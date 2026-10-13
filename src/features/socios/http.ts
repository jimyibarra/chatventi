import { NextResponse } from 'next/server'

// Respuestas de la API de socios. Archivo chico y sin dependencias para que
// service.ts y catalog.ts lo compartan sin importarse entre sí.
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status })
export const apiError = (code: string, status: number, message?: string) =>
  json({ error: code, ...(message ? { message } : {}) }, status)
