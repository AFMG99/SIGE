import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { crearBloque, eliminarBloque } from '@/features/datos/controllers/edificaciones'
import { ImportadorVariables } from '../ImportadorVariables'
import { bloquesDemo, edificacionesDemo } from '../__fixtures__/catalogo'
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
  args: { resultadoInicial: resultadoVariablesDemo },
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
