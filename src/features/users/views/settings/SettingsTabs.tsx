'use client'

import { SETTINGS_TABS, type Tab } from './settingsTypes'

interface SettingsTabsProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  return (
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
  )
}