import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'

import { DashboardHome, type EnergySummary, type HomeAccount } from '../DashboardHome'

const cuenta: HomeAccount = {
  id: 'ckxy000000000000000000',
  name: 'Ana Torres',
  email: 'ana.torres@tecnologicoantioquia.edu.co',
  role: 'GESTOR_ENERGETICO',
  createdAt: '2025-06-01T12:00:00.000Z',
}

const resumen: EnergySummary = {
  facturas: 48,
  ultimoPeriodo: '2026-08',
  edificaciones: 4,
  bloques: 9,
}

const meta = {
  component: DashboardHome,
  tags: ['ai-generated'],
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/dashboard' } },
  },
  args: {
    account: cuenta,
    extraModules: [],
    energy: resumen,
  },
} satisfies Meta<typeof DashboardHome>

export default meta
type Story = StoryObj<typeof meta>

export const ConResumen: Story = {
  name: 'Inicio · identidad, módulos y resumen real',
  play: async ({ canvas }) => {
    // Identity preserved (S1)
    expect(await canvas.findByRole('heading', { level: 1, name: 'Ana Torres' })).toBeTruthy()
    expect(canvas.getByText('ana.torres@tecnologicoantioquia.edu.co')).toBeTruthy()
    expect(canvas.getByText('Gestor Energético')).toBeTruthy()
    expect(canvas.getByText('junio de 2025')).toBeTruthy()

    // Energy summary with an explicit period (S4), cards gated like the nav
    const resumen = await canvas.findByRole('region', { name: 'Resumen energético' })
    expect(resumen.textContent).toContain('2026-08')
    expect(canvas.getByRole('link', { name: /Gestión de datos/ })).toBeTruthy()
    // The home is never a card of itself
    expect(canvas.queryByRole('link', { name: 'Dashboard' })).toBeNull()
  },
}

export const SinAccesoConsumo: Story = {
  name: 'Inicio · rol sin acceso a consumption (sin resumen)',
  args: {
    account: { ...cuenta, role: 'COMUNIDAD_UNIVERSITARIA' },
    energy: null,
  },
  play: async ({ canvas }) => {
    // No summary region, no energy numbers and no data-module card
    expect(canvas.queryByRole('region', { name: 'Resumen energético' })).toBeNull()
    expect(canvas.queryByText('Último periodo')).toBeNull()
    expect(canvas.queryByRole('link', { name: /Gestión de datos/ })).toBeNull()
    // …but the modules it CAN see are still there (alertas has no module gate,
    // estimates is allowed for this role; "analisis" requires consumption)
    expect(canvas.queryByRole('link', { name: /Análisis estadístico/ })).toBeNull()
    expect(canvas.getByRole('link', { name: /Alertas/ })).toBeTruthy()
    expect(canvas.getByRole('link', { name: /Estimaciones/ })).toBeTruthy()
  },
}

export const SinFacturas: Story = {
  name: 'Inicio · base sin facturas (estado vacío con acción)',
  args: {
    energy: { facturas: 0, ultimoPeriodo: null, edificaciones: 0, bloques: 0 },
  },
  play: async ({ canvas }) => {
    expect(canvas.getByText('Aún no hay facturas registradas')).toBeTruthy()
    expect(canvas.getByText('Sin registros')).toBeTruthy()
    const cta = await canvas.findByRole('link', { name: 'Ir a Gestión de datos' })
    expect(cta.getAttribute('href')).toBe('/dashboard/datos')
  },
}
