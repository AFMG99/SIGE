'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/shared/views/ui/Avatar'
import { useToast } from '@/shared/views/ui/ToastProvider'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'
import { TwoFactorCodeForm } from '@/features/users/views/twofa/TwoFactorCodeForm'
import {
  ROLE_LABELS,
  ROLE_BADGES,
  STATUS_LABELS,
  STATUS_BADGES,
  type Role,
  type UserStatus,
} from '@/shared/models/permissions'
import { isTwoFactorRequired } from '@/shared/models/twoFactorPolicy'
import { getCurrentTheme, setTheme, type Theme } from '@/shared/utils/theme'
import { formatDateTimeLocale, formatDateLocale } from '@/shared/utils/date-utils'

export interface SettingsUser {
  id: string
  name: string | null
  email: string
  phone: string | null
  role: Role
  status: UserStatus
  avatarUrl: string | null
  timezone: string
  notificationsEmail: boolean
  notificationsInApp: boolean
  twoFactorEnabled: boolean
  twoFactorRequired: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface SettingsSession {
  id: string
  userAgent: string | null
  createdAt: string
  expiresAt: string
  current: boolean
}

type Tab = 'perfil' | 'apariencia' | 'seguridad' | 'notificaciones'

const FALLBACK_TIMEZONES = [
  'America/Bogota',
  'America/Mexico_City',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/New_York',
  'Europe/Madrid',
  'UTC',
]

function getSupportedTimezones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    if (typeof intl.supportedValuesOf === 'function') {
      const all = intl.supportedValuesOf('timeZone')
      // Keep the list relevant for a Colombian audience; UTC always included.
      const filtered = all.filter((tz) => /^(America|Europe)\//.test(tz) || tz === 'UTC')
      return filtered.length > 0 ? filtered : all
    }
  } catch {
    // fall through to the curated list
  }
  return FALLBACK_TIMEZONES
}

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

// Downscale to a 256px WebP data-URL on the client before sending it — keeps
// the DB payload small (base64 storage) and no server-side image processing.
function fileToAvatarDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const width = Math.round(img.width * scale)
        const height = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas no soportado')
        ctx.drawImage(img, 0, 0, width, height)
        // Browsers that cannot encode WebP transparently fall back to PNG,
        // which the server-side schema also accepts.
        const dataUrl = canvas.toDataURL('image/webp', 0.85)
        resolve(dataUrl)
      } catch (err) {
        reject(err)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen'))
    }
    img.src = url
  })
}

interface SettingsViewProps {
  initialUser: SettingsUser
  initialSessions: SettingsSession[]
}

export function SettingsView({ initialUser, initialSessions }: SettingsViewProps) {
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState<SettingsUser>(initialUser)
  const [sessions, setSessions] = useState<SettingsSession[]>(initialSessions)
  const [activeTab, setActiveTab] = useState<Tab>('perfil')

  // Perfil
  const [name, setName] = useState(initialUser.name ?? '')
  const [phone, setPhone] = useState(initialUser.phone ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [changingAvatar, setChangingAvatar] = useState(false)

  // Apariencia
  const [theme, setThemeState] = useState<Theme>('light')
  const [timezone, setTimezone] = useState(initialUser.timezone)
  const [savingTimezone, setSavingTimezone] = useState(false)

  // Contraseña
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // 2FA
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disabling2FA, setDisabling2FA] = useState(false)

  // Sesiones
  const [revoking, setRevoking] = useState(false)
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'revokeOne'; sessionId: string }
    | { type: 'revokeAll' }
    | null
  >(null)

  // Notificaciones
  const [savingNotifications, setSavingNotifications] = useState(false)

  useEffect(() => {
    setThemeState(getCurrentTheme())
  }, [])

  const patchProfile = async (patch: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) {
        const fieldErrors = data.errors
          ? Object.values(data.errors).flat().join(' · ')
          : null
        throw new Error(fieldErrors || data.message || 'Error al guardar')
      }
      setUser((prev) => ({ ...prev, ...patch, ...data.user }))
      return true
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error inesperado', 'error')
      return false
    }
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const ok = await patchProfile({ name: name.trim(), phone: phone.trim() || null })
      if (ok) showToast('Perfil actualizado correctamente', 'success')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('Selecciona un archivo de imagen', 'error')
      return
    }
    setChangingAvatar(true)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      const ok = await patchProfile({ avatarUrl: dataUrl })
      if (ok) showToast('Foto de perfil actualizada', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error al procesar la imagen', 'error')
    } finally {
      setChangingAvatar(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setChangingAvatar(true)
    try {
      const ok = await patchProfile({ avatarUrl: null })
      if (ok) showToast('Foto de perfil eliminada', 'success')
    } finally {
      setChangingAvatar(false)
    }
  }

  const handleThemeChange = (next: Theme) => {
    setTheme(next)
    setThemeState(next)
  }

  const handleTimezoneChange = async (tz: string) => {
    const previous = timezone
    setTimezone(tz)
    setSavingTimezone(true)
    const ok = await patchProfile({ timezone: tz })
    if (ok) {
      showToast('Zona horaria actualizada', 'success')
    } else {
      setTimezone(previous)
    }
    setSavingTimezone(false)
  }

  const handleToggleNotification = async (field: 'notificationsEmail' | 'notificationsInApp') => {
    const previous = user[field]
    setSavingNotifications(true)
    const ok = await patchProfile({ [field]: !previous })
    if (ok) showToast('Preferencia guardada', 'success')
    else setUser((prev) => ({ ...prev, [field]: previous }))
    setSavingNotifications(false)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      showToast('La confirmación no coincide con la nueva contraseña', 'error')
      return
    }
    setSavingPassword(true)
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Error al cambiar la contraseña')
      showToast('Contraseña actualizada. Se cerraron las sesiones en otros dispositivos.', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      // Password change revoked the other sessions — refresh the list.
      const sessionsRes = await fetch('/api/profile/sessions')
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json()
        setSessions(sessionsData.sessions)
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error inesperado', 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleDisable2FA = async (code: string) => {
    setDisabling2FA(true)
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Error al desactivar 2FA')
      setUser((prev) => ({ ...prev, twoFactorEnabled: false }))
      showToast('2FA desactivado correctamente', 'success')
      setShowDisableForm(false)
      setDisablePassword('')
    } catch (error) {
      throw error
    } finally {
      setDisabling2FA(false)
    }
  }

  const refreshSessions = async () => {
    try {
      const res = await fetch('/api/profile/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions)
      }
    } catch {
      // keep the current list on failure
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmAction || revoking) return
    setRevoking(true)
    try {
      if (confirmAction.type === 'revokeOne') {
        const res = await fetch(`/api/profile/sessions/${confirmAction.sessionId}`, {
          method: 'DELETE',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Error al cerrar la sesión')
        showToast('Sesión cerrada correctamente', 'success')
      } else {
        const res = await fetch('/api/profile/sessions', { method: 'DELETE' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Error al cerrar las sesiones')
        showToast(
          `${data.revoked} sesión(es) cerrada(s) en otros dispositivos`,
          'success'
        )
      }
      await refreshSessions()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error inesperado', 'error')
    } finally {
      setRevoking(false)
      setConfirmAction(null)
    }
  }

  const twoFactorMandatory = isTwoFactorRequired(user)
  const otherSessionCount = sessions.filter((s) => !s.current).length

  const tabs: { id: Tab; label: string }[] = [
    { id: 'perfil', label: 'Perfil' },
    { id: 'apariencia', label: 'Apariencia' },
    { id: 'seguridad', label: 'Seguridad' },
    { id: 'notificaciones', label: 'Notificaciones' },
  ]

  const timezones = getSupportedTimezones()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="ui-panel flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} email={user.email} src={user.avatarUrl} size="xl" />
          <div className="min-w-0">
            <h1 className="ui-title text-xl truncate">{user.name || '—'}</h1>
            <p className="ui-muted truncate text-sm">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGES[user.role]}`}>
                {ROLE_LABELS[user.role]}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[user.status]}`}>
                {STATUS_LABELS[user.status]}
              </span>
            </div>
          </div>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="ui-btn ui-btn-danger-outline w-full sm:w-auto">
            Cerrar sesión
          </button>
        </form>
      </div>

      {/* Tabs + panel */}
      <div className="ui-panel overflow-hidden !p-0">
        <nav className="border-b border-gray-100 dark:border-slate-800" aria-label="Secciones de configuración">
          <ul className="flex overflow-x-auto" role="tablist">
            {tabs.map((tab) => (
              <li key={tab.id} role="presentation">
                <button
                  role="tab"
                  id={`${tab.id}-tab`}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`${tab.id}-panel`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`cursor-pointer whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-ring ${
                    activeTab === tab.id
                      ? 'border-uv-forest text-uv-forest dark:border-emerald-400 dark:text-emerald-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-6">
          {/* ================= PERFIL ================= */}
          {activeTab === 'perfil' && (
            <div
              role="tabpanel"
              id="perfil-panel"
              aria-labelledby="perfil-tab"
              className="space-y-6"
            >
              {/* Avatar */}
              <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar name={user.name} email={user.email} src={user.avatarUrl} size="xl" />
                <div className="flex flex-wrap gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFile}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={changingAvatar}
                    className="ui-btn ui-btn-secondary"
                  >
                    {changingAvatar ? 'Procesando…' : user.avatarUrl ? 'Cambiar foto' : 'Subir foto'}
                  </button>
                  {user.avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={changingAvatar}
                      className="ui-btn ui-btn-danger-outline"
                    >
                      Quitar foto
                    </button>
                  )}
                </div>
                <p className="ui-muted text-xs sm:ml-auto">
                  Se recorta a 256px y se guarda en tu cuenta.
                </p>
              </section>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="ui-field">
                  <label htmlFor="profile-name" className="ui-label">
                    Nombre
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="ui-input"
                    maxLength={100}
                  />
                </div>
                <div className="ui-field">
                  <label htmlFor="profile-phone" className="ui-label">
                    Teléfono
                  </label>
                  <input
                    id="profile-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="ui-input"
                    placeholder="+57 300 123 4567"
                  />
                </div>
                <div className="ui-field">
                  <label htmlFor="profile-email" className="ui-label">
                    Correo electrónico
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    value={user.email}
                    disabled
                    className="ui-input"
                    aria-describedby="profile-email-hint"
                  />
                  <p id="profile-email-hint" className="ui-muted mt-1 text-xs">
                    El correo solo puede cambiarlo un administrador.
                  </p>
                </div>
                <div className="ui-field">
                  <label htmlFor="profile-lastlogin" className="ui-label">
                    Último acceso
                  </label>
                  <input
                    id="profile-lastlogin"
                    type="text"
                    value={formatDateTimeLocale(user.lastLoginAt, user.timezone)}
                    disabled
                    className="ui-input"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="ui-btn ui-btn-primary"
                >
                  {savingProfile ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}

          {/* ================= APARIENCIA ================= */}
          {activeTab === 'apariencia' && (
            <div
              role="tabpanel"
              id="apariencia-panel"
              aria-labelledby="apariencia-tab"
              className="space-y-6"
            >
              <section>
                <h3 className="ui-title text-base">Tema</h3>
                <p className="ui-muted mt-1 text-sm">
                  Elige entre tema claro u oscuro. Se aplica de inmediato en todo el sistema.
                </p>
                <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 p-4 dark:border-slate-800">
                  <div>
                    <p className="ui-title text-base">Modo oscuro</p>
                    <p className="ui-muted text-sm">
                      {theme === 'dark' ? 'Activado' : 'Desactivado'}
                    </p>
                  </div>
                  <label htmlFor="theme-switch" className="inline-flex cursor-pointer items-center">
                    <input
                      id="theme-switch"
                      type="checkbox"
                      role="switch"
                      aria-label="Modo oscuro"
                      checked={theme === 'dark'}
                      onChange={(e) => handleThemeChange(e.target.checked ? 'dark' : 'light')}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-gray-900 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-uv-lime peer-focus-visible:ring-offset-2 dark:bg-slate-600 dark:peer-checked:bg-slate-100 dark:peer-checked:after:bg-gray-900"
                    />
                  </label>
                </div>
              </section>

              <section>
                <h3 className="ui-title text-base">Zona horaria</h3>
                <p className="ui-muted mt-1 text-sm">
                  Las fechas y horas de tu cuenta se muestran en esta zona horaria.
                </p>
                <div className="ui-field mt-4 max-w-md">
                  <label htmlFor="timezone-select" className="ui-label">
                    Zona horaria
                  </label>
                  <select
                    id="timezone-select"
                    value={timezone}
                    onChange={(e) => handleTimezoneChange(e.target.value)}
                    disabled={savingTimezone}
                    className="ui-input"
                  >
                    {!timezones.includes(timezone) && (
                      <option value={timezone}>{timezone}</option>
                    )}
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                  <p className="ui-muted mt-1 text-xs">
                    Ejemplo: {formatDateTimeLocale(new Date().toISOString(), timezone)}
                  </p>
                </div>
              </section>
            </div>
          )}

          {/* ================= SEGURIDAD ================= */}
          {activeTab === 'seguridad' && (
            <div
              role="tabpanel"
              id="seguridad-panel"
              aria-labelledby="seguridad-tab"
              className="space-y-8"
            >
              {/* Contraseña */}
              <section>
                <h3 className="ui-title text-base">Cambiar contraseña</h3>
                <p className="ui-muted mt-1 text-sm">
                  Al cambiar la contraseña se cierran las sesiones en otros dispositivos.
                </p>
                <form onSubmit={handleChangePassword} className="mt-4 max-w-md space-y-4">
                  <div className="ui-field">
                    <label htmlFor="current-password" className="ui-label">
                      Contraseña actual
                    </label>
                    <input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
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
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="ui-input"
                      minLength={8}
                      required
                    />
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
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="ui-input"
                      minLength={8}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="ui-btn ui-btn-primary"
                  >
                    {savingPassword ? 'Actualizando…' : 'Actualizar contraseña'}
                  </button>
                </form>
              </section>

              {/* 2FA */}
              <section className="border-t border-gray-100 pt-6 dark:border-slate-800">
                <h3 className="ui-title text-base">Autenticación de dos factores (2FA)</h3>
                <div className="mt-3 flex flex-wrap items-center gap-3">
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
                  {!user.twoFactorEnabled && (
                    <p className="ui-muted text-sm">
                      Añade una capa extra de seguridad con una app de autenticación.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {!user.twoFactorEnabled && (
                      <a href="/twofa/setup" className="ui-btn ui-btn-primary">
                        Configurar 2FA
                      </a>
                    )}

                    {user.twoFactorEnabled && !twoFactorMandatory && !showDisableForm && (
                      <button
                        type="button"
                        onClick={() => setShowDisableForm(true)}
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
                          onChange={(e) => setDisablePassword(e.target.value)}
                          disabled={disabling2FA}
                          className="ui-input"
                          placeholder="••••••••"
                        />
                      </div>
                      <TwoFactorCodeForm
                        onSubmit={handleDisable2FA}
                        submitLabel="Desactivar 2FA"
                        disabled={disabling2FA || !disablePassword}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowDisableForm(false)
                          setDisablePassword('')
                        }}
                        className="ui-btn w-full"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* Sesiones */}
              <section className="border-t border-gray-100 pt-6 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="ui-title text-base">Sesiones activas</h3>
                    <p className="ui-muted mt-1 text-sm">
                      {sessions.length} sesión{sessions.length !== 1 ? 'es' : ''} · desde donde
                      iniciaste sesión.
                    </p>
                  </div>
                  {otherSessionCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setConfirmAction({ type: 'revokeAll' })}
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
                      className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="ui-title text-base truncate">
                            {describeDevice(session.userAgent)}
                          </p>
                          {session.current && (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              Este dispositivo
                            </span>
                          )}
                        </div>
                        <p className="ui-muted text-sm">
                          Iniciada: {formatDateTimeLocale(session.createdAt, user.timezone)} ·
                          Expira: {formatDateTimeLocale(session.expiresAt, user.timezone)}
                        </p>
                        {session.userAgent && (
                          <p className="ui-muted mt-1 truncate text-xs" title={session.userAgent}>
                            {session.userAgent}
                          </p>
                        )}
                      </div>
                      {!session.current && (
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ type: 'revokeOne', sessionId: session.id })}
                          className="ui-btn ui-btn-danger-outline shrink-0 self-start sm:self-auto"
                        >
                          Cerrar sesión
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                <p className="ui-muted mt-4 text-xs">
                  Miembro desde {formatDateLocale(user.createdAt, user.timezone)} · Último acceso{' '}
                  {formatDateTimeLocale(user.lastLoginAt, user.timezone)}
                </p>
              </section>
            </div>
          )}

          {/* ================= NOTIFICACIONES ================= */}
          {activeTab === 'notificaciones' && (
            <div
              role="tabpanel"
              id="notificaciones-panel"
              aria-labelledby="notificaciones-tab"
              className="space-y-6"
            >
              <div className="ui-callout ui-callout-info">
                Las notificaciones se configurarán aquí; se aplicarán cuando el módulo de
                notificaciones esté disponible. Tu selección ya queda guardada.
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-gray-100 p-4 dark:border-slate-800">
                  <div className="pr-4">
                    <p className="ui-title text-base">Notificaciones por correo</p>
                    <p className="ui-muted text-sm">
                      Recibe alertas e informes importantes en {user.email}.
                    </p>
                  </div>
                  <label htmlFor="notif-email" className="inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      id="notif-email"
                      type="checkbox"
                      role="switch"
                      aria-label="Notificaciones por correo"
                      checked={user.notificationsEmail}
                      disabled={savingNotifications}
                      onChange={() => handleToggleNotification('notificationsEmail')}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-gray-900 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-uv-lime peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-slate-600 dark:peer-checked:bg-slate-100 dark:peer-checked:after:bg-gray-900"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-gray-100 p-4 dark:border-slate-800">
                  <div className="pr-4">
                    <p className="ui-title text-base">Notificaciones en la interfaz</p>
                    <p className="ui-muted text-sm">
                      Avisos dentro de SIGE (campana, avisos urgentes y recordatorios).
                    </p>
                  </div>
                  <label htmlFor="notif-inapp" className="inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      id="notif-inapp"
                      type="checkbox"
                      role="switch"
                      aria-label="Notificaciones en la interfaz"
                      checked={user.notificationsInApp}
                      disabled={savingNotifications}
                      onChange={() => handleToggleNotification('notificationsInApp')}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-gray-900 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-uv-lime peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-slate-600 dark:peer-checked:bg-slate-100 dark:peer-checked:after:bg-gray-900"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialogs */}
      {confirmAction && (
        <ConfirmDialog
          isOpen
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirmAction}
          title={confirmAction.type === 'revokeOne' ? 'Cerrar sesión' : 'Cerrar en otros dispositivos'}
          description={
            confirmAction.type === 'revokeOne'
              ? 'Esta sesión se cerrará en ese dispositivo y deberá iniciar sesión de nuevo.'
              : `Se cerrarán las ${otherSessionCount} sesión(es) en otros dispositivos. En este dispositivo seguirás conectado.`
          }
          confirmText={confirmAction.type === 'revokeOne' ? 'Cerrar sesión' : 'Cerrar todas'}
          variant="destructive"
        />
      )}
    </div>
  )
}
