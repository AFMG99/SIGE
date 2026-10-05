import { logout } from '@/features/users/controllers/authController'

export async function POST() {
  return logout()
}
