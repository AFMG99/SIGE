import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'

import { SettingsView, type SettingsUser, type SettingsSession } from '../SettingsView'
import { ToastProvider } from '@/shared/views/ui/ToastProvider'

const initialUser: SettingsUser = {
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

const initialSessions: SettingsSession[] = [
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

const meta = {
  component: SettingsView,
  tags: ['ai-generated'],
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  args: {
    initialUser,
    initialSessions,
  },
} satisfies Meta<typeof SettingsView>

export default meta
type Story = StoryObj<typeof meta>

export const Perfil: Story = {
  name: 'Perfil · datos de cuenta en pestaña activa',
  play: async ({ canvas }) => {
    expect(await canvas.getByLabelText('Nombre')).toBeInTheDocument()
    expect(await canvas.getByLabelText('Correo electrónico')).toBeDisabled()
    expect(await canvas.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  },
}

export const NavegacionTabs: Story = {
  name: 'Navegación · las 4 pestañas cambian de panel',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('tab', { name: 'Apariencia' }))
    expect(await canvas.getByText('Tema', )).toBeVisible()
    expect(await canvas.getByLabelText('Zona horaria')).toBeVisible()

    await userEvent.click(canvas.getByRole('tab', { name: 'Seguridad' }))
    expect(await canvas.getByRole('button', { name: 'Cerrar en otros dispositivos' })).toBeVisible()
    expect(await canvas.getByText('Chrome · Windows', )).toBeVisible()
    expect(await canvas.getByText('Este dispositivo', )).toBeVisible()

    await userEvent.click(canvas.getByRole('tab', { name: 'Notificaciones' }))
    expect(await canvas.getByRole('switch', { name: /notificaciones por correo/i })).toBeVisible()
    expect(await canvas.getByRole('switch', { name: /notificaciones en la interfaz/i })).toBeVisible()
  },
}

export const PerfilConFoto: Story = {
  name: 'Perfil · avatar con foto de perfil',
  args: {
    initialUser: {
      ...initialUser,
      avatarUrl:
        'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
    },
  },
  play: async ({ canvas }) => {
    // Header + profile tab both render the avatar image.
    expect(canvas.getAllByRole('img', { name: /Ana Pérez Gómez/ })).toHaveLength(2)
    expect(await canvas.getByRole('button', { name: 'Cambiar foto' })).toBeEnabled()
    expect(await canvas.getByRole('button', { name: 'Quitar foto' })).toBeEnabled()
  },
}
