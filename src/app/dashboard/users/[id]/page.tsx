import { redirect } from 'next/navigation'
import { requireAdmin } from '@/shared/models/authz'
import { prisma } from '@/shared/models/prisma'
import { UserDetailClient } from './UserDetailClient'

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    redirect('/dashboard')
  }

  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      phone: true,
      lastLoginAt: true,
      twoFactorEnabled: true,
      twoFactorRequired: true,
      createdAt: true,
    },
  })

  if (!user) {
    redirect('/dashboard/users')
  }

  const sessions = await prisma.session.findMany({
    where: { userId: id, expiresAt: { gt: new Date() } },
    select: { id: true, token: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  })

  const auditLogs = await prisma.auditLog.findMany({
    where: { targetId: id },
    select: { id: true, actorId: true, actorEmail: true, action: true, detail: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  // Get current admin's session token for marking current session
  const cookieStore = (await import('next/headers')).cookies()
  const adminToken = cookieStore.get('auth-token')?.value

  const sessionsWithCurrent = sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    // The viewer's token only matches when the admin views their own account.
    current: s.token === adminToken,
  }))

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <UserDetailClient
        currentUserId={admin.id}
        adminToken={adminToken}
        initialUser={{
          ...user,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
        }}
        initialSessions={sessionsWithCurrent}
        initialAuditLogs={auditLogs.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </main>
  )
}