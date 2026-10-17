import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fireEvent, within } from 'storybook/test'

import { ConfiguracionCalendario } from '../ConfiguracionCalendario'
import {
  bloquesDemo,
  calendariosDemo,
  espaciosDemo,
  horariosEquipoDemo,
  rangosCalendarioDemo,
} from '../__fixtures__/catalogo'
import { equiposExistentesDemo } from '../__fixtures__/existencias'

const base = {
  calendarios: calendariosDemo,
  rangos: rangosCalendarioDemo,
  horarios: horariosEquipoDemo,
  bloques: bloquesDemo,
  espacios: espaciosDemo,
  equipos: equiposExistentesDemo.filas,
  puedeCargar: true,
}

const meta = {
  component: ConfiguracionCalendario,
  tags: ['ai-generated'],
} satisfies Meta<typeof ConfiguracionCalendario>

export default meta
type Story = StoryObj<typeof meta>

export const SinSeleccion: Story = {
  name: 'Sin edificación seleccionada (selector compartido vacío)',
  args: { ...base, edificacionId: '' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Sin edificación seleccionada')).toBeVisible()
    expect(canvas.queryByLabelText(/fecha de inicio/i)).toBeNull()
  },
}

export const SinConfiguracion: Story = {
  name: 'Edificación sin configuración operativa',
  args: { ...base, edificacionId: 'ed-oficina-000001' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Sin configuración operativa')).toBeVisible()
    expect(canvas.queryByLabelText(/fecha de inicio/i)).toBeNull()
  },
}

export const RangosYHorariosDelCampus: Story = {
  name: 'Rangos, plantilla TdeA y horarios del campus (6d2/6d3)',
  args: { ...base, edificacionId: 'ed-campus-00000001' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    // Rangos del fixture: lectivo con nombre y vacaciones sin nombre.
    // (Las etiquetas del catálogo también viven en las <option> del select:
    // se cuentan los nodos en vez de exigir coincidencia única.)
    await expect(canvas.getByText('09/02/2026 → 13/06/2026')).toBeVisible()
    await expect(canvas.getByText(/Período académico 2026-1/)).toBeVisible()
    expect(canvas.getAllByText('Día lectivo / hábil (operativo)').length).toBeGreaterThanOrEqual(1)
    await expect(canvas.getByText('14/06/2026 → 02/08/2026')).toBeVisible()
    expect(canvas.getAllByText('Vacaciones / receso (no operativo)').length).toBeGreaterThanOrEqual(1)

    // Agregar un rango con fechas válidas (mock del servidor).
    fireEvent.change(canvas.getByLabelText(/fecha de inicio/i), {
      target: { value: '2026-09-01' },
    })
    fireEvent.change(canvas.getByLabelText(/fecha de fin/i), { target: { value: '2026-09-30' } })
    fireEvent.change(canvas.getByLabelText(/tipo de día/i), { target: { value: 'VACACIONES' } })
    await userEvent.type(canvas.getByLabelText(/nombre del rango/i), 'Receso de septiembre')
    await userEvent.click(canvas.getByRole('button', { name: /agregar rango/i }))
    await screen.findByText(/Rango agregado al calendario/, {}, { timeout: 3000 })

    // Validación: fin anterior a inicio devuelve error sin tocar el servidor.
    // (El alta exitosa resetea el formulario —como el drawer—, así que se
    // rellenan ambas fechas con la relación invertida. Matcher por texto:
    // el toast de éxito anterior también es role="alert".)
    fireEvent.change(canvas.getByLabelText(/fecha de inicio/i), {
      target: { value: '2026-09-15' },
    })
    fireEvent.change(canvas.getByLabelText(/fecha de fin/i), { target: { value: '2026-09-01' } })
    await userEvent.click(canvas.getByRole('button', { name: /agregar rango/i }))
    await expect(
      canvas.findByText('La fecha de fin no puede ser anterior a la de inicio.', {}, { timeout: 3000 })
    ).resolves.toBeVisible()

    // Plantilla TdeA: confirmación explícita antes de reemplazar.
    // (El diálogo anima su entrada: se localiza y se confirma —el toast posterior
    // es la prueba de que el wiring funciona, igual que en el story del drawer.)
    await userEvent.click(canvas.getByRole('button', { name: /cargar plantilla tdea/i }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /cargar plantilla/i }))
    await screen.findByText(/Plantilla cargada \(7 rangos\)/, {}, { timeout: 3000 })

    // Horarios del fixture: nombre, franja y chip de vigencia.
    await expect(canvas.getByText('Iluminación aulas')).toBeVisible()
    await expect(canvas.getByText('06:00–20:00')).toBeVisible()
    await expect(canvas.getAllByText('Vigente').length).toBeGreaterThan(0)

    // Crear horario: nombre + al menos un día + horas por defecto (8–17).
    await userEvent.type(canvas.getByLabelText(/nombre del horario/i), 'Aula con clases')
    await userEvent.click(canvas.getByRole('button', { name: 'Lun', pressed: false }))
    expect(canvas.getByRole('button', { name: 'Lun' }).getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(canvas.getByRole('button', { name: /crear horario/i }))
    await screen.findByText(/Horario agregado\./, {}, { timeout: 3000 })

    // Ámbito jerárquico (S12): el listbox incluye bloques del árbol del campus.
    await userEvent.click(canvas.getByLabelText(/ámbito/i))
    const panel = await screen.findByRole('listbox')
    expect(panel.querySelector('[data-value="bloque:bk-campus-a101-001"]')).not.toBeNull()
    expect(panel.querySelector('[data-value=""]')).not.toBeNull()
    await userEvent.click(panel.querySelector('[data-value="bloque:bk-campus-a101-001"]') as HTMLElement)
    // El portal del listbox puede quedar montado al cerrarse: se afirma contra
    // el trigger (nombre accesible «Ámbito» por el label, texto interno + data-value).
    const triggerAmbito = canvas.getByRole('button', { name: /ámbito/i })
    expect(triggerAmbito.getAttribute('data-value')).toBe('bloque:bk-campus-a101-001')
    await expect(within(triggerAmbito).getByText('Bloque A-101 — Ala Norte')).toBeVisible()
  },
}
