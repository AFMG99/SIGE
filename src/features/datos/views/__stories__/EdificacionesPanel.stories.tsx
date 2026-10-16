import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'

import {
  actualizarEdificacion,
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
  calendariosDemo,
  edificacionesDemo,
  espaciosDemo,
  horariosEquipoDemo,
  rangosCalendarioDemo,
} from '../__fixtures__/catalogo'
import { equiposExistentesDemo } from '../__fixtures__/existencias'

const meta = {
  component: EdificacionesPanel,
  tags: ['ai-generated'],
  args: {
    edificaciones: edificacionesDemo,
    bloques: bloquesDemo,
    espacios: espaciosDemo,
    equipos: equiposExistentesDemo.filas,
    calendarios: calendariosDemo,
    rangos: rangosCalendarioDemo,
    horarios: horariosEquipoDemo,
    crearEdificacion,
    actualizarEdificacion,
    eliminarEdificacion,
    crearBloque,
    eliminarBloque,
    crearEspacio,
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
    await userEvent.click(within(formulario).getByRole('button', { name: /añadir espacio/i }))

    await screen.findByText(/Espacio "Aula 103" creado/, {}, { timeout: 3000 })
    // En Storybook el panel es stateless: la lista no se muta; el alta se
    // verifica por el toast del servidor.
  },
}

export const CalendarioGde: Story = {
  name: 'Calendario y GDE con fórmula visible',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      canvas.getByRole('button', { name: /calendario y gde de campus bloque a/i })
    )
    const dialog = await screen.findByRole('dialog')

    // Configuración operativa precargada (Tb = 23 °C del fixture).
    const tb = within(dialog).getByLabelText(/tb \(°c\)/i) as HTMLInputElement
    expect(tb.value).toBe('23')

    // Rangos del calendario visibles.
    await expect(within(dialog).getByText('09/02/2026 → 13/06/2026')).toBeVisible()

    // Calcular con la fuente climática mockeada.
    await userEvent.click(within(dialog).getByRole('button', { name: /calcular gde/i }))
    // Resultado + fórmula sustituida (interpretabilidad — S8).
    await screen.findByText('41,2 °C·día', {}, { timeout: 3000 })
    await expect(
      within(dialog).getByText(/GDE = Σ\(Tp − Tb\)·Xd sobre 20 días operativos/)
    ).toBeVisible()
    await expect(within(dialog).getByText('12/02/2026')).toBeVisible()

    // Registro en variables operativas existentes.
    await userEvent.click(
      within(dialog).getByRole('button', { name: /registrar en variables operativas/i })
    )
    await screen.findByText(/registrada en 2 variables operativas/i, {}, { timeout: 3000 })
  },
}

export const HorariosEquipos: Story = {
  name: 'Horarios de equipos: consulta y alta',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      canvas.getByRole('button', { name: /calendario y gde de campus bloque a/i })
    )
    const dialog = await screen.findByRole('dialog')

    // Horarios existentes del fixture (S10: consulta desde la sección).
    await expect(within(dialog).getByText('Iluminación aulas')).toBeVisible()
    await expect(within(dialog).getByText('Lun–Vie · 06:00–20:00')).toBeVisible()

    // Alta de un horario nuevo (el panel es stateless en Storybook: el alta
    // se verifica por el toast del servidor, como en el resto de stories).
    await userEvent.type(within(dialog).getByLabelText(/nombre del grupo/i), 'Laboratorio 201')
    await userEvent.click(within(dialog).getByRole('button', { name: /agregar horario/i }))
    await screen.findByText(/Horario agregado/, {}, { timeout: 3000 })
  },
}

export const HorarioAmbitoEspacio: Story = {
  name: 'Horarios: ámbito en cascada (bloque → espacio) con vigencia',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      canvas.getByRole('button', { name: /calendario y gde de campus bloque a/i })
    )
    const dialog = await screen.findByRole('dialog')

    // El horario del fixture es de la edificación completa sin vigencia (S12).
    const chips = await within(dialog).findAllByText(
      /Edificación completa · Sin vigencia registrada/
    )
    expect(chips.length).toBeGreaterThan(0)

    // Nivel "Espacio / aula" revela los selects en cascada.
    await userEvent.click(within(dialog).getByRole('button', { name: /espacio \/ aula/i }))
    await expect(within(dialog).getByLabelText(/^bloque/i)).toBeVisible()
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/^bloque/i),
      'bk-campus-a101-001'
    )
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/espacio \/ aula/i),
      'sp-campus-101-0001'
    )

    // Los campos de vigencia existen y el «hasta» es opcional (abierta).
    await expect(within(dialog).getByLabelText(/vigente desde/i)).toBeVisible()
    await expect(within(dialog).getByLabelText(/vigente hasta/i)).toBeVisible()

    await userEvent.type(within(dialog).getByLabelText(/nombre del grupo/i), 'Aula 101 — prueba')
    await userEvent.click(within(dialog).getByRole('button', { name: /agregar horario/i }))
    await screen.findByText(/Horario agregado/, {}, { timeout: 3000 })
  },
}
