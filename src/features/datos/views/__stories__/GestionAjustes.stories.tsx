import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { GestionAjustes } from '../GestionAjustes'
import { ajustesExistentesDemo, ajustesVaciosDemo } from '../__fixtures__/existencias'

const meta = {
  component: GestionAjustes,
  tags: ['ai-generated'],
  args: {
    ajustes: ajustesExistentesDemo,
  },
} satisfies Meta<typeof GestionAjustes>

export default meta
type Story = StoryObj<typeof meta>

export const EliminarAjuste: Story = {
  name: 'Eliminar un ajuste con confirmación',
  play: async ({ canvasElement, userEvent }) => {
    // El ConfirmDialog se monta vía createPortal en document.body.
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      screen.getByRole('button', { name: 'Eliminar ajuste No rutinario del bloque A-101' })
    )

    const dialog = await screen.findByRole('dialog')
    const titulo = within(dialog).getByText('¿Eliminar el ajuste no rutinario del bloque A-101?')
    await waitFor(() => expect(titulo).toBeVisible(), { timeout: 2000 })
    await userEvent.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))

    const toast = await screen.findByText(
      'Se eliminó el ajuste NO_RUTINARIO del bloque "BLOQUE-A-001 — Bloque de Aulas Mayores".'
    )
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })
    // La fila sale de la tabla y el contador baja (espejo local).
    await expect(
      screen.queryByRole('button', { name: 'Eliminar ajuste No rutinario del bloque A-101' })
    ).toBeNull()
    await expect(await screen.findByText('2 ajustes')).toBeVisible()
  },
}

export const BuscarAjuste: Story = {
  name: 'Buscar ajustes por cualquier columna',
  play: async ({ canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    const buscar = await screen.findByLabelText(/buscar en ajustes para gestionar/i)
    await userEvent.type(buscar, 'adm-1')

    // Solo queda el ajuste del bloque ADM-1.
    await waitFor(
      () => {
        expect(screen.queryByRole('button', { name: 'Eliminar ajuste No rutinario del bloque A-101' })).toBeNull()
      },
      { timeout: 3000 }
    )
    await expect(
      await screen.findByRole('button', { name: 'Eliminar ajuste Rutinario del bloque ADM-1' })
    ).toBeVisible()
  },
}

export const VaciarAjustes: Story = {
  name: 'Vaciar ajustes conservando el resto de los datos',
  play: async ({ canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(screen.getByRole('button', { name: 'Vaciar base de datos' }))

    const dialog = await screen.findByRole('dialog')
    // El diálogo explicita qué se conserva: todo lo demás.
    const conserva = within(dialog).getByText(
      /facturas, equipos, variables, líneas base, bloques y edificaciones se conservan/i
    )
    await waitFor(() => expect(conserva).toBeVisible(), { timeout: 2000 })
    await userEvent.click(within(dialog).getByRole('button', { name: /vaciar todo/i }))

    const toast = await screen.findByText(
      'Se eliminaron 3 ajustes energéticos. El resto de los datos se conserva.'
    )
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })
    await expect(await screen.findByText('No hay ajustes guardados')).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Vaciar base de datos' })).toBeDisabled()
  },
}

export const AjustesVacios: Story = {
  name: 'Estado vacío (sin ajustes)',
  args: { ajustes: ajustesVaciosDemo },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('No hay ajustes guardados')).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Vaciar base de datos' })).toBeDisabled()
  },
}
