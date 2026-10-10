import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/shared/models/auth'

// Enrolment needs an authenticated session (the user already proved their
// password in login phase 1). This route lives OUTSIDE /login so the
// "already authenticated → /dashboard" redirect there cannot fight it.
export default async function TwoFASetupLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  return <>{children}</>
}
