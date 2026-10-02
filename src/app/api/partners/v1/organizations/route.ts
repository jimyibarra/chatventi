import { NextResponse, type NextRequest } from 'next/server'
import {
  apiError,
  authenticatePartner,
  createOrgSchema,
  createPartnerOrganization,
  listPartnerOrganizations,
} from '@/features/socios/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/partners/v1/organizations — los negocios del socio. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticatePartner(request)
  if (auth instanceof NextResponse) return auth
  return listPartnerOrganizations(auth.service, auth.partner)
}

/** POST /api/partners/v1/organizations — alta de un negocio (idempotente por externalId). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticatePartner(request)
  if (auth instanceof NextResponse) return auth

  const parsed = createOrgSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return apiError('invalid_body', 400, `${issue?.path.join('.') ?? ''}: ${issue?.message ?? 'inválido'}`)
  }
  return createPartnerOrganization(auth.service, auth.partner, parsed.data)
}
