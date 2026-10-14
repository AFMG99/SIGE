import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'

import { ModuleNav } from './ModuleNav'

const meta = {
  component: ModuleNav,
  tags: ['ai-generated'],
  // ModuleNav always renders inside the chrome surface (DashboardHeader),
  // so the story must show it on the same background to be readable.
  decorators: [
    (Story) => (
      <div className="chrome-forest w-full max-w-3xl rounded-lg p-3">
        <Story />
      </div>
    ),
  ],
  parameters: {
    nextjs: {
      appDirectory: true,
      // Ruta activa simulada: deja «Datos» en estado activo para poder
      // verificar el marcador de navegación activa en las pruebas.
      navigation: { pathname: '/dashboard/datos' },
    },
  },
  args: {
    role: 'ADMIN_TI',
    variant: 'bar',
  },
} satisfies Meta<typeof ModuleNav>

export default meta
type Story = StoryObj<typeof meta>

export const VarianteBar: Story = {
  name: 'Barra superior de módulos',
}

export const VarianteSidebar: Story = {
  name: 'Riel lateral con árbol de datos',
  args: { variant: 'sidebar' },
}

export const VarianteRail: Story = {
  name: 'Rail compacto',
  args: { variant: 'rail' },
}

export const EstadoActivo: Story = {
  name: 'Barra · el módulo activo se anuncia y se marca',
  play: async ({ canvas }) => {
    const activo = canvas.getByRole('link', { name: 'Datos' })
    expect(activo.getAttribute('aria-current')).toBe('page')
    expect(activo.querySelector('[class*="bg-uv-lime"]')).not.toBeNull()

    // ADMIN_TI no ve «Reportes» (matriz de permisos): «Espacial» sí es
    // visible y sirve de enlace inactivo de referencia.
    const inactivo = canvas.getByRole('link', { name: 'Espacial' })
    expect(inactivo.getAttribute('aria-current')).toBeNull()
    expect(inactivo.querySelector('[class*="bg-uv-lime"]')).toBeNull()
  },
}

export const RielSeccionesSinAnidar: Story = {
  name: 'Riel · el toggle de secciones va fuera del enlace',
  args: { variant: 'sidebar' },
  play: async ({ canvas, userEvent }) => {
    // HTML válido y orden de foco lógico: ningún enlace contiene controles.
    const enlaces = canvas.getAllByRole('link')
    expect(enlaces.length).toBeGreaterThan(0)
    for (const enlace of enlaces) {
      expect(
        enlace.querySelector('button, [role="button"]'),
        `enlace sin controles anidados: ${enlace.textContent?.trim()}`
      ).toBeNull()
    }

    // El control sigue siendo accesible por teclado y conmuta el árbol.
    const toggle = canvas.getByRole('button', {
      name: /mostrar u ocultar las secciones/i,
    })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await userEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  },
}
