import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, within } from 'storybook/test'

import { SeriesChart } from '../SeriesChart'
import {
  BARRAS_EDIFICACION,
  CONSUMO_12M,
  ETIQUETAS_12M,
  INDICE_XM,
  LINEA_BASE_12M,
} from '../__fixtures__/charts.fixtures'

const meta = {
  title: 'Shared/Charts/SeriesChart',
  component: SeriesChart,
  tags: ['ai-generated'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="ui-panel p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SeriesChart>

export default meta
type Story = StoryObj<typeof meta>

/** Consumo real vs línea base: el «actual vs target» del dashboard. */
export const ConsumoVsLineaBase: Story = {
  args: {
    titulo: 'Consumo mensual contra línea base',
    etiquetas: ETIQUETAS_12M,
    series: [
      { clave: 'real', nombre: 'Consumo real', valores: CONSUMO_12M, tipo: 'area' },
      { clave: 'lb', nombre: 'Línea base', valores: LINEA_BASE_12M, tipo: 'linea' },
    ],
    formatoValor: (v) => `${new Intl.NumberFormat('es-CO').format(Math.round(v))} kWh`,
  },
  play: async ({ canvas, userEvent }) => {
    const figura = canvas.getByRole('figure', { name: /consumo mensual/i })

    // Las dos curvas están dibujadas (área con gradiente + línea de referencia)
    expect(figura.querySelectorAll('path').length).toBeGreaterThan(1)

    // Leyenda: dos botones visibles (aria-pressed true)
    const botones = within(figura).getAllByRole('button')
    expect(botones.length).toBe(2)
    expect(botones[0].getAttribute('aria-pressed')).toBe('true')

    // El overlay de teclado enfoca y el ArrowRight mueve el cruce (tooltip)
    const overlay = canvas.getByRole('application')
    overlay.focus()
    await userEvent.keyboard('{ArrowRight}')
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(canvas.getByText('oct 25')).toBeTruthy()
  },
}

/** Toggle de leyenda: oculta una serie sin perder la otra. */
export const LeyendaAlternaSeries: Story = {
  args: { ...ConsumoVsLineaBase.args },
  play: async ({ canvas }) => {
    const leyenda = within(canvas.getByRole('figure'))
    const botonLb = leyenda.getByRole('button', { name: /línea base/i })
    await userEvent.click(botonLb)
    expect(botonLb.getAttribute('aria-pressed')).toBe('false')
    // La serie de consumo sigue visible
    expect(leyenda.getByRole('button', { name: /consumo real/i }).getAttribute('aria-pressed')).toBe('true')
  },
}

/** Índice XM (interanual) — una sola serie de área. */
export const SerieUnicaIndice: Story = {
  args: {
    titulo: 'Índice de consumo XM (base 100)',
    etiquetas: ETIQUETAS_12M,
    series: [{ clave: 'indice', nombre: 'Índice XM', valores: INDICE_XM, tipo: 'area' }],
    desdeCero: false,
  },
}

/** Estado vacío: sin datos no se dibuja nada inventado (S2). */
export const SinDatos: Story = {
  args: {
    titulo: 'Serie sin datos',
    etiquetas: ETIQUETAS_12M,
    series: [
      { clave: 'vacio', nombre: 'Consumo', valores: ETIQUETAS_12M.map(() => null) },
    ],
    sinDatos: 'Aún no hay facturas para mostrar',
  },
  play: async ({ canvas }) => {
    expect(canvas.getByText('Aún no hay facturas para mostrar')).toBeTruthy()
  },
}

/** Silueta reutilizable para barras de distribución del dashboard de ref. */
export const ReferenciaBarras: Story = {
  args: {
    titulo: 'Consumo por edificación (serie de referencia)',
    etiquetas: BARRAS_EDIFICACION.map((b) => b.etiqueta),
    series: [
      { clave: 'kwh', nombre: 'kWh', valores: BARRAS_EDIFICACION.map((b) => b.valor), tipo: 'area' },
    ],
    desdeCero: true,
  },
}
