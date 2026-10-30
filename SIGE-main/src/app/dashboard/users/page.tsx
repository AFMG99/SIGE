import { redirect } from 'next/navigation'
import { requireAdmin } from '@/shared/models/authz'
import { prisma } from '@/shared/models/prisma'
import { UserManagement } from '@/features/users/views/UserManagement'

export default async function UsersPage() {
  const admin = await requireAdmin()
  if (!admin) {
    redirect('/dashboard')
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, status: true, phone: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <UserManagement
        currentUserId={admin.id}
        initialUsers={users.map((user) => ({
          ...user,
          status: user.status,
          phone: user.phone,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
        }))}
      />
    </main>
  )
}
