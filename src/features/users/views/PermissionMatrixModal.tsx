'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MATRIX_ROWS, ROLES, ROLE_LABELS, type Role, type ModuleId } from '@/shared/models/permissions'

// Short header labels + fixed avatar colors per role (visual identity only —
// authorization is never derived from this table).
const ROLE_STYLES: Record<Role, { label: string; initials: string; avatarClass: string }> = {
  ADMIN_TI: { label: 'Admin. TI', initials: 'TI', avatarClass: 'bg-uv-deep text-white' },
  GESTOR_ENERGETICO: { label: 'Gestor energía', initials: 'GE', avatarClass: 'bg-uv-soft text-uv-ink' },
  COORD_INFRAESTRUCTURA: { label: 'Coord. infra.', initials: 'CI', avatarClass: 'bg-uv-turquoise text-uv-ink' },
  DIRECTIVO: { label: 'Directivo', initials: 'DI', avatarClass: 'bg-uv-purple text-white' },
  COMUNIDAD_UNIVERSITARIA: { label: 'Comunidad', initials: 'CU', avatarClass: 'bg-uv-sky text-uv-ink' },
}

const MATRIX_ROLE_COLUMNS = ROLES.map((role) => ({
  key: role,
  label: ROLE_STYLES[role].label,
  fullLabel: ROLE_LABELS[role],
  initials: ROLE_STYLES[role].initials,
  avatarClass: ROLE_STYLES[role].avatarClass,
}))

const MODULE_DOTS: Record<ModuleId, string> = {
  users: 'bg-uv-purple',
  consumption: 'bg-uv-soft',
  estimates: 'bg-uv-sky',
  plans: 'bg-uv-turquoise',
  inventory: 'bg-uv-yellow',
  reports: 'bg-uv-deep',
  alerts: 'bg-uv-forest',
}

interface PermissionMatrixModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PermissionMatrixModal({ isOpen, onClose }: PermissionMatrixModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
      setTimeout(() => {
        const closeBtn = modalRef.current?.querySelector<HTMLButtonElement>('[data-close]')
        closeBtn?.focus()
      }, 0)

      const handleKeyDown = (e: globalThis.KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onClose()
        }
        if (e.key === 'Tab') {
          const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
          if (focusableElements && focusableElements.length > 0) {
            const firstElement = focusableElements[0]
            const lastElement = focusableElements[focusableElements.length - 1]
            if (e.shiftKey && document.activeElement === firstElement) {
              e.preventDefault()
              lastElement.focus()
            } else if (!e.shiftKey && document.activeElement === lastElement) {
              e.preventDefault()
              firstElement.focus()
            }
          }
        }
      }
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
        previousActiveElement.current?.focus()
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="matrix-modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-5xl max-h-[90vh] rounded-2xl bg-white shadow-2xl animate-slide-up overflow-hidden flex flex-col dark:bg-slate-900 dark:shadow-black/50"
      >
        {/* Header */}
        <div className="relative border-b border-gray-100 px-6 py-5 dark:border-slate-800">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" aria-hidden="true" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M3 15h18M9 3v18" />
                </svg>
              </span>
              <div>
                <h2 id="matrix-modal-title" className="ui-title text-lg">
                  Matriz de permisos por rol
                </h2>
                <p className="ui-muted text-sm">
                  5 roles × 6 módulos · qué puede hacer cada rol en la plataforma
                </p>
              </div>
            </div>
            <button
              type="button"
              data-close
              onClick={onClose}
              aria-label="Cerrar matriz de permisos"
              className="focus-ring cursor-pointer rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-gray-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          <div className="ui-table-shell">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/70">
                  <th className="sticky left-0 z-20 min-w-[9.5rem] border-b border-gray-200 px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-400">
                    Módulo
                  </th>
                  {MATRIX_ROLE_COLUMNS.map((roleInfo) => (
                    <th
                      key={roleInfo.key}
                      scope="col"
                      className="border-b border-gray-200 px-3 py-3.5 text-center dark:border-slate-700"
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-sm ${roleInfo.avatarClass}`}
                          aria-hidden="true"
                        >
                          {roleInfo.initials}
                        </span>
                        <span className="text-[11px] font-semibold uppercase leading-tight tracking-wider text-gray-700 dark:text-gray-300">
                          {roleInfo.label}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX_ROWS.map((row, idx) => (
                  <tr
                    key={row.moduleId}
                    className={`border-b border-gray-100 transition-colors last:border-b-0 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-emerald-500/5 ${
                      idx % 2 === 1 ? 'bg-gray-50/60 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-900'
                    }`}
                  >
                    <td className="sticky left-0 z-10 border-r border-gray-100 px-4 py-3.5 font-semibold text-gray-900 dark:border-slate-800 dark:text-gray-100 bg-inherit">
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${MODULE_DOTS[row.moduleId] ?? 'bg-gray-300'}`} aria-hidden="true" />
                      {row.moduleLabel}
                    </td>
                    {MATRIX_ROLE_COLUMNS.map((roleInfo) => {
                      const text = row.cells[roleInfo.key]
                      const muted = text === 'No accede' || text.startsWith('Oculto')
                      if (muted) {
                        return (
                          <td
                            key={roleInfo.key}
                            className="px-3 py-3.5 text-center align-top"
                          >
                            <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] italic text-gray-400 dark:bg-slate-800 dark:text-gray-500">
                              {text.startsWith('Oculto') ? 'Oculto' : text}
                            </span>
                            {text.startsWith('Oculto') && (
                              <span className="mt-1 block text-[10px] text-gray-400 dark:text-gray-500">
                                {text.replace(/^Oculto\s*—?\s*/, '')}
                              </span>
                            )}
                          </td>
                        )
                      }
                      const parts = text.split(' / ').map((p) => p.trim()).filter(Boolean)
                      return (
                        <td key={roleInfo.key} className="px-3 py-3.5 text-center align-top">
                          <span className="flex flex-wrap justify-center gap-1">
                            {parts.map((part) => (
                              <span
                                key={part}
                                className="inline-block rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                              >
                                {part}
                              </span>
                            ))}
                          </span>
                            </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">Crear</span>
              acción permitida
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] italic text-gray-400 dark:bg-slate-800 dark:text-gray-500">No accede</span>
              sin acceso u oculto
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Fuente de verdad: <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-slate-800 dark:text-gray-300">src/shared/models/permissions.ts</code>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 dark:border-slate-800">
          <p className="ui-muted text-xs">
            Cambiar permisos por usuario se hace en Detalle de usuario → Roles y permisos (permisos temporales).
          </p>
          <button
            type="button"
            onClick={onClose}
            className="ui-btn ui-btn-primary"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof window === 'undefined') return null
  return createPortal(modalContent, document.body)
}
