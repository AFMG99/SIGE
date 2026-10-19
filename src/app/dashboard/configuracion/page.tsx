import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSession } from '@/shared/models/auth'
import { getEffectiveExtraModules } from '@/shared/models/authz'
import { visibleModules } from '@/shared/models/permissions'
import { prisma } from '@/shared/models/prisma'
import { SettingsView } from '@/features/users/views/settings/SettingsView'
import { SETTINGS_TABS, type Tab } from '@/features/users/views/settings/settingsTypes'

// Account settings for the logged-in user (/dashboard/configuracion).
// Thin server page: session guard + Prisma queries → serializable props.
// No module gate — every authenticated user manages their own account.
// `?tab=<id>` deep-links a section (from the header's account menu); anything
// else falls back to the default tab.
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string | string[] }
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      avatarUrl: true,
      timezone: true,
      notificationsEmail: true,
      notificationsInApp: true,
      twoFactorEnabled: true,
      twoFactorRequired: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })
  if (!user) redirect('/login')

  const sessions = await prisma.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    select: { id: true, token: true, userAgent: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  })

  // La pestaña de notificaciones muestra el estado REAL de la campana, así que
  // necesita el conteo de alertas sin revisar y saber si el rol ve el módulo
  // (misma regla que la navegación: matriz de permisos + overrides temporales).
  const extraModules = await getEffectiveExtraModules(user.id)
  const puedeVerAlertas =
    visibleModules(user.role).includes('alerts') || extraModules.includes('alerts')
  const alertasPendientes = puedeVerAlertas
    ? await prisma.alertaConsumo.count({ where: { estado: 'nueva' } })
    : 0

  const viewerToken = (await cookies()).get('auth-token')?.value

  const requestedTab = typeof searchParams.tab === 'string' ? searchParams.tab : null
  const initialTab: Tab = SETTINGS_TABS.some((t) => t.id === requestedTab)
    ? (requestedTab as Tab)
    : 'perfil'

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <SettingsView
        initialTab={initialTab}
        alertasPendientes={alertasPendientes}
        puedeVerAlertas={puedeVerAlertas}
        initialUser={{
          ...user,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
        }}
        initialSessions={sessions.map((s) => ({
          id: s.id,
          userAgent: s.userAgent,
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          current: s.token === viewerToken,
        }))}
      />
    </main>
  )
}
