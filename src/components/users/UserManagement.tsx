'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ROLES,
  ROLE_LABELS,
  USER_STATUSES,
  STATUS_LABELS,
  type Role,
} from '@/lib/permissions'
import { UserTable, UserCardList, type AdminUser } from './UserTable'
import { UserDrawer, type UserFormData } from './UserDrawer'
import { PermissionMatrixModal } from './PermissionMatrixModal'
import { exportUsersToCSV } from './export-csv'
import { useToast } from '@/components/ui/ToastProvider'
import { UserTableSkeleton, UserCardSkeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export type { AdminUser }

export interface UserManagementProps {
  initialUsers: AdminUser[]
  currentUserId: string
}

type SortField = 'name' | 'email' | 'role' | 'status' | 'lastLoginAt' | 'createdAt'
type SortDirection = 'asc' | 'desc'

interface DrawerState {
  open: boolean
  mode: 'create' | 'edit'
  user: AdminUser | null
}

interface ConfirmState {
  type: 'suspend' | 'delete' | 'revokeAllSessions'
  ids: string[]
  subject: string
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]

const normalize = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = (await res.json().catch(() => null)) as T | null
  if (!res.ok) {
    const message = (body as { message?: string } | null)?.message
    throw new Error(message ?? 'Error interno del servidor')
  }
  return body as T
}

function sortValue(user: AdminUser, field: SortField): string | number | Date | null {
  switch (field) {
    case 'name':
      return user.name ?? user.email
    case 'email':
      return user.email
    case 'role':
      return ROLE_LABELS[user.role]
    case 'status':
      return STATUS_LABELS[user.status]
    case 'lastLoginAt':
      return user.lastLoginAt ? new Date(user.lastLoginAt) : null
    case 'createdAt':
      return new Date(user.createdAt)
  }
}

function compare(a: AdminUser, b: AdminUser, field: SortField, direction: SortDirection): number {
  const va = sortValue(a, field)
  const vb = sortValue(b, field)
  if (va === null && vb === null) return 0
  if (va === null) return 1 // nulls always last
  if (vb === null) return -1
  let result = 0
  if (va instanceof Date && vb instanceof Date) {
    result = va.getTime() - vb.getTime()
  } else if (typeof va === 'number' && typeof vb === 'number') {
    result = va - vb
  } else {
    result = String(va).localeCompare(String(vb), 'es')
  }
  return direction === 'asc' ? result : -result
}

export function UserManagement({ initialUsers, currentUserId }: UserManagementProps) {
  const router = useRouter()
  const { showToast } = useToast()

  const [users, setUsers] = useState<AdminUser[]>(initialUsers)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'createdAt',
    direction: 'desc',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, mode: 'create', user: null })
  const [submitting, setSubmitting] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [revokeAllTarget, setRevokeAllTarget] = useState<AdminUser | null>(null)
  const [matrixOpen, setMatrixOpen] = useState(false)

  // Reset to first page when the filter inputs change
  useEffect(() => {
    setPage(1)
  }, [query, roleFilter, statusFilter, pageSize])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<{ users: AdminUser[] }>('/api/users?pageSize=100&page=1')
      setUsers(data.users)
      setSelectedIds((prev) => prev.filter((id) => data.users.some((u) => u.id === id)))
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // ---------- Derived data: filter → sort → paginate ----------
  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    let list = users
    if (q) {
      list = list.filter((u) =>
        normalize(u.name ?? '').includes(q) ||
        normalize(u.email).includes(q) ||
        normalize(u.phone ?? '').includes(q)
      )
    }
    if (roleFilter) list = list.filter((u) => u.role === roleFilter)
    if (statusFilter) list = list.filter((u) => u.status === statusFilter)
    return list
  }, [users, query, roleFilter, statusFilter])

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compare(a, b, sort.field, sort.direction)),
    [filtered, sort]
  )

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
  const rangeFrom = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const rangeTo = Math.min(safePage * pageSize, sorted.length)

  const hasFilters = query.trim() !== '' || roleFilter !== '' || statusFilter !== ''

  const clearFilters = () => {
    setQuery('')
    setRoleFilter('')
    setStatusFilter('')
  }

  // ---------- Selection ----------
  const pageIds = pageItems.map((u) => u.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))

  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) =>
      selected ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)
    )
  }

  const handleSelectAll = (selected: boolean) => {
    setSelectedIds((prev) =>
      selected ? [...prev, ...pageIds.filter((id) => !prev.includes(id))] : prev.filter((id) => !pageIds.includes(id))
    )
  }

  // ---------- Sorting ----------
  const handleSort = (field: string) => {
    setSort((prev) => {
      const f = field as SortField
      if (prev.field === f) {
        return { field: f, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { field: f, direction: 'asc' }
    })
  }

  // ---------- Row actions ----------
  const handleView = (user: AdminUser) => router.push(`/dashboard/users/${user.id}`)

  const handleEdit = (user: AdminUser) => setDrawer({ open: true, mode: 'edit', user })

  const handleCreate = () => setDrawer({ open: true, mode: 'create', user: null })

  const handleSuspendRequest = (user: AdminUser) =>
    setConfirm({ type: 'suspend', ids: [user.id], subject: user.name || user.email })

  const handleDeleteRequest = (user: AdminUser) =>
    setConfirm({ type: 'delete', ids: [user.id], subject: user.name || user.email })

  const handleRevokeAllSessions = (user: AdminUser) => {
    setRevokeAllTarget(user)
    setConfirm({
      type: 'revokeAllSessions',
      ids: [user.id],
      subject: user.name || user.email,
    })
  }

  const handleActivate = async (user: AdminUser) => {
    try {
      await api(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
      showToast('Usuario reactivado', 'success')
      await refresh()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo reactivar el usuario', 'error')
    }
  }

  // ---------- Bulk actions ----------
  const runBulk = async (action: 'suspend' | 'activate' | 'delete' | 'setRole', ids: string[], role?: Role) => {
    if (ids.length === 0) return
    try {
      await api('/api/users/bulk', {
        method: 'POST',
        body: JSON.stringify({ action, ids, ...(role ? { role } : {}) }),
      })
      const messages: Record<string, string> = {
        suspend: `Se suspendieron ${ids.length} usuario(s)`,
        activate: `Se reactivaron ${ids.length} usuario(s)`,
        delete: `Se eliminaron ${ids.length} usuario(s)`,
        setRole: `Rol actualizado en ${ids.length} usuario(s)`,
      }
      showToast(messages[action], action === 'delete' ? 'info' : 'success')
      setSelectedIds([])
      await refresh()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo completar la acción', 'error')
    }
  }

  const handleConfirmAction = async () => {
    if (!confirm) return
    if (confirm.type === 'revokeAllSessions') {
      if (!revokeAllTarget) return
      try {
        await api(`/api/users/${revokeAllTarget.id}/sessions`, { method: 'DELETE' })
        showToast(`Se cerraron todas las sesiones de ${revokeAllTarget.name || revokeAllTarget.email}`, 'success')
        setRevokeAllTarget(null)
        await refresh()
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'No se pudieron cerrar las sesiones', 'error')
      }
      return
    }
    void runBulk(confirm.type === 'suspend' ? 'suspend' : 'delete', confirm.ids)
  }

  // ---------- Drawer submit ----------
  const handleDrawerSubmit = async (data: UserFormData) => {
    setSubmitting(true)
    try {
      if (drawer.mode === 'create') {
        const sendInvitation = data.sendInvitation === true
        await api('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            role: data.role,
            status: data.status,
            sendInvitation,
            ...(sendInvitation ? {} : { password: data.password }),
          }),
        })
        showToast(
          sendInvitation ? 'Usuario creado. Invitación enviada (simulación).' : 'Usuario creado',
          'success'
        )
      } else if (drawer.user) {
        await api(`/api/users/${drawer.user.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: data.name,
            phone: data.phone || null,
            role: data.role,
            status: data.status,
          }),
        })
        showToast('Cambios guardados', 'success')
      }
      setDrawer({ open: false, mode: 'create', user: null })
      await refresh()
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- CSV ----------
  const handleExport = () => {
    exportUsersToCSV(sorted)
    showToast('Exportación descargada (usuarios.csv)', 'success')
  }

  // ---------- Pagination ----------
  const goToPage = (p: number) => setPage(Math.min(Math.max(1, p), totalPages))
  const visiblePages = useMemo(() => {
    const nums: number[] = []
    const start = Math.max(1, Math.min(safePage - 2, totalPages - 4))
    const end = Math.min(totalPages, start + 4)
    for (let i = start; i <= end; i++) nums.push(i)
    return nums
  }, [safePage, totalPages])

  const toolbarSelectClass = 'ui-input cursor-pointer'
  const ghostButtonClass = 'ui-btn ui-btn-secondary'

  const confirmTitle = !confirm
    ? ''
    : confirm.type === 'delete'
      ? confirm.ids.length > 1
        ? `Eliminar ${confirm.ids.length} usuarios`
        : 'Eliminar usuario'
      : confirm.type === 'revokeAllSessions'
        ? 'Cerrar todas las sesiones'
        : confirm.ids.length > 1
          ? `Suspender ${confirm.ids.length} usuarios`
          : 'Suspender usuario'

  const confirmDescription = !confirm
    ? ''
    : confirm.type === 'delete'
      ? `Se eliminará a ${confirm.subject} y sus sesiones activas. Esta acción no se puede deshacer.`
      : confirm.type === 'revokeAllSessions'
        ? `Se cerrarán TODAS las sesiones de ${confirm.subject}. El usuario deberá iniciar sesión de nuevo.`
        : `${confirm.subject} perderá el acceso al sistema. Podrás reactivarlo más tarde.`

  return (
    <div className="space-y-6">
      {/* Header: title + the single primary action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="ui-title text-2xl">Gestión de Usuarios</h1>
          <p className="ui-muted mt-1 text-sm">
            Administra cuentas, roles, estados y accesos de la plataforma.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="ui-btn ui-btn-primary"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo usuario
        </button>
      </div>

      {/* Toolbar: search + filters + secondary actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, correo o teléfono"
            aria-label="Buscar usuarios"
            className="ui-input pl-10 pr-4"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filtrar por rol"
            className={toolbarSelectClass}
          >
            <option value="">Todos los roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrar por estado"
            className={toolbarSelectClass}
          >
            <option value="">Todos los estados</option>
            {USER_STATUSES.map((status) => (
              <option key={status} value={status}>{STATUS_LABELS[status]}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExport}
            className={ghostButtonClass}
            disabled={sorted.length === 0}
            title={sorted.length === 0 ? 'No hay usuarios para exportar' : undefined}
          >
            Exportar CSV
          </button>

          <button
            type="button"
            onClick={() => setMatrixOpen(true)}
            className={ghostButtonClass}
          >
            Ver matriz de permisos
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label="Acciones masivas"
          className="ui-callout ui-callout-success flex flex-wrap items-center gap-2"
        >
          <span className="text-sm font-medium">
            {selectedIds.length} seleccionado(s)
          </span>
          <button
            type="button"
            onClick={() => setConfirm({ type: 'suspend', ids: selectedIds, subject: `${selectedIds.length} usuario(s)` })}
            className="ui-btn ui-btn-secondary ui-btn-sm"
          >
            Suspender
          </button>
          <button
            type="button"
            onClick={() => void runBulk('activate', selectedIds)}
            className="ui-btn ui-btn-secondary ui-btn-sm"
          >
            Reactivar
          </button>
          <select
            value=""
            onChange={(e) => {
              const role = e.target.value as Role
              if (role) void runBulk('setRole', selectedIds, role)
            }}
            aria-label="Cambiar rol de la selección"
            className="ui-input w-auto cursor-pointer py-1.5"
          >
            <option value="">Cambiar rol…</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setConfirm({ type: 'delete', ids: selectedIds, subject: `${selectedIds.length} usuario(s)` })}
            className="ui-btn ui-btn-danger-outline ui-btn-sm"
          >
            Eliminar
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="ui-btn ui-btn-ghost ui-btn-sm ml-auto"
          >
            Limpiar selección
          </button>
        </div>
      )}

      {/* Content: skeletons / empty / table+cards */}
      {loading ? (
        <div>
          <div className="hidden md:block"><UserTableSkeleton rows={6} /></div>
          <div className="md:hidden"><UserCardSkeleton count={3} /></div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="ui-empty">
          <svg className="h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className="ui-title text-sm">No se encontraron usuarios</h3>
          <p className="text-sm">
            {hasFilters ? 'Intenta ajustar los filtros o la búsqueda.' : 'Aún no hay usuarios registrados.'}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ui-btn ui-btn-secondary ui-btn-sm mt-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
<>
            <div className="hidden md:block">
              <UserTable
                users={pageItems}
                currentUserId={currentUserId}
                onEdit={handleEdit}
                onView={handleView}
                onSuspend={handleSuspendRequest}
                onActivate={handleActivate}
                onDelete={handleDeleteRequest}
                onRevokeSession={() => undefined}
                onRevokeAllSessions={handleRevokeAllSessions}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
                sortConfig={sort}
                onSort={handleSort}
              />
            </div>
            <UserCardList
              users={pageItems}
              currentUserId={currentUserId}
              onEdit={handleEdit}
              onView={handleView}
              onSuspend={handleSuspendRequest}
              onActivate={handleActivate}
              onDelete={handleDeleteRequest}
              onRevokeSession={() => undefined}
              onRevokeAllSessions={handleRevokeAllSessions}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
              sortConfig={sort}
              onSort={handleSort}
            />
          </>
      )}

      {/* Pagination */}
      {!loading && sorted.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span>
              Mostrando <span className="font-medium text-gray-700 dark:text-gray-200">{rangeFrom}–{rangeTo}</span> de{' '}
              <span className="font-medium text-gray-700 dark:text-gray-200">{sorted.length}</span>
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Filas por página"
              className="ui-input w-auto cursor-pointer py-1.5"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} / pág.</option>
              ))}
            </select>
          </div>

          <nav aria-label="Paginación" className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage <= 1}
              aria-label="Página anterior"
              className="ui-btn ui-btn-secondary ui-btn-sm"
            >
              Anterior
            </button>
            {visiblePages.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => goToPage(p)}
                aria-label={`Página ${p}`}
                aria-current={p === safePage ? 'page' : undefined}
                className={`ui-btn ui-btn-sm ${p === safePage ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage >= totalPages}
              aria-label="Página siguiente"
              className="ui-btn ui-btn-secondary ui-btn-sm"
            >
              Siguiente
            </button>
          </nav>
        </div>
      )}

      {/* Create / edit drawer */}
      <UserDrawer
        isOpen={drawer.open}
        mode={drawer.mode}
        submitting={submitting}
        initialData={
          drawer.mode === 'edit' && drawer.user
            ? {
                name: drawer.user.name ?? '',
                email: drawer.user.email,
                phone: drawer.user.phone ?? '',
                role: drawer.user.role,
                status: drawer.user.status,
              }
            : null
        }
        onClose={() => setDrawer({ open: false, mode: 'create', user: null })}
        onSubmit={handleDrawerSubmit}
      />

      {/* Destructive confirmation */}
      {confirm?.type !== 'revokeAllSessions' && (
        <ConfirmDialog
          isOpen={confirm !== null}
          onClose={() => setConfirm(null)}
          onConfirm={handleConfirmAction}
          title={confirmTitle}
          description={confirmDescription}
          confirmText={confirm?.type === 'delete' ? 'Eliminar' : 'Suspender'}
          cancelText="Cancelar"
          variant="destructive"
        />
      )}
      {confirm?.type === 'revokeAllSessions' && (
        <ConfirmDialog
          isOpen
          onClose={() => { setConfirm(null); setRevokeAllTarget(null) }}
          onConfirm={handleConfirmAction}
          title={confirmTitle}
          description={confirmDescription}
          confirmText="Cerrar todas"
          cancelText="Cancelar"
          variant="destructive"
        />
      )}

      {/* Official permission matrix (read-only) */}
      <PermissionMatrixModal isOpen={matrixOpen} onClose={() => setMatrixOpen(false)} />
    </div>
  )
}
