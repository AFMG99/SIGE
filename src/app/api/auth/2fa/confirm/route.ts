import { NextRequest } from 'next/server'
import { confirm2FA } from '@/features/users/controllers/twoFactorController'

export async function POST(request: NextRequest) {
  return confirm2FA(request)
}
