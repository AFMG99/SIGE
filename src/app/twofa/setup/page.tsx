import { TwoFactorEnrollment } from '@/features/users/views/twofa/TwoFactorEnrollment'

// Forced or voluntary 2FA enrollment. Reached only after a successful
// login-phase verification (session cookie already set by /api/auth/2fa/verify),
// or voluntarily from SecurityTab while logged in.
export default function TwoFASetupPage() {
  return <TwoFactorEnrollment />
}
