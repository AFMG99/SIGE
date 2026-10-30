import { NextRequest } from 'next/server'
import { getUser, updateUser, deleteUser } from '@/features/users/controllers/userDetailController'

type Params = { params: { id: string } }

export async function GET(request: NextRequest, ctx: Params) {
  return getUser(request, ctx)
}

export async function PATCH(request: NextRequest, ctx: Params) {
  return updateUser(request, ctx)
}

export async function DELETE(request: NextRequest, ctx: Params) {
  return deleteUser(request, ctx)
}
