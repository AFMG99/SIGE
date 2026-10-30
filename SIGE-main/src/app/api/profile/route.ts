import { NextRequest } from 'next/server'
import { getProfile, updateProfile } from '@/features/users/controllers/profileController'

export async function GET() {
  return getProfile()
}

export async function PATCH(request: NextRequest) {
  return updateProfile(request)
}
