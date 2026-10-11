import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/shared/views/DashboardShell'
import { getCurrentUser, getEffectiveExtraModules } from '@/shared/models/authz'
import { getSession } from '@/shared/models/auth'
import { ToastProvider } from '@/shared/views/ui/ToastProvider'
import { prisma } from '@/shared/models/prisma'
import { isTwoFactorRequired } from '@/shared/models/twoFactorPolicy'

// Authenticated area layout: the movable header (top bar / side bar) + content
// padding live in DashboardShell, so it only exists after login —
// never on /login.
// The current role (always read from DB) is forwarded to the header so only
// ADMIN_TI sees the "Usuarios" navigation link.
// extraModules from temporary overrides are also threaded through.
// Users whose role mandates 2FA — or whom an admin flagged as 2FA-required
// (User.twoFactorRequired) — are diverted to the enrollment screen until they
// complete setup — otherwise the policy would be trivially bypassable by
// simply never enabling 2FA.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await getCurrentUser()
  const extraModules = user ? await getEffectiveExtraModules(user.id) : []

  let mustEnroll2FA = false
  if (user) {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true, role: true, twoFactorRequired: true },
    })
    if (u && !u.twoFactorEnabled && isTwoFactorRequired(u)) {
      mustEnroll2FA = true
    }
  }
  if (mustEnroll2FA) redirect('/twofa/setup')

  return (
    <ToastProvider>
      <DashboardShell role={user?.role ?? null} extraModules={extraModules}>{children}</DashboardShell>
    </ToastProvider>
  )
}
