import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'

import { EventosCalendario } from '../EventosCalendario'
import {
  bloquesDemo,
  edificacionesDemo,
  espaciosDemo,
  eventosDemo,
} from '../__fixtures__/catalogo'
import { equiposExistentesDemo } from '../__fixtures__/existencias'

const meta = {
  component: EventosCalendario,
  tags: ['ai-generated'],
  args: {
    edificaciones: edificacionesDemo,
    bloques: bloquesDemo,
    espacios: espaciosDemo,
    equipos: equiposExistentesDemo.filas,
    eventos: eventosDemo,
    puedeCargar: true,
    edificacionId: '',
    onEdificacionChange: () => {},
  },
  // El panel es CONTROLADO (T8): la selección vive en el wrapper (en la app,
  // en DatosContent). Las stories lo simulan con estado interno para que el
  // play siga eligiendo la edificación por el listbox.
  render: (args) => <ConEdificacion {...args} />,
} satisfies Meta<typeof EventosCalendario>

export default meta
type Story = StoryObj<typeof meta>

/** Estado de la selección de edificación (doble del wrapper de la app). */
function ConEdificacion(
  props: Omit<Parameters<typeof EventosCalendario>[0], 'edificacionId' | 'onEdificacionChange'> & {
    edificacionId?: string
  }
) {
  const [id, setId] = useState(props.edificacionId ?? '')
  return <EventosCalendario {...props} edificacionId={id} onEdificacionChange={setId} />
}

type UserEventClic = {
  click: (el: HTMLElement) => Promise<unknown>
}

/**
 * Réplica de `elegirListbox` (el panel del selector es un portal en body,
 * igual que en las stories de Análisis).
 */
async function elegirListbox(
  trigger: HTMLElement,
  valor: string,
  user: UserEventClic
): Promise<void> {
  await user.click(trigger)
  const doc = trigger.ownerDocument
  const panel = await waitFor(() => {
    const abierto = doc.querySelector('[role="listbox"]')
    expect(abierto, 'listbox abierto').not.toBeNull()
    return abierto as HTMLElement
  })
  const opcion = panel.querySelector<HTMLElement>(`[data-value="${valor}"]`)
  expect(opcion, `opción con data-value "${valor}"`).not.toBeNull()
  await user.click(opcion as HTMLElement)
}

/** Elige el Campus Bloque A en el selector de edificación del panel. */
async function seleccionarCampus(
  canvas: { getByLabelText: (rx: RegExp) => HTMLElement },
  user: UserEventClic
): Promise<void> {
  await elegirListbox(canvas.getByLabelText(/edificación/i), 'ed-campus-00000001', user)
}

/** Puebla un campo de texto del formulario con el valor completo. */
async function llenarTexto(campo: HTMLElement, valor: string): Promise<void> {
  await userEvent.clear(campo)
  await userEvent.type(campo, valor)
}

export const ContextoDeEdificacionRequerido: Story = {
  name: 'Sin edificación seleccionada: estado vacío y sin acciones',
  play: async ({ canvas }) => {
    // Sin contexto no se listan ni se crean eventos.
    await expect(await canvas.findByText('Seleccione una edificación')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Nuevo evento' })).toBeNull()
    await expect(canvas.queryByText('Semana de la infraestructura')).toBeNull()
  },
}

export const ListaEventosPorNivel: Story = {
  name: 'Lista los eventos del árbol con tipo, rango y nivel del ámbito (S7/S8)',
  play: async ({ canvas, userEvent }) => {
    await seleccionarCampus(canvas, userEvent)

    // Los 5 eventos del campus (los de otra edificación jamás aparecen).
    await expect(await canvas.findByText('Semana de la infraestructura')).toBeVisible()
    await expect(await canvas.findByText('Sustentación de tesis')).toBeVisible()
    await expect(await canvas.findByText('Mantenimiento chiller A-102')).toBeVisible()
    await expect(await canvas.findByText('Corte de suministro al HVAC')).toBeVisible()
    await expect(await canvas.findByText('Feria de ciencias 2025')).toBeVisible()
    expect(canvas.queryByText('Cierre por auditoría interna')).toBeNull()

    // Rango de ocurrencia (S7): «16–20 nov», día único «27 nov» y vencido «10–12 sep».
    await expect(await canvas.findByText('16–20 nov')).toBeVisible()
    await expect(await canvas.findByText('27 nov')).toBeVisible()
    await expect(await canvas.findByText('10–12 sep')).toBeVisible()

    // Ámbito por nivel (S8): badge con el nivel exacto de cada fila
    // (orden cronológico: vencido, equipo, edificación, espacio, bloque).
    const niveles = Array.from(
      document.querySelectorAll<HTMLElement>('[data-nivel]')
    ).map((el) => el.dataset.nivel)
    expect(niveles).toEqual(['EDIFICACION', 'EQUIPO', 'EDIFICACION', 'ESPACIO', 'BLOQUE'])

    // Dos eventos son de nivel EDIFICACION (Semana + la feria vencida):
    // hay dos badges «Edificación completa», por eso getAllByText.
    expect(canvas.getAllByText('Edificación completa')).toHaveLength(2)
    await expect(await canvas.findByText('Espacio · Aula 101')).toBeVisible()
    await expect(await canvas.findByText('Equipo · HVAC (Aula 101)')).toBeVisible()
    await expect(await canvas.findByText('Bloque · A-102 — Ala Sur')).toBeVisible()

    // Chips de tipo con texto neutro (el color vive en el punto).
    await expect(await canvas.findByLabelText('Tipo Institucional')).toBeVisible()
    await expect(await canvas.findByLabelText('Tipo Mantenimiento')).toBeVisible()
  },
}

export const CreaEventoConFormulario: Story = {
  name: 'Nuevo evento: abrir, llenar y guardar → aparece en la lista',
  play: async ({ canvas, userEvent }) => {
    await seleccionarCampus(canvas, userEvent)

    await userEvent.click(canvas.getByRole('button', { name: 'Nuevo evento' }))
    await expect(canvas.getByLabelText(/nombre/i)).toBeVisible()

    await llenarTexto(canvas.getByLabelText(/^nombre/i), 'Reunión de consejo')
    // Los inputs `type="date"` no aceptan tipeo carácter a carácter: se
    // dispara change con el valor completo (mismo truco que en Análisis).
    fireEvent.change(canvas.getByLabelText(/fecha de inicio/i), {
      target: { value: '2026-11-30' },
    })
    await userEvent.click(canvas.getByRole('button', { name: 'Guardar evento' }))

    // La fila creada (id del doble) entra a la lista, el toast confirma y
    // el form se cierra (el toast vive en un portal sobre body).
    await expect(await canvas.findByText('Reunión de consejo')).toBeVisible()
    await waitFor(() => {
      expect(document.body.textContent).toContain('Evento creado.')
    })
    await expect(canvas.getByRole('button', { name: 'Nuevo evento' })).toBeVisible()
  },
}

export const ValidacionDeNombreYFechas: Story = {
  name: 'Validación inline: nombre vacío y fecha final anterior a la inicial',
  play: async ({ canvas, userEvent }) => {
    await seleccionarCampus(canvas, userEvent)
    await userEvent.click(canvas.getByRole('button', { name: 'Nuevo evento' }))

    // Nombre vacío: bloquea antes de llegar al servidor.
    await userEvent.click(canvas.getByRole('button', { name: 'Guardar evento' }))
    await expect(await canvas.findByText('Ingrese el nombre del evento.')).toBeVisible()

    // fechaFin < fechaInicio: también inline, sin crear el evento.
    await llenarTexto(canvas.getByLabelText(/^nombre/i), 'Congreso de energética')
    fireEvent.change(canvas.getByLabelText(/fecha de inicio/i), {
      target: { value: '2026-11-20' },
    })
    fireEvent.change(canvas.getByLabelText(/fecha final/i), {
      target: { value: '2026-11-10' },
    })
    await userEvent.click(canvas.getByRole('button', { name: 'Guardar evento' }))
    await expect(
      await canvas.findByText('La fecha final debe ser posterior o igual a la inicial.')
    ).toBeVisible()

    // Nunca se creó: el nombre no está en la lista.
    expect(canvas.queryByText('Congreso de energética')).toBeNull()
  },
}

export const EliminaEventoConConfirmacion: Story = {
  name: 'Eliminar: ConfirmDialog destructivo → la fila desaparece',
  play: async ({ canvas, userEvent }) => {
    await seleccionarCampus(canvas, userEvent)

    await userEvent.click(
      canvas.getByRole('button', { name: 'Eliminar evento Sustentación de tesis' })
    )

    // El diálogo vive en un portal sobre body (no dentro del canvas).
    const dialog = await waitFor(() => {
      const abierto = document.querySelector('[role="dialog"]')
      expect(abierto, 'ConfirmDialog abierto').not.toBeNull()
      return abierto as HTMLElement
    })
    await waitFor(() => {
      expect(within(dialog).getByText('Eliminar evento')).toBeVisible()
    })
    await waitFor(() => {
      expect(within(dialog).getByText(/Sustentación de tesis/)).toBeVisible()
    })

    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))

    // La fila sale de la lista y el diálogo se cierra.
    await waitFor(() => {
      expect(canvas.queryByText('Sustentación de tesis')).toBeNull()
    })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  },
}

export const SoloLecturaSinGestion: Story = {
  name: 'Rol sin carga: la lista se consulta, sin formulario ni acciones',
  args: {
    puedeCargar: false,
  },
  play: async ({ canvas, userEvent }) => {
    await seleccionarCampus(canvas, userEvent)

    await expect(await canvas.findByText('Semana de la infraestructura')).toBeVisible()
    expect(canvas.queryByRole('button', { name: 'Nuevo evento' })).toBeNull()
    expect(canvas.queryByRole('button', { name: /eliminar evento/i })).toBeNull()
  },
}
