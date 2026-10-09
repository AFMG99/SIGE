import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'

import { ImportadorFacturas } from '../ImportadorFacturas'
import { edificacionesDemo } from '../__fixtures__/catalogo'
import { resultadoFacturasDemo } from '../__fixtures__/resultado'
import { archivoFacturas, elegirListbox, subirArchivo } from './ayuda'

const meta = {
  component: ImportadorFacturas,
  tags: ['ai-generated'],
  args: {
    puedeCargar: true,
    edificaciones: edificacionesDemo,
    onIrAlCatalogo: () => {},
  },
} satisfies Meta<typeof ImportadorFacturas>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Las facturas exigen elegir la edificación antes de leer cualquier archivo
 * (FK requerida). El catálogo vive en Facturas de energía › Edificaciones.
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
  name: 'Paso 2 · Mapeo automático de columnas',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoFacturas())

    await expect(
      await canvas.findByRole('button', { name: /continuar a vista previa/i }, { timeout: 5000 })
    ).toBeVisible()
    // El dropzone y la plantilla pertenecen al paso 1: su ausencia confirma el avance.
    await expect(canvas.queryByRole('button', { name: /descargar plantilla/i })).toBeNull()
  },
}

export const Paso3VistaPrevia: Story = {
  name: 'Paso 3 · Vista previa editable',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoFacturas())

    const continuar = await canvas.findByRole(
      'button',
      { name: /continuar a vista previa/i },
      { timeout: 5000 }
    )
    await userEvent.click(continuar)

    await expect(await canvas.findByText(/listo para importar/i)).toBeVisible()
    await expect(canvas.getByRole('button', { name: /importar \d+ filas/i })).toBeVisible()
  },
}

export const Paso4Resultado: Story = {
  name: 'Paso 4 · Resultado de la importación',
  args: { resultadoInicial: resultadoFacturasDemo },
}

export const ImportacionExitosa: Story = {
  name: 'Flujo completo · Carga → resultado',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoFacturas())

    const continuar = await canvas.findByRole(
      'button',
      { name: /continuar a vista previa/i },
      { timeout: 5000 }
    )
    await userEvent.click(continuar)

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

export const SoloLectura: Story = {
  name: 'Rol sin permiso de carga',
  args: { puedeCargar: false },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/solo lectura/i)).toBeVisible()
  },
}
