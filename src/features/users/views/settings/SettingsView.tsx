'use client'

import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/shared/views/ui/ToastProvider'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'
import { isTwoFactorRequired } from '@/shared/models/twoFactorPolicy'
import { getCurrentTheme, setTheme, type Theme } from '@/shared/utils/theme'
import { SettingsTabs } from './SettingsTabs'
import { SETTINGS_TABS, type Tab } from './settingsTypes'
import { PerfilTab } from './tabs/PerfilTab'
import { AparienciaTab } from './tabs/AparienciaTab'
import { SeguridadTab } from './tabs/SeguridadTab'
import { NotificacionesTab } from './tabs/NotificacionesTab'

export type { SettingsUser, SettingsSession } from './settingsTypes'
import type { SettingsSession, SettingsUser } from './settingsTypes'

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
  /** Tab preselected from a validated `?tab=` deep link. */
  initialTab?: Tab
}

export function SettingsView({
  initialUser,
  initialSessions,
  initialTab,
}: SettingsViewProps) {
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState<SettingsUser>(initialUser)
  const [sessions, setSessions] = useState<SettingsSession[]>(initialSessions)
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'perfil')

  // The server re-renders the page on `?tab=` changes (account menu links);
  // this keeps the active tab in sync with the URL without useSearchParams.
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])

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
    { type: 'revokeOne'; sessionId: string } | { type: 'revokeAll' } | null
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
        showToast(`${data.revoked} sesión(es) cerrada(s) en otros dispositivos`, 'success')
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
  const timezones = getSupportedTimezones()

  return (
    <div className="space-y-6">
      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="ui-panel p-6 sm:p-8">
        {/* `key` remounts the panel on tab change so the fade-up replays. */}
        <div key={activeTab} className="settings-panel">
          {activeTab === 'perfil' && (
            <PerfilTab
              user={user}
              name={name}
              phone={phone}
              onNameChange={setName}
              onPhoneChange={setPhone}
              saving={savingProfile}
              onSave={handleSaveProfile}
              avatarUrl={user.avatarUrl}
              fileInputRef={fileInputRef}
              onFileChange={handleAvatarFile}
              onPickPhoto={() => fileInputRef.current?.click()}
              onRemovePhoto={handleRemoveAvatar}
              photoBusy={changingAvatar}
            />
          )}

          {activeTab === 'apariencia' && (
            <AparienciaTab
              user={user}
              theme={theme}
              onThemeChange={handleThemeChange}
              timezone={timezone}
              onTimezoneChange={handleTimezoneChange}
              savingTimezone={savingTimezone}
              timezones={timezones}
            />
          )}

          {activeTab === 'seguridad' && (
            <SeguridadTab
              user={user}
              sessions={sessions}
              twoFactorMandatory={twoFactorMandatory}
              otherSessionCount={otherSessionCount}
              currentPassword={currentPassword}
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              onCurrentPassword={setCurrentPassword}
              onNewPassword={setNewPassword}
              onConfirmPassword={setConfirmPassword}
              savingPassword={savingPassword}
              onChangePassword={handleChangePassword}
              showDisableForm={showDisableForm}
              onShowDisableForm={(show) => {
                setShowDisableForm(show)
                if (!show) setDisablePassword('')
              }}
              disablePassword={disablePassword}
              onDisablePassword={setDisablePassword}
              disabling2FA={disabling2FA}
              onDisable2FA={handleDisable2FA}
              onRevokeOne={(sessionId) => setConfirmAction({ type: 'revokeOne', sessionId })}
              onRevokeAll={() => setConfirmAction({ type: 'revokeAll' })}
            />
          )}

          {activeTab === 'notificaciones' && (
            <NotificacionesTab
              user={user}
              saving={savingNotifications}
              onToggle={handleToggleNotification}
            />
          )}
        </div>
      </div>

      {confirmAction && (
        <ConfirmDialog
          isOpen
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirmAction}
          title={
            confirmAction.type === 'revokeOne' ? 'Cerrar sesión' : 'Cerrar en otros dispositivos'
          }
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
