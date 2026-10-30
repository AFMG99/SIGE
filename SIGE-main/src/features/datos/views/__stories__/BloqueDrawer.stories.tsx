import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, within } from 'storybook/test'

import { BloqueDrawer } from '../BloqueDrawer'

const meta = {
  component: BloqueDrawer,
  tags: ['ai-generated'],
  args: {
    isOpen: true,
    edificacion: { nombre: 'Campus Bloque A', tipo: 'EDUCATIVO_CAMPUS' },
    onClose: fn(),
    onSubmit: fn(async () => {}),
    submitting: false,
  },
} satisfies Meta<typeof BloqueDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const FormularioVacio: Story = {
  name: 'Validación al enviar vacío',
  play: async ({ canvasElement, userEvent }) => {
    // El drawer se monta vía createPortal en document.body.
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(screen.getByRole('button', { name: /crear bloque/i }))

    await expect(await screen.findByText('El código es obligatorio')).toBeVisible()
    await expect(screen.getByText('El nombre es obligatorio')).toBeVisible()
  },
}

export const Enviando: Story = {
  name: 'Enviando (submitting)',
  args: { submitting: true },
}
