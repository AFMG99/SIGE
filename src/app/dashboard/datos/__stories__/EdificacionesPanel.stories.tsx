import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'

import {
  crearBloque,
  crearEdificacion,
  eliminarBloque,
  eliminarEdificacion,
} from '@/actions/edificaciones'
import { EdificacionesPanel } from '../EdificacionesPanel'
import { bloquesDemo, edificacionesDemo, espaciosDemo } from '../__fixtures__/catalogo'

const meta = {
  component: EdificacionesPanel,
  tags: ['ai-generated'],
  args: {
    edificaciones: edificacionesDemo,
    bloques: bloquesDemo,
    espacios: espaciosDemo,
    crearEdificacion,
    eliminarEdificacion,
    crearBloque,
    eliminarBloque,
  },
} satisfies Meta<typeof EdificacionesPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Catalogo: Story = {
  name: 'Catálogo completo',
}

export const CrearEdificacion: Story = {
  name: 'Crear una edificación',
  play: async ({ canvas, canvasElement, userEvent }) => {
    // El drawer se monta vía createPortal en document.body.
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByRole('button', { name: /nueva edificación/i }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.type(within(dialog).getByLabelText(/nombre/i), 'Biblioteca Central')
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/tipo/i),
      'OFICINA_PUBLICA'
    )
    await userEvent.click(within(dialog).getByRole('button', { name: /crear edificación/i }))

    await screen.findByText(/Edificación "Biblioteca Central" creada/, {}, { timeout: 3000 })
  },
}

export const CrearBloque: Story = {
  name: 'Crear un bloque en una edificación',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    const tarjeta = canvas.getByText('Campus Bloque A').closest('.ui-card') as HTMLElement
    await userEvent.click(within(tarjeta).getByRole('button', { name: /nuevo bloque/i }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.type(within(dialog).getByLabelText(/código/i), 'A-103')
    await userEvent.type(within(dialog).getByLabelText(/^nombre/i), 'Ala Este')
    await userEvent.click(within(dialog).getByRole('button', { name: /crear bloque/i }))

    await screen.findByText(/Bloque "Ala Este" creado/, {}, { timeout: 3000 })
  },
}

export const EliminarBloqueado: Story = {
  name: 'Bloqueo al eliminar una edificación con datos',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      canvas.getByRole('button', { name: 'Eliminar edificación Campus Bloque A' })
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))

    const alerta = await screen.findByRole('alert', {}, { timeout: 3000 })
    await expect(alerta).toHaveTextContent(
      'No se puede eliminar la edificación "Campus Bloque A"'
    )
    // La edificación sigue en el catálogo: nada se borró.
    await expect(canvas.getByText('Campus Bloque A')).toBeVisible()
  },
}

export const EliminarEdificacionVacia: Story = {
  name: 'Eliminar una edificación sin datos',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      canvas.getByRole('button', { name: 'Eliminar edificación Administración Principal' })
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))

    await screen.findByText(
      /Se eliminó la edificación "Administración Principal"/,
      {},
      { timeout: 3000 }
    )
  },
}
