'use client'

import { formatDateLocale, formatDateTimeLocale } from '@/shared/utils/date-utils'
import type { SettingsUser } from '../settingsTypes'
import { SETTINGS_TABS } from '../settingsTypes'
import { PanelHeading } from './PanelHeading'
import { Avatar } from '@/shared/views/ui/Avatar'
import type { RefObject } from 'react'

interface PerfilTabProps {
  user: SettingsUser
  name: string
  phone: string
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  saving: boolean
  onSave: () => void
  /** Avatar URL for display and editing. */
  avatarUrl?: string | null
  /** Hidden file input ref — the "Cambiar foto" button triggers it. */
  fileInputRef: RefObject<HTMLInputElement>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPickPhoto: () => void
  onRemovePhoto: () => void
  photoBusy: boolean
}

const meta = SETTINGS_TABS.find((t) => t.id === 'perfil')!

export function PerfilTab({
  user,
  name,
  phone,
  onNameChange,
  onPhoneChange,
  saving,
  onSave,
  avatarUrl,
  fileInputRef,
  onFileChange,
  onPickPhoto,
  onRemovePhoto,
  photoBusy,
}: PerfilTabProps) {
  return (
    <div
      role="tabpanel"
      id="perfil-panel"
      aria-labelledby="perfil-tab"
      className="space-y-6"
    >
      <PanelHeading
        number={meta.number}
        label={meta.label}
        heading={meta.heading}
        description="Estos datos identifican tu cuenta dentro de SIGE."
      />

      {/* Avatar section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="shrink-0">
          <Avatar
            name={user.name}
            email={user.email}
            src={avatarUrl}
            size="2xl"
            className="ring-4 ring-white shadow-lg dark:ring-slate-900"
          />
        </div>
        <div className="min-w-0 flex flex-col gap-2 sm:pb-1">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
            <button
              type="button"
              onClick={onPickPhoto}
              disabled={photoBusy}
              className="ui-btn ui-btn-secondary ui-btn-sm"
            >
              {photoBusy ? 'Procesando…' : avatarUrl ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={onRemovePhoto}
                disabled={photoBusy}
                className="ui-btn ui-btn-danger-outline ui-btn-sm"
              >
                Quitar foto
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="ui-field">
          <label htmlFor="profile-name" className="ui-label">
            Nombre
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
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
            onChange={(e) => onPhoneChange(e.target.value)}
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

      <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <p className="ui-muted text-xs">
          Miembro desde {formatDateLocale(user.createdAt, user.timezone)}
        </p>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="ui-btn ui-btn-primary sm:shrink-0"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
