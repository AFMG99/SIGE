'use client'

import type { SVGProps } from 'react'
import { IconDashboard, IconMail } from '../settingsIcons'
import { SETTINGS_TABS, type SettingsUser } from '../settingsTypes'
import { PanelHeading } from './PanelHeading'

interface NotificacionesTabProps {
  user: SettingsUser
  saving: boolean
  onToggle: (field: 'notificationsEmail' | 'notificationsInApp') => void
}

const meta = SETTINGS_TABS.find((t) => t.id === 'notificaciones')!

interface RowProps {
  id: string
  icon: React.ReactElement<SVGProps<SVGSVGElement>>
  title: string
  description: string
  checked: boolean
  disabled: boolean
  onToggle: () => void
}

function NotificationRow({ id, icon, title, description, checked, disabled, onToggle }: RowProps) {
  return (
    <div className="ui-card flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-uv-forest dark:bg-emerald-500/15 dark:text-emerald-400">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="ui-title text-base">{title}</p>
          <p className="ui-muted text-sm">{description}</p>
        </div>
      </div>
      <label htmlFor={id} className="inline-flex shrink-0 cursor-pointer items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-label={title}
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-gray-900 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-uv-lime peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-slate-600 dark:peer-checked:bg-slate-100 dark:peer-checked:after:bg-gray-900"
        />
      </label>
    </div>
  )
}

export function NotificacionesTab({ user, saving, onToggle }: NotificacionesTabProps) {
  return (
    <div
      role="tabpanel"
      id="notificaciones-panel"
      aria-labelledby="notificaciones-tab"
      className="space-y-6"
    >
      <PanelHeading
        number={meta.number}
        label={meta.label}
        heading={meta.heading}
        description="Decide por qué vías quieres recibir alertas e informes de SIGE."
      />

      <div className="ui-callout ui-callout-info">
        Las notificaciones se configurarán aquí; se aplicarán cuando el módulo de
        notificaciones esté disponible. Tu selección ya queda guardada.
      </div>

      <div className="space-y-4">
        <NotificationRow
          id="notif-email"
          icon={<IconMail width={18} height={18} />}
          title="Notificaciones por correo"
          description={`Recibe alertas e informes importantes en ${user.email}.`}
          checked={user.notificationsEmail}
          disabled={saving}
          onToggle={() => onToggle('notificationsEmail')}
        />

        <NotificationRow
          id="notif-inapp"
          icon={<IconDashboard width={18} height={18} />}
          title="Notificaciones en la interfaz"
          description="Avisos dentro de SIGE (campana, avisos urgentes y recordatorios)."
          checked={user.notificationsInApp}
          disabled={saving}
          onToggle={() => onToggle('notificationsInApp')}
        />
      </div>
    </div>
  )
}
