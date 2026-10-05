import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/DashboardShell'
import { getCurrentUser, getEffectiveExtraModules } from '@/lib/authz'
import { ToastProvider } from '@/components/ui/ToastProvider'

// Authenticated area layout: the movable header (top bar / side bar) + content
// padding live in DashboardShell, so it only exists after login —
// never on /login or /register.
// The current role (always read from DB) is forwarded to the header so only
// ADMIN_TI sees the "Usuarios" navigation link.
// extraModules from temporary overrides are also threaded through.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()
  const extraModules = user ? await getEffectiveExtraModules(user.id) : []

  return (
    <ToastProvider>
      <DashboardShell role={user?.role ?? null} extraModules={extraModules}>{children}</DashboardShell>
    </ToastProvider>
  )
}
