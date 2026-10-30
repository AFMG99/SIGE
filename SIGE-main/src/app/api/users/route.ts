import { NextRequest } from 'next/server'
import { listUsers, createUser } from '@/features/users/controllers/usersController'

export async function GET(request: NextRequest) {
  return listUsers(request)
}

export async function POST(request: NextRequest) {
  return createUser(request)
}
