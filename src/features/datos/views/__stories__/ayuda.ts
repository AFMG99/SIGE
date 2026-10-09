import { expect, waitFor } from 'storybook/test'

import { equiposCsv, facturasCsv, variablesCsv } from '../__fixtures__/archivos'

/**
 * Utilidades compartidas por las stories del módulo de carga.
 * El `<input type="file">` de los importadores es `sr-only` (no tiene rol ni
 * etiqueta accesibles), por eso se localiza con un querySelector directo.
 */

type UserEventLike = {
  upload: (input: HTMLInputElement, archivo: File) => Promise<unknown>
}

type UserEventClic = {
  click: (el: HTMLElement) => Promise<unknown>
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

/**
 * Elige una opción en un `ListboxSelect`. El panel es un portal montado en
 * `document.body`, así que `userEvent.selectOptions` (que exige un `<select>`)
 * no sirve: se abre el gatillo y se pulsa la opción por su `data-value`.
 */
export async function elegirListbox(
  trigger: HTMLElement,
  valor: string,
  userEvent: UserEventClic
): Promise<void> {
  await userEvent.click(trigger)
  const doc = trigger.ownerDocument
  const panel = await waitFor(() => {
    const abierto = doc.querySelector('[role="listbox"]')
    expect(abierto, 'listbox abierto').not.toBeNull()
    return abierto as HTMLElement
  })
  const opcion = panel.querySelector<HTMLElement>(`[data-value="${valor}"]`)
  expect(opcion, `opción con data-value "${valor}"`).not.toBeNull()
  await userEvent.click(opcion as HTMLElement)
}

/**
 * Nombres de las opciones de un `ListboxSelect` (abre la lista, las lee y la
 * vuelve a cerrar), para las stories que solo necesitan comprobar el contenido
 * disponible sin cambiar el valor.
 */
export async function opcionesListbox(
  trigger: HTMLElement,
  userEvent: UserEventClic
): Promise<string[]> {
  await userEvent.click(trigger)
  const doc = trigger.ownerDocument
  const panel = await waitFor(() => {
    const abierto = doc.querySelector('[role="listbox"]')
    expect(abierto, 'listbox abierto').not.toBeNull()
    return abierto as HTMLElement
  })
  const nombres = Array.from(panel.querySelectorAll<HTMLElement>('[role="option"]')).map(
    (el) => el.textContent?.trim() ?? ''
  )
  await userEvent.click(trigger)
  return nombres
}

export const archivoFacturas = (): File =>
  new File([facturasCsv], 'facturas-epm-demo.csv', { type: 'text/csv' })

export const archivoEquipos = (): File =>
  new File([equiposCsv], 'inventario-equipos-demo.csv', { type: 'text/csv' })

export const archivoVariables = (): File =>
  new File([variablesCsv], 'variables-operativas-demo.csv', { type: 'text/csv' })
