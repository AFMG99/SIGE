import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { crearBloque, eliminarBloque } from '@/features/datos/controllers/edificaciones'
import { ImportadorVariables } from '../ImportadorVariables'
import {
  bloquesDemo,
  calendariosDemo,
  edificacionesDemo,
  horariosEquipoDemo,
  rangosCalendarioDemo,
} from '../__fixtures__/catalogo'
import { EDIFICACION_CAMPUS } from '../__fixtures__/calculoUso'
import { resultadoVariablesDemo } from '../__fixtures__/resultado'
import { archivoVariables, elegirListbox, opcionesListbox, subirArchivo } from './ayuda'

const meta = {
  component: ImportadorVariables,
  tags: ['ai-generated'],
  args: {
    puedeCargar: true,
    edificaciones: edificacionesDemo,
    bloques: bloquesDemo,
    crearBloque,
    eliminarBloque,
    onIrAlCatalogo: () => {},
    // Cálculo de la GDE (S2): configuración, rangos y horarios del campus.
    calendarios: calendariosDemo,
    rangos: rangosCalendarioDemo,
    horarios: horariosEquipoDemo,
  },
} satisfies Meta<typeof ImportadorVariables>

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

export const CalculoGde: Story = {
  name: 'Paso 4 · Cálculo de variables: días y GDE independientes (S2)',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoVariables())

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

    // Paso de cálculo con dos cálculos independientes, cada uno con su modo.
    await expect(
      await canvas.findByText('Cálculo de Variables Operativas (opcional)')
    ).toBeVisible()
    await expect(canvas.getByText('Modo: Días lectivos/laborales')).toBeVisible()
    await expect(canvas.getByText('Modo: GDE')).toBeVisible()

    // Independencia: deshabilitar días NO deshabilita la GDE.
    await userEvent.click(canvas.getByLabelText('Días lectivos/laborales'))
    await expect(canvas.queryByText('Modo: Días lectivos/laborales')).toBeNull()
    await expect(canvas.getByText('Modo: GDE')).toBeVisible()
    await userEvent.click(canvas.getByLabelText('Días lectivos/laborales'))

    await userEvent.click(await canvas.findByRole('button', { name: /revisar periodos/i }))

    // Vista previa determinista (mock): 3 combinaciones bloque×mes, 2 con
    // días vacíos y 3 con GDE; 1 sin variable operativa.
    await expect(await canvas.findByText(/Se escribirán días: 2/)).toBeVisible()
    await expect(await canvas.findByText(/Se escribirán GDE: 3/)).toBeVisible()
    await expect(
      await canvas.findByText(/1 combinaciones bloque×mes no tienen variable operativa/)
    ).toBeVisible()

    await userEvent.click(
      await canvas.findByRole('button', { name: /ejecutar cálculos \(3 periodos\)/i })
    )

    // Ejecución (único lote del mock) → resumen con ambos cálculos.
    await expect(
      await canvas.findByText('Resultado del cálculo', {}, { timeout: 5000 })
    ).toBeVisible()
    expect(await valorDeStat(canvas, 'Días calculados')).toBe('2')
    expect(await valorDeStat(canvas, 'GDE calculadas')).toBe('3')
    expect(await valorDeStat(canvas, 'GDE fallidas')).toBe('0')
  },
}

export const Paso2Mapeo: Story = {
  name: 'Paso 2 · Mapeo de las 7 columnas',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoVariables())

    await expect(
      await canvas.findByRole('button', { name: /continuar a vista previa/i }, { timeout: 5000 })
    ).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /descargar plantilla/i })).toBeNull()
  },
}

export const Paso3VistaPrevia: Story = {
  name: 'Paso 3 · Vista previa con fila inválida',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoVariables())

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
    // La última fila del CSV trae mes 13: debe aparecer marcada con error.
    await expect(await canvas.findByText('Mes inválido en la fila')).toBeVisible()
  },
}

export const Paso5Resultado: Story = {
  name: 'Paso 5 · Resultado de la importación',
  args: { resultadoInicial: resultadoVariablesDemo, edificacionInicial: EDIFICACION_CAMPUS },
}

export const EliminarBloqueConDatos: Story = {
  name: 'Catálogo · bloqueo al eliminar un bloque con datos',
  play: async ({ canvas, canvasElement, userEvent }) => {
    // El ConfirmDialog se monta vía createPortal en document.body.
    const screen = within(canvasElement.ownerDocument.body)

    const selectEdificacion = await canvas.findByLabelText(/^edificación/i)
    await elegirListbox(selectEdificacion, 'ed-campus-00000001', userEvent)
    const selectBloque = await canvas.findByLabelText(/bloque global/i)
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
    const bloqueTras = await canvas.findByLabelText(/bloque global/i)
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
