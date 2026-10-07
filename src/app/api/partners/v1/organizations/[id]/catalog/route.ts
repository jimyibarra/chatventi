import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError, authenticatePartner, partnerOwnsOrganization } from '@/features/socios/service'
import { catalogSchema, putPartnerCatalog } from '@/features/socios/catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** PUT /api/partners/v1/organizations/:id/catalog — servicios y horario del negocio, desde el socio. */
export async function PUT(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const auth = await authenticatePartner(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return apiError('not_found', 404)
  const parsed = catalogSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return apiError('invalid_body', 400, parsed.error.issues[0]?.message)
  if (!(await partnerOwnsOrganization(auth.service, auth.partner, id))) return apiError('not_found', 404)
  return putPartnerCatalog(auth.service, id, parsed.data)
}
