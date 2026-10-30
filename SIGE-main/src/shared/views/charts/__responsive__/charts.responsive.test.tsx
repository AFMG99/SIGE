/**
 * Gráficos compartidos (T1) — responsive.
 *
 * Contracts protected here:
 *  1. No horizontal overflow a 320 / 375 / 768 / 1024 / 1280 / 1920 con los
 *     tres gráficos en la misma grilla que usará el dashboard.
 *  2. Targets táctiles: los botones de leyenda (interactivos) miden ≥ 40px
 *     por debajo de `lg`.
 *  3. El SVG escala al ancho de su contenedor (viewBox + w-full) sin
 *     desbordarlo.
 *  4. Sin datos se rinde un estado vacío legible, nunca cifras inventadas.
 *
 * A failing assertion is never fixed by lowering a threshold.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'

import '@/app/globals.css'

import { BarList } from '../BarList'
import { SeriesChart } from '../SeriesChart'
import { Sparkline } from '../Sparkline'
import {
  BARRAS_EDIFICACION,
  CONSUMO_12M,
  ETIQUETAS_12M,
  LINEA_BASE_12M,
  SERIE_PLANES_24M,
} from '../__fixtures__/charts.fixtures'

/** Réplica de la grilla del dashboard: chart (2/3) + barras (1/3) + KPI. */
function GraficasDemo() {
  return (
    <main className="ui-panel space-y-6 p-4">
      <section className="ui-card-stat flex items-center justify-between gap-3 p-4">
        <div>
          <p className="ui-label">Consumo último mes</p>
          <p className="ui-stat tabular-nums">45.800 kWh</p>
        </div>
        <Sparkline valores={SERIE_PLANES_24M.slice(-12)} />
      </section>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="ui-card p-4 lg:col-span-2">
          <SeriesChart
            titulo="Consumo mensual contra línea base"
            etiquetas={ETIQUETAS_12M}
            series={[
              { clave: 'real', nombre: 'Consumo real', valores: CONSUMO_12M, tipo: 'area' },
              { clave: 'lb', nombre: 'Línea base', valores: LINEA_BASE_12M, tipo: 'linea' },
            ]}
          />
        </section>
        <section className="ui-card p-4">
          <BarList
            titulo="Consumo por edificación"
            datos={BARRAS_EDIFICACION.map((b) => ({
              ...b,
              textoValor: `${new Intl.NumberFormat('es-CO').format(b.valor)} kWh`,
            }))}
          />
        </section>
      </div>
    </main>
  )
}

async function present(selector: string): Promise<HTMLElement> {
  return vi.waitFor(
    () => {
      const el = document.querySelector<HTMLElement>(selector)
      expect(el, `expected element ${selector}`).not.toBeNull()
      return el as HTMLElement
    },
    { timeout: 5000 }
  )
}

function horizontalOverflow(): number {
  const root = document.documentElement
  return root.scrollWidth - root.clientWidth
}

async function setViewport(width: number, height: number) {
  await page.viewport(width, height)
  await vi.waitFor(
    () => {
      expect(window.innerWidth).toBeLessThanOrEqual(width)
    },
    { timeout: 5000 }
  )
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

beforeEach(async () => {
  cleanup()
  await setViewport(1280, 800)
})
afterEach(() => cleanup())

describe('Charts compartidos — estructura', () => {
  it('renderiza las dos series, la leyenda interactiva y el BarList con meters', async () => {
    render(<GraficasDemo />)
    const leyenda = await present('figure[aria-label="Consumo mensual contra línea base"] button')
    expect(leyenda.getAttribute('aria-pressed')).toBe('true')

    const svg = await present('figure svg[viewBox^="0 0 720"]')
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0)

    const meters = document.querySelectorAll('[role="meter"]')
    expect(meters.length).toBe(BARRAS_EDIFICACION.length)
  })

  it('sin datos, el chart rinde el estado vacío (nada inventado)', async () => {
    render(
      <main>
        <SeriesChart
          titulo="Serie vacía"
          etiquetas={ETIQUETAS_12M}
          series={[{ clave: 'x', nombre: 'Consumo', valores: [] }]}
          sinDatos="Registra facturas para ver el histórico"
        />
      </main>
    )
    const vacio = await present('.ui-empty')
    expect(vacio.innerText).toContain('Registra facturas para ver el histórico')
    expect(document.querySelector('figure svg')).toBeNull()
  })
})

describe('Charts compartidos — responsive', () => {
  const VIEWPORTS = [
    { nombre: 'xs 320', width: 320, height: 568 },
    { nombre: 'móvil 375', width: 375, height: 812 },
    { nombre: 'tablet 768', width: 768, height: 1024 },
    { nombre: 'laptop 1024', width: 1024, height: 768 },
    { nombre: 'desktop 1280', width: 1280, height: 800 },
    { nombre: 'ancho 1920', width: 1920, height: 1080 },
  ]

  describe.each(VIEWPORTS)('$nombre', ({ width, height }) => {
    beforeEach(async () => {
      await setViewport(width, height)
    })

    it('el documento no desborda horizontalmente', async () => {
      render(<GraficasDemo />)
      await present('figure')
      expect(horizontalOverflow()).toBeLessThanOrEqual(1)
    })

    it('el SVG del chart escala dentro de su contenedor', async () => {
      render(<GraficasDemo />)
      // El viewBox identifica al gráfico (los swatches de leyenda también son svg)
      const contenedor = await present('figure svg[viewBox^="0 0 720"]')
      const svgRect = contenedor.getBoundingClientRect()
      const padreRect = contenedor.parentElement!.getBoundingClientRect()
      expect(svgRect.width).toBeGreaterThan(100)
      expect(svgRect.width).toBeLessThanOrEqual(padreRect.width + 1)
    })

    it.skipIf(width >= 1024)('los botones de leyenda miden ≥ 40px (t táctil)', async () => {
      render(<GraficasDemo />)
      await present('figure button')
      const botones = Array.from(document.querySelectorAll<HTMLElement>('figure button'))
      expect(botones.length).toBeGreaterThan(0)
      for (const boton of botones) {
        expect(boton.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
      }
    })
  })
})
