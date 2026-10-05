'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { ROLES, ROLE_LABELS, ROLE_BADGES, type Role, USER_STATUSES, STATUS_LABELS, STATUS_BADGES, type UserStatus } from '@/shared/models/permissions'
import { Avatar } from '@/shared/views/ui/Avatar'
import { DropdownMenu } from '@/shared/views/ui/DropdownMenu'
import { formatDateLocale, formatDateTimeLocale } from '@/shared/utils/date-utils'

export interface AdminUser {
  id: string
  name: string | null
  email: string
  role: Role
  status: UserStatus
  phone: string | null
  lastLoginAt: string | null
  createdAt: string
  hasActiveSession?: boolean
}

interface UserTableProps {
  users: AdminUser[]
  currentUserId: string
  onEdit: (user: AdminUser) => void
  onView: (user: AdminUser) => void
  onSuspend: (user: AdminUser) => void
  onActivate: (user: AdminUser) => void
  onDelete: (user: AdminUser) => void
  onRevokeSession: (userId: string, sessionId: string) => void
  onRevokeAllSessions?: (user: AdminUser) => void
  selectedIds: string[]
  onSelect: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  sortConfig: { field: string; direction: 'asc' | 'desc' }
  onSort: (field: string) => void
}

export function UserTable({
  users,
  currentUserId,
  onEdit,
  onView,
  onSuspend,
  onActivate,
  onDelete,
  onRevokeSession,
  onRevokeAllSessions,
  selectedIds,
  onSelect,
  onSelectAll,
  sortConfig,
  onSort,
}: UserTableProps) {
  const selectAllRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedIds.length > 0 && selectedIds.length < users.length
    }
  }, [selectedIds, users.length])

  const handleSort = (field: string) => {
    onSort(field)
  }

  const isSorted = (field: string) => sortConfig.field === field
  const sortDirection = (field: string) => (isSorted(field) ? sortConfig.direction : null)

  const renderSortIcon = (field: string) => {
    const direction = sortDirection(field)
    if (!direction) return (
      <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4M17 16V4m0 0l-4 4m4-4l4 4" />
      </svg>
    )
    return direction === 'asc' ? (
      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  const sortButton = (field: string, label: string) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="inline-flex items-center gap-1 cursor-pointer select-none transition-colors hover:text-gray-700 dark:hover:text-gray-200 focus-ring"
    >
      {label}
      {renderSortIcon(field)}
    </button>
  )

  const ariaSort = (field: string): 'ascending' | 'descending' | 'none' =>
    sortDirection(field) === 'asc' ? 'ascending' : sortDirection(field) === 'desc' ? 'descending' : 'none'

  return (
    <div className="ui-table-shell">
      <div className="overflow-x-auto">
        <table className="ui-table">
          <thead>
            <tr>
              <th className="w-12">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={selectedIds.length === users.length && users.length > 0}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  aria-label="Seleccionar todos los usuarios de esta página"
                />
              </th>
              <th aria-sort={ariaSort('name')}>{sortButton('name', 'Usuario')}</th>
              <th aria-sort={ariaSort('email')}>{sortButton('email', 'Correo')}</th>
              <th aria-sort={ariaSort('role')}>{sortButton('role', 'Rol')}</th>
              <th aria-sort={ariaSort('status')}>{sortButton('status', 'Estado')}</th>
              <th aria-sort={ariaSort('lastLoginAt')}>{sortButton('lastLoginAt', 'Último acceso')}</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(user.id)}
                    onChange={(e) => onSelect(user.id, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    aria-label={`Seleccionar ${user.name || user.email}`}
                  />
                </td>
<td className="whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} email={user.email} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 block dark:text-gray-100">{user.name || '—'}</span>
                          {user.hasActiveSession && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400" aria-label="En línea">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                              En línea
                            </span>
                          )}
                          {user.id === currentUserId && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">(tú)</span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500 block dark:text-gray-400">{user.email}</span>
                      </div>
                    </div>
                  </td>
                <td className="whitespace-nowrap hidden md:table-cell">
                  <span className="text-gray-600 dark:text-gray-300">{user.email}</span>
                </td>
                <td className="whitespace-nowrap">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGES[user.role]}`}>
                    {ROLE_LABELS[user.role]}
                  </span>
                </td>
                <td className="whitespace-nowrap">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGES[user.status]}`}>
                    {STATUS_LABELS[user.status]}
                  </span>
                </td>
                <td className="whitespace-nowrap text-gray-600 dark:text-gray-300">
                  {user.lastLoginAt ? formatDateTimeLocale(user.lastLoginAt) : '—'}
                </td>
                <td className="whitespace-nowrap text-right">
                  <DropdownMenu
                    trigger={
                      <button
                        type="button"
                        aria-label="Acciones"
                        className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-slate-800 dark:hover:text-gray-300 focus-ring"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="19" cy="12" r="1" />
                          <circle cx="5" cy="12" r="1" />
                        </svg>
                      </button>
                    }
                    items={[
                      { label: 'Ver detalle', onClick: () => onView(user), icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )},
                      { label: 'Editar', onClick: () => onEdit(user), icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      )},
                      { label: user.status === 'INACTIVE' ? 'Reactivar' : 'Suspender', onClick: () => (user.status === 'INACTIVE' ? onActivate(user) : onSuspend(user)), variant: user.status === 'INACTIVE' ? 'default' : 'destructive', icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      )},
                      ...(user.hasActiveSession && onRevokeAllSessions
                        ? [{
                            label: 'Cerrar todas las sesiones',
                            onClick: () => onRevokeAllSessions(user),
                            variant: 'destructive' as const,
                            icon: (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                              </svg>
                            ),
                          }]
                        : []),
                      { label: 'Eliminar', onClick: () => onDelete(user), variant: 'destructive', icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      )},
                    ]}
                    align="right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Mobile card list
export function UserCardList({
  users,
  currentUserId,
  onEdit,
  onView,
  onSuspend,
  onActivate,
  onDelete,
  onRevokeAllSessions,
  selectedIds,
  onSelect,
}: UserTableProps) {

  return (
    <div className="md:hidden space-y-3 px-2">
      {users.map((user) => (
        <div key={user.id} className="ui-card">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selectedIds.includes(user.id)}
              onChange={(e) => onSelect(user.id, e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              aria-label={`Seleccionar ${user.name || user.email}`}
            />
            <Avatar name={user.name} email={user.email} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 truncate dark:text-gray-100">{user.name || '—'}</span>
                {user.hasActiveSession && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400" aria-label="En línea">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                    En línea
                  </span>
                )}
                {user.id === currentUserId && <span className="text-xs text-gray-400 dark:text-gray-500">(tú)</span>}
              </div>
              <p className="text-sm text-gray-500 truncate dark:text-gray-400">{user.email}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGES[user.role]}`}>
                  {ROLE_LABELS[user.role]}
                </span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[user.status]}`}>
                  {STATUS_LABELS[user.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Último acceso: {user.lastLoginAt ? formatDateTimeLocale(user.lastLoginAt) : '—'}
              </p>
            </div>
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  aria-label="Acciones"
                  className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-slate-800 dark:hover:text-gray-300 focus-ring"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="19" cy="12" r="1" />
                    <circle cx="5" cy="12" r="1" />
                  </svg>
                </button>
              }
              items={[
              { label: 'Ver detalle', onClick: () => onView(user), icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )},
              { label: 'Editar', onClick: () => onEdit(user), icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              )},
              { label: user.status === 'INACTIVE' ? 'Reactivar' : 'Suspender', onClick: () => (user.status === 'INACTIVE' ? onActivate(user) : onSuspend(user)), variant: user.status === 'INACTIVE' ? 'default' : 'destructive', icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              )},
              ...(user.hasActiveSession && onRevokeAllSessions
                ? [{
                    label: 'Cerrar todas las sesiones',
                    onClick: () => onRevokeAllSessions(user),
                    variant: 'destructive' as const,
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    ),
                  }]
                : []),
              { label: 'Eliminar', onClick: () => onDelete(user), variant: 'destructive', icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              )},
            ]}
            align="right"
          />
          </div>
        </div>
      ))}
    </div>
  )
}