'use client'

import { useState } from 'react'
import { formatDateTimeLocale } from '@/shared/utils/date-utils'
import { useToast } from '@/shared/views/ui/ToastProvider'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'

interface Session {
  id: string
  createdAt: string
  expiresAt: string
  current: boolean
}

interface SecurityTabProps {
  userId: string
  userEmail: string
  sessions: Session[]
  twoFactorEnabled: boolean
  onToggle2FA: (enabled: boolean) => Promise<void>
  onRevokeSession: (sessionId: string) => Promise<void>
  onRevokeAllSessions: () => Promise<void>
  currentUserId: string
}

export function SecurityTab({
  userId,
  userEmail,
  sessions,
  twoFactorEnabled,
  onToggle2FA,
  onRevokeSession,
  onRevokeAllSessions,
  currentUserId,
}: SecurityTabProps) {
  const { showToast } = useToast()
  const [confirmDialog, setConfirmDialog] = useState<{ sessionId: string } | null>(null)
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false)
  const [toggling2FA, setToggling2FA] = useState(false)

  const handle2FAToggle = async () => {
    setToggling2FA(true)
    try {
      await onToggle2FA(!twoFactorEnabled)
      showToast(
        twoFactorEnabled ? 'Autenticación de dos factores desactivada' : 'Autenticación de dos factores activada',
        'success'
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error al cambiar 2FA', 'error')
    } finally {
      setToggling2FA(false)
    }
  }

  const handleRevoke = async (sessionId: string) => {
    if (sessionId === sessions.find((s) => s.current)?.id) {
      showToast('No puedes revocar tu propia sesión actual', 'error')
      return
    }
    setConfirmDialog({ sessionId })
  }

  const confirmRevoke = async () => {
    if (!confirmDialog) return
    try {
      await onRevokeSession(confirmDialog.sessionId)
      showToast('Sesión revocada correctamente', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error al revocar sesión', 'error')
    } finally {
      setConfirmDialog(null)
    }
  }

  const otherSessions = sessions.filter((s) => !s.current)
  const currentSession = sessions.find((s) => s.current)

  return (
    <div className="space-y-6" role="tabpanel" id="security-panel" aria-labelledby="security-tab">
      {/* 2FA Section */}
      <div className="ui-panel">
        <h3 className="ui-title text-base">Autenticación de dos factores (2FA)</h3>
        <p className="ui-muted mt-1 text-sm">
          Activación TOTP disponible en una fase posterior.
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="ui-title text-base">Estado actual</p>
            <p className="ui-muted text-sm">
              {twoFactorEnabled ? 'Activado' : 'Desactivado'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={twoFactorEnabled}
            onClick={handle2FAToggle}
            disabled={toggling2FA}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-ring ${twoFactorEnabled ? 'bg-emerald-600' : 'bg-gray-200 dark:bg-slate-700'} ${toggling2FA ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="ui-panel">
        <div className="flex items-center justify-between">
          <h3 className="ui-title text-base">Sesiones activas</h3>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                sessions.length > 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'
              }`}
            >
              {sessions.length > 0 ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  En línea
                </>
              ) : (
                'Desconectado'
              )}
            </span>
            <span className="ui-muted text-sm">{sessions.length} sesión{sessions.length !== 1 ? 'es' : ''}</span>
          </div>
        </div>

        {currentSession && (
          <div className="ui-callout ui-callout-success mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="ui-title text-base">Sesión actual</p>
                  <p className="text-sm">
                    Iniciada: {formatDateTimeLocale(currentSession.createdAt)} · Expira: {formatDateTimeLocale(currentSession.expiresAt)}
                  </p>
                </div>
              </div>
              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                Esta sesión
              </span>
            </div>
          </div>
        )}

        {otherSessions.length > 0 && (
          <div className="mt-6">
            <h4 className="ui-title text-sm">
              {currentSession ? 'Otras sesiones' : 'Sesiones de este usuario'}
            </h4>
            <ul className="mt-3 space-y-3" role="list">
              {otherSessions.map((session) => (
                <li key={session.id} className="ui-stat flex items-center justify-between">
                  <div>
                    <p className="ui-title text-base">Sesión del {formatDateTimeLocale(session.createdAt)}</p>
                    <p className="ui-muted text-sm">Expira: {formatDateTimeLocale(session.expiresAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(session.id)}
                    disabled={confirmDialog?.sessionId === session.id}
                    className="cursor-pointer text-sm font-medium text-red-600 transition-colors hover:text-red-700 disabled:opacity-50 focus-ring"
                  >
                    Revocar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {otherSessions.length === 0 && !currentSession && (
          <p className="ui-muted mt-4 text-center text-sm">No hay sesiones activas.</p>
        )}

        {sessions.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setConfirmRevokeAll(true)}
              disabled={sessions.length === 1 && !!currentSession}
              className="w-full inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-400 dark:hover:bg-amber-950/30 focus-ring"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Cerrar todas las sesiones
            </button>
          </div>
        )}
      </div>

      {/* Confirm Dialog - Revoke single session */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmRevoke}
          title="Revocar sesión"
          description="¿Estás seguro de que quieres revocar esta sesión? El usuario tendrá que iniciar sesión de nuevo."
          confirmText="Revocar"
          variant="destructive"
        />
      )}

      {/* Confirm Dialog - Revoke all sessions */}
      {confirmRevokeAll && (
        <ConfirmDialog
          isOpen
          onClose={() => setConfirmRevokeAll(false)}
          onConfirm={async () => {
            try {
              await onRevokeAllSessions()
            } catch (error) {
              // Error handled in onRevokeAllSessions
            }
          }}
          title="Cerrar todas las sesiones"
          description="¿Estás seguro de que quieres cerrar TODAS las sesiones de este usuario? El usuario deberá iniciar sesión de nuevo en todos sus dispositivos."
          confirmText="Cerrar todas"
          variant="destructive"
        />
      )}
    </div>
  )
}