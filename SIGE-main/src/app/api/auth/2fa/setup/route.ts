import { setup2FA } from '@/features/users/controllers/twoFactorController'

export async function POST() {
  return setup2FA()
}
