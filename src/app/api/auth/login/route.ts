import { NextRequest } from 'next/server'
import { login } from '@/features/users/controllers/authController'

export async function POST(request: NextRequest) {
  return login(request)
}
