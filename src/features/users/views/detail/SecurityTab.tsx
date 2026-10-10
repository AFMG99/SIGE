'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  onRevokeSession: (sessionId: string) => Promise<void>
  onRevokeAllSessions: () => Promise<void>
  currentUserId: string
}

export function SecurityTab({
  userId,
  userEmail,
  sessions,
  twoFactorEnabled,
  onRevokeSession,
  onRevokeAllSessions,
  currentUserId,
}: SecurityTabProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [confirmDialog, setConfirmDialog] = useState<{ sessionId: string } | null>(null)
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false)
  const [confirmDisable2FA, setConfirmDisable2FA] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableCode, setDisableCode] = useState('')

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
          Añade una capa extra de seguridad: además de tu contraseña, deberás introducir un código
          de 6 dígitos de tu app de autenticación.
        </p>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="ui-title text-base">Estado actual</p>
            <p className="ui-muted text-sm">
              {twoFactorEnabled ? 'Activado' : 'Desactivado'}
            </p>
          </div>

          {twoFactorEnabled ? (
            <button
              type="button"
              onClick={() => setConfirmDisable2FA(true)}
              className="ui-btn cursor-pointer border border-red-300 bg-white text-red-600 hover:bg-red-50 dark:border-red-700 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Desactivar 2FA
            </button>
          ) : (
            <Link
              href="/twofa/setup"
              className="ui-btn ui-btn-primary cursor-pointer"
            >
              Activar 2FA
            </Link>
          )}
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

      {/* Disable 2FA — requires password + a current TOTP/backup code (server enforces) */}
      {confirmDisable2FA && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h3 className="ui-title text-lg">Desactivar 2FA</h3>
            <p className="ui-muted mt-2 text-sm">
              Introduce tu contraseña y un código actual de tu app (o de respaldo) para desactivar 2FA.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  const res = await fetch('/api/auth/2fa/disable', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: disablePassword, code: disableCode }),
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.message || 'Error al desactivar 2FA')
                  showToast('2FA desactivado', 'success')
                  router.refresh()
                } catch (error) {
                  showToast(error instanceof Error ? error.message : 'Error inesperado', 'error')
                } finally {
                  setConfirmDisable2FA(false)
                  setDisablePassword('')
                  setDisableCode('')
                }
              }}
            >
              <div>
                <label htmlFor="disable-password" className="ui-label mb-1.5">Contraseña</label>
                <input
                  id="disable-password"
                  type="password"
                  autoComplete="current-password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="••••••••"
                  className="ui-input py-2"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="disable-code" className="ui-label mb-1.5">Código de verificación</label>
                <input
                  id="disable-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  maxLength={10}
                  placeholder="123456 o código de respaldo"
                  className="ui-input py-2 text-center font-mono tracking-[0.2em]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setConfirmDisable2FA(false); setDisablePassword(''); setDisableCode('') }}
                  className="ui-btn flex-1 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={disablePassword.length < 1 || disableCode.length < 6}
                  className="ui-btn flex-1 cursor-pointer bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Desactivar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
