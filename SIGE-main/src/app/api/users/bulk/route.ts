import { NextRequest } from 'next/server'
import { bulkUsers } from '@/features/users/controllers/usersController'

export async function POST(request: NextRequest) {
  return bulkUsers(request)
}
