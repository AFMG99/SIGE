import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'

import { CalendarioFestivos } from '../CalendarioFestivos'
import {
  calendariosDemo,
  eventosDemo,
  horariosEquipoDemo,
  rangosCalendarioDemo,
} from '../__fixtures__/catalogo'

const meta = {
  component: CalendarioFestivos,
  tags: ['ai-generated'],
} satisfies Meta<typeof CalendarioFestivos>

export default meta
type Story = StoryObj<typeof meta>

export const Julio2026: Story = {
  name: 'Julio de 2026 con festivos',
  args: { mesInicial: 7, anoInicial: 2026 },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('julio de 2026')).toBeVisible()

    // Sin edificación (S9): pista de contexto visible y nada de contexto superpuesto.
    await expect(
      canvas.getByText('Selecciona una edificación para ver eventos, tipo de día y horas de uso.')
    ).toBeVisible()
    expect(canvas.queryByText(/festivos · /)).toBeNull()

    // Lista del mes con los dos festivos oficiales (Chiquinquirá — Ley
    // 2578/2026 — y el 20 de julio). La rejilla también los muestra, pero
    // truncada: se consulta por la lista para evitar matches ambiguos.
    const lista = canvas.getByRole('list')
    await expect(
      within(lista).getByText('Nuestra Señora del Rosario de Chiquinquirá')
    ).toBeVisible()
    await expect(within(lista).getByText('Día de la Independencia')).toBeVisible()

    // Navegación de meses (S11: vista mensual navegable).
    await userEvent.click(canvas.getByRole('button', { name: 'Mes siguiente' }))
    await expect(canvas.getByText('agosto de 2026')).toBeVisible()
    await expect(within(canvas.getByRole('list')).getByText('Batalla de Boyacá')).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Mes anterior' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Mes anterior' }))
    await expect(canvas.getByText('junio de 2026')).toBeVisible()
    await expect(
      within(canvas.getByRole('list')).getByText('Sagrado Corazón de Jesús')
    ).toBeVisible()
  },
}

export const FebreroSinFestivos: Story = {
  name: 'Mes sin festivos (febrero 2026)',
  args: { mesInicial: 2, anoInicial: 2026 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('febrero de 2026')).toBeVisible()
    await expect(canvas.getByText('Sin festivos nacionales en este mes.')).toBeVisible()
    // La rejilla sigue mostrando los 28 días del mes.
    await expect(canvas.getByText('28')).toBeVisible()
  },
}

export const VistaAno: Story = {
  name: 'S5 · Vista de año (12 meses) y salto a un mes',
  args: { mesInicial: 7, anoInicial: 2026 },
  play: async ({ canvas, userEvent }) => {
    // Abrir la vista de año: 12 tarjetas, una por mes, con su recuento.
    await userEvent.click(canvas.getByRole('button', { name: 'Ver los 12 meses' }))
    const grupo = await canvas.findByRole('group', { name: 'Los 12 meses de 2026' })
    expect(within(grupo).getAllByRole('button', { name: /Elegir / })).toHaveLength(12)
    await expect(within(grupo).getByRole('button', { name: 'Elegir junio de 2026 (3 festivos)' })).toBeVisible()
    await expect(within(grupo).getByRole('button', { name: 'Elegir septiembre de 2026 (0 festivos)' })).toBeVisible()

    // El mes en curso lleva aria-current (solo si el reloj cae en 2026).
    if (new Date().getFullYear() === 2026) {
      expect(within(grupo).getAllByRole('button', { current: 'date' })).toHaveLength(1)
    }

    // Navegación de años desde la vista de año (cualquier año, sin rango).
    await userEvent.click(canvas.getByRole('button', { name: 'Año anterior' }))
    await expect(
      await canvas.findByRole('group', { name: 'Los 12 meses de 2025' })
    ).toBeVisible()
    await expect(canvas.getByText('julio de 2025')).toBeVisible()
    await expect(canvas.getByText('2025')).toBeVisible()
    // Ley 2578/2026: en 2025 julio solo tiene el día 20.
    await expect(
      canvas.getByRole('button', { name: 'Elegir julio de 2025 (1 festivo)' })
    ).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Año siguiente' }))
    await expect(
      await canvas.findByRole('group', { name: 'Los 12 meses de 2026' })
    ).toBeVisible()

    // Saltar a julio desde su tarjeta: la vista mensual muestra el mes elegido.
    await userEvent.click(
      within(canvas.getByRole('group', { name: 'Los 12 meses de 2026' })).getByRole('button', {
        name: 'Elegir julio de 2026 (2 festivos)',
      })
    )
    await expect(canvas.getByText('julio de 2026')).toBeVisible()
    await expect(canvas.getByRole('grid')).toBeVisible()

    // La navegación de meses cruza el cambio de año en cualquier vista.
    for (let i = 0; i < 7; i++) {
      await userEvent.click(canvas.getByRole('button', { name: 'Mes anterior' }))
    }
    await expect(canvas.getByText('diciembre de 2025')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Mes siguiente' }))
    await expect(canvas.getByText('enero de 2026')).toBeVisible()

    // «Hoy» sale de la vista de año y vuelve a la vista mensual del mes actual.
    const d = new Date()
    const MESES = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ]
    await userEvent.click(canvas.getByRole('button', { name: 'Ver los 12 meses' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Hoy' }))
    await expect(canvas.getByRole('grid')).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: 'Ver los 12 meses', pressed: false })
    ).toBeVisible()
    await expect(canvas.getByText(`${MESES[d.getMonth()]} de ${d.getFullYear()}`)).toBeVisible()
  },
}

export const VistaSemana: Story = {
  name: 'S6 · Vista semanal (lun–dom) con festivos',
  args: { mesInicial: 7, anoInicial: 2026 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Semana' }))
    await expect(canvas.getByRole('button', { name: 'Semana', pressed: true })).toBeVisible()

    // Julio 2026 (mes referido, hoy fuera): el ancla es el día 1 y la semana
    // mostrada es lun 29 jun – dom 5 jul 2026, con festivo del lunes.
    await expect(canvas.getByText('2026-06-29')).toBeVisible()
    await expect(canvas.getByText('2026-07-05')).toBeVisible()
    expect(canvas.getAllByText(/^\d{4}-\d{2}-\d{2}$/)).toHaveLength(7)
    await expect(canvas.getByText('San Pedro y San Pablo')).toBeVisible()
    await expect(canvas.getByText('EMILIANI')).toBeVisible()

    // Avanzar y retroceder semanas (±7 días, cruza de mes).
    await userEvent.click(canvas.getByRole('button', { name: 'Semana ›' }))
    await expect(canvas.getByText('2026-07-06')).toBeVisible()
    await expect(canvas.queryByText('2026-06-29')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Semana ›' }))
    await expect(canvas.getByText('2026-07-13')).toBeVisible()
    await expect(canvas.getByText('Nuestra Señora del Rosario de Chiquinquirá')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '‹ Semana' }))
    await userEvent.click(canvas.getByRole('button', { name: '‹ Semana' }))
    await expect(canvas.getByText('2026-06-29')).toBeVisible()

    // Coherencia: cambiar de mes desde la vista semanal sigue en ella y
    // traslada el ancla al nuevo mes.
    await userEvent.click(canvas.getByRole('button', { name: 'Mes siguiente' }))
    await expect(canvas.getByText('agosto de 2026')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Semana', pressed: true })).toBeVisible()
    await expect(canvas.getByText('2026-08-01')).toBeVisible()
  },
}

export const VistaAgenda: Story = {
  name: 'S6 · Vista de agenda (festivos del mes)',
  args: { mesInicial: 7, anoInicial: 2026 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Agenda' }))
    await expect(canvas.getByText('Agenda de julio de 2026')).toBeVisible()

    // Una fila por día con contenido, con fecha corta, nombre y badge de origen.
    await expect(canvas.getByText('13 jul')).toBeVisible()
    await expect(canvas.getByText('Nuestra Señora del Rosario de Chiquinquirá')).toBeVisible()
    await expect(canvas.getByText('EMILIANI')).toBeVisible()
    await expect(canvas.getByText('20 jul')).toBeVisible()
    await expect(canvas.getByText('Día de la Independencia')).toBeVisible()
    await expect(canvas.getByText('FIJO')).toBeVisible()

    // El mes siguiente sigue en la vista agenda.
    await userEvent.click(canvas.getByRole('button', { name: 'Mes siguiente' }))
    await expect(canvas.getByText('Agenda de agosto de 2026')).toBeVisible()
    await expect(canvas.getByText('Batalla de Boyacá')).toBeVisible()

    // Volver a «Mes» restaura la rejilla.
    await userEvent.click(canvas.getByRole('button', { name: 'Mes' }))
    await expect(canvas.getByRole('grid')).toBeVisible()
  },
}

export const AgendaVacia: Story = {
  name: 'S6 · Agenda de un mes sin festivos (febrero 2026)',
  args: { mesInicial: 2, anoInicial: 2026 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Agenda' }))
    await expect(canvas.getByText('Agenda de febrero de 2026')).toBeVisible()
    await expect(canvas.getByText('Sin eventos en este mes.')).toBeVisible()
  },
}

/**
 * Rango del período 2026-2 (story-only): los fixtures compartidos cubren
 * 2026-1 y vacaciones, y «octubre fuera de rangos» sostiene otras stories.
 */
const RANGO_2026_2 = {
  id: 'rg-story-periodo-2026-2',
  calendarioId: 'cal-campus-0000001',
  fechaInicio: '2026-08-03',
  fechaFin: '2026-12-18',
  tipoDia: 'LECTIVO',
  nombre: 'Período académico 2026-2',
}

export const ContextoDeEdificacion: Story = {
  name: 'S9 · Con edificación: eventos, tipo de día y horas de uso',
  args: {
    mesInicial: 11,
    anoInicial: 2026,
    edificacionId: 'ed-campus-00000001',
    calendarios: calendariosDemo,
    rangos: [...rangosCalendarioDemo, RANGO_2026_2],
    horarios: horariosEquipoDemo,
    eventos: eventosDemo,
  },
  play: async ({ canvas, userEvent }) => {
    // Resumen del mes (solo display): 30 días lectivos (rango 2026-2),
    // 2 festivos nacionales (2 y 16 nov) y 3 eventos del árbol del campus.
    await expect(
      await canvas.findByText('30 días lectivos · 2 festivos · 3 eventos')
    ).toBeVisible()
    // Hay contexto: la pista de festivos-only no aparece.
    expect(
      canvas.queryByText('Selecciona una edificación para ver eventos, tipo de día y horas de uso.')
    ).toBeNull()

    // Celda 14 nov: día lectivo + el evento de nivel equipo (herencia S8).
    const celda14 = canvas.getByLabelText(/14 de noviembre/)
    expect(celda14.getAttribute('aria-label')).toContain('día lectivo')
    expect(celda14.getAttribute('aria-label')).toContain('1 evento')
    // Celda 16 nov: festivo de Cartagena + evento de la semana institucional.
    const celda16 = canvas.getByLabelText(/16 de noviembre/)
    expect(celda16.getAttribute('aria-label')).toContain('festivo: Independencia de Cartagena')
    expect(celda16.getAttribute('aria-label')).toContain('1 evento')
    // El evento de la otra edificación jamás se superpone.
    const celda3 = canvas.getByLabelText(/^3 de noviembre,/)
    expect(celda3.getAttribute('aria-label')).not.toContain('evento')

    // Vista semanal (lun 9 – dom 15 nov): chip de tipo + badge de horas.
    await userEvent.click(canvas.getByRole('button', { name: 'Semana' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Semana ›' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Semana ›' }))
    await expect(canvas.getByText('2026-11-09')).toBeVisible()
    await expect(canvas.getByText('2026-11-15')).toBeVisible()
    expect(canvas.getAllByText('Lectivo')).toHaveLength(7)
    await expect(canvas.getByText('Corte de suministro al HVAC')).toBeVisible()
    // Sábado 14: HVAC administración (7–19) ∪ Aula 101 (8–14) = 12 h unidas.
    await expect(canvas.getByText('12 h')).toBeVisible()

    // Agenda: festivos + eventos expandidos por rango, con badge de ámbito.
    await userEvent.click(canvas.getByRole('button', { name: 'Agenda' }))
    await expect(canvas.getByText('Agenda de noviembre de 2026')).toBeVisible()
    await expect(canvas.getByText('Todos los Santos')).toBeVisible()
    await expect(canvas.getByText('Corte de suministro al HVAC')).toBeVisible()
    await expect(canvas.getByText('Equipo · HVAC (Aula 101)')).toBeVisible()
    await expect(canvas.getByText('Independencia de Cartagena')).toBeVisible()
    // Evento multía (16–20 nov) expandido a un renglón por día (badge por fila).
    expect(canvas.getAllByText('Semana de la infraestructura')).toHaveLength(5)
    expect(canvas.getAllByText('Edificación completa')).toHaveLength(5)
    await expect(canvas.getByText('Sustentación de tesis')).toBeVisible()
    await expect(canvas.getByText('Espacio · Aula 101')).toBeVisible()
    expect(canvas.queryByText('Cierre por auditoría interna')).toBeNull()
  },
}
