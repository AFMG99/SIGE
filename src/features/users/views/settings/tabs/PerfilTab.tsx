'use client'

import { formatDateLocale, formatDateTimeLocale } from '@/shared/utils/date-utils'
import type { SettingsUser } from '../settingsTypes'
import { SETTINGS_TABS } from '../settingsTypes'
import { PanelHeading } from './PanelHeading'

interface PerfilTabProps {
  user: SettingsUser
  name: string
  phone: string
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  saving: boolean
  onSave: () => void
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
        description="Estos datos identifican tu cuenta dentro de SIGE. La foto de perfil se edita en el encabezado."
      />

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
