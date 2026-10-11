import type { SettingsSession, SettingsUser } from '../settingsTypes'

export const settingsUser: SettingsUser = {
  id: 'user_demo_01',
  name: 'Ana Pérez Gómez',
  email: 'ana.perez@udea.edu.co',
  phone: '+57 300 123 4567',
  role: 'GESTOR_ENERGETICO',
  status: 'ACTIVE',
  avatarUrl: null,
  timezone: 'America/Bogota',
  notificationsEmail: true,
  notificationsInApp: false,
  twoFactorEnabled: false,
  twoFactorRequired: false,
  lastLoginAt: '2026-10-10T14:30:00.000Z',
  createdAt: '2025-02-03T15:00:00.000Z',
}

export const settingsSessions: SettingsSession[] = [
  {
    id: 'sess_current',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    createdAt: '2026-10-10T14:30:00.000Z',
    expiresAt: '2026-11-09T14:30:00.000Z',
    current: true,
  },
  {
    id: 'sess_other',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    createdAt: '2026-10-08T09:10:00.000Z',
    expiresAt: '2026-11-07T09:10:00.000Z',
    current: false,
  },
]
