import { NextRequest } from 'next/server'
import { setTwoFactorRequirement } from '@/features/users/controllers/twoFactorController'

type Params = { params: { id: string } }

export async function POST(request: NextRequest, ctx: Params) {
  return setTwoFactorRequirement(request, ctx)
}
