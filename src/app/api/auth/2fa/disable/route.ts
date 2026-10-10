import { NextRequest } from 'next/server'
import { disable2FA } from '@/features/users/controllers/twoFactorController'

export async function POST(request: NextRequest) {
  return disable2FA(request)
}
