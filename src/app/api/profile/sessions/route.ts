import { listOwnSessions, revokeOtherSessions } from '@/features/users/controllers/profileController'

export async function GET() {
  return listOwnSessions()
}

export async function DELETE() {
  return revokeOtherSessions()
}
