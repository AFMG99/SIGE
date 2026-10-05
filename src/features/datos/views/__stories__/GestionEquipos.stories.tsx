import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { GestionEquipos } from '../GestionEquipos'
import { equiposExistentesDemo, equiposVaciosDemo } from '../__fixtures__/existencias'

const meta = {
  component: GestionEquipos,
  tags: ['ai-generated'],
  args: {
    equipos: equiposExistentesDemo,
  },
} satisfies Meta<typeof GestionEquipos>

export default meta
type Story = StoryObj<typeof meta>

export const EditarEquipo: Story = {
  name: 'Editar cantidad de un equipo en línea',
  play: async ({ canvasElement, userEvent }) => {
    // El ConfirmDialog se monta vía createPortal en document.body.
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar equipo HVAC en Aula 101' })
    )
    const cantidad = await screen.findByLabelText('Cantidad en Aula 101')
    await userEvent.clear(cantidad)
    await userEvent.type(cantidad, '3')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios en Aula 101' }))

    // El toast entra con `animate-slide-up` (opacity 0 → 1).
    const toast = await screen.findByText('Equipo actualizado correctamente.')
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })
    // La celda se actualiza al instante (espejo local).
    await expect(await screen.findByText('3')).toBeVisible()
    await expect(screen.queryByLabelText('Cantidad en Aula 101')).toBeNull()
  },
}

export const EliminarEquipo: Story = {
  name: 'Eliminar un equipo con confirmación',
  play: async ({ canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      screen.getByRole('button', { name: 'Eliminar equipo HVAC en Aula 101' })
    )

    // El overlay del diálogo entra con `animate-fade-in` (opacity 0 → 1).
    const dialog = await screen.findByRole('dialog')
    const titulo = within(dialog).getByText('¿Eliminar HVAC en Aula 101?')
    await waitFor(() => expect(titulo).toBeVisible(), { timeout: 2000 })
    await userEvent.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))

    const toast = await screen.findByText('Equipo eliminado del inventario.')
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })
    await expect(
      screen.queryByRole('button', { name: 'Editar equipo HVAC en Aula 101' })
    ).toBeNull()
  },
}

export const VaciarInventario: Story = {
  name: 'Vaciar inventario conservando el catálogo',
  play: async ({ canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(screen.getByRole('button', { name: 'Vaciar base de datos' }))

    const dialog = await screen.findByRole('dialog')
    // El diálogo explicita qué se conserva: edificaciones, bloques y espacios.
    const conserva = within(dialog).getByText(/edificaciones, bloques y espacios se conservan/i)
    await waitFor(() => expect(conserva).toBeVisible(), { timeout: 2000 })
    await userEvent.click(within(dialog).getByRole('button', { name: /vaciar todo/i }))

    const toast = await screen.findByText(
      'Se eliminaron todos los equipos. Edificaciones, bloques y espacios se conservan.'
    )
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })
    await expect(await screen.findByText('El inventario está vacío')).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Vaciar base de datos' })).toBeDisabled()
  },
}

export const InventarioVacio: Story = {
  name: 'Estado vacío (sin equipos)',
  args: { equipos: equiposVaciosDemo },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('El inventario está vacío')).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Vaciar base de datos' })).toBeDisabled()
  },
}
