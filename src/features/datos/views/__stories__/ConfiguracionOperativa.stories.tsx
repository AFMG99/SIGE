import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

// El holder vive en el doble: la ruta relativa resuelve al MISMO archivo que
// el alias del componente en runtime (alias → __mocks__/serverActions.ts) y además
// satisface a tsc, que resolvería el alias al controller real.
import { ultimaConfigGuardada } from '../__mocks__/serverActions'
import { ConfiguracionOperativa } from '../ConfiguracionOperativa'
import { calendariosDemo, edificacionesDemo } from '../__fixtures__/catalogo'

const meta = {
  component: ConfiguracionOperativa,
  tags: ['ai-generated'],
} satisfies Meta<typeof ConfiguracionOperativa>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Elige una edificación en el ListboxSelect (el panel del selector es un
 * portal en body; réplica del patrón de EventosCalendario.stories).
 */
async function elegirEdificacion(
  canvas: Parameters<NonNullable<Story['play']>>[0]['canvas'],
  canvasElement: HTMLElement,
  user: { click: (el: HTMLElement) => Promise<unknown> },
  valor: string
): Promise<void> {
  await user.click(canvas.getByLabelText(/edificación/i))
  const doc = canvasElement.ownerDocument
  const panel = await waitFor(() => {
    const abierto = doc.querySelector('[role="listbox"]')
    expect(abierto, 'listbox abierto').not.toBeNull()
    return abierto as HTMLElement
  })
  const opcion = panel.querySelector<HTMLElement>(`[data-value="${valor}"]`)
  expect(opcion, `opción con data-value "${valor}"`).not.toBeNull()
  await user.click(opcion as HTMLElement)
}

export const EstadosVacios: Story = {
  name: 'Sin edificaciones registradas',
  args: { edificaciones: [], calendarios: [] },
  play: async ({ canvas }) => {
    // Sin catálogo: pista hacia la pestaña «Infraestructura».
    await expect(canvas.getByText('Sin edificaciones registradas')).toBeVisible()
    expect(canvas.queryByRole('switch', { name: /usar horarios como xe/i })).toBeNull()
  },
}

export const SinSeleccion: Story = {
  name: 'Con catálogo pero sin edificación seleccionada',
  args: { edificaciones: edificacionesDemo, calendarios: calendariosDemo },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Seleccione una edificación')).toBeVisible()
    expect(canvas.queryByLabelText(/tb \(°c\)/i)).toBeNull()
    expect(canvas.queryByRole('switch', { name: /usar horarios como xe/i })).toBeNull()
  },
}

export const ConfigCampus: Story = {
  name: 'Configuración del campus: H, Tb, Xe y ubicación (6d1)',
  args: { edificaciones: edificacionesDemo, calendarios: calendariosDemo },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    // Selector de edificación (ListboxSelect con portal): elegir el campus.
    await elegirEdificacion(canvas, canvasElement, userEvent, 'ed-campus-00000001')

    // Configuración precargada del fixture (H = 06:00–18:00, Tb = 23 °C).
    const horaInicio = canvas.getByLabelText(/inicio del día operativo/i) as HTMLSelectElement
    expect(horaInicio.value).toBe('6')
    const tb = canvas.getByLabelText(/tb \(°c\)/i) as HTMLInputElement
    expect(tb.value).toBe('23')
    await expect(canvas.getByText('Horario diario: 06:00–18:00 (12 h)')).toBeVisible()

    // Ubicación: sin campos manuales de lat/lon; chip con la ciudad elegida.
    expect(canvas.queryByLabelText(/latitud/i)).toBeNull()
    expect(canvas.queryByLabelText(/longitud/i)).toBeNull()
    await expect(canvas.getByText('Medellín, Antioquia')).toBeVisible()
    await expect(canvas.getByText('6,2477, -75,5662')).toBeVisible()

    // «Cambiar» abre la búsqueda por ciudad o zona (solo UI: sin red).
    await userEvent.click(canvas.getByRole('button', { name: /^cambiar$/i }))
    await expect(canvas.getByLabelText(/ciudad o zona/i)).toBeVisible()
    await expect(canvas.getByRole('button', { name: /buscar ubicación/i })).toBeVisible()

    // S4 (Fase 6): interruptor «Usar horarios como Xe» con su ayuda exacta.
    const interruptor = canvas.getByRole('switch', { name: /usar horarios como xe/i })
    expect((interruptor as HTMLInputElement).checked).toBe(false)
    await expect(
      canvas.getByText(
        'Apagado: Xe = horas de operación (H), comportamiento legacy bit a bit. Encendido: Xe = horas de uso de los horarios vigentes por día (edición en «Calendario»).'
      )
    ).toBeVisible()
    await userEvent.click(interruptor)
    expect((interruptor as HTMLInputElement).checked).toBe(true)

    // La GDE no se calcula aquí: solo el aviso al pie (que apunta a Calendario).
    expect(canvas.queryByRole('button', { name: /calcular gde/i })).toBeNull()
    await expect(
      canvas.getByText(/La GDE mensual se calcula desde Variables Operativas/)
    ).toBeVisible()

    // Guardar con la configuración existente: toast del servidor (mock).
    await userEvent.click(canvas.getByRole('button', { name: /actualizar configuración/i }))
    await screen.findByText(/Configuración operativa guardada/, {}, { timeout: 3000 })
  },
}

export const ValidacionSinUbicacion: Story = {
  name: 'Validación: guardar sin ubicación resuelve el error',
  args: { edificaciones: edificacionesDemo, calendarios: calendariosDemo },
  play: async ({ canvas, canvasElement, userEvent }) => {
    // «Administración Principal» no tiene lat/lon registradas.
    await elegirEdificacion(canvas, canvasElement, userEvent, 'ed-oficina-000001')

    // Sin configuración previa el botón es «Guardar configuración».
    await userEvent.click(canvas.getByRole('button', { name: /guardar configuración/i }))
    const alerta = await canvas.findByRole('alert', {}, { timeout: 3000 })
    await expect(alerta).toHaveTextContent(
      'Busque y seleccione la ubicación (ciudad o zona) de la edificación.'
    )
  },
}

export const PoliticaOperatividad: Story = {
  name: 'Flags de operatividad: domingos y festivos (S2)',
  args: { edificaciones: edificacionesDemo, calendarios: calendariosDemo },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await elegirEdificacion(canvas, canvasElement, userEvent, 'ed-campus-00000001')

    // Ambos interruptores visibles y encendidos por defecto (legado ON/ON).
    const domingos = canvas.getByRole('switch', { name: /domingos operativos/i })
    const festivos = canvas.getByRole('switch', { name: /festivos operativos/i })
    expect((domingos as HTMLInputElement).checked).toBe(true)
    expect((festivos as HTMLInputElement).checked).toBe(true)
    await expect(canvas.getByText(/ningún domingo cuenta/i)).toBeVisible()
    await expect(canvas.getByText(/festivos de Colombia/i)).toBeVisible()

    // Apagar solo domingos: el otro sigue encendido y el payload lleva los dos.
    await userEvent.click(domingos)
    expect((domingos as HTMLInputElement).checked).toBe(false)
    expect((festivos as HTMLInputElement).checked).toBe(true)
    await userEvent.click(canvas.getByRole('button', { name: /actualizar configuración/i }))
    await screen.findByText(/Configuración operativa guardada/, {}, { timeout: 3000 })
    expect(ultimaConfigGuardada.edificacionId).toBe('ed-campus-00000001')
    expect(ultimaConfigGuardada.datos).toEqual(
      expect.objectContaining({ domingosOperativos: false, festivosOperativos: true })
    )
  },
}
