import { NextResponse, type NextRequest } from 'next/server'
import {
  apiError,
  authenticatePartner,
  getPartnerOrganization,
  updateOrgSchema,
  updatePartnerOrganization,
} from '@/features/socios/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/partners/v1/organizations/:id?period=YYYY-MM — estado, consumo y actividad del mes. */
export async function GET(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const auth = await authenticatePartner(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  return getPartnerOrganization(auth.service, auth.partner, id, request.nextUrl.searchParams.get('period'))
}

/** PATCH /api/partners/v1/organizations/:id — suspender, reactivar o cambiar de plan. */
export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const auth = await authenticatePartner(request)
  if (auth instanceof NextResponse) return auth
  const parsed = updateOrgSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return apiError('invalid_body', 400, parsed.error.issues[0]?.message)
  const { id } = await params
  return updatePartnerOrganization(auth.service, auth.partner, id, parsed.data)
}
