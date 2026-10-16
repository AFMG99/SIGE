import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'

import { CalendarioFestivos } from '../CalendarioFestivos'

const meta = {
  component: CalendarioFestivos,
  tags: ['ai-generated'],
} satisfies Meta<typeof CalendarioFestivos>

export default meta
type Story = StoryObj<typeof meta>

export const Julio2026: Story = {
  name: 'Julio de 2026 con festivos',
  args: { mesInicial: 7, anoInicial: 2026 },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('julio de 2026')).toBeVisible()

    // Lista del mes con los dos festivos oficiales (Chiquinquirá — Ley
    // 2578/2026 — y el 20 de julio). La rejilla también los muestra, pero
    // truncada: se consulta por la lista para evitar matches ambiguos.
    const lista = canvas.getByRole('list')
    await expect(
      within(lista).getByText('Nuestra Señora del Rosario de Chiquinquirá')
    ).toBeVisible()
    await expect(within(lista).getByText('Día de la Independencia')).toBeVisible()

    // Navegación de meses (S11: vista mensual navegable).
    await userEvent.click(canvas.getByRole('button', { name: 'Mes siguiente' }))
    await expect(canvas.getByText('agosto de 2026')).toBeVisible()
    await expect(within(canvas.getByRole('list')).getByText('Batalla de Boyacá')).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Mes anterior' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Mes anterior' }))
    await expect(canvas.getByText('junio de 2026')).toBeVisible()
    await expect(
      within(canvas.getByRole('list')).getByText('Sagrado Corazón de Jesús')
    ).toBeVisible()
  },
}

export const FebreroSinFestivos: Story = {
  name: 'Mes sin festivos (febrero 2026)',
  args: { mesInicial: 2, anoInicial: 2026 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('febrero de 2026')).toBeVisible()
    await expect(canvas.getByText('Sin festivos nacionales en este mes.')).toBeVisible()
    // La rejilla sigue mostrando los 28 días del mes.
    await expect(canvas.getByText('28')).toBeVisible()
  },
}
