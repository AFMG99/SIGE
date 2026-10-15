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
  bloques: [
    { id: 'cbloque00000000000001', edificacionId: 'cedif00000000000000001' },
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `cbloque${String(i + 2).padStart(16, '0')}`,
      edificacionId: 'cedif00000000000000001',
    })),
  ],
  serie: [
    { periodo: '2026-08', consumoNormalizado: 45800, costoCop: 5200000 },
    { periodo: '2026-07', consumoNormalizado: 43300, costoCop: 4900000 },
  ],
  ultimasFacturas: [
    {
      id: 'cfactura000000000000001',
      periodo: '2026-08',
      edificacionId: 'cedif00000000000000001',
      edificacionNombre: 'Campus Norte',
      consumoKwh: 45200,
      consumoNormalizado: 45800,
      costoCop: 5200000,
      diasFacturados: 30,
    },
  ],
  lineasBase: [
    {
      bloqueId: 'cbloque00000000000001',
      edificacionId: 'cedif00000000000000001',
      modelos: [
        {
          tipo: 'valor_absoluto',
          r2: 0.91,
          coeficientes: {
            lben_mensual: [
              null, null, null, null, null, null, null, 50000, null, null, null, null,
            ],
          },
        },
      ],
    },
  ],
  periodoActual: [
    {
      edificacionId: 'cedif00000000000000001',
      nombre: 'Campus Norte',
      consumoNormalizado: 45800,
      costoCop: 5200000,
    },
  ],
  periodoPrevio: [
    {
      edificacionId: 'cedif00000000000000001',
      nombre: 'Campus Norte',
      consumoNormalizado: 43300,
      costoCop: 4900000,
    },
  ],
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
    moduleStats: { usuariosActivos: 12, variablesOperativas: 9 },
  },
} satisfies Meta<typeof DashboardHome>

export default meta
type Story = StoryObj<typeof meta>

export const ConResumen: Story = {
  name: 'Inicio · carrusel de módulos y resumen real',
  play: async ({ canvas, userEvent }) => {
    // S4: the modules section owns the h1; identity lives in the shell/nav
    expect(await canvas.findByRole('heading', { level: 1, name: 'Módulos' })).toBeTruthy()
    expect(canvas.queryByText('ana.torres@tecnologicoantioquia.edu.co')).toBeNull()

    // Carousel: first visible module for this role, with its real figure
    const carrusel = await canvas.findByRole('region', { name: 'Módulos destacados' })
    const primero = await canvas.findByRole('link', { name: /Gestión de datos/ })
    expect(primero.getAttribute('href')).toBe('/dashboard/datos')
    expect(carrusel.textContent).toContain('48')
    expect(carrusel.textContent).toContain('facturas registradas')
    // The home is never a card of itself
    expect(canvas.queryByRole('link', { name: 'Dashboard' })).toBeNull()
    // First interaction: lock to manual mode without leaving slide 1
    await userEvent.click(
      canvas.getByRole('button', { name: 'Ir al módulo Gestión de datos' })
    )

    // Next slide: Análisis with the variables figure the server queried
    await userEvent.click(canvas.getByRole('button', { name: 'Módulo siguiente' }))
    const analisis = await canvas.findByRole('link', { name: /Análisis estadístico/ })
    expect(analisis.getAttribute('href')).toBe('/dashboard/analisis')
    expect(analisis.textContent).toContain('9')
    expect(analisis.textContent).toContain('variables operativas registradas')

    // Energy summary with an explicit period (S4), gated like the nav
    const resumen = await canvas.findByRole('region', { name: 'Resumen energético' })
    expect(resumen.textContent).toContain('2026-08')

    // Redesigned overview (S1/S2): real KPIs + chart + leaderboard
    expect(canvas.getByText('Consumo · ago 26')).toBeTruthy()
    // 45.800 kWh aparece en KPI, distribución y tabla; 4.200 en KPI y ranking
    expect(canvas.getAllByText('45.800 kWh').length).toBeGreaterThan(0)
    expect(canvas.getAllByText('4.200 kWh').length).toBeGreaterThan(0)
    expect(canvas.getByText('Con LBEn')).toBeTruthy()
    expect(await canvas.findByRole('img', { name: 'Consumo mensual contra línea base' })).toBeTruthy()
    expect(canvas.getByRole('list', { name: 'Ranking de ahorro por edificación' })).toBeTruthy()
  },
}

export const SinAccesoConsumo: Story = {
  name: 'Inicio · rol sin acceso a consumption (sin resumen)',
  args: {
    account: { ...cuenta, role: 'COMUNIDAD_UNIVERSITARIA' },
    energy: null,
  },
  play: async ({ canvas, userEvent }) => {
    // No summary region, no energy numbers and no data-module slide
    expect(canvas.queryByRole('region', { name: 'Resumen energético' })).toBeNull()
    expect(canvas.queryByText('Último periodo')).toBeNull()
    expect(canvas.queryByRole('link', { name: /Gestión de datos/ })).toBeNull()
    expect(canvas.queryByRole('link', { name: /Análisis estadístico/ })).toBeNull()
    // …but the modules it CAN see are still slides (alertas has no module gate,
    // estimates is allowed for this role; "analisis" requires consumption)
    expect(await canvas.findByRole('link', { name: /Alertas/ })).toBeTruthy()
    // Placeholder slides show the honest label, never a figure
    expect(canvas.getByText('Módulo en construcción')).toBeTruthy()
    await userEvent.click(canvas.getByRole('button', { name: 'Módulo siguiente' }))
    expect(await canvas.findByRole('link', { name: /Estimaciones/ })).toBeTruthy()
    // …and still no gated slide after navigating
    expect(canvas.queryByRole('link', { name: /Gestión de datos/ })).toBeNull()
  },
}

export const SinFacturas: Story = {
  name: 'Inicio · base sin facturas (estado vacío con acción)',
  args: {
    energy: {
      facturas: 0,
      ultimoPeriodo: null,
      edificaciones: 0,
      bloques: [],
      serie: [],
      ultimasFacturas: [],
      lineasBase: [],
      periodoActual: null,
      periodoPrevio: null,
    },
  },
  play: async ({ canvas }) => {
    expect(canvas.getByText('Aún no hay facturas registradas')).toBeTruthy()
    expect(canvas.getByText('Sin registros')).toBeTruthy()
    const cta = await canvas.findByRole('link', { name: 'Ir a Gestión de datos' })
    expect(cta.getAttribute('href')).toBe('/dashboard/datos')
  },
}
