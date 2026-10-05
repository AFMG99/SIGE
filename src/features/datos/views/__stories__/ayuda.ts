import { equiposCsv, facturasCsv, variablesCsv } from '../__fixtures__/archivos'

/**
 * Utilidades compartidas por las stories del módulo de carga.
 * El `<input type="file">` de los importadores es `sr-only` (no tiene rol ni
 * etiqueta accesibles), por eso se localiza con un querySelector directo.
 */

type UserEventLike = {
  upload: (input: HTMLInputElement, archivo: File) => Promise<unknown>
}

export async function subirArchivo(
  canvasElement: HTMLElement,
  userEvent: UserEventLike,
  archivo: File
): Promise<void> {
  const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('No se encontró input[type="file"] en la historia')
  await userEvent.upload(input, archivo)
}

export const archivoFacturas = (): File =>
  new File([facturasCsv], 'facturas-epm-demo.csv', { type: 'text/csv' })

export const archivoEquipos = (): File =>
  new File([equiposCsv], 'inventario-equipos-demo.csv', { type: 'text/csv' })

export const archivoVariables = (): File =>
  new File([variablesCsv], 'variables-operativas-demo.csv', { type: 'text/csv' })
