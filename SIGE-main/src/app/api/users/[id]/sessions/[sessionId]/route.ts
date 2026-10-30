import { NextRequest } from 'next/server'
import { revokeSession } from '@/features/users/controllers/sessionsController'

type Params = { params: { id: string; sessionId: string } }

export async function DELETE(request: NextRequest, ctx: Params) {
  return revokeSession(request, ctx)
}
