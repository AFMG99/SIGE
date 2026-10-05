import { NextRequest } from 'next/server'
import { listOverrides, grantOverride, revokeOverride } from '@/features/users/controllers/overridesController'

type Params = { params: { id: string } }

export async function GET(request: NextRequest, ctx: Params) {
  return listOverrides(request, ctx)
}

export async function POST(request: NextRequest, ctx: Params) {
  return grantOverride(request, ctx)
}

export async function DELETE(request: NextRequest, ctx: Params) {
  return revokeOverride(request, ctx)
}
