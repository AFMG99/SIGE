import { getSession } from '@/shared/models/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/shared/models/prisma'
import { ROLE_LABELS } from '@/shared/models/permissions'

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  // Validar que session.userId existe y es string
  if (session.userId == null || typeof session.userId !== 'string') {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  })

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center dark:bg-emerald-500/15">
            <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h1 className="ui-title text-2xl">{user.name || 'Usuario'}</h1>
            <p className="ui-muted">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-xl p-6 dark:bg-slate-800/60">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 dark:text-gray-400">Rol</h3>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{ROLE_LABELS[user.role]}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 dark:bg-slate-800/60">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 dark:text-gray-400">Miembro desde</h3>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{new Date(user.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 dark:bg-slate-800/60">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 dark:text-gray-400">ID</h3>
            <p className="text-lg font-mono text-gray-600 dark:text-gray-300">{user.id.slice(0, 12)}...</p>
          </div>
        </div>
        </div>
      </main>
    )
  }