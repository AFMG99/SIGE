'use client'

import type { RefObject } from 'react'
import { Avatar } from '@/shared/views/ui/Avatar'
import {
  ROLE_BADGES,
  ROLE_LABELS,
  STATUS_BADGES,
  STATUS_LABELS,
} from '@/shared/models/permissions'
import { SETTINGS_TABS, type SettingsUser, type Tab } from './settingsTypes'

interface SettingsHeroProps {
  user: SettingsUser
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  /** Hidden file input ref — the "Cambiar foto" button triggers it. */
  fileInputRef: RefObject<HTMLInputElement>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPickPhoto: () => void
  onRemovePhoto: () => void
  photoBusy: boolean
}

/**
 * Account identity banner: the chrome-forest surface with a big overlapping
 * avatar (reference design: hero header on top), followed by the tab bar.
 * The panels render below this component in SettingsView.
 */
export function SettingsHero({
  user,
  activeTab,
  onTabChange,
  fileInputRef,
  onFileChange,
  onPickPhoto,
  onRemovePhoto,
  photoBusy,
}: SettingsHeroProps) {
  return (
    <section className="ui-panel overflow-hidden !p-0">
      {/* Banner — brand surface with soft depth accents (no bitmap assets). */}
      <div className="chrome-forest relative h-24 overflow-hidden sm:h-32 lg:h-36">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-uv-lime/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-1/3 -bottom-24 h-44 w-44 rounded-full bg-white/5 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-black/25"
        />
      </div>

      {/* Identity row — avatar overlaps the banner edge. */}
      <div className="px-4 pb-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-5">
            <div className="-mt-12 w-fit shrink-0 sm:-mt-14">
              <Avatar
                name={user.name}
                email={user.email}
                src={user.avatarUrl}
                size="2xl"
                className="ring-4 ring-white shadow-lg dark:ring-slate-900"
              />
            </div>
            <div className="min-w-0 sm:pb-1">
              <h1 className="ui-title truncate text-xl sm:text-2xl">{user.name || '—'}</h1>
              <p className="ui-muted truncate text-sm">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGES[user.role]}`}
                >
                  {ROLE_LABELS[user.role]}
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[user.status]}`}
                >
                  {STATUS_LABELS[user.status]}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
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
                {photoBusy ? 'Procesando…' : user.avatarUrl ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {user.avatarUrl && (
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
            <form action="/api/auth/logout" method="POST" className="w-full sm:w-auto">
              <button
                type="submit"
                className="ui-btn ui-btn-danger-outline w-full sm:w-auto"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Tab bar — lives inside the same panel as the hero. */}
      <nav
        className="border-t border-gray-100 px-2 dark:border-slate-800 sm:px-4"
        aria-label="Secciones de configuración"
      >
        <ul className="flex overflow-x-auto" role="tablist">
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <li key={tab.id} role="presentation">
                <button
                  role="tab"
                  id={`${tab.id}-tab`}
                  aria-selected={isActive}
                  aria-controls={`${tab.id}-panel`}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3.5 text-sm font-medium transition-colors focus-ring ${
                    isActive
                      ? 'border-uv-forest text-uv-forest dark:border-emerald-400 dark:text-emerald-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <tab.Icon width={16} height={16} className="shrink-0" />
                  {tab.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </section>
  )
}
