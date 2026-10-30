import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/shared/views/DashboardShell'
import { getCurrentUser, getEffectiveExtraModules } from '@/shared/models/authz'
import { getSession } from '@/shared/models/auth'
import { ToastProvider } from '@/shared/views/ui/ToastProvider'
import { prisma } from '@/shared/models/prisma'
import { isTwoFactorRequired } from '@/shared/models/twoFactorPolicy'
import { visibleModules } from '@/shared/models/permissions'
import { badgeAlertasNav } from '@/features/alertas/models/alertas'

// Authenticated area layout: the movable header (top bar / side bar) + content
// padding live in DashboardShell, so it only exists after login —
// never on /login.
// The current role (always read from DB) is forwarded to the header so only
// ADMIN_TI sees the "Usuarios" navigation link.
// extraModules from temporary overrides are also threaded through.
// The pending-alert count for the navigation badge is resolved here too: the
// rule (module visibility + the in-app notification switch) lives in the alerts
// model, never in the chrome.
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
  let avisarEnApp = true
  if (user) {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        twoFactorEnabled: true,
        role: true,
        twoFactorRequired: true,
        notificationsInApp: true,
      },
    })
    if (u) {
      avisarEnApp = u.notificationsInApp
      if (!u.twoFactorEnabled && isTwoFactorRequired(u)) {
        mustEnroll2FA = true
      }
    }
  }
  if (mustEnroll2FA) redirect('/twofa/setup')

  // Punto rojo de la campana: una consulta barata por índice que sólo corre si
  // el rol ve el módulo de alertas y el usuario no apagó los avisos en la
  // interfaz (quien los apagó sigue teniendo su bandeja, pero no se le avisa).
  const veAlertas = user
    ? visibleModules(user.role).includes('alerts') || extraModules.includes('alerts')
    : false
  const sinRevisar =
    veAlertas && avisarEnApp
      ? await prisma.alertaConsumo.count({ where: { estado: 'nueva' } })
      : 0

  const badges: Record<string, number | undefined> = {}
  const conteoAlertas = badgeAlertasNav(sinRevisar, avisarEnApp)
  if (conteoAlertas !== null) badges.alertas = conteoAlertas

  return (
    <ToastProvider>
      <DashboardShell
        role={user?.role ?? null}
        extraModules={extraModules}
        badges={badges}
        account={
          user
            ? { name: user.name, email: user.email, avatarUrl: user.avatarUrl }
            : null
        }
      >
        {children}
      </DashboardShell>
    </ToastProvider>
  )
}
