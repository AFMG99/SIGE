import { NextRequest } from 'next/server'
import { revokeOwnSession } from '@/features/users/controllers/profileController'

type Params = { params: { sessionId: string } }

export async function DELETE(request: NextRequest, ctx: Params) {
  return revokeOwnSession(request, ctx)
}
