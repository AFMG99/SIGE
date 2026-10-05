import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn } from 'storybook/test'

import { DATOS_SECTIONS } from '@/app/dashboard/datos/nav'
import SidebarNav from './SidebarNav'

const meta = {
  component: SidebarNav,
  tags: ['ai-generated'],
  args: {
    items: DATOS_SECTIONS,
    activeId: 'resumen',
    open: true,
    onSelect: fn(),
    onToggle: fn(),
  },
} satisfies Meta<typeof SidebarNav>

export default meta
type Story = StoryObj<typeof meta>

export const Expandido: Story = {
  name: 'Expandido con sección activa',
}

export const Colapsado: Story = {
  name: 'Colapsado (solo iconos)',
  args: { open: false },
}

export const SeccionActivaFacturas: Story = {
  name: 'Sección activa: Facturas de energía',
  args: { activeId: 'facturas' },
}

export const SeleccionEmiteCallback: Story = {
  name: 'Seleccionar una sección emite onSelect',
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /facturas de energía/i }))

    await expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'facturas' })
    )
  },
}

export const CssCheck: Story = {
  name: 'CssCheck · indicador activo usa uv-lime del tema UV',
  args: { activeId: 'resumen' },
  play: async ({ canvas }) => {
    const fila = canvas.getByRole('button', { name: /^resumen$/i })
    const indicador = fila.querySelector('[class*="bg-uv-lime"]')

    expect(indicador).not.toBeNull()
    // globals.css define --color-uv-lime como #92bd24 (verde UV institucional);
    // el indicador usa uv-lime para mantener contraste sobre .chrome-forest.
    expect(getComputedStyle(indicador as Element).backgroundColor).toBe('rgb(146, 189, 36)')
  },
}
