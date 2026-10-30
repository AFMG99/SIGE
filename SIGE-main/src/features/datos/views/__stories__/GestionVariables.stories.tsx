import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { GestionVariables } from '../GestionVariables'
import { variablesExistentesDemo, variablesVaciasDemo } from '../__fixtures__/existencias'

const meta = {
  component: GestionVariables,
  tags: ['ai-generated'],
  args: {
    variables: variablesExistentesDemo,
  },
} satisfies Meta<typeof GestionVariables>

export default meta
type Story = StoryObj<typeof meta>

export const EditarVariable: Story = {
  name: 'Editar población de un registro en línea',
  play: async ({ canvasElement, userEvent }) => {
    // El ConfirmDialog se monta vía createPortal en document.body.
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar variable 2024-12 del bloque A-101' })
    )
    const poblacionFija = await screen.findByLabelText('Población fija de 2024-12')
    await userEvent.clear(poblacionFija)
    await userEvent.type(poblacionFija, '26')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios en 2024-12' }))

    const toast = await screen.findByText('Variable 12/2024 actualizada.')
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })
    // La celda se actualiza al instante (espejo local).
    await expect(await screen.findByText('26')).toBeVisible()
    await expect(screen.queryByLabelText('Población fija de 2024-12')).toBeNull()
  },
}

export const EliminarVariable: Story = {
  name: 'Eliminar un registro con confirmación',
  play: async ({ canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      screen.getByRole('button', { name: 'Eliminar variable 2024-12 del bloque A-101' })
    )

    const dialog = await screen.findByRole('dialog')
    const titulo = within(dialog).getByText('¿Eliminar la variable de 2024-12?')
    await waitFor(() => expect(titulo).toBeVisible(), { timeout: 2000 })
    await userEvent.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))

    const toast = await screen.findByText('Variable eliminada de la base de datos.')
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })
    await expect(
      screen.queryByRole('button', { name: 'Editar variable 2024-12 del bloque A-101' })
    ).toBeNull()
  },
}

export const VaciarVariables: Story = {
  name: 'Vaciar variables conservando facturas y líneas base',
  play: async ({ canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(screen.getByRole('button', { name: 'Vaciar base de datos' }))

    const dialog = await screen.findByRole('dialog')
    // El diálogo explicita qué se conserva: facturas, líneas base y bloques.
    const conserva = within(dialog).getByText(
      /facturas, líneas base guardadas y el catálogo de bloques se conservan/i
    )
    await waitFor(() => expect(conserva).toBeVisible(), { timeout: 2000 })
    await userEvent.click(within(dialog).getByRole('button', { name: /vaciar todo/i }))

    const toast = await screen.findByText(
      'Se eliminaron 6 variables operativas. Facturas y líneas base se conservan.'
    )
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })
    await expect(await screen.findByText('No hay variables operativas')).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Vaciar base de datos' })).toBeDisabled()
  },
}

export const VariablesVacias: Story = {
  name: 'Estado vacío (sin variables)',
  args: { variables: variablesVaciasDemo },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('No hay variables operativas')).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Vaciar base de datos' })).toBeDisabled()
  },
}
