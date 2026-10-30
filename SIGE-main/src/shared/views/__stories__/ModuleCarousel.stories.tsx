import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor } from 'storybook/test'

import { ModuleCarousel, type TarjetaModulo } from '../ModuleCarousel'

function IconoDemo({ d }: { d: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  )
}

const modulos: TarjetaModulo[] = [
  {
    id: 'usuarios',
    href: '/dashboard/users',
    titulo: 'Usuarios',
    descripcion: 'Cuentas, roles y permisos de acceso.',
    icon: <IconoDemo d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />,
    estadistica: { valor: '12', etiqueta: 'usuarios activos' },
  },
  {
    id: 'datos',
    href: '/dashboard/datos',
    titulo: 'Gestión de datos',
    descripcion: 'Facturas EPM, equipos, variables y catálogos.',
    icon: <IconoDemo d="M12 20V10M18 20V4M6 20v-4" />,
    estadistica: { valor: '48', etiqueta: 'facturas registradas' },
  },
  {
    id: 'alertas',
    href: '/dashboard/alertas',
    titulo: 'Alertas',
    descripcion: 'Avisos y notificaciones del sistema.',
    icon: <IconoDemo d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />,
    enConstruccion: true,
  },
]

const meta = {
  component: ModuleCarousel,
  tags: ['ai-generated'],
  args: { modulos },
} satisfies Meta<typeof ModuleCarousel>

export default meta
type Story = StoryObj<typeof meta>

export const NavegacionManual: Story = {
  name: 'Carrusel · navegación con controles, puntos y teclado',
  play: async ({ canvas, userEvent }) => {
    // Slide 1 with its real figure; inactive slides are not in the DOM
    const primero = await canvas.findByRole('link', { name: /Usuarios/ })
    expect(primero.getAttribute('href')).toBe('/dashboard/users')
    expect(primero.textContent).toContain('12')
    expect(primero.textContent).toContain('usuarios activos')
    expect(canvas.queryByText('Módulo en construcción')).toBeNull()

    // First interaction: lock the carousel to manual mode (dot of slide 1)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Ir al módulo Usuarios' })
    )

    // Next → slide 2, with its own figure and dot state
    await userEvent.click(canvas.getByRole('button', { name: 'Módulo siguiente' }))
    const segundo = await canvas.findByRole('link', { name: /Gestión de datos/ })
    expect(segundo.getAttribute('href')).toBe('/dashboard/datos')
    expect(segundo.textContent).toContain('48')
    expect(
      canvas
        .getByRole('button', { name: 'Ir al módulo Gestión de datos' })
        .getAttribute('aria-current')
    ).toBe('true')
    expect(canvas.queryByText('Módulo en construcción')).toBeNull()

    // Next → placeholder slide: the honest label instead of any figure
    await userEvent.click(canvas.getByRole('button', { name: 'Módulo siguiente' }))
    expect(await canvas.findByRole('link', { name: /Alertas/ })).toBeTruthy()
    expect(canvas.getByText('Módulo en construcción')).toBeTruthy()
    expect(canvas.queryByText('facturas registradas')).toBeNull()

    // Next wraps around to the first slide
    await userEvent.click(canvas.getByRole('button', { name: 'Módulo siguiente' }))
    expect(await canvas.findByRole('link', { name: /Usuarios/ })).toBeTruthy()

    // Dot jump + previous button
    await userEvent.click(
      canvas.getByRole('button', { name: 'Ir al módulo Gestión de datos' })
    )
    expect(await canvas.findByRole('link', { name: /Gestión de datos/ })).toBeTruthy()
    await userEvent.click(canvas.getByRole('button', { name: 'Módulo anterior' }))
    expect(await canvas.findByRole('link', { name: /Usuarios/ })).toBeTruthy()

    // Keyboard: ← and → move between slides (focus is inside the carousel)
    await userEvent.keyboard('{ArrowRight}')
    expect(await canvas.findByRole('link', { name: /Gestión de datos/ })).toBeTruthy()
    await userEvent.keyboard('{ArrowLeft}')
    expect(await canvas.findByRole('link', { name: /Usuarios/ })).toBeTruthy()
  },
}

/** Title of the module currently shown, read from the active dot. */
function tituloActivo(): string | null {
  const puntoActual = document.querySelector(
    '[aria-roledescription="carrusel"] [aria-current="true"]'
  )
  return puntoActual?.getAttribute('aria-label')?.replace(/^Ir al módulo /, '') ?? null
}

export const AutoAvanceYPausa: Story = {
  name: 'Carrusel · auto-avance, pausa y cancelación permanente',
  args: { modulos, intervaloMs: 300 },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('link', { name: /Usuarios/ })

    // Without interaction the carousel advances on its own…
    await waitFor(
      () => expect(canvas.queryByRole('link', { name: /Usuarios/ })).toBeNull(),
      { timeout: 2000, interval: 50 }
    )

    // …the first interaction cancels it permanently: click «siguiente», note
    // the slide and verify it stays after several auto-advance periods.
    const antesDelClic = tituloActivo()
    await userEvent.click(canvas.getByRole('button', { name: 'Módulo siguiente' }))
    await waitFor(
      () => expect(tituloActivo()).not.toBe(antesDelClic),
      { timeout: 2000, interval: 50 }
    )
    const trasElClic = tituloActivo()
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(tituloActivo()).toBe(trasElClic)
  },
}

export const PausaAlHover: Story = {
  name: 'Carrusel · el hover pausa el auto-avance (transitorio)',
  args: { modulos, intervaloMs: 300 },
  play: async ({ canvas, userEvent }) => {
    const primero = await canvas.findByRole('link', { name: /Usuarios/ })
    await userEvent.hover(primero)

    // Several periods with the pointer over the carousel: same slide
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(canvas.getByRole('link', { name: /Usuarios/ })).toBeTruthy()

    // Pointer out: the auto-advance resumes
    await userEvent.unhover(primero)
    await waitFor(
      () => expect(canvas.queryByRole('link', { name: /Usuarios/ })).toBeNull(),
      { timeout: 2000, interval: 50 }
    )
  },
}
