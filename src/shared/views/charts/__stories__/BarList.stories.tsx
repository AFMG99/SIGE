import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'

import { BarList } from '../BarList'
import { BARRAS_EDIFICACION } from '../__fixtures__/charts.fixtures'

const meta = {
  title: 'Shared/Charts/BarList',
  component: BarList,
  tags: ['ai-generated'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="ui-panel max-w-md p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BarList>

export default meta
type Story = StoryObj<typeof meta>

/** Distribución por edificación con Δ mensual (patrón «pipeline stages»). */
export const ConsumoPorEdificacion: Story = {
  args: {
    titulo: 'Consumo del último período por edificación',
    datos: BARRAS_EDIFICACION.map((b) => ({
      ...b,
      textoValor: `${new Intl.NumberFormat('es-CO').format(b.valor)} kWh`,
    })),
  },
  play: async ({ canvas }) => {
    const lista = canvas.getByRole('list', { name: /por edificación/i })
    const filas = within(lista).getAllByRole('listitem')
    expect(filas.length).toBe(4)

    // El valor formateado y el delta con signo están presentes
    expect(canvas.getByText('18.420 kWh')).toBeTruthy()
    expect(canvas.getByText(/\+3,2 %/)).toBeTruthy()
    expect(canvas.getByText(/−1,4 %/)).toBeTruthy()

    // Cada barra expone un meter con valor real
    const meters = canvas.getAllByRole('meter')
    expect(meters.length).toBe(4)
    expect(meters[0].getAttribute('aria-valuenow')).toBe('18420')
  },
}

/** Serie de los 4 modelos LBEn (solo valores, sin delta). */
export const ModelosLben: Story = {
  args: {
    titulo: 'Ahorro potencial por modelo',
    datos: [
      { clave: 'reg', etiqueta: 'Regresión estadística', valor: 8420 },
      { clave: 'coc', etiqueta: 'Cociente', valor: 7610 },
      { clave: 'conf', etiqueta: 'Confort térmico', valor: 6980 },
      { clave: 'va', etiqueta: 'Valor absoluto', valor: 5240 },
    ],
  },
}

export const Vacio: Story = {
  args: {
    titulo: 'Distribución vacía',
    datos: [],
    vacio: 'Registra facturas para ver la distribución',
  },
  play: async ({ canvas }) => {
    expect(canvas.getByText('Registra facturas para ver la distribución')).toBeTruthy()
  },
}
