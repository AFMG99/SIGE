import { NextRequest } from 'next/server'
import { changePassword } from '@/features/users/controllers/profileController'

export async function POST(request: NextRequest) {
  return changePassword(request)
}
