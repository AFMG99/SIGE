import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'

import { Sparkline } from '../Sparkline'
import { SERIE_PLANES_24M } from '../__fixtures__/charts.fixtures'

const meta = {
  title: 'Shared/Charts/Sparkline',
  component: Sparkline,
  tags: ['ai-generated'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="ui-card p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sparkline>

export default meta
type Story = StoryObj<typeof meta>

export const KpiConsumo: Story = {
  args: {
    valores: SERIE_PLANES_24M,
    titulo: 'Tendencia del consumo de los últimos 24 meses',
  },
  play: async () => {
    const svg = document.querySelector('.ui-card svg')
    expect(svg).not.toBeNull()
    expect(svg!.querySelectorAll('path').length).toBeGreaterThan(0)
  },
}

export const DecorativaSinTitulo: Story = {
  args: { valores: SERIE_PLANES_24M.slice(-12), color: 'sky' },
  play: async () => {
    // Sin título es decorativa: aria-hidden y sin rol de imagen
    expect(document.querySelector('.ui-card svg[aria-hidden="true"]')).not.toBeNull()
    expect(document.querySelector('.ui-card svg[role="img"]')).toBeNull()
  },
}

export const Insuficiente: Story = {
  args: { valores: [10, null] },
  play: async () => {
    // Con menos de 2 puntos con datos no se dibuja nada (evita curvas falsas)
    expect(document.querySelector('.ui-card svg')).toBeNull()
  },
}
