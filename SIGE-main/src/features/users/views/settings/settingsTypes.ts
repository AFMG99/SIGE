import type { ComponentType, SVGProps } from 'react'
import type { Role, UserStatus } from '@/shared/models/permissions'
import { IconBell, IconShield, IconSun, IconUser } from './settingsIcons'

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

export type Tab = 'perfil' | 'apariencia' | 'seguridad' | 'notificaciones'

export interface SettingsTabDef {
  id: Tab
  label: string
  /** Editorial kicker number shown above each panel heading. */
  number: string
  heading: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}

export const SETTINGS_TABS: SettingsTabDef[] = [
  { id: 'perfil', label: 'Perfil', number: '01', heading: 'Información de la cuenta', Icon: IconUser },
  { id: 'apariencia', label: 'Apariencia', number: '02', heading: 'Tema y formato', Icon: IconSun },
  { id: 'seguridad', label: 'Seguridad', number: '03', heading: 'Protege tu cuenta', Icon: IconShield },
  { id: 'notificaciones', label: 'Notificaciones', number: '04', heading: 'Elige cómo enterarte', Icon: IconBell },
]
