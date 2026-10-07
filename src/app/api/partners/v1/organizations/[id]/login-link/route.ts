import { NextResponse, type NextRequest } from 'next/server'
import { authenticatePartner, createLoginLink } from '@/features/socios/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** POST /api/partners/v1/organizations/:id/login-link — pase de un solo uso para que el dueño entre sin contraseña. */
export async function POST(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const auth = await authenticatePartner(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const res = await createLoginLink(auth.service, auth.partner, id)
  // El pase es una credencial: ni caché ni referer.
  res.headers.set('Cache-Control', 'no-store')
  res.headers.set('Referrer-Policy', 'no-referrer')
  return res
}
