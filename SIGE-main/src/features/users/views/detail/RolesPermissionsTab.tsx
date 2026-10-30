'use client'

import { useState } from 'react'
import { AdminUser } from '../UserTable'
import {
  MATRIX_ROWS,
  ROLE_LABELS,
  MODULES,
  ACTION_LABELS,
  can,
  type Role,
  type ModuleId,
} from '@/shared/models/permissions'
import { formatDateTimeLocale } from '@/shared/utils/date-utils'
import { useToast } from '@/shared/views/ui/ToastProvider'
import { PermissionGrantDrawer } from '../PermissionGrantDrawer'

export interface TempOverride {
  id: string
  moduleId: string
  action: string
  expiresAt: string | null
  grantedBy: string
  grantedByEmail: string
  createdAt: string
}

interface RolesPermissionsTabProps {
  user: AdminUser
  overrides: TempOverride[]
  loading: boolean
  onRefresh: () => void | Promise<void>
}

// Action groups used to derive the Ver/Crear/Editar/Eliminar matrix columns.
const ACTION_GROUPS = {
  view: ['read', 'view_macro', 'view_impact'],
  create: ['create', 'upload', 'register', 'design', 'configure_origin'],
  edit: ['edit', 'modify', 'update', 'evaluate', 'generate'],
  delete: ['delete'],
} as const

export function RolesPermissionsTab({ user, overrides, loading, onRefresh }: RolesPermissionsTabProps) {
  const userRole = user.role as Role
  const { showToast } = useToast()
  const [grantOpen, setGrantOpen] = useState(false)

  const moduleLabel = (id: string) => MODULES.find((m) => m.id === id)?.label ?? id
  const actionLabel = (a: string) => ACTION_LABELS[a] ?? a

  const groupLabels = (moduleId: ModuleId, actions: readonly string[]) =>
    actions
      .filter((a) => can(userRole, moduleId, a))
      .map((a) => actionLabel(a))
      .join(', ')

  async function revoke(override: TempOverride) {
    try {
      const res = await fetch(
        `/api/users/${user.id}/overrides?moduleId=${encodeURIComponent(override.moduleId)}&action=${encodeURIComponent(override.action)}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Error al revocar el permiso')
      showToast('Permiso revocado', 'success')
      onRefresh()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error inesperado', 'error')
    }
  }

  return (
    <div className="space-y-6" role="tabpanel" id="roles-panel" aria-labelledby="roles-tab">
      {/* ── Block 1: inherited matrix ─────────────────────────── */}
      <div>
        <h3 className="ui-title text-base">Permisos heredados del rol</h3>
        <p className="ui-muted mt-1 text-sm">
          Derivados de la matriz oficial para el rol <strong>{ROLE_LABELS[userRole]}</strong>.
        </p>

        <div className="ui-table-shell mt-3">
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Módulo</th>
                  <th className="text-center">Ver</th>
                  <th className="text-center">Crear</th>
                  <th className="text-center">Editar</th>
                  <th className="text-center">Eliminar</th>
                </tr>
              </thead>
              <tbody>
                {MODULES.map((module) => {
                  const cell = MATRIX_ROWS.find((r) => r.moduleId === module.id)?.cells[userRole] ?? ''
                  const isVisible = cell && !cell.startsWith('No accede') && !cell.startsWith('Oculto')

                  const hasView = isVisible && can(userRole, module.id)
                  const hasCreate = isVisible && ACTION_GROUPS.create.some((a) => can(userRole, module.id, a))
                  const hasEdit = isVisible && ACTION_GROUPS.edit.some((a) => can(userRole, module.id, a))
                  const hasDelete = isVisible && ACTION_GROUPS.delete.some((a) => can(userRole, module.id, a))

                  const cellState = (granted: boolean) =>
                    granted ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-gray-600'

                  return (
                    <tr key={module.id} className={!isVisible ? 'bg-gray-50/50 dark:bg-slate-800/40' : ''}>
                      <td className="ui-title text-sm">{module.label}</td>
                      <td className="text-center">
                        <span className="inline-flex items-center justify-center" title={groupLabels(module.id, ACTION_GROUPS.view) || 'Sin permisos de visualización'}>
                          {hasView ? (
                            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className={`w-5 h-5 ${cellState(false)}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="inline-flex items-center justify-center" title={groupLabels(module.id, ACTION_GROUPS.create) || 'Sin permisos de creación'}>
                          {hasCreate ? (
                            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className={`w-5 h-5 ${cellState(false)}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="inline-flex items-center justify-center" title={groupLabels(module.id, ACTION_GROUPS.edit) || 'Sin permisos de edición'}>
                          {hasEdit ? (
                            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className={`w-5 h-5 ${cellState(false)}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="inline-flex items-center justify-center" title={groupLabels(module.id, ACTION_GROUPS.delete) || 'Sin permisos de eliminación'}>
                          {hasDelete ? (
                            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className={`w-5 h-5 ${cellState(false)}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Block 2: active exceptions (temporal + permanente) ── */}
      <div className="ui-panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="ui-title text-base">Permisos excepcionales activos</h3>
            <p className="ui-muted mt-1 text-xs">
              Excepciones otorgadas fuera de la matriz. Las temporales caducan automáticamente; las
              permanentes hasta que las revocas. Quedan registradas en auditoría.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-slate-800 dark:text-slate-300">
            {loading ? '…' : overrides.length}
          </span>
        </div>

        <div className="mt-4">
          {loading && <p className="ui-muted text-sm">Cargando permisos…</p>}

          {!loading && overrides.length === 0 && (
            <p className="ui-muted text-sm">Sin permisos excepcionales activos.</p>
          )}

          {!loading && overrides.length > 0 && (
            <ul className="space-y-2" role="list">
              {overrides.map((o) => {
                const isPermanent = o.expiresAt === null
                return (
                  <li
                    key={o.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${
                      isPermanent
                        ? 'border-indigo-200 bg-indigo-50/70 dark:border-indigo-500/25 dark:bg-indigo-500/10'
                        : 'border-amber-200 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/10'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`font-semibold ${isPermanent ? 'text-indigo-900 dark:text-indigo-300' : 'text-amber-900 dark:text-amber-300'}`}>
                        {moduleLabel(o.moduleId)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                          isPermanent
                            ? 'border-indigo-300 bg-white text-indigo-800 dark:border-indigo-500/30 dark:bg-slate-900 dark:text-indigo-300'
                            : 'border-amber-300 bg-white text-amber-800 dark:border-amber-500/30 dark:bg-slate-900 dark:text-amber-300'
                        }`}
                      >
                        {actionLabel(o.action)}
                      </span>
                      {isPermanent && (
                        <span className="rounded-full border border-indigo-300 bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300">
                          Permanente
                        </span>
                      )}
                      <span className={`text-xs ${isPermanent ? 'text-indigo-700/80 dark:text-indigo-400/80' : 'text-amber-700/80 dark:text-amber-400/80'}`}>
                        {isPermanent
                          ? `Sin caducidad · otorgado por ${o.grantedByEmail}`
                          : `Vence ${formatDateTimeLocale(o.expiresAt as string)} · otorgado por ${o.grantedByEmail}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => revoke(o)}
                      aria-label={`Revocar permiso ${actionLabel(o.action)} en ${moduleLabel(o.moduleId)}`}
                      className={`cursor-pointer rounded-md p-1.5 transition-colors ${
                        isPermanent
                          ? 'text-indigo-700 hover:bg-indigo-100 hover:text-red-600 dark:text-indigo-400 dark:hover:bg-indigo-500/20 dark:hover:text-red-400'
                          : 'text-amber-700 hover:bg-amber-100 hover:text-red-600 dark:text-amber-400 dark:hover:bg-amber-500/20 dark:hover:text-red-400'
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Block 3: grant entry point (drawer) ───────────────── */}
      <div className="ui-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="ui-title text-base">Asignar permiso</h3>
            <p className="ui-muted mt-1 text-xs">
              Otorga permisos temporales o permanentes: abre módulos a los que el rol no accede o
              amplía los que ya tiene, p. ej. de solo lectura a edición. La duración se elige para
              el permiso temporal; el permanente queda bajo advertencia y es revocable.
            </p>
          </div>
          <button type="button" onClick={() => setGrantOpen(true)} className="ui-btn ui-btn-primary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Asignar
          </button>
        </div>
      </div>

      <PermissionGrantDrawer
        isOpen={grantOpen}
        onClose={() => setGrantOpen(false)}
        userId={user.id}
        userRole={userRole}
        onGranted={onRefresh}
      />

      <p className="ui-muted text-xs">
        Los símbolos derivan de la matriz oficial; hoy ningún rol tiene permiso de eliminar. Los
        permisos excepcionales se aplican de inmediato a la navegación y al acceso a módulos.
      </p>
    </div>
  )
}
