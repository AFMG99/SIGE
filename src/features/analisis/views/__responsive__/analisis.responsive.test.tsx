/**
 * Tests responsivos del Módulo 3 — Análisis estadístico.
 *
 * Mismo contrato que `shared/views/__responsive__/overflow.responsive.test.tsx`:
 * renderiza la vista real (bajo DashboardShell, que aporta el header y el
 * SubNavContext compartido) en navegador, cambia el viewport (matriz 375 /
 * 768 / 1280) y verifica que ni el documento ni sus contenedores desborden
 * horizontalmente, que la tabla scrollee en su shell y que los targets
 * táctiles midan ≥ 40px por debajo de `lg`. La navegación entre secciones es
 * la del módulo de datos: sidebar lateral desde `lg`, burger + cajón por
 * debajo. Una aserción que falla NO se arregla bajando el umbral: describe
 * una vista aún no responsiva.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'

import '@/app/globals.css'

// --- mocks de Next (DashboardShell/Header/ModuleNav viven en el App Router) --
// `__esModule` es obligatorio: next/link se resuelve como CJS y sin él el
// import por defecto devuelve el objeto { default } en vez del componente.
vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  const LinkMock = ({
    href,
    children,
    ...rest
  }: {
    href?: unknown
    children?: React.ReactNode
    className?: string
    title?: string
    'aria-label'?: string
    'data-no-drag'?: boolean
  }) =>
    createElement(
      'a',
      { href: typeof href === 'string' ? href : '#', ...rest },
      children
    )
  return { __esModule: true, default: LinkMock }
})

vi.mock('next/navigation', () => ({
  __esModule: true,
  usePathname: () => '/dashboard/analisis',
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// La server action importa Prisma y spawnea Python (irrepetibles fuera de
// Next): se apunta al doble determinista que ya usa Storybook. El import va
// inline porque `vi.mock` se eleva por encima del archivo.
vi.mock('@/features/analisis/controllers/analisis', () =>
  import('../__mocks__/serverActions')
)
vi.mock('@/features/analisis/controllers/xm', () => import('../__mocks__/serverActions'))

import { DashboardShell } from '@/shared/views/DashboardShell'
import { AnalisisView } from '../AnalisisView'
import { edificacionUnicaDemo } from '../__fixtures__/analisis'

const VIEWPORTS = [
  { nombre: 'móvil 375', width: 375, height: 812 },
  { nombre: 'tablet 768', width: 768, height: 1024 },
  { nombre: 'desktop 1280', width: 1280, height: 800 },
]

async function ajustarViewport(width: number, height: number) {
  await page.viewport(width, height)
  await vi.waitFor(
    () => {
      expect(window.innerWidth).toBeLessThanOrEqual(width)
    },
    { timeout: 5000 }
  )
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

/** Píxeles que el elemento desborda por la derecha (0 = cabe). */
function desborde(el: Element): number {
  return el.scrollWidth - el.clientWidth
}

function desbordeDocumento(): number {
  return desborde(document.documentElement)
}

function botonesVisibles(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(
    (b) => b.offsetParent !== null
  )
}

function textoDe(b: HTMLButtonElement): string {
  return (b.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Navega a la sección «nombre» del módulo: por el sidebar lateral si existe
 * (≥ lg, header arriba) o por el burger + cajón móvil por debajo — igual que
 * `irASecionDatos` del test compartido.
 */
async function irASecionAnalisis(nombre: string, textoEsperado: string): Promise<void> {
  const aside = document.querySelector<HTMLElement>(
    'aside[aria-label="Menú lateral del módulo de análisis"]'
  )
  // El aside es `position: fixed` (su offsetParent es null): se decide por display.
  const lateralVisible = aside ? getComputedStyle(aside).display !== 'none' : false

  if (lateralVisible) {
    const item = botonesVisibles().find((b) => b.title === nombre)
    expect(item, `item del menú lateral "${nombre}"`).toBeTruthy()
    ;(item as HTMLButtonElement).click()
  } else {
    const burger = document.querySelector<HTMLButtonElement>('button[aria-controls="nav-movil"]')
    expect(burger, 'burger de navegación móvil').toBeTruthy()
    ;(burger as HTMLButtonElement).click()
    await vi.waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    })
    const fila = botonesVisibles().find((b) => textoDe(b) === nombre.toLowerCase())
    expect(fila, `fila del cajón "${nombre}"`).toBeTruthy()
    if (window.innerWidth < 1024) {
      expect(
        fila!.getBoundingClientRect().height,
        `target táctil de la fila "${nombre}"`
      ).toBeGreaterThanOrEqual(39.5)
    }
    ;(fila as HTMLButtonElement).click()
    // Cambiar de sección no toca la ruta: el cajón se cierra solo.
    await vi.waitFor(() => {
      expect(
        document.querySelector('[role="dialog"]'),
        `el cajón se cierra al elegir "${nombre}"`
      ).toBeNull()
    })
  }

  const esperado = textoEsperado.toLowerCase()
  await vi.waitFor(() => {
    expect(
      document.body.innerText.replace(/\s+/g, ' ').toLowerCase(),
      `"${textoEsperado}" visible tras ir a ${nombre}`
    ).toContain(esperado)
  })
}

describe('AnalisisView — desborde horizontal', () => {
  beforeEach(() => cleanup())
  afterEach(() => cleanup())

  describe.each(VIEWPORTS)('$nombre', ({ width, height }) => {
    beforeEach(async () => {
      await ajustarViewport(width, height)
    })

    it('estado inicial: el documento no desborda y los targets miden ≥ 40px', async () => {
      render(
        <DashboardShell role="GESTOR_ENERGETICO">
          <AnalisisView edificaciones={edificacionUnicaDemo} puedeAnalizar />
        </DashboardShell>
      )

      const boton = await vi.waitFor(() => {
        const el = document.querySelector<HTMLButtonElement>(
          'button.ui-btn-primary'
        )
        expect(el).not.toBeNull()
        return el as HTMLButtonElement
      })
      expect(boton.textContent).toMatch(/ejecutar análisis/i)

      const selector = document.querySelector<HTMLButtonElement>(
        '#analisis-edificacion'
      )
      expect(selector).not.toBeNull()

      if (width < 1024) {
        expect(boton.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
        expect(selector!.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
      }
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    it('con resultados: se navega por secciones y la tabla scrollea sin desbordar', async () => {
      render(
        <DashboardShell role="GESTOR_ENERGETICO">
          <AnalisisView edificaciones={edificacionUnicaDemo} puedeAnalizar />
        </DashboardShell>
      )

      const boton = await vi.waitFor(() => {
        const el = document.querySelector<HTMLButtonElement>('button.ui-btn-primary')
        expect(el).not.toBeNull()
        return el as HTMLButtonElement
      })
      boton.click()

      const heading = await vi.waitFor(
        () => {
          const el = document.querySelector('h2')
          expect(el).not.toBeNull()
          return el as HTMLElement
        },
        { timeout: 5000 }
      )
      expect(heading.textContent).toBe('Campus Robledo')

      // Los controles nuevos (Configuración del análisis + Simulador de
      // umbral) son interactivos: ≥ 40px por debajo de lg, como todo lo demás.
      const controlesNuevos = [
        '#analisis-periodicidad',
        '#analisis-modelo',
        '#analisis-nivel',
        '#sim-pct',
        '#sim-k',
      ]
      for (const sel of controlesNuevos) {
        const el = document.querySelector<HTMLElement>(sel)
        expect(el, `control ${sel} presente tras ejecutar`).not.toBeNull()
        if (width < 1024) {
          expect(
            el!.getBoundingClientRect().height,
            `target táctil de ${sel}`
          ).toBeGreaterThanOrEqual(39.5)
        }
      }
      const casilla = document.querySelector<HTMLInputElement>('#sim-activo')
      expect(casilla, 'toggle del simulador').not.toBeNull()
      if (width < 1024) {
        // El target real es la etiqueta envolvente (el input es size-4).
        const etiqueta = casilla!.closest('label')
        expect(etiqueta, 'etiqueta del toggle').not.toBeNull()
        expect(
          etiqueta!.getBoundingClientRect().height,
          'target táctil del toggle del simulador'
        ).toBeGreaterThanOrEqual(39.5)
      }

      // El sidebar del módulo existe desde lg con sus 4 secciones; por
      // debajo la navegación vive en el cajón (irASecionAnalisis).
      const aside = document.querySelector<HTMLElement>(
        'aside[aria-label="Menú lateral del módulo de análisis"]'
      )
      expect(aside).not.toBeNull()
      const lateralVisible = getComputedStyle(aside as Element).display !== 'none'
      if (lateralVisible) {
        // Los items del árbol llevan la clase `datos-row`; el resto del aside
        // es el botón de contraer/expandir.
        const items = Array.from(
          (aside as HTMLElement).querySelectorAll<HTMLButtonElement>('button.datos-row')
        )
        expect(items.map((b) => b.title)).toEqual([
          'Resumen',
          'Comparativo',
          'Patrones de consumo',
          'Ahorros',
        ])
      }

      // La gráfica SVG (Resumen) cabe en su contenedor
      const svg = document.querySelector<SVGSVGElement>('figure svg')
      expect(svg).not.toBeNull()
      expect(svg!.getBoundingClientRect().right).toBeLessThanOrEqual(
        window.innerWidth + 1
      )

      // La tabla de períodos inusuales vive en la sección Patrones: se
      // navega a ella y verifica su shell scrolleable.
      await irASecionAnalisis('Patrones de consumo', 'Períodos inusuales')

      const tabla = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>('.ui-table-shell table')
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      const shell = tabla.parentElement
      expect(shell).not.toBeNull()
      expect(['auto', 'scroll']).toContain(getComputedStyle(shell as Element).overflowX)

      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })
  })
})
