import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'

import '@/app/globals.css'

vi.mock('@/features/reportes/controllers/reportesController', () =>
  import('../__mocks__/serverActions')
)

import { ReportesView } from '../ReportesView'
import {
  BLOQUES_FIXTURE,
  DATOS_REPORTE_FIXTURE,
  EDIFICACIONES_FIXTURE,
} from '../__fixtures__/reportes.fixtures'

const VIEWPORTS = [
  { nombre: '320', width: 320, height: 780 },
  { nombre: '375', width: 375, height: 812 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1024', width: 1024, height: 800 },
  { nombre: '1280', width: 1280, height: 800 },
  { nombre: '1920', width: 1920, height: 1080 },
]

async function ajustarViewport(width: number, height: number) {
  await page.viewport(width, height)
  await vi.waitFor(() => {
    expect(window.innerWidth).toBeLessThanOrEqual(width)
  })
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

function medirDesbordamiento(el: Element): number {
  return el.scrollWidth - el.clientWidth
}

afterEach(() => cleanup())

describe('ReportesView responsive', () => {
  it('no desborda y mantiene controles táctiles de al menos 40px bajo lg', async () => {
    render(
      <ReportesView
        edificaciones={EDIFICACIONES_FIXTURE}
        bloques={BLOQUES_FIXTURE}
        datosIniciales={DATOS_REPORTE_FIXTURE}
        puedeGenerar
        puedeDescargar
      />
    )

    for (const viewport of VIEWPORTS) {
      await ajustarViewport(viewport.width, viewport.height)
      expect(
        medirDesbordamiento(document.documentElement),
        `documento ${viewport.nombre}`
      ).toBeLessThanOrEqual(1)

      const controles = Array.from(
        document.querySelectorAll<HTMLElement>('button, select')
      ).filter((control) => control.offsetParent !== null)

      if (viewport.width < 1024) {
        for (const control of controles) {
          expect(
            control.getBoundingClientRect().height,
            `${control.tagName.toLowerCase()} (${control.textContent?.trim().slice(0, 20)}) mide al menos 40px en ${viewport.nombre}px`
          ).toBeGreaterThanOrEqual(40)
        }
      }

      expect(
        medirDesbordamiento(document.documentElement),
        `resultado ${viewport.nombre}`
      ).toBeLessThanOrEqual(1)
    }
  })
})
