import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'

import '@/app/globals.css'

vi.mock('@/features/estimaciones/controllers/forecast', () =>
  import('../__mocks__/serverActions')
)

import { EstimacionesView } from '../EstimacionesView'
import {
  bloquesDemo,
  edificacionesDemo,
} from '../__fixtures__/forecast'

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

describe('EstimacionesView responsive', () => {
  it('no desborda y mantiene controles táctiles de 40px bajo lg', async () => {
    render(
      <EstimacionesView
        edificaciones={[edificacionesDemo[0]]}
        bloques={bloquesDemo}
        puedeEjecutar
        puedeCrearOrden
        puedeDiagnosticar
      />
    )

    for (const viewport of VIEWPORTS) {
      await ajustarViewport(viewport.width, viewport.height)
      expect(medirDesbordamiento(document.documentElement), `documento ${viewport.nombre}`)
        .toBeLessThanOrEqual(1)

      if (viewport.width === 320) {
        const ordenManual = document.querySelector<HTMLInputElement>(
          'input[type="checkbox"]'
        )
        expect(ordenManual).not.toBeNull()
        ordenManual?.click()
        await vi.waitFor(() => {
          expect(document.querySelectorAll('input[type="number"]')).toHaveLength(3)
        })
      }

      const controles = Array.from(
        document.querySelectorAll<HTMLElement>('button, select, input[type="number"]')
      ).filter((control) => control.offsetParent !== null)
      if (viewport.width < 1024) {
        for (const control of controles) {
          expect(
            control.getBoundingClientRect().height,
            `${control.tagName.toLowerCase()} mide al menos 40px en ${viewport.nombre}px`
          ).toBeGreaterThanOrEqual(40)
        }
        const etiquetaOrden = document.querySelector<HTMLElement>(
          'label:has(input[type="checkbox"])'
        )
        expect(etiquetaOrden?.getBoundingClientRect().height).toBeGreaterThanOrEqual(40)
      }

      if (viewport.width === 320) {
        const boton = document.querySelector<HTMLButtonElement>(
          'button[type="submit"]'
        )
        expect(boton).not.toBeNull()
        boton?.click()
        await vi.waitFor(() => {
          expect(document.querySelector('svg[role="img"]')).not.toBeNull()
        })
      }

      expect(medirDesbordamiento(document.documentElement), `resultado ${viewport.nombre}`)
        .toBeLessThanOrEqual(1)
    }
  })
})
