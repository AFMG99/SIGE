import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'

import { DashboardShell } from './DashboardShell'

const meta = {
  component: DashboardShell,
  tags: ['ai-generated'],
  parameters: {
    nextjs: {
      appDirectory: true,
      // La navegación se monta sobre el módulo de datos para poder verificar
      // el estado activo del chrome en las pruebas de interacción.
      navigation: { pathname: '/dashboard/datos' },
    },
  },
  args: {
    role: 'ADMIN_TI',
    account: {
      name: 'Ana Pérez',
      email: 'ana.perez@udea.edu.co',
      avatarUrl: null,
    },
    children: <p className="p-6">contenido de página</p>,
  },
} satisfies Meta<typeof DashboardShell>

export default meta
type Story = StoryObj<typeof meta>

export const BarraSuperior: Story = {
  name: 'Barra superior con módulo activo',
}

export const JerarquiaFocoYEstado: Story = {
  name: 'Chrome · marca sin h1, activa con aria-current y foco uv-lime',
  play: async ({ userEvent }) => {
    const header = document.querySelector('header')
    expect(header, 'el shell monta el encabezado').not.toBeNull()

    // La marca no disputa el h1 a las páginas de módulo (que ya tienen la suya).
    expect(header!.querySelector('h1')).toBeNull()
    expect(header!.textContent).toContain('SIGE-TdeA')

    // El contenido arranca debajo del encabezado fijo (no queda tapado).
    const raiz = header!.parentElement
    expect(raiz, 'el encabezado cuelga del shell').not.toBeNull()
    expect(
      parseFloat(getComputedStyle(raiz as Element).paddingTop)
    ).toBeGreaterThanOrEqual(header!.getBoundingClientRect().height)

    // El módulo activo es identificable: ARIA + marcador uv-lime.
    const activo = header!.querySelector('a[aria-current="page"]')
    expect(activo, 'el módulo activo se anuncia con aria-current').not.toBeNull()
    expect(activo!.querySelector('[class*="bg-uv-lime"]')).not.toBeNull()

    // El primer destino de Tabulador es un enlace del encabezado…
    await userEvent.tab()
    const foco = document.activeElement as HTMLElement | null
    expect(foco, 'el teclado entra por la navegación').not.toBeNull()
    expect(header!.contains(foco)).toBe(true)
    // … y su foco visible pinta el anillo uv-lime (sin offset sobre chrome-forest).
    expect(getComputedStyle(foco as Element).boxShadow).toContain('146, 189, 36')
  },
}

export const CicloDePosiciones: Story = {
  name: 'Encabezado · el ciclo de posiciones sigue intacto',
  play: async ({ canvas, userEvent }) => {
    const mover = canvas.getByRole('button', {
      name: /cambiar la posición del encabezado/i,
    })
    const header = document.querySelector('header')
    expect(header).not.toBeNull()
    const raiz = header!.parentElement
    expect(raiz).not.toBeNull()
    const paddingDe = () => {
      const cs = getComputedStyle(raiz as Element)
      return {
        top: parseFloat(cs.paddingTop),
        right: parseFloat(cs.paddingRight),
        left: parseFloat(cs.paddingLeft),
      }
    }
    const alturaEncabezado = header!.getBoundingClientRect().height

    // centro → derecha: el shell reserve la anchura del riel a la derecha.
    await userEvent.click(mover)
    await new Promise((resolve) => setTimeout(resolve, 450))
    let padding = paddingDe()
    expect(padding.top).toBe(0)
    expect(padding.right).toBeGreaterThanOrEqual(64)
    expect(padding.left).toBe(0)

    // derecha → izquierda → centro: vuelve la barra superior y con ella el
    // padding superior (el header no tapa el contenido).
    await userEvent.click(mover)
    await userEvent.click(mover)
    await new Promise((resolve) => setTimeout(resolve, 450))
    padding = paddingDe()
    expect(padding.top).toBeGreaterThanOrEqual(alturaEncabezado)
    expect(padding.right).toBe(0)
    expect(padding.left).toBe(0)
  },
}
