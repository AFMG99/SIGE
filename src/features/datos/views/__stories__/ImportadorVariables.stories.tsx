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

const ANO_GDE_STORY = new Date().getFullYear()
const RANGO_GDE_STORY = {
  id: 'rg-story-gde-marzo',
  calendarioId: 'cal-campus-0000001',
  fechaInicio: `${ANO_GDE_STORY}-03-01`,
  fechaFin: `${ANO_GDE_STORY}-03-31`,
  tipoDia: 'LECTIVO',
  nombre: 'Marzo operativo',
}

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

export const CalculoGde: Story = {
  name: 'Cálculo de la GDE: entradas efectivas y botón único (S2)',
  args: { rangos: [RANGO_GDE_STORY] },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await elegirEdificacion(canvas, userEvent)

    // Fórmula visible + entradas efectivas ANTES de guardar.
    await expect(await canvas.findByText('GDE = Σ (Tp − Tb) · Xe')).toBeVisible()
    await expect(canvas.getByText('06:00–18:00 (12 h/día)')).toBeVisible()
    await expect(canvas.getByText('Xe = H (fijo, 12 h)')).toBeVisible()
    // Fijar octubre para que la interacción no dependa del mes actual.
    await userEvent.selectOptions(canvas.getByLabelText(/^mes/i), '10')
    await expect(
      canvas.getByText(
        new RegExp(`Configurado · 0 día\\(s\\) operativo\\(s\\) en octubre de ${ANO_GDE_STORY}`)
      )
    ).toBeVisible()

    // Marzo del año actual está dentro del rango lectivo → 31 días operativos.
    await userEvent.selectOptions(canvas.getByLabelText(/^mes/i), '3')
    await expect(
      await canvas.findByText(
        new RegExp(`31 día\\(s\\) operativo\\(s\\) en marzo de ${ANO_GDE_STORY}`)
      )
    ).toBeVisible()

    // Un solo botón: calcula en el servidor y registra (mocks deterministas).
    const boton = await canvas.findByRole('button', { name: /calcular y guardar gde/i })
    await userEvent.click(boton)
    await expect(await canvas.findByText('41,2 °C·día', {}, { timeout: 3000 })).toBeVisible()
    await expect(await canvas.findByText(/Registrada en variables operativas/)).toBeVisible()
    await screen.findByText(/registrada en 2 variables operativas/i, {}, { timeout: 3000 })
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
    await expect(canvas.getByRole('button', { name: /importar \d+ filas/i })).toBeVisible()
    // La última fila del CSV trae mes 13: debe aparecer marcada con error.
    await expect(await canvas.findByText('Mes inválido en la fila')).toBeVisible()
  },
}

export const Paso4Resultado: Story = {
  name: 'Paso 4 · Resultado de la importación',
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
