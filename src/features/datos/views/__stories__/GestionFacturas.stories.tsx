import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { GestionFacturas } from '../GestionFacturas'
import {
  facturasExistentesDemo,
  facturasVaciasDemo,
  lineasBaseFilasDemo,
  lineasBaseFilasVaciasDemo,
} from '../__fixtures__/existencias'

const meta = {
  component: GestionFacturas,
  tags: ['ai-generated'],
  args: {
    facturas: facturasExistentesDemo,
    lineasBaseTotal: 4,
    lineasBaseFilas: lineasBaseFilasDemo,
  },
} satisfies Meta<typeof GestionFacturas>

export default meta
type Story = StoryObj<typeof meta>

export const EditarFactura: Story = {
  name: 'Editar una factura en línea',
  play: async ({ canvasElement, userEvent }) => {
    // El ConfirmDialog se monta vía createPortal en document.body.
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(screen.getByRole('button', { name: 'Editar factura 2024-12' }))
    const consumo = await screen.findByLabelText('Consumo kWh de 2024-12')
    await userEvent.clear(consumo)
    await userEvent.type(consumo, '19500')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios en 2024-12' }))

    // El toast entra con `animate-slide-up` (opacity 0 → 1).
    const toast = await screen.findByText('Factura actualizada correctamente.')
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })
    // La celda se actualiza al instante (espejo local) con formato es-CO.
    await expect(await screen.findByText('19.500,00')).toBeVisible()
    await expect(screen.queryByLabelText('Consumo kWh de 2024-12')).toBeNull()
  },
}

export const EliminarFactura: Story = {
  name: 'Eliminar una factura con confirmación',
  play: async ({ canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar factura 2024-12' }))

    // El overlay del diálogo entra con `animate-fade-in` (opacity 0 → 1).
    const dialog = await screen.findByRole('dialog')
    const titulo = within(dialog).getByText('¿Eliminar factura 2024-12?')
    await waitFor(() => expect(titulo).toBeVisible(), { timeout: 2000 })
    await userEvent.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))

    const toast = await screen.findByText('Factura eliminada de la base de datos.')
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })
    await expect(
      screen.queryByRole('button', { name: 'Editar factura 2024-12' })
    ).toBeNull()
  },
}

export const VaciarBaseDeFacturas: Story = {
  name: 'Vaciar la base elimina facturas y líneas base',
  play: async ({ canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(screen.getByRole('button', { name: 'Vaciar base de datos' }))

    const dialog = await screen.findByRole('dialog')
    // El diálogo explicita las consecuencias: facturas + líneas base.
    const consecuencias = within(dialog).getByText(
      /se eliminarán 12 facturas y 4 líneas base guardadas/i
    )
    await waitFor(() => expect(consecuencias).toBeVisible(), { timeout: 2000 })
    await userEvent.click(within(dialog).getByRole('button', { name: /vaciar todo/i }))

    const toast = await screen.findByText(
      'Se eliminaron todas las facturas y sus líneas base guardadas.'
    )
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })
    // Estado vacío: la tabla desaparece y el botón de vaciar queda inhabilitado.
    await expect(await screen.findByText('No hay facturas guardadas')).toBeVisible()
    await expect(screen.queryByRole('button', { name: 'Editar factura 2024-12' })).toBeNull()
    await expect(screen.getByRole('button', { name: 'Vaciar base de datos' })).toBeDisabled()
  },
}

export const BaseVacia: Story = {
  name: 'Estado vacío (sin facturas)',
  args: {
    facturas: facturasVaciasDemo,
    lineasBaseTotal: 0,
    lineasBaseFilas: lineasBaseFilasVaciasDemo,
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('No hay facturas guardadas')).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Vaciar base de datos' })).toBeDisabled()
    await expect(await screen.findByText('No hay líneas base guardadas')).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Vaciar líneas base' })).toBeDisabled()
  },
}

export const EliminarLineaBase: Story = {
  name: 'Eliminar una línea base sin tocar las facturas',
  play: async ({ canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      screen.getByRole('button', { name: 'Eliminar línea base Valor Absoluto del bloque A-101' })
    )

    const dialog = await screen.findByRole('dialog')
    const titulo = within(dialog).getByText(
      '¿Eliminar la línea base valor absoluto del bloque A-101?'
    )
    await waitFor(() => expect(titulo).toBeVisible(), { timeout: 2000 })
    await userEvent.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))

    const toast = await screen.findByText(
      'Se eliminó la línea base guardada del bloque "BLOQUE-A-001 — Bloque de Aulas Mayores".'
    )
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })
    // La fila sale de la tabla y el contador baja; las facturas intactas.
    await expect(
      screen.queryByRole('button', { name: 'Eliminar línea base Valor Absoluto del bloque A-101' })
    ).toBeNull()
    await expect(await screen.findByText('3 líneas base')).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Editar factura 2024-12' })).toBeVisible()
  },
}

export const VaciarLineasBase: Story = {
  name: 'Vaciar solo las líneas base guardadas',
  play: async ({ canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(screen.getByRole('button', { name: 'Vaciar líneas base' }))

    const dialog = await screen.findByRole('dialog')
    // El diálogo explicita qué se conserva: facturas, variables, bloques y edificaciones.
    const conserva = within(dialog).getByText(
      /facturas, variables, bloques y edificaciones se conservan/i
    )
    await waitFor(() => expect(conserva).toBeVisible(), { timeout: 2000 })
    await userEvent.click(within(dialog).getByRole('button', { name: /vaciar todo/i }))

    const toast = await screen.findByText(
      'Se eliminaron 4 líneas base guardadas. Facturas y variables se conservan.'
    )
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })
    await expect(await screen.findByText('No hay líneas base guardadas')).toBeVisible()
    await expect(screen.getByRole('button', { name: 'Vaciar líneas base' })).toBeDisabled()
    // Las facturas no se ven afectadas por este vaciado.
    await expect(screen.getByRole('button', { name: 'Editar factura 2024-12' })).toBeVisible()
  },
}
