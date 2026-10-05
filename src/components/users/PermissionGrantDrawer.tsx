'use client'

import { useState, useRef, useEffect, useMemo, FormEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  MODULES,
  MODULE_ACTIONS,
  ACTION_LABELS,
  MATRIX_ROWS,
  ROLE_LABELS,
  can,
  type Role,
  type ModuleId,
} from '@/lib/permissions'
import { useToast } from '@/components/ui/ToastProvider'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

const DURATION_OPTIONS = [
  { label: '1 hora', hours: 1 },
  { label: '8 horas', hours: 8 },
  { label: '24 horas', hours: 24 },
  { label: '7 días', hours: 168 },
  { label: '30 días', hours: 720 },
]

type GrantType = 'temporal' | 'permanente'

// Actions of a module the role does NOT include — the only ones worth
// overriding (canWithOverrides consults the static matrix first).
function grantableActions(role: Role, moduleId: ModuleId): readonly string[] {
  return (MODULE_ACTIONS[moduleId] ?? []).filter((a) => !can(role, moduleId, a))
}

interface PermissionGrantDrawerProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  userRole: Role
  onGranted: () => void | Promise<void>
}

export function PermissionGrantDrawer({
  isOpen,
  onClose,
  userId,
  userRole,
  onGranted,
}: PermissionGrantDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()

  const [type, setType] = useState<GrantType>('temporal')
  const [moduleId, setModuleId] = useState<ModuleId | ''>('')
  const [action, setAction] = useState('')
  const [durationHours, setDurationHours] = useState(24)
  const [pending, setPending] = useState(false)
  const [warningOpen, setWarningOpen] = useState(false)

  // Two blocks ('users' excluded by policy): modules the role cannot access
  // at all, and modules it already accesses but with actions still missing.
  const modulesWithoutAccess = useMemo(
    () => MODULES.filter((m) => m.id !== 'users' && !can(userRole, m.id)),
    [userRole]
  )
  const modulesWithAccess = useMemo(
    () =>
      MODULES.filter(
        (m) => m.id !== 'users' && can(userRole, m.id) && grantableActions(userRole, m.id).length > 0
      ),
    [userRole]
  )

  const actionsForModule = moduleId ? grantableActions(userRole, moduleId) : []
  const selectedAction = action && actionsForModule.includes(action) ? action : actionsForModule[0] ?? ''
  const durationLabel = DURATION_OPTIONS.find((d) => d.hours === durationHours)?.label ?? ''

  const moduleLabel = (id: string) => MODULES.find((m) => m.id === id)?.label ?? id
  const actionLabel = (a: string) => ACTION_LABELS[a] ?? a
  const cellText = (id: ModuleId) => MATRIX_ROWS.find((r) => r.moduleId === id)?.cells[userRole] ?? ''

  useEffect(() => {
    if (!isOpen) return
    setType('temporal')
    setModuleId(modulesWithoutAccess[0]?.id ?? modulesWithAccess[0]?.id ?? '')
    setAction('')
    setDurationHours(24)
    setPending(false)
    setWarningOpen(false)
    const firstSelect = drawerRef.current?.querySelector<HTMLSelectElement>('select')
    firstSelect?.focus()
  }, [isOpen, modulesWithoutAccess, modulesWithAccess])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !warningOpen) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose, warningOpen])

  if (!isOpen) return null

  async function grant() {
    setPending(true)
    try {
      const res = await fetch(`/api/users/${userId}/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId,
          action: selectedAction,
          ...(type === 'permanente' ? { permanent: true } : { expiresInHours: durationHours }),
          acknowledgeRoleConflict: true,
        }),
      })
      const data = await res.json()
      if (res.status === 409 && data.roleConflict) {
        setWarningOpen(true)
        return
      }
      if (!res.ok) throw new Error(data.message || 'Error al asignar el permiso')
      showToast(
        type === 'permanente'
          ? 'Permiso permanente asignado'
          : `Permiso temporal asignado · vence en ${durationLabel}`,
        'success'
      )
      await onGranted()
      onClose()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error inesperado', 'error')
    } finally {
      setPending(false)
      setWarningOpen(false)
    }
  }

  const noModules = modulesWithoutAccess.length === 0 && modulesWithAccess.length === 0

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selectedAction || pending || noModules) return
    setWarningOpen(true)
  }

  const onModuleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setModuleId(e.target.value as ModuleId)
    setAction('')
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 dark:bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="grant-drawer-title"
    >
      <div
        ref={drawerRef}
        className="h-full w-full max-w-[28rem] animate-slide-in-right overflow-y-auto bg-white shadow-2xl dark:bg-slate-900 dark:shadow-black/40"
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-gray-100 px-6 pt-6 pb-4 dark:border-slate-800">
          <div>
            <h2 id="grant-drawer-title" className="ui-title text-lg">
              Asignar permiso
            </h2>
            <p className="ui-muted mt-1 text-sm">
              Otorga o amplía accesos fuera de la matriz de {ROLE_LABELS[userRole]}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="focus-ring cursor-pointer rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 px-6 pb-6">
          {/* Grant type: temporal | permanente */}
          <div>
            <span className="ui-label mb-1.5 block" id="grant-type-label">Tipo de permiso</span>
            <div
              role="group"
              aria-labelledby="grant-type-label"
              className="inline-flex w-full rounded-xl border border-gray-200 bg-gray-100 p-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {(['temporal', 'permanente'] as const).map((t) => {
                const activa = type === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    aria-pressed={activa}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold capitalize transition-colors duration-300 focus-ring ${
                      activa
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'cursor-pointer text-gray-500 hover:bg-white hover:text-gray-800 dark:text-gray-400 dark:hover:bg-slate-700 dark:hover:text-gray-200'
                    }`}
                  >
                    Permiso {t}
                  </button>
                )
              })}
            </div>
          </div>

          {type === 'temporal' ? (
            <label className="ui-field block">
              <span className="ui-label mb-1.5 block">Duración</span>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                disabled={pending}
                className="ui-input cursor-pointer"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d.hours} value={d.hours}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="ui-callout ui-callout-warn">
              <strong className="font-semibold">Sin fecha de caducidad.</strong> El permiso quedará
              activo hasta que lo revokes manualmente, se registrará en auditoría y el usuario
              tendrá acceso desde el primer momento.
            </div>
          )}

          {noModules ? (
            <div className="ui-callout ui-callout-info">
              El rol {ROLE_LABELS[userRole]} ya cubre todas las acciones disponibles. No hay
              permisos que otorgar.
            </div>
          ) : (
            <>
              {modulesWithoutAccess.length > 0 && (
                <label className="ui-field block">
                  <span className="ui-label mb-1.5 block">Módulo sin acceso</span>
                  <select
                    value={modulesWithoutAccess.some((m) => m.id === moduleId) ? moduleId : ''}
                    onChange={onModuleChange}
                    disabled={pending}
                    className="ui-input cursor-pointer"
                  >
                    <option value="" disabled>
                      Selecciona un módulo…
                    </option>
                    {modulesWithoutAccess.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {modulesWithAccess.length > 0 && (
                <label className="ui-field block">
                  <span className="ui-label mb-1.5 block">Módulo con acceso actual</span>
                  <select
                    value={modulesWithAccess.some((m) => m.id === moduleId) ? moduleId : ''}
                    onChange={onModuleChange}
                    disabled={pending}
                    className="ui-input cursor-pointer"
                  >
                    <option value="" disabled>
                      Selecciona un módulo…
                    </option>
                    {modulesWithAccess.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} · {cellText(m.id)}
                      </option>
                    ))}
                  </select>
                  <span className="ui-muted mt-1 block text-xs">
                    Para ampliar el acceso existente, p. ej. de solo lectura a edición.
                  </span>
                </label>
              )}

              <label className="ui-field block">
                <span className="ui-label mb-1.5 block">Acción</span>
                <select
                  value={selectedAction}
                  onChange={(e) => setAction(e.target.value)}
                  disabled={pending}
                  className="ui-input cursor-pointer"
                >
                  {actionsForModule.map((a) => (
                    <option key={a} value={a}>
                      {actionLabel(a)} — fuera del rol
                    </option>
                  ))}
                </select>
                <span className="ui-muted mt-1 block text-xs">
                  Solo acciones que el rol {ROLE_LABELS[userRole]} no incluye.
                </span>
              </label>
            </>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-slate-800">
            <button type="button" onClick={onClose} disabled={pending} className="ui-btn ui-btn-secondary">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending || !selectedAction || noModules}
              className="ui-btn ui-btn-primary"
            >
              {pending ? 'Asignando…' : 'Asignar'}
            </button>
          </div>
        </form>

        <ConfirmDialog
          isOpen={warningOpen}
          onClose={() => setWarningOpen(false)}
          onConfirm={() => void grant()}
          title={type === 'permanente' ? 'Advertencia: permiso permanente' : 'Advertencia: permiso fuera del rol'}
          description={
            type === 'permanente'
              ? `El rol ${ROLE_LABELS[userRole]} no incluye "${actionLabel(selectedAction)}" en ${moduleLabel(moduleId)}. Se otorgará como excepción PERMANENTE sin fecha de caducidad: quedará activa hasta que la revokes y se registrará en auditoría. ¿Continuar?`
              : `El rol ${ROLE_LABELS[userRole]} no incluye "${actionLabel(selectedAction)}" en ${moduleLabel(moduleId)}. Se otorgará como excepción TEMPORAL durante ${durationLabel}, se registrará en auditoría y caducará automáticamente. ¿Continuar?`
          }
          confirmText="Asignar de todos modos"
          cancelText="Cancelar"
          variant="destructive"
        />
      </div>
    </div>,
    document.body
  )
}
