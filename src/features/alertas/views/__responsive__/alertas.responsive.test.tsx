/**
 * Tests responsivos del Módulo 4 — Alertas de consumo inusual (HU-08).
 *
 * Mismo contrato que `analisis.responsive.test.tsx`: renderiza la vista real
 * bajo `DashboardShell` (header + navegación) en navegador, cambia el viewport
 * (375 / 768 / 1280) y verifica que ni el documento ni sus contenedores
 * desborden horizontalmente, que la tabla scrollee en su shell y que los
 * targets táctiles midan ≥ 40px por debajo de `lg`. Una aserción que falla NO
 * se arregla bajando el umbral: describe una vista aún no responsiva.
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
  usePathname: () => '/dashboard/alertas',
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
    refresh: () => {},
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// La server action importa Prisma y ejecuta el motor estadístico en Python
// (irrepetibles fuera de Next): se apunta al doble determinista que ya usa
// Storybook. El import va inline porque `vi.mock` se eleva por encima del
// archivo.
vi.mock('@/features/alertas/controllers/alertas', () =>
  import('../__mocks__/serverActions')
)

import { DashboardShell } from '@/shared/views/DashboardShell'
import { ToastProvider } from '@/shared/views/ui/ToastProvider'
import { AlertasView } from '../AlertasView'
import {
  alertasDemo,
  configsAlertasDemo,
  edificacionesAlertasDemo,
  evaluacionesAlertasDemo,
} from '../__fixtures__/alertas'

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

function renderVista() {
  return render(
    <ToastProvider>
      <DashboardShell role="GESTOR_ENERGETICO">
        <AlertasView
          edificaciones={edificacionesAlertasDemo}
          alertas={alertasDemo}
          configs={configsAlertasDemo}
          evaluaciones={evaluacionesAlertasDemo}
          puedeEvaluar
          puedeConfigurar
        />
      </DashboardShell>
    </ToastProvider>
  )
}

/** Botón visible dentro de un contenedor, por su texto. */
function botonCon(contenedor: ParentNode, texto: string): HTMLButtonElement {
  const boton = Array.from(contenedor.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
    (b.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase().includes(texto.toLowerCase())
  )
  expect(boton, `botón "${texto}"`).toBeTruthy()
  return boton as HTMLButtonElement
}

describe('AlertasView — desborde horizontal', () => {
  beforeEach(() => cleanup())
  afterEach(() => cleanup())

  describe.each(VIEWPORTS)('$nombre', ({ width, height }) => {
    beforeEach(async () => {
      await ajustarViewport(width, height)
    })

    it('bandeja y controles: sin desborde, tabla scrolleable y targets ≥ 40px', async () => {
      renderVista()

      const recalcular = await vi.waitFor(() => {
        const el = document.querySelector<HTMLButtonElement>('button.ui-btn-primary')
        expect(el).not.toBeNull()
        return el as HTMLButtonElement
      })
      expect(recalcular.textContent).toMatch(/recalcular alertas/i)

      const selector = document.querySelector<HTMLButtonElement>('#alertas-edificacion')
      expect(selector, 'selector de edificación').not.toBeNull()

      // Controles del umbral (sliders) y el toggle de generación.
      for (const sel of ['#alerta-pct', '#alerta-k']) {
        const el = document.querySelector<HTMLElement>(sel)
        expect(el, `control ${sel}`).not.toBeNull()
        if (width < 1024) {
          expect(el!.getBoundingClientRect().height, `target táctil de ${sel}`).toBeGreaterThanOrEqual(39.5)
        }
      }
      const casilla = document.querySelector<HTMLInputElement>('#alerta-pct')
      expect(casilla).not.toBeNull()

      if (width < 1024) {
        expect(recalcular.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
        expect(selector!.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
        // Las acciones de fila usan `.ui-btn-sm` (min-h-10).
        const acciones = botonCon(document.querySelector('.ui-table-shell') as ParentNode, 'Marcar leída')
        expect(acciones.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
      }

      // La tabla vive en su shell scrolleable, no empuja el documento.
      const tabla = document.querySelector<HTMLElement>('.ui-table-shell table')
      expect(tabla).not.toBeNull()
      const shell = tabla!.parentElement
      expect(shell).not.toBeNull()
      expect(['auto', 'scroll']).toContain(getComputedStyle(shell as Element).overflowX)

      // 1 fila de cabecera + 4 alertas del Campus Robledo.
      expect(document.querySelectorAll('.ui-table-shell tbody tr').length).toBe(4)

      expect(desborde(document.documentElement)).toBeLessThanOrEqual(1)
    })

    it('descartar: el diálogo cabe, sus botones son táctiles y responde el triage', async () => {
      renderVista()

      const tabla = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>('.ui-table-shell')
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      botonCon(tabla, 'Descartar').click()

      const dialogo = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>('[role="dialog"]')
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      expect(dialogo.textContent).toContain('Descartar alerta')
      // El diálogo nunca desborda el viewport.
      expect(dialogo.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth + 1)

      const confirmar = botonCon(dialogo, 'Descartar')
      const cancelar = botonCon(dialogo, 'Cancelar')
      if (width < 1024) {
        expect(confirmar.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
        expect(cancelar.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
      }
      confirmar.click()

      await vi.waitFor(() => {
        expect(document.body.innerText).toContain('descartada (simulado)')
      })
      expect(desborde(document.documentElement)).toBeLessThanOrEqual(1)
    })
  })
})
