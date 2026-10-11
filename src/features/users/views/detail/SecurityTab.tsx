'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDateTimeLocale } from '@/shared/utils/date-utils'
import { useToast } from '@/shared/views/ui/ToastProvider'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'
import { BackupCodesDisplay } from '@/features/users/views/twofa/BackupCodesDisplay'
import { TwoFactorCodeForm } from '@/features/users/views/twofa/TwoFactorCodeForm'
import { isTwoFactorRequiredForRole } from '@/shared/models/twoFactorPolicy'
import type { Role } from '@/shared/models/permissions'

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
  twoFactorRequired: boolean
  role: Role
  currentUserId: string
  // Optional optimistic-update callbacks; the tab performs the API calls itself
  // and only asks the parent to sync its local state.
  onSessionsChanged?: (sessions: Session[]) => void
  onSessionsCleared?: () => void
}

// Security settings for a user's own account, shown in the admin user-detail
// view. 2FA activation is still self-service only: the admin cannot silently
// flip another user's 2FA enrolment on/off (that would bypass the enrolment
// proof). The admin levers are: the per-user 2FA requirement switch (forces
// enrolment at next login without touching the secret) and — for a user who
// already enrolled — regenerating backup codes or a full 2FA reset, both after
// an explicit confirmation.
export function SecurityTab({
  userId,
  userEmail,
  sessions,
  twoFactorEnabled,
  twoFactorRequired,
  role,
  currentUserId,
  onSessionsChanged,
  onSessionsCleared,
}: SecurityTabProps) {
  const { showToast } = useToast()
  const [confirmDialog, setConfirmDialog] = useState<{ sessionId: string } | null>(null)
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false)
  const [confirmResetCodes, setConfirmResetCodes] = useState(false)
  const [resettingCodes, setResettingCodes] = useState(false)
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null)
  const [confirmReset2FA, setConfirmReset2FA] = useState(false)
  const [resetting2FA, setResetting2FA] = useState(false)
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disabling, setDisabling] = useState(false)
  const [requirementForced, setRequirementForced] = useState(twoFactorRequired)
  const [togglingRequirement, setTogglingRequirement] = useState(false)

  // Roles already covered by the global policy don't need — and shouldn't
  // expose — a per-user switch; the requirement is permanent for them.
  const roleMandatory = isTwoFactorRequiredForRole(role)

  const handleToggleRequirement = async (required: boolean) => {
    setTogglingRequirement(true)
    try {
      const res = await fetch(`/api/users/${userId}/2fa/require`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ required }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Error al actualizar la exigencia de 2FA')
      setRequirementForced(required)
      showToast(
        required
          ? 'Exigencia de 2FA activada. El usuario deberá configurarlo en su próximo acceso.'
          : 'Exigencia de 2FA desactivada. El 2FA del usuario queda opcional.',
        'success'
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error inesperado', 'error')
    } finally {
      setTogglingRequirement(false)
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
      const res = await fetch(`/api/users/${userId}/sessions/${confirmDialog.sessionId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Error al revocar sesión')
      }
      onSessionsChanged?.(sessions.filter((s) => s.id !== confirmDialog.sessionId))
      showToast('Sesión revocada correctamente', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error al revocar sesión', 'error')
    } finally {
      setConfirmDialog(null)
    }
  }

  const otherSessions = sessions.filter((s) => !s.current)
  const currentSession = sessions.find((s) => s.current)

  const handleResetCodes = async () => {
    setResettingCodes(true)
    try {
      const res = await fetch(`/api/users/${userId}/2fa/backup-codes`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Error al regenerar códigos')
      setNewBackupCodes(data.backupCodes)
      showToast('Códigos de respaldo regenerados', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error inesperado', 'error')
    } finally {
      setResettingCodes(false)
      setConfirmResetCodes(false)
    }
  }

  const handleReset2FA = async () => {
    setResetting2FA(true)
    try {
      const res = await fetch(`/api/users/${userId}/2fa/reset`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Error al resetear 2FA')
      showToast('2FA deshabilitado. El usuario deberá configurarlo de nuevo al iniciar sesión.', 'success')
      onSessionsCleared?.()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error inesperado', 'error')
    } finally {
      setResetting2FA(false)
      setConfirmReset2FA(false)
    }
  }

  const isSelf = userId === currentUserId

  const handleDisableSubmit = async (code: string) => {
    setDisabling(true)
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Error al desactivar 2FA')
      showToast('2FA desactivado correctamente', 'success')
      setShowDisableForm(false)
      setDisablePassword('')
      onSessionsCleared?.()
    } catch (error) {
      throw error
    } finally {
      setDisabling(false)
    }
  }

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

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                twoFactorEnabled
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'
              }`}
            >
              {twoFactorEnabled ? 'Activado' : 'Desactivado'}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {!twoFactorEnabled && (
            <p className="ui-muted text-sm">
              {isSelf
                ? 'Aún no tienes 2FA activo. Puedes configurarlo ahora para añadir una capa extra de seguridad.'
                : 'Este usuario aún no tiene 2FA activo. Debe configurarlo desde su propia pestaña Seguridad; con la exigencia de 2FA activa, el sistema lo redirigirá automáticamente en su próximo acceso.'}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {!twoFactorEnabled && isSelf && (
              <Link
                href="/twofa/setup"
                className="ui-btn ui-btn-primary cursor-pointer"
              >
                Configurar 2FA
              </Link>
            )}

            {twoFactorEnabled && isSelf && !showDisableForm && (
              <button
                type="button"
                onClick={() => setShowDisableForm(true)}
                className="ui-btn cursor-pointer border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                Desactivar 2FA
              </button>
            )}

            {twoFactorEnabled && !isSelf && (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmResetCodes(true)}
                  disabled={resettingCodes}
                  className="ui-btn cursor-pointer border border-amber-300 bg-white text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-400 dark:hover:bg-amber-950/30"
                >
                  {resettingCodes ? 'Regenerando...' : 'Regenerar códigos de respaldo'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset2FA(true)}
                  disabled={resetting2FA}
                  className="ui-btn cursor-pointer border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  {resetting2FA ? 'Reseteando...' : 'Resetear 2FA completo'}
                </button>
              </>
            )}
          </div>

          {!isSelf && (
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-slate-800">
              <label
                htmlFor="force-2fa"
                className="flex cursor-pointer items-start justify-between gap-4"
              >
                <span>
                  <span className="ui-title block text-base">Exigir 2FA a este usuario</span>
                  <span className="ui-muted block text-sm">
                    Con la exigencia activa, {userEmail} será redirigido a la configuración de 2FA
                    en su próximo acceso hasta completarla. No se toca su 2FA actual.
                  </span>
                </span>
                <input
                  id="force-2fa"
                  type="checkbox"
                  role="switch"
                  checked={roleMandatory || requirementForced}
                  disabled={roleMandatory || togglingRequirement}
                  onChange={(e) => handleToggleRequirement(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-gray-900 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-uv-lime peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-slate-600 dark:peer-checked:bg-slate-100 dark:peer-checked:after:bg-gray-900"
                />
              </label>
              {roleMandatory && (
                <p className="ui-muted mt-1 text-xs">
                  Este rol ya tiene 2FA obligatorio por política; la exigencia no puede desactivarse.
                </p>
              )}
            </div>
          )}

          {twoFactorEnabled && isSelf && showDisableForm && (
            <div className="ui-panel mt-4 space-y-4">
              <h4 className="ui-title text-sm">Desactivar 2FA</h4>
              <p className="ui-muted text-sm">
                Introduce tu contraseña y un código de verificación para desactivar 2FA.
              </p>
              <div>
                <label htmlFor="disable-password" className="ui-label mb-1.5">
                  Contraseña
                </label>
                <input
                  id="disable-password"
                  type="password"
                  autoComplete="current-password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  disabled={disabling}
                  className="ui-input py-2.5"
                  placeholder="••••••••"
                />
              </div>
              <TwoFactorCodeForm
                onSubmit={handleDisableSubmit}
                submitLabel="Desactivar 2FA"
                disabled={disabling || !disablePassword}
              />
              <button
                type="button"
                onClick={() => {
                  setShowDisableForm(false)
                  setDisablePassword('')
                }}
                className="ui-btn w-full cursor-pointer"
              >
                Cancelar
              </button>
            </div>
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
              const res = await fetch(`/api/users/${userId}/sessions`, { method: 'DELETE' })
              if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.message || 'Error al cerrar sesiones')
              }
              onSessionsCleared?.()
              showToast('Todas las sesiones cerradas', 'success')
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Error al cerrar sesiones', 'error')
            }
          }}
          title="Cerrar todas las sesiones"
          description="¿Estás seguro de que quieres cerrar TODAS las sesiones de este usuario? El usuario deberá iniciar sesión de nuevo en todos sus dispositivos."
          confirmText="Cerrar todas"
          variant="destructive"
        />
      )}

      {/* New backup codes — shown once after an admin reset */}
      {newBackupCodes && (
        <div className="ui-panel">
          <h3 className="ui-title text-base">Nuevos códigos de respaldo</h3>
          <p className="ui-muted mt-1 text-sm">
            Entrega estos códigos a {userEmail} de forma segura. Se muestran una sola vez.
          </p>
          <div className="mt-4 space-y-3">
            <BackupCodesDisplay codes={newBackupCodes} />
            <button
              type="button"
              onClick={() => setNewBackupCodes(null)}
              className="ui-btn w-full cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog - Reset backup codes */}
      {confirmResetCodes && (
        <ConfirmDialog
          isOpen
          onClose={() => setConfirmResetCodes(false)}
          onConfirm={handleResetCodes}
          title="Regenerar códigos de respaldo"
          description={`Los códigos actuales de ${userEmail} dejarán de funcionar. Se generarán 8 códigos nuevos que se mostrarán una sola vez.`}
          confirmText="Regenerar"
          variant="primary"
        />
      )}

      {/* Confirm Dialog - Reset 2FA completely */}
      {confirmReset2FA && (
        <ConfirmDialog
          isOpen
          onClose={() => setConfirmReset2FA(false)}
          onConfirm={handleReset2FA}
          title="Resetear 2FA completo"
          description={`El 2FA de ${userEmail} será deshabilitado y todos sus datos de autenticación (secreto TOTP, códigos de respaldo) serán eliminados. El usuario deberá configurar 2FA de nuevo al iniciar sesión. Usa esta opción solo si el usuario perdió su app de autenticación y no tiene códigos de respaldo.`}
          confirmText="Resetear 2FA"
          variant="destructive"
        />
      )}
    </div>
  )
}
