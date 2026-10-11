import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSession } from '@/shared/models/auth'
import { prisma } from '@/shared/models/prisma'
import { SettingsView } from '@/features/users/views/settings/SettingsView'

// Account settings for the logged-in user (/dashboard/configuracion).
// Thin server page: session guard + Prisma queries → serializable props.
// No module gate — every authenticated user manages their own account.
export default async function SettingsPage() {
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

  const viewerToken = (await cookies()).get('auth-token')?.value

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <SettingsView
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
