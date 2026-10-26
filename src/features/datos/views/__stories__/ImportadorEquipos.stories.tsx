import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { crearBloque, eliminarBloque } from '@/features/datos/controllers/edificaciones'
import { ImportadorEquipos } from '../ImportadorEquipos'
import {
  bloquesDemo,
  calendariosDemo,
  edificacionesDemo,
  espaciosDemo,
  horariosEquipoDemo,
  rangosCalendarioDemo,
} from '../__fixtures__/catalogo'
import { EDIFICACION_CAMPUS } from '../__fixtures__/calculoUso'
import { resultadoEquiposDemo } from '../__fixtures__/resultado'
import { archivoEquipos, elegirListbox, opcionesListbox, subirArchivo } from './ayuda'

const meta = {
  component: ImportadorEquipos,
  tags: ['ai-generated'],
  args: {
    puedeCargar: true,
    edificaciones: edificacionesDemo,
    bloques: bloquesDemo,
    espacios: espaciosDemo,
    crearBloque,
    eliminarBloque,
    onIrAlCatalogo: () => {},
    // Contexto de calendario (6d4): config operativa + rangos + horarios del campus.
    calendarios: calendariosDemo,
    rangos: rangosCalendarioDemo,
    horarios: horariosEquipoDemo,
  },
} satisfies Meta<typeof ImportadorEquipos>

export default meta
type Story = StoryObj<typeof meta>

/**
 * El asistente exige elegir la edificación antes de leer cualquier archivo.
 * El catálogo de edificaciones vive en Facturas de energía › Edificaciones: aquí
 * solo se hereda la lista.
 */
async function elegirEdificacion(
  canvas: { findByLabelText: (m: RegExp, o?: object) => Promise<HTMLElement> },
  userEvent: { click: (el: HTMLElement) => Promise<unknown> }
): Promise<void> {
  const trigger = await canvas.findByLabelText(/^edificación/i)
  await elegirListbox(trigger, 'ed-campus-00000001', userEvent)
}

export const Paso1Carga: Story = {
  name: 'Paso 1 · Edificación y carga',
}

export const Paso2Mapeo: Story = {
  name: 'Paso 2 · Mapeo por segmentación',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoEquipos())

    await expect(
      await canvas.findByRole('button', { name: /continuar a vista previa/i }, { timeout: 5000 })
    ).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /descargar plantilla/i })).toBeNull()
  },
}

export const Paso3VistaPrevia: Story = {
  name: 'Paso 3 · Vista previa por espacio',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoEquipos())

    const continuar = await canvas.findByRole(
      'button',
      { name: /continuar a vista previa/i },
      { timeout: 5000 }
    )
    await userEvent.click(continuar)

    await expect(await canvas.findByText(/listo para importar/i)).toBeVisible()
    // La vista previa deja de importar directo: el flujo pasa por cálculos opcionales.
    await expect(
      canvas.getByRole('button', { name: /continuar a cálculos opcionales/i })
    ).toBeVisible()
  },
}

/**
 * Valor numérico de una `.ui-stat` del paso de cálculo: la etiqueta es el
 * segundo `<p>` de la tarjeta y el número el primero.
 */
async function valorDeStat(
  canvas: { findByText: (m: string, o?: object, w?: object) => Promise<HTMLElement> },
  etiqueta: string
): Promise<string> {
  const etiquetaEl = await canvas.findByText(etiqueta)
  const tarjeta = etiquetaEl.closest('.ui-stat')
  const valor = tarjeta?.querySelector('p')
  return valor?.textContent?.trim() ?? ''
}

export const Paso4Calculos: Story = {
  name: 'Paso 4 · Cálculo de uso: vista previa y ejecución (6d4)',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoEquipos())

    const continuar = await canvas.findByRole(
      'button',
      { name: /continuar a vista previa/i },
      { timeout: 5000 }
    )
    await userEvent.click(continuar)
    await userEvent.click(
      await canvas.findByRole(
        'button',
        { name: /continuar a cálculos opcionales/i },
        { timeout: 5000 }
      )
    )

    // Intervalo enero–junio: el doble determinista reparte las seis
    // clasificaciones BR4 del campus (1 intacto + 5 pendientes).
    await userEvent.selectOptions(canvas.getByLabelText(/^mes inicial$/i), '1')
    await userEvent.selectOptions(canvas.getByLabelText(/^mes final$/i), '6')

    await userEvent.click(await canvas.findByRole('button', { name: /revisar periodos/i }))

    // Vista previa de solo lectura (modo «solo-vacios» por defecto): el
    // periodo intacto no se reescribe.
    await expect(await canvas.findByText(/resultados existentes: 1/i)).toBeVisible()
    await expect(await canvas.findByText(/periodos pendientes: 5/i)).toBeVisible()
    await expect(await canvas.findByText(/se calcularán ahora: 5/i)).toBeVisible()

    await userEvent.click(
      await canvas.findByRole('button', { name: /ejecutar cálculo \(5 periodos\)/i })
    )

    // Ejecución por lotes (2 llamadas del doble) → resumen final.
    await expect(
      await canvas.findByText('Resultado del cálculo', {}, { timeout: 5000 })
    ).toBeVisible()
    expect(await valorDeStat(canvas, 'Calculados')).toBe('3')
    expect(await valorDeStat(canvas, 'Conservados')).toBe('1')
    expect(await valorDeStat(canvas, 'Fallidos')).toBe('1')
    expect(await valorDeStat(canvas, 'En revisión')).toBe('1')
  },
}

export const ModoCalculoUso: Story = {
  name: 'Paso 4 · «Solo vacíos» excluye intactos, «reemplazar» los incluye',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoEquipos())

    const continuar = await canvas.findByRole(
      'button',
      { name: /continuar a vista previa/i },
      { timeout: 5000 }
    )
    await userEvent.click(continuar)
    await userEvent.click(
      await canvas.findByRole(
        'button',
        { name: /continuar a cálculos opcionales/i },
        { timeout: 5000 }
      )
    )

    await userEvent.selectOptions(canvas.getByLabelText(/^mes inicial$/i), '1')
    await userEvent.selectOptions(canvas.getByLabelText(/^mes final$/i), '6')

    // Modo por defecto: el periodo existente intacto queda fuera de la escritura.
    await userEvent.click(await canvas.findByRole('button', { name: /revisar periodos/i }))
    await expect(await canvas.findByText(/se calcularán ahora: 5/i)).toBeVisible()

    // «Reemplazar existentes» incluye también el intacto.
    await userEvent.selectOptions(canvas.getByLabelText(/^modo$/i), 'reemplazar')
    await userEvent.click(await canvas.findByRole('button', { name: /revisar periodos/i }))
    await expect(await canvas.findByText(/se calcularán ahora: 6/i)).toBeVisible()
  },
}

export const Paso5Resultado: Story = {
  name: 'Paso 5 · Resultado de la importación',
  args: { resultadoInicial: resultadoEquiposDemo, edificacionInicial: EDIFICACION_CAMPUS },
}

export const ImportacionExitosa: Story = {
  name: 'Flujo completo · Edificación → cálculos opcionales → resultado',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoEquipos())

    const continuar = await canvas.findByRole(
      'button',
      { name: /continuar a vista previa/i },
      { timeout: 5000 }
    )
    await userEvent.click(continuar)

    // Vista previa navega al paso de cálculos (obligatorio pasar por él).
    const aCalculos = await canvas.findByRole(
      'button',
      { name: /continuar a cálculos opcionales/i },
      { timeout: 5000 }
    )
    await userEvent.click(aCalculos)

    // El cálculo es opcional: se puede saltar directo a la importación.
    const aImportacion = await canvas.findByRole(
      'button',
      { name: /continuar a importación/i },
      { timeout: 5000 }
    )
    await userEvent.click(aImportacion)

    const importar = await canvas.findByRole(
      'button',
      { name: /importar \d+ filas/i },
      { timeout: 5000 }
    )
    await userEvent.click(importar)

    // La barra de progreso avanza con un setInterval antes de mostrar el resultado.
    await expect(
      await canvas.findByText('Importación finalizada', {}, { timeout: 10000 })
    ).toBeVisible()
  },
}

export const EliminarBloqueConDatos: Story = {
  name: 'Catálogo · bloqueo al eliminar un bloque con datos',
  play: async ({ canvas, canvasElement, userEvent }) => {
    // El ConfirmDialog se monta vía createPortal en document.body.
    const screen = within(canvasElement.ownerDocument.body)

    const selectEdificacion = await canvas.findByLabelText(/^edificación/i)
    await elegirListbox(selectEdificacion, 'ed-campus-00000001', userEvent)
    const selectBloque = await canvas.findByLabelText(/bloque \/ piso/i)
    await elegirListbox(selectBloque, 'bk-campus-a102-001', userEvent)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar bloque A-102' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))

    const alerta = await screen.findByRole('alert')
    await waitFor(
      () => {
        expect(alerta.textContent ?? '').toContain(
          'No se puede eliminar el bloque "A-102 — Ala Sur"'
        )
      },
      { timeout: 3000 }
    )
    // El bloque sigue en el catálogo: nada se borró en cascada.
    const bloqueTras = await canvas.findByLabelText(/bloque \/ piso/i)
    const opciones = await opcionesListbox(bloqueTras, userEvent)
    expect(opciones.some((nombre) => /A-102 — Ala Sur/.test(nombre))).toBe(true)
  },
}

export const SoloLectura: Story = {
  name: 'Rol sin permiso de carga',
  args: { puedeCargar: false },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/solo lectura/i)).toBeVisible()
  },
}

// La jerarquía de horarios (espacio > bloque > edificación) y el modo
// «reemplazar/solo-vacios» ahora se prueban en el paso «Cálculos opcionales»
// (Paso4Calculos y ModoCalculoUso); la precedencia por nivel vive en los tests
// unitarios de models/horarios.test.ts y models/calculoUso.test.ts.
