'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ROLE_LABELS, ROLE_BADGES, STATUS_LABELS, STATUS_BADGES, type Role, type UserStatus } from '@/shared/models/permissions'
import { Avatar } from '@/shared/views/ui/Avatar'
import { ProfileTab } from '@/features/users/views/detail/ProfileTab'
import { RolesPermissionsTab } from '@/features/users/views/detail/RolesPermissionsTab'
import { SecurityTab } from '@/features/users/views/detail/SecurityTab'
import { ActivityTab } from '@/features/users/views/detail/ActivityTab'
import { UserDrawer, type UserFormData } from '@/features/users/views/UserDrawer'
import { useToast } from '@/shared/views/ui/ToastProvider'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'

interface AdminUser {
  id: string
  name: string | null
  email: string
  role: Role
  status: UserStatus
  phone: string | null
  lastLoginAt: string | null
  twoFactorEnabled: boolean
  createdAt: string
}

interface Session {
  id: string
  createdAt: string
  expiresAt: string
  current: boolean
}

interface AuditEntry {
  id: string
  actorId: string
  actorEmail: string
  action: string
  detail: string | null
  createdAt: string
}

interface UserOverride {
  id: string
  moduleId: string
  action: string
  expiresAt: string | null
  grantedBy: string
  grantedByEmail: string
  createdAt: string
}

interface UserDetailClientProps {
  currentUserId: string
  adminToken: string | undefined
  initialUser: AdminUser
  initialSessions: Session[]
  initialAuditLogs: AuditEntry[]
}

type Tab = 'profile' | 'roles' | 'security' | 'activity'

export function UserDetailClient({
  currentUserId,
  adminToken,
  initialUser,
  initialSessions,
  initialAuditLogs,
}: UserDetailClientProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [user, setUser] = useState<AdminUser>(initialUser)
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [auditLogs] = useState<AuditEntry[]>(initialAuditLogs)
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [drawer, setDrawer] = useState<{ open: boolean; mode: 'create' | 'edit'; data?: AdminUser }>({
    open: false,
    mode: 'edit',
  })
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [suspendConfirm, setSuspendConfirm] = useState<{ user: AdminUser; action: 'suspend' | 'activate' } | null>(null)
  const [overrides, setOverrides] = useState<UserOverride[]>([])
  const [overridesLoading, setOverridesLoading] = useState(false)

  const fetchOverrides = useCallback(async () => {
    setOverridesLoading(true)
    try {
      const res = await fetch(`/api/users/${user.id}/overrides`)
      const data = await res.json()
      if (res.ok) {
        setOverrides(data.overrides || [])
      }
    } catch (error) {
      console.error('Failed to fetch overrides:', error)
    } finally {
      setOverridesLoading(false)
    }
  }, [user.id])

  // Fetch overrides on mount and when user changes
  useEffect(() => {
    fetchOverrides()
  }, [fetchOverrides])

  const handleEdit = useCallback(() => {
    setDrawer({ open: true, mode: 'edit', data: user })
  }, [user])

  const handleDrawerSubmit = async (data: UserFormData) => {
    try {
      const payload = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        status: data.status,
      }
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || 'Error al actualizar')
      setUser({ ...user, ...data })
      showToast('Cambios guardados correctamente', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error inesperado', 'error')
      throw error
    }
  }

  const handleSuspend = async () => {
    if (!suspendConfirm) return
    try {
      const res = await fetch(`/api/users/${suspendConfirm.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: suspendConfirm.action === 'suspend' ? 'INACTIVE' : 'ACTIVE' }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || 'Error al cambiar estado')
      setUser((prev) => ({ ...prev, status: suspendConfirm.action === 'suspend' ? 'INACTIVE' : 'ACTIVE' }))
      showToast(
        suspendConfirm.action === 'suspend' ? 'Usuario suspendido' : 'Usuario reactivado',
        'success'
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error inesperado', 'error')
    } finally {
      setSuspendConfirm(null)
    }
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || 'Error al eliminar')
      showToast('Usuario eliminado correctamente', 'success')
      router.push('/dashboard/users')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error inesperado', 'error')
    } finally {
      setDeleteConfirm(false)
    }
  }

  const handleToggle2FA = async (enabled: boolean) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ twoFactorEnabled: enabled }),
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.message || 'Error al cambiar 2FA')
    setUser((prev) => ({ ...prev, twoFactorEnabled: enabled }))
  }

  const handleRevokeSession = async (sessionId: string) => {
    const res = await fetch(`/api/users/${user.id}/sessions/${sessionId}`, { method: 'DELETE' })
    const result = await res.json()
    if (!res.ok) throw new Error(result.message || 'Error al revocar sesión')
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
  }

  const handleRevokeAllSessions = async () => {
    const res = await fetch(`/api/users/${user.id}/sessions`, { method: 'DELETE' })
    const result = await res.json()
    if (!res.ok) throw new Error(result.message || 'Error al cerrar sesiones')
    setSessions([])
    showToast(`Se cerraron todas las sesiones de ${user.name || user.email}`, 'success')
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Perfil' },
    { id: 'roles', label: 'Roles y permisos' },
    { id: 'security', label: 'Seguridad' },
    { id: 'activity', label: 'Actividad' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/dashboard/users"
          className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver a usuarios
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleEdit}
            className="ui-btn ui-btn-primary inline-flex items-center gap-2"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Editar
          </button>
        </div>
      </div>

      {/* User Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <Avatar name={user.name} email={user.email} size="xl" />
          <div className="flex-1 text-center md:text-left">
            <h1 className="ui-title text-2xl">{user.name || '—'}</h1>
            <p className="ui-muted mt-1">{user.email}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${ROLE_BADGES[user.role]}`}>
                {ROLE_LABELS[user.role]}
              </span>
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${STATUS_BADGES[user.status]}`}>
                {STATUS_LABELS[user.status]}
              </span>
              {user.id === currentUserId && (
                <span className="inline-flex rounded-full px-3 py-1 text-sm font-medium bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                  Tú
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <nav className="border-b border-gray-100 dark:border-slate-800" aria-label="Pestañas de detalle de usuario">
          <ul className="flex overflow-x-auto" role="tablist">
            {tabs.map((tab) => (
              <li key={tab.id} role="presentation">
                <button
                  role="tab"
                  id={`${tab.id}-tab`}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`${tab.id}-panel`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') {
                      e.preventDefault()
                      const idx = tabs.findIndex((t) => t.id === activeTab)
                      setActiveTab(tabs[(idx + 1) % tabs.length].id)
                    } else if (e.key === 'ArrowLeft') {
                      e.preventDefault()
                      const idx = tabs.findIndex((t) => t.id === activeTab)
                      setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length].id)
                    }
                  }}
                  className={`flex-shrink-0 rounded-t-md px-4 py-4 text-sm font-medium border-b-2 transition-colors focus-ring ${
                    activeTab === tab.id
                      ? 'border-emerald-600 text-emerald-600 dark:border-emerald-500 dark:text-emerald-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-6 md:p-8">
          {activeTab === 'profile' && <ProfileTab user={user} />}
          {activeTab === 'roles' && (
            <RolesPermissionsTab
              user={user}
              overrides={overrides}
              loading={overridesLoading}
              onRefresh={fetchOverrides}
            />
          )}
          {activeTab === 'security' && (
            <SecurityTab
              userId={user.id}
              userEmail={user.email}
              sessions={sessions}
              twoFactorEnabled={user.twoFactorEnabled}
              onToggle2FA={handleToggle2FA}
              onRevokeSession={handleRevokeSession}
              onRevokeAllSessions={handleRevokeAllSessions}
              currentUserId={currentUserId}
            />
          )}
          {activeTab === 'activity' && <ActivityTab auditLogs={auditLogs} />}
        </div>
      </div>

      {/* Drawer */}
      <UserDrawer
        isOpen={drawer.open}
        onClose={() => setDrawer({ open: false, mode: 'edit' })}
        onSubmit={handleDrawerSubmit}
        initialData={drawer.data ? {
          name: drawer.data.name || '',
          email: drawer.data.email,
          phone: drawer.data.phone || '',
          role: drawer.data.role,
          status: drawer.data.status,
          sendInvitation: false,
          password: '',
        } : null}
        mode="edit"
      />

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Eliminar usuario"
        description={`¿Estás seguro de que quieres eliminar a ${user.name || user.email}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="destructive"
      />

      {suspendConfirm && (
        <ConfirmDialog
          isOpen
          onClose={() => setSuspendConfirm(null)}
          onConfirm={handleSuspend}
          title={suspendConfirm.action === 'suspend' ? 'Suspender usuario' : 'Reactivar usuario'}
          description={
            suspendConfirm.action === 'suspend'
              ? `¿Suspender a ${suspendConfirm.user.name || suspendConfirm.user.email}? El usuario no podrá acceder a la plataforma.`
              : `¿Reactivar a ${suspendConfirm.user.name || suspendConfirm.user.email}? El usuario recuperará el acceso.`
          }
          confirmText={suspendConfirm.action === 'suspend' ? 'Suspender' : 'Reactivar'}
          variant={suspendConfirm.action === 'suspend' ? 'destructive' : 'primary'}
        />
      )}
    </div>
  )
}