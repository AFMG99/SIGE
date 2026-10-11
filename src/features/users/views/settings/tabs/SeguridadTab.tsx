'use client'

import { TwoFactorCodeForm } from '@/features/users/views/twofa/TwoFactorCodeForm'
import { formatDateTimeLocale } from '@/shared/utils/date-utils'
import { IconKey, IconMonitor, IconShield, IconSmartphone } from '../settingsIcons'
import {
  SETTINGS_TABS,
  type SettingsSession,
  type SettingsUser,
} from '../settingsTypes'
import { PanelHeading } from './PanelHeading'

interface SeguridadTabProps {
  user: SettingsUser
  sessions: SettingsSession[]
  twoFactorMandatory: boolean
  otherSessionCount: number
  // Password form
  currentPassword: string
  newPassword: string
  confirmPassword: string
  onCurrentPassword: (value: string) => void
  onNewPassword: (value: string) => void
  onConfirmPassword: (value: string) => void
  savingPassword: boolean
  onChangePassword: (e: React.FormEvent) => void
  // 2FA
  showDisableForm: boolean
  onShowDisableForm: (show: boolean) => void
  disablePassword: string
  onDisablePassword: (value: string) => void
  disabling2FA: boolean
  onDisable2FA: (code: string) => Promise<void>
  // Sessions
  onRevokeOne: (sessionId: string) => void
  onRevokeAll: () => void
}

const meta = SETTINGS_TABS.find((t) => t.id === 'seguridad')!

function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Dispositivo desconocido'

  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\/|Opera/.test(userAgent) ? 'Opera'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Safari\//.test(userAgent) ? 'Safari'
    : 'Navegador desconocido'

  const os =
    /Windows/.test(userAgent) ? 'Windows'
    : /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad|iPod/.test(userAgent) ? 'iOS'
    : /Mac OS X/.test(userAgent) ? 'macOS'
    : /Linux/.test(userAgent) ? 'Linux'
    : 'Sistema desconocido'

  return `${browser} · ${os}`
}

function isMobileDevice(userAgent: string | null): boolean {
  return userAgent ? /Mobi|Android|iPhone|iPad|iPod/.test(userAgent) : false
}

/** 0 = empty · 1 = débil · 2 = media · 3 = fuerte (length + character classes). */
function passwordStrength(password: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (!password) return { level: 0, label: '' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 1) return { level: 1, label: 'Débil' }
  if (score <= 3) return { level: 2, label: 'Media' }
  return { level: 3, label: 'Fuerte' }
}

const STRENGTH_COLORS = {
  0: 'bg-gray-200 dark:bg-slate-700',
  1: 'bg-red-400',
  2: 'bg-amber-400',
  3: 'bg-emerald-600',
} as const

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="ui-card">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-uv-forest dark:bg-emerald-500/15 dark:text-emerald-400">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="ui-title text-base">{title}</h3>
          <p className="ui-muted mt-0.5 text-sm">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function SeguridadTab({
  user,
  sessions,
  twoFactorMandatory,
  otherSessionCount,
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentPassword,
  onNewPassword,
  onConfirmPassword,
  savingPassword,
  onChangePassword,
  showDisableForm,
  onShowDisableForm,
  disablePassword,
  onDisablePassword,
  disabling2FA,
  onDisable2FA,
  onRevokeOne,
  onRevokeAll,
}: SeguridadTabProps) {
  const strength = passwordStrength(newPassword)

  return (
    <div
      role="tabpanel"
      id="seguridad-panel"
      aria-labelledby="seguridad-tab"
      className="space-y-4"
    >
      <div className="mb-6">
        <PanelHeading
          number={meta.number}
          label={meta.label}
          heading={meta.heading}
          description="Contraseña, verificación en dos pasos y dispositivos con acceso a tu cuenta."
        />
      </div>

      {/* ---- Contraseña ---- */}
      <SectionCard
        icon={<IconKey width={20} height={20} />}
        title="Cambiar contraseña"
        description="Al cambiar la contraseña se cierran las sesiones en otros dispositivos."
      >
        <form onSubmit={onChangePassword} className="max-w-md space-y-4">
          <div className="ui-field">
            <label htmlFor="current-password" className="ui-label">
              Contraseña actual
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => onCurrentPassword(e.target.value)}
              className="ui-input"
              required
            />
          </div>

          <div className="ui-field">
            <label htmlFor="new-password" className="ui-label">
              Nueva contraseña
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => onNewPassword(e.target.value)}
              className="ui-input"
              minLength={8}
              required
              aria-describedby="password-strength"
            />
            {newPassword && (
              <div id="password-strength" className="mt-1 flex items-center gap-2">
                <div className="flex flex-1 gap-1" aria-hidden="true">
                  {([1, 2, 3] as const).map((seg) => (
                    <span
                      key={seg}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        strength.level >= seg
                          ? STRENGTH_COLORS[strength.level]
                          : STRENGTH_COLORS[0]
                      }`}
                    />
                  ))}
                </div>
                <span className="ui-muted text-xs">{strength.label}</span>
              </div>
            )}
          </div>

          <div className="ui-field">
            <label htmlFor="confirm-password" className="ui-label">
              Confirmar nueva contraseña
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => onConfirmPassword(e.target.value)}
              className="ui-input"
              minLength={8}
              required
            />
          </div>

          <button
            type="submit"
            disabled={
              savingPassword || !currentPassword || !newPassword || !confirmPassword
            }
            className="ui-btn ui-btn-primary"
          >
            {savingPassword ? 'Actualizando…' : 'Actualizar contraseña'}
          </button>
        </form>
      </SectionCard>

      {/* ---- 2FA ---- */}
      <SectionCard
        icon={<IconShield width={20} height={20} />}
        title="Autenticación de dos factores (2FA)"
        description={
          user.twoFactorEnabled
            ? 'Tu cuenta está protegida con una app de autenticación.'
            : 'Añade una capa extra de seguridad con una app de autenticación.'
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
              user.twoFactorEnabled
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'
            }`}
          >
            {user.twoFactorEnabled ? 'Activado' : 'Desactivado'}
          </span>
          {twoFactorMandatory && (
            <span className="ui-muted text-xs">
              Tu cuenta requiere 2FA por política de seguridad.
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            {!user.twoFactorEnabled && (
              <a href="/twofa/setup" className="ui-btn ui-btn-primary">
                Configurar 2FA
              </a>
            )}

            {user.twoFactorEnabled && !twoFactorMandatory && !showDisableForm && (
              <button
                type="button"
                onClick={() => onShowDisableForm(true)}
                className="ui-btn ui-btn-danger-outline"
              >
                Desactivar 2FA
              </button>
            )}
          </div>

          {user.twoFactorEnabled && !twoFactorMandatory && showDisableForm && (
            <div className="ui-panel space-y-4">
              <h4 className="ui-title text-sm">Desactivar 2FA</h4>
              <p className="ui-muted text-sm">
                Introduce tu contraseña y un código de verificación para desactivar 2FA.
              </p>
              <div className="ui-field">
                <label htmlFor="disable-password" className="ui-label">
                  Contraseña
                </label>
                <input
                  id="disable-password"
                  type="password"
                  autoComplete="current-password"
                  value={disablePassword}
                  onChange={(e) => onDisablePassword(e.target.value)}
                  disabled={disabling2FA}
                  className="ui-input"
                  placeholder="••••••••"
                />
              </div>
              <TwoFactorCodeForm
                onSubmit={onDisable2FA}
                submitLabel="Desactivar 2FA"
                disabled={disabling2FA || !disablePassword}
              />
              <button
                type="button"
                onClick={() => onShowDisableForm(false)}
                className="ui-btn w-full"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ---- Sesiones ---- */}
      <SectionCard
        icon={<IconSmartphone width={20} height={20} />}
        title="Sesiones activas"
        description={`${sessions.length} sesión${sessions.length !== 1 ? 'es' : ''} desde donde iniciaste sesión en SIGE.`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="ui-muted text-sm">Último acceso: {formatDateTimeLocale(user.lastLoginAt, user.timezone)}</p>
          {otherSessionCount > 0 && (
            <button
              type="button"
              onClick={onRevokeAll}
              className="ui-btn ui-btn-danger-outline"
            >
              Cerrar en otros dispositivos
            </button>
          )}
        </div>

        <ul className="mt-4 space-y-3" role="list">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                  {isMobileDevice(session.userAgent) ? (
                    <IconSmartphone width={18} height={18} />
                  ) : (
                    <IconMonitor width={18} height={18} />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="ui-title text-sm">{describeDevice(session.userAgent)}</p>
                    {session.current && (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Este dispositivo
                      </span>
                    )}
                  </div>
                  <p className="ui-muted text-xs">
                    Iniciada: {formatDateTimeLocale(session.createdAt, user.timezone)} · Expira:{' '}
                    {formatDateTimeLocale(session.expiresAt, user.timezone)}
                  </p>
                  {session.userAgent && (
                    <p className="ui-muted mt-1 truncate text-xs" title={session.userAgent}>
                      {session.userAgent}
                    </p>
                  )}
                </div>
              </div>
              {!session.current && (
                <button
                  type="button"
                  onClick={() => onRevokeOne(session.id)}
                  className="ui-btn ui-btn-danger-outline shrink-0 self-start sm:self-auto"
                >
                  Cerrar sesión
                </button>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
