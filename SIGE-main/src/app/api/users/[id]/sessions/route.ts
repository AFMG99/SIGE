import { NextRequest } from 'next/server'
import { listSessions, revokeAllSessions } from '@/features/users/controllers/sessionsController'

type Params = { params: { id: string } }

export async function GET(request: NextRequest, ctx: Params) {
  return listSessions(request, ctx)
}

export async function DELETE(request: NextRequest, ctx: Params) {
  return revokeAllSessions(request, ctx)
}
