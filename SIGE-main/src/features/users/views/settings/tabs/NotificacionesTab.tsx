'use client'

import type { SVGProps } from 'react'
import Link from 'next/link'
import {
  badgeAlertasNav,
  etiquetaBadgeAlertas,
} from '@/features/alertas/models/alertas'
import { IconBell, IconDashboard, IconMail } from '../settingsIcons'
import { SETTINGS_TABS, type SettingsUser } from '../settingsTypes'
import { PanelHeading } from './PanelHeading'

interface NotificacionesTabProps {
  user: SettingsUser
  saving: boolean
  onToggle: (field: 'notificationsEmail' | 'notificationsInApp') => void
  /** Alertas sin revisar del usuario (0 si su rol no ve el módulo). */
  alertasPendientes?: number
  /** El rol del usuario ve el módulo de alertas (guard server-side). */
  puedeVerAlertas?: boolean
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
  /** Etiqueta corta de alcance («Próximamente»), para no prometer lo que no pasa. */
  nota?: string
}

function NotificationRow({
  id,
  icon,
  title,
  description,
  checked,
  disabled,
  onToggle,
  nota,
}: RowProps) {
  return (
    <div className="ui-card flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-uv-forest dark:bg-emerald-500/15 dark:text-emerald-400">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="ui-title flex flex-wrap items-center gap-2 text-base">
            {title}
            {nota && (
              <span className="inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:border-slate-600 dark:text-gray-400">
                {nota}
              </span>
            )}
          </p>
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

export function NotificacionesTab({
  user,
  saving,
  onToggle,
  alertasPendientes = 0,
  puedeVerAlertas = false,
}: NotificacionesTabProps) {
  // Misma regla que el cromo (`badgeAlertasNav`): lo que se explica aquí es
  // exactamente lo que hace la campana, no una copia aproximada.
  const badge = badgeAlertasNav(alertasPendientes, user.notificationsInApp)
  const tonoAlertas = !user.notificationsInApp
    ? 'ui-callout-info'
    : badge === null
      ? 'ui-callout-success'
      : 'ui-callout-warn'
  const estadoAlertas = !user.notificationsInApp
    ? 'Los avisos en la interfaz están apagados: tu bandeja sigue ahí, pero la campana no marca pendientes.'
    : badge === null
      ? 'No hay alertas sin revisar. La campana se marcará sola en cuanto aparezca una.'
      : `Ahora mismo hay ${etiquetaBadgeAlertas(badge)}: la campana de la navegación lleva el punto rojo.`

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
        Los avisos dentro de SIGE ya funcionan: el interruptor de la interfaz enciende el punto
        rojo de la campana de Alertas. El envío por correo queda guardado para cuando el módulo
        de notificaciones esté disponible.
      </div>

      {puedeVerAlertas && (
        <section aria-labelledby="notif-alertas" className="ui-card space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
              >
                <IconBell width={18} height={18} />
              </span>
              <div className="min-w-0">
                <h3 id="notif-alertas" className="ui-title text-base">
                  Alertas de consumo inusual
                </h3>
                <p className="ui-muted text-sm">
                  Los períodos que superan la banda de confianza de su mes llegan a tu bandeja
                  del módulo de Alertas; esta pestaña sólo decide si te avisamos dentro de SIGE.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/alertas"
              className="ui-btn ui-btn-secondary ui-btn-sm focus-ring"
            >
              Abrir bandeja
            </Link>
          </div>

          <p className={`ui-callout ${tonoAlertas}`}>{estadoAlertas}</p>
        </section>
      )}

      <div className="space-y-4">
        <NotificationRow
          id="notif-email"
          icon={<IconMail width={18} height={18} />}
          title="Notificaciones por correo"
          description={`Recibe alertas e informes importantes en ${user.email}.`}
          checked={user.notificationsEmail}
          disabled={saving}
          onToggle={() => onToggle('notificationsEmail')}
          nota="Próximamente"
        />

        <NotificationRow
          id="notif-inapp"
          icon={<IconDashboard width={18} height={18} />}
          title="Notificaciones en la interfaz"
          description="Avisos dentro de SIGE: el punto rojo de la campana de Alertas, avisos urgentes y recordatorios."
          checked={user.notificationsInApp}
          disabled={saving}
          onToggle={() => onToggle('notificationsInApp')}
        />
      </div>
    </div>
  )
}
