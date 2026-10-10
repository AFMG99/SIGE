import { NextRequest } from 'next/server'
import { verify2FA } from '@/features/users/controllers/twoFactorController'

export async function POST(request: NextRequest) {
  return verify2FA(request)
}
