import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, within } from 'storybook/test'

import { EdificacionDrawer } from '../EdificacionDrawer'

const meta = {
  component: EdificacionDrawer,
  tags: ['ai-generated'],
  args: {
    isOpen: true,
    onClose: fn(),
    onSubmit: fn(async () => {}),
    submitting: false,
  },
} satisfies Meta<typeof EdificacionDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const FormularioVacio: Story = {
  name: 'Validación al enviar vacío',
  play: async ({ canvasElement, userEvent }) => {
    // El drawer se monta vía createPortal en document.body.
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(screen.getByRole('button', { name: /crear edificación/i }))

    await expect(await screen.findByText('El nombre es obligatorio')).toBeVisible()
    await expect(screen.getByText('Seleccione el tipo de edificación')).toBeVisible()
  },
}

export const Enviando: Story = {
  name: 'Enviando (submitting)',
  args: { submitting: true },
}
