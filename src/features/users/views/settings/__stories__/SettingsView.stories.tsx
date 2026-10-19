import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor } from 'storybook/test'

import { SettingsView } from '../SettingsView'
import { settingsSessions, settingsUser } from '../__fixtures__/settings'
import { ToastProvider } from '@/shared/views/ui/ToastProvider'

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
    initialUser: settingsUser,
    initialSessions: settingsSessions,
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
    // El panel entra con `settings-fade-up` (opacity 0 → 1): reintentar hasta que termine.
    await userEvent.click(canvas.getByRole('tab', { name: 'Apariencia' }))
    await waitFor(() => {
      expect(canvas.getByText('Tema')).toBeVisible()
      expect(canvas.getByLabelText('Zona horaria')).toBeVisible()
    })

    await userEvent.click(canvas.getByRole('tab', { name: 'Seguridad' }))
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'Cerrar en otros dispositivos' })).toBeVisible()
      expect(canvas.getByText('Chrome · Windows')).toBeVisible()
      expect(canvas.getByText('Este dispositivo')).toBeVisible()
    })

    await userEvent.click(canvas.getByRole('tab', { name: 'Notificaciones' }))
    await waitFor(() => {
      expect(canvas.getByRole('switch', { name: /notificaciones por correo/i })).toBeVisible()
      expect(canvas.getByRole('switch', { name: /notificaciones en la interfaz/i })).toBeVisible()
    })
  },
}

export const PerfilConFoto: Story = {
  name: 'Perfil · avatar con foto de perfil',
  args: {
    initialUser: {
      ...settingsUser,
      avatarUrl:
        'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
    },
  },
  play: async ({ canvas }) => {
    // The photo lives in the hero only — the Perfil tab no longer renders one.
    expect(canvas.getAllByRole('img', { name: /Ana Pérez Gómez/ })).toHaveLength(1)
    expect(await canvas.getByRole('button', { name: 'Cambiar foto' })).toBeEnabled()
    expect(await canvas.getByRole('button', { name: 'Quitar foto' })).toBeEnabled()
  },
}

export const NotificacionesConPendientes: Story = {
  name: 'Notificaciones · la campana avisa y la bandeja está a un clic',
  args: {
    initialUser: { ...settingsUser, notificationsInApp: true },
    alertasPendientes: 3,
    puedeVerAlertas: true,
    initialTab: 'notificaciones',
  },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { level: 3, name: 'Alertas de consumo inusual' })
    // El texto sale de la MISMA regla que pinta el punto del cromo.
    await canvas.findByText(
      /Ahora mismo hay 3 alertas sin revisar: la campana de la navegación lleva el punto rojo/
    )
    const abrir = canvas.getByRole('link', { name: 'Abrir bandeja' })
    expect(abrir).toHaveAttribute('href', '/dashboard/alertas')
    // Lo que todavía no existe se dice: nada de prometer correos.
    await canvas.findByText('Próximamente')
  },
}

export const NotificacionesApagadas: Story = {
  name: 'Notificaciones · interfaz apagada (bandeja sin aviso)',
  args: { alertasPendientes: 3, puedeVerAlertas: true, initialTab: 'notificaciones' },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { level: 3, name: 'Alertas de consumo inusual' })
    await canvas.findByText(
      /Los avisos en la interfaz están apagados: tu bandeja sigue ahí, pero la campana no marca pendientes/
    )
  },
}
