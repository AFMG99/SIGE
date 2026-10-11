import { NextRequest } from 'next/server'
import { reset2FA } from '@/features/users/controllers/twoFactorController'

type Params = { params: { id: string } }

export async function POST(request: NextRequest, ctx: Params) {
  return reset2FA(request, ctx)
}
