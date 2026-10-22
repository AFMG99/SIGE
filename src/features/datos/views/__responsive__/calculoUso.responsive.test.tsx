/**
 * Tests responsivos de la sección «Cálculo de uso» (T5).
 *
 * Mismo contrato que `alertas.responsive.test.tsx`: renderiza la vista real,
 * cambia el viewport (320 / 375 / 768 / 1024 / 1280 / 1920) y verifica que ni
 * el documento ni sus contenedores desborden horizontalmente, que las tablas
 * scrollean en su shell y que los targets táctiles midan ≥ 40px por debajo de
 * `lg`. Una aserción que falla NO se arregla bajando el umbral: describe una
 * vista aún no responsiva.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'

import '@/app/globals.css'

// Las server actions importan Prisma (irrepetibles fuera de Next): se apunta
// al doble determinista que ya usa Storybook. El import va inline porque
// `vi.mock` se eleva por encima del archivo.
vi.mock('@/features/datos/controllers/calculoUso', () =>
  import('../__mocks__/serverActions')
)

import { ToastProvider } from '@/shared/views/ui/ToastProvider'
import { CalculoUso } from '../CalculoUso'
import { edificacionesCalculoDemo } from '../__fixtures__/calculoUso'

const VIEWPORTS = [
  { nombre: 'móvil 320', width: 320, height: 812 },
  { nombre: 'móvil 375', width: 375, height: 812 },
  { nombre: 'tablet 768', width: 768, height: 1024 },
  { nombre: 'desktop 1024', width: 1024, height: 800 },
  { nombre: 'desktop 1280', width: 1280, height: 800 },
  { nombre: 'desktop 1920', width: 1920, height: 1080 },
]

const ANO_PREVIO = new Date().getFullYear() - 1

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
      <CalculoUso edificaciones={edificacionesCalculoDemo} puedeCargar />
    </ToastProvider>
  )
}

/** Botón visible por su texto, dentro de un contenedor. */
function botonCon(contenedor: ParentNode, texto: string): HTMLButtonElement {
  const boton = Array.from(contenedor.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
    (b.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase().includes(texto.toLowerCase())
  )
  expect(boton, `botón "${texto}"`).toBeTruthy()
  return boton as HTMLButtonElement
}

/** Abre el ListboxSelect y elige la opción por su `data-value` (panel en portal). */
async function elegirEdificacion(valor: string) {
  const trigger = document.querySelector<HTMLButtonElement>('#calculo-uso-edificacion')
  expect(trigger, 'disparador de edificación').not.toBeNull()
  trigger!.click()
  const opcion = await vi.waitFor(() => {
    const el = document.querySelector<HTMLElement>(`[role="option"][data-value="${valor}"]`)
    expect(el, `opción ${valor}`).not.toBeNull()
    return el as HTMLElement
  })
  opcion.click()
}

/** Fija un `<select>` nativo controlado por su id. */
function elegirSelect(id: string, valor: string) {
  const select = document.querySelector<HTMLSelectElement>(`#${id}`)
  expect(select, `select #${id}`).not.toBeNull()
  select!.value = valor
  select!.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('CalculoUso — desborde horizontal y targets táctiles', () => {
  beforeEach(() => cleanup())
  afterEach(() => cleanup())

  describe.each(VIEWPORTS)('$nombre', ({ width, height }) => {
    beforeEach(async () => {
      await ajustarViewport(width, height)
    })

    it('estado vacío y selectores: sin desborde y targets ≥ 40px bajo lg', async () => {
      renderVista()

      const encabezado = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>('h2')
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      expect(encabezado.textContent).toContain('Cálculo de uso')

      const trigger = document.querySelector<HTMLButtonElement>('#calculo-uso-edificacion')
      expect(trigger, 'selector de edificación').not.toBeNull()
      expect(document.body.innerText).toContain(
        'Seleccione una edificación para calcular las horas de uso.'
      )

      if (width < 1024) {
        expect(trigger!.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
      }

      // Con edificación aparecen ambos flujos con sus botones.
      await elegirEdificacion('ed-campus-00000001')
      const calclar = await vi.waitFor(() => {
        const el = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
          (b.textContent ?? '').includes('Calcular')
        )
        expect(el, 'botón Calcular').not.toBeNull()
        return el as HTMLButtonElement
      })
      const vistaPrevia = botonCon(document, 'Vista previa')

      if (width < 1024) {
        expect(calclar.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
        expect(vistaPrevia.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
        for (const id of ['calculo-uso-mes', 'calculo-uso-ano', 'calculo-uso-mes-inicial']) {
          const select = document.querySelector<HTMLElement>(`#${id}`)
          expect(select, `select #${id}`).not.toBeNull()
          expect(select!.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
        }
      }

      expect(desborde(document.documentElement)).toBeLessThanOrEqual(1)
    })

    it('individual y vista previa: tablas en su shell scrolleable, sin desborde', async () => {
      renderVista()

      await vi.waitFor(() => {
        expect(document.querySelector('#calculo-uso-edificacion')).not.toBeNull()
      })
      await elegirEdificacion('ed-campus-00000001')

      // Cálculo individual de marzo: aparecen las cuatro tablas de trazabilidad.
      elegirSelect('calculo-uso-mes', '3')
      botonCon(document, 'Calcular').click()
      await vi.waitFor(() => {
        expect(document.body.innerText).toContain('eq-campus-hvac-01')
      })
      expect(document.body.innerText).toContain('Sin horario vigente')

      // Vista previa de seis meses (enero–junio del año previo).
      elegirSelect('calculo-uso-mes-inicial', '1')
      elegirSelect('calculo-uso-ano-inicial', String(ANO_PREVIO))
      elegirSelect('calculo-uso-mes-final', '6')
      elegirSelect('calculo-uso-ano-final', String(ANO_PREVIO))
      botonCon(document, 'Vista previa').click()
      await vi.waitFor(() => {
        expect(document.body.innerText).toContain('Meses en el intervalo: 6')
      })
      expect(document.body.innerText).toContain('Resultados existentes: 1')

      // Toda tabla vive en su shell scrolleable; ninguna empuja el documento.
      const shells = document.querySelectorAll<HTMLElement>('.ui-table-shell')
      expect(shells.length).toBeGreaterThan(0)
      for (const shell of Array.from(shells)) {
        expect(shell.querySelector('table'), 'tabla dentro del shell').not.toBeNull()
        expect(['auto', 'scroll']).toContain(getComputedStyle(shell).overflowX)
      }

      expect(desborde(document.documentElement)).toBeLessThanOrEqual(1)
    })

    it('ejecución masiva: CTA, progreso, resumen y acciones ≥40px bajo lg, sin desborde', async () => {
      renderVista()

      await vi.waitFor(() => {
        expect(document.querySelector('#calculo-uso-edificacion')).not.toBeNull()
      })
      await elegirEdificacion('ed-campus-00000001')

      // Vista previa de enero–junio del año previo (5 pendientes de 6).
      elegirSelect('calculo-uso-mes-inicial', '1')
      elegirSelect('calculo-uso-ano-inicial', String(ANO_PREVIO))
      elegirSelect('calculo-uso-mes-final', '6')
      elegirSelect('calculo-uso-ano-final', String(ANO_PREVIO))
      botonCon(document, 'Vista previa').click()
      await vi.waitFor(() => {
        expect(document.body.innerText).toContain('Periodos pendientes: 5')
      })

      // CTA del lote con su recuento de pendientes.
      const cta = botonCon(document, 'Ejecutar cálculo masivo')
      expect(cta.disabled).toBe(false)
      if (width < 1024) {
        expect(cta.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
      }

      cta.click()

      // Durante la corrida: periodo en curso, barra de progreso y Detener.
      // Todo se mide DENTRO del `waitFor`: el bloque de progreso solo existe
      // mientras corre el lote, y medirlo tras terminar sería un nodo suelto.
      await vi.waitFor(
        () => {
          const b = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
            (el) => (el.textContent ?? '').includes('Detener')
          )
          expect(b, 'botón Detener durante el lote').not.toBeNull()
          expect(document.body.innerText).toMatch(/Procesando \d{4}-\d{2}…/)
          expect(document.querySelector('[role="progressbar"]')).not.toBeNull()
          if (width < 1024) {
            expect(b!.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
          }
        },
        { timeout: 2000 }
      )

      // Resumen final con las cuatro cubetas + fila fallida accionable.
      await vi.waitFor(
        () => {
          expect(document.body.innerText).toContain('Resumen de la ejecución')
        },
        { timeout: 4000 }
      )
      expect(document.body.innerText).toContain('Calculados: 3')
      expect(document.body.innerText).toContain('Conservados: 1')
      expect(document.body.innerText).toContain('Fallidos: 1')
      expect(document.body.innerText).toContain('Pendientes de revisión: 1')

      const reintentar = botonCon(document, 'Reintentar')
      if (width < 1024) {
        expect(reintentar.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
      }

      expect(desborde(document.documentElement)).toBeLessThanOrEqual(1)
    })
  })
})
