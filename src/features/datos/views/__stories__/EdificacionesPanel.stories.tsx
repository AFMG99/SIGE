import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'

import {
  actualizarEdificacion,
  actualizarDimensionesBloque,
  actualizarEspacio,
  crearBloque,
  crearEdificacion,
  crearEspacio,
  eliminarBloque,
  eliminarEdificacion,
  eliminarEspacio,
} from '@/features/datos/controllers/edificaciones'
import { EdificacionesPanel } from '../EdificacionesPanel'
import {
  bloquesDemo,
  edificacionesDemo,
  espaciosDemo,
} from '../__fixtures__/catalogo'

const meta = {
  component: EdificacionesPanel,
  tags: ['ai-generated'],
  args: {
    edificaciones: edificacionesDemo,
    bloques: bloquesDemo,
    espacios: espaciosDemo,
    crearEdificacion,
    actualizarEdificacion,
    eliminarEdificacion,
    crearBloque,
    actualizarDimensionesBloque,
    eliminarBloque,
    crearEspacio,
    actualizarEspacio,
    eliminarEspacio,
  },
} satisfies Meta<typeof EdificacionesPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Catalogo: Story = {
  name: 'Catálogo completo',
  play: async ({ canvas }) => {
    // Chips de área (UPME §7.3): formato es-CO y estado «sin registrar».
    await expect(canvas.getByText('4.500 m²')).toBeVisible()
    await expect(canvas.getByText('Sin área registrada')).toBeVisible()
  },
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
    await userEvent.click(
      within(dialog).getByText('Opciones avanzadas: dimensiones del bloque')
    )
    await userEvent.type(within(dialog).getByLabelText('Largo (m)'), '20')
    await userEvent.type(within(dialog).getByLabelText('Ancho (m)'), '8')
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

export const EditarEdificacion: Story = {
  name: 'Editar el área de una edificación',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    const tarjeta = canvas
      .getByText('Administración Principal')
      .closest('.ui-card') as HTMLElement
    await userEvent.click(within(tarjeta).getByRole('button', { name: /editar edificación/i }))
    const dialog = await screen.findByRole('dialog')

    // El tipo viene cargado y deshabilitado: no es editable tras la creación.
    const tipo = within(dialog).getByLabelText(/tipo/i) as HTMLSelectElement
    expect(tipo.disabled).toBe(true)

    const area = within(dialog).getByLabelText(/área total/i)
    await userEvent.clear(area)
    await userEvent.type(area, '750')
    await userEvent.click(within(dialog).getByRole('button', { name: /guardar cambios/i }))

    await screen.findByText(/Edificación "Administración Principal" actualizada/, {}, { timeout: 3000 })
    // En Storybook el panel es stateless (el estado vive en el hook de
    // DatosContent): la actualización se verifica por el toast del servidor.
  },
}

export const AniadirEspacio: Story = {
  name: 'Añadir un espacio a un bloque',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    const campo = canvas.getByLabelText(/nuevo espacio en el bloque A-101/i)
    await userEvent.type(campo, 'Aula 103')
    // Hay un botón «Añadir espacio» por bloque: se usa el del formulario A-101.
    const formulario = campo.closest('form') as HTMLElement
    await userEvent.click(within(formulario).getByText('Avanzado'))
    await userEvent.type(within(formulario).getByLabelText('Piso o nivel'), '1')
    await userEvent.type(within(formulario).getByLabelText('Largo (m)'), '6')
    await userEvent.type(within(formulario).getByLabelText('Ancho (m)'), '4')
    await userEvent.click(within(formulario).getByRole('button', { name: /añadir espacio/i }))

    await screen.findByText(/Espacio "Aula 103" creado/, {}, { timeout: 3000 })
    // En Storybook el panel es stateless: la lista no se muta; el alta se
    // verifica por el toast del servidor.
  },
}

export const EditarUbicacionYDimensionesEspacio: Story = {
  name: 'Asignar piso y dimensiones a un espacio existente',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)
    const botonConfigurar = canvas.getByRole('button', {
      name: 'Configurar piso y dimensiones del espacio Aula 101, piso Sin asignar, bloque A-101',
    })
    const tarjetaEspacio = botonConfigurar.closest('.rounded-md') as HTMLElement
    const espacio = within(tarjetaEspacio)
    await userEvent.click(botonConfigurar)
    await userEvent.type(espacio.getByLabelText('Piso o nivel'), '1')
    await userEvent.type(espacio.getByLabelText('Largo (m)'), '6')
    await userEvent.type(espacio.getByLabelText('Ancho (m)'), '4')
    await userEvent.click(espacio.getByRole('button', { name: 'Guardar' }))

    await screen.findByText('Datos espaciales del espacio actualizados.')
  },
}
