/**
 * Tests responsivos del Módulo 3 — Análisis estadístico.
 *
 * Mismo contrato que `shared/views/__responsive__/overflow.responsive.test.tsx`:
 * renderiza la vista real en navegador, cambia el viewport (matriz 375 /
 * 768 / 1280) y verifica que ni el documento ni sus contenedores desborden
 * horizontalmente, que la tabla scrollee en su shell y que los targets
 * táctiles midan ≥ 40px por debajo de `lg`. Una aserción que falla NO se
 * arregla bajando el umbral: describe una vista aún no responsiva.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'

import '@/app/globals.css'

// La server action importa Prisma y spawnea Python (irrepetibles fuera de
// Next): se apunta al doble determinista que ya usa Storybook. El import va
// inline porque `vi.mock` se eleva por encima del archivo.
vi.mock('@/features/analisis/controllers/analisis', () =>
  import('../__mocks__/serverActions')
)
vi.mock('@/features/analisis/controllers/xm', () => import('../__mocks__/serverActions'))

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

describe('AnalisisView — desborde horizontal', () => {
  beforeEach(() => cleanup())
  afterEach(() => cleanup())

  describe.each(VIEWPORTS)('$nombre', ({ width, height }) => {
    beforeEach(async () => {
      await ajustarViewport(width, height)
    })

    it('estado inicial: el documento no desborda y los targets miden ≥ 40px', async () => {
      render(<AnalisisView edificaciones={edificacionUnicaDemo} puedeAnalizar />)

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

    it('con resultados: la tabla scrollea en su shell y nada desborda', async () => {
      render(<AnalisisView edificaciones={edificacionUnicaDemo} puedeAnalizar />)

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

      // La gráfica SVG cabe en su contenedor
      const svg = document.querySelector<SVGSVGElement>('figure svg')
      expect(svg).not.toBeNull()
      expect(svg!.getBoundingClientRect().right).toBeLessThanOrEqual(
        window.innerWidth + 1
      )

      // La tabla de períodos inusuales vive en un shell scrolleable
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
