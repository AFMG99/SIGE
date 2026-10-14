'use client'

import { useEffect, useState } from 'react'
import { IconClock } from '../settingsIcons'
import { SETTINGS_TABS, type SettingsUser } from '../settingsTypes'
import { type Theme } from '@/shared/utils/theme'
import { PanelHeading } from './PanelHeading'

interface AparienciaTabProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  timezone: string
  onTimezoneChange: (timezone: string) => void
  savingTimezone: boolean
  timezones: string[]
  user: SettingsUser
}

const meta = SETTINGS_TABS.find((t) => t.id === 'apariencia')!

function formatInZone(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat('es-CO', { ...options, timeZone }).format(date)
  } catch {
    return new Intl.DateTimeFormat('es-CO', options).format(date)
  }
}

/** Mini theme preview drawn with divs — no screenshots. */
function ThemePreview({ mode }: { mode: Theme }) {
  const isDark = mode === 'dark'
  return (
    <span
      aria-hidden="true"
      className={`block h-24 overflow-hidden rounded-lg border p-3 ${
        isDark
          ? 'border-slate-700 bg-slate-950'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      <span
        className={`mb-2 block h-3 w-1/3 rounded ${isDark ? 'bg-emerald-500' : 'bg-emerald-600'}`}
      />
      <span
        className={`mb-1.5 block h-2 w-2/3 rounded ${isDark ? 'bg-slate-600' : 'bg-gray-300'}`}
      />
      <span
        className={`mb-2 block h-2 w-1/2 rounded ${isDark ? 'bg-slate-600' : 'bg-gray-300'}`}
      />
      <span
        className={`block h-7 w-full rounded ${
          isDark ? 'border border-slate-800 bg-slate-900' : 'border border-gray-200 bg-white'
        }`}
      />
    </span>
  )
}

export function AparienciaTab({
  theme,
  onThemeChange,
  timezone,
  onTimezoneChange,
  savingTimezone,
  timezones,
  user,
}: AparienciaTabProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      role="tabpanel"
      id="apariencia-panel"
      aria-labelledby="apariencia-tab"
      className="space-y-8"
    >
      <PanelHeading
        number={meta.number}
        label={meta.label}
        heading={meta.heading}
        description="Ajusta cómo se ve SIGE y cómo se muestran las fechas de tu cuenta."
      />

      {/* ---- Tema ---- */}
      <section>
        <h2 className="ui-title text-base">Tema</h2>
        <p className="ui-muted mt-1 text-sm">
          Elige entre tema claro u oscuro. Se aplica de inmediato en todo el sistema.
        </p>

        <div
          role="radiogroup"
          aria-label="Tema"
          className="mt-4 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {(['light', 'dark'] as const).map((mode) => (
            <label key={mode} className="group cursor-pointer">
              <input
                type="radio"
                name="settings-theme"
                value={mode}
                checked={theme === mode}
                onChange={() => onThemeChange(mode)}
                className="peer sr-only"
              />
              <span className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all peer-checked:border-transparent peer-checked:ring-2 peer-checked:ring-uv-forest peer-focus-visible:ring-2 peer-focus-visible:ring-uv-lime peer-focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900 dark:peer-checked:ring-emerald-500">
                <ThemePreview mode={mode} />
                <span className="mt-3 flex items-center justify-between">
                  <span className="ui-title text-sm">{mode === 'light' ? 'Claro' : 'Oscuro'}</span>
                  <span
                    className={`text-xs font-medium ${
                      theme === mode
                        ? 'text-uv-forest dark:text-emerald-400'
                        : 'text-transparent'
                    }`}
                  >
                    {theme === mode ? 'Activo' : '·'}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* ---- Zona horaria ---- */}
      <section className="border-t border-gray-100 pt-6 dark:border-slate-800">
        <h2 className="ui-title text-base">Zona horaria</h2>
        <p className="ui-muted mt-1 text-sm">
          Las fechas y horas de tu cuenta se muestran en esta zona horaria.
        </p>

        <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <div className="ui-field max-w-md">
            <label htmlFor="timezone-select" className="ui-label">
              Zona horaria
            </label>
            <select
              id="timezone-select"
              value={timezone}
              onChange={(e) => onTimezoneChange(e.target.value)}
              disabled={savingTimezone}
              className="ui-input"
            >
              {!timezones.includes(timezone) && <option value={timezone}>{timezone}</option>}
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <p className="ui-muted mt-1 text-xs">Se guarda automáticamente.</p>
          </div>

          {/* Live clock preview in the selected zone */}
          <div className="ui-card flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-uv-forest dark:bg-emerald-500/15 dark:text-emerald-400">
              <IconClock width={20} height={20} />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {formatInZone(now, timezone, { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="ui-muted truncate text-xs">
                {formatInZone(now, timezone, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <p className="ui-muted ml-auto hidden shrink-0 text-right text-xs sm:block">
              {user.timezone === timezone ? 'Zona actual' : 'Vista previa'}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
