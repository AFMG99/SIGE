import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'

import { HorariosEquipos } from '../HorariosEquipos'
import { horariosEquipoDemo } from '../__fixtures__/catalogo'
import { equiposExistentesDemo } from '../__fixtures__/existencias'

const meta = {
  component: HorariosEquipos,
  tags: ['ai-generated'],
  args: {
    equipos: equiposExistentesDemo.filas,
    horarios: horariosEquipoDemo,
  },
} satisfies Meta<typeof HorariosEquipos>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Primera tarjeta del fixture: HVAC del Aula 101 (bloque A-101, campus).
 * Aplican 5 horarios — equipo, espacio, bloque y dos de edificación — siempre
 * ordenados de menos a más específico.
 */
function tarjetaHvac(canvas: {
  getByText: (texto: string, opciones?: object) => HTMLElement
}): HTMLElement {
  return canvas.getByText('HVAC').closest('article') as HTMLElement
}

export const TrazabilidadPorNivel: Story = {
  name: 'Horarios aplicables por nivel con franja, días y vigencia (S3)',
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'Horarios aplicables y horas de uso' })
    ).toBeVisible()

    const card = tarjetaHvac(canvas)

    // Orden de especificidad: equipo → espacio → bloque → edificación.
    const niveles = Array.from(card.querySelectorAll('[data-nivel]')).map(
      (el) => (el as HTMLElement).dataset.nivel
    )
    expect(niveles).toEqual(['EQUIPO', 'ESPACIO', 'BLOQUE', 'EDIFICACION', 'EDIFICACION'])

    // Cada fila declara el nivel + el nombre exacto del objetivo.
    await expect(await within(card).findByText('Equipo · HVAC · Aula 101')).toBeVisible()
    await expect(await within(card).findByText('Espacio · Aula 101')).toBeVisible()
    await expect(await within(card).findByText('Bloque · A-101 — Ala Norte')).toBeVisible()

    // Franja + días + vigencia («abierta» sin extremos) en una sola línea.
    await expect(await within(card).findByText('Lun–Vie · 06:00–08:00 · abierta')).toBeVisible()
    await expect(await within(card).findByText('Sáb · 08:00–14:00 · abierta')).toBeVisible()

    // La fila vencida (A-102) sigue visible: es trazabilidad, no cálculo.
    // La vigencia es parte de la línea `días · franja · vigencia`, así que se
    // busca por regex (getByText con cadena exige coincidencia exacta total).
    await expect(await canvas.findByText('A-102 — verano 2025')).toBeVisible()
    await expect(await canvas.findByText(/01\/06\/2025 – 15\/08\/2025/)).toBeVisible()
  },
}

export const HorasDeUsoEstaSemana: Story = {
  name: 'Horas de uso por día (L…D) y total semanal · esta semana (S3)',
  play: async ({ canvas }) => {
    const card = tarjetaHvac(canvas)

    await expect(await within(card).findByText('Horas de uso · esta semana')).toBeVisible()

    // Unión de las 5 filas aplicables: L–V 06–22 = 16 h, Sáb 07–19 = 12 h, Dom = 0.
    await expect(await within(card).findByText('Lun 16 h')).toBeVisible()
    await expect(await within(card).findByText('Sáb 12 h')).toBeVisible()
    await expect(await within(card).findByText('Dom 0 h')).toBeVisible()

    // Total semanal etiquetado explícitamente como periodo «esta semana».
    await expect(await within(card).findByText('Total semanal 92 h')).toBeVisible()
    await expect(await within(card).findByText('(esta semana)')).toBeVisible()
  },
}

export const VigenciaExcluidaDelResumen: Story = {
  name: 'Vencido: aparece en los horarios, fuera del resumen semanal',
  play: async ({ canvas }) => {
    // Equipo del bloque A-102: su único horario de bloque está vencido.
    const card = canvas
      .getByText('Equipos de laboratorio')
      .closest('article') as HTMLElement

    // Traza visible… (la vigencia va en la línea combinada → regex)
    await expect(await within(card).findByText('A-102 — verano 2025')).toBeVisible()
    await expect(await within(card).findByText(/01\/06\/2025 – 15\/08\/2025/)).toBeVisible()

    // …pero la vigencia vencida no aporta horas: solo cuentan las filas de
    // edificación (06–20 y 07–19) → L–V 14 h, Sáb 12 h, total 82 h.
    await expect(await within(card).findByText('Lun 14 h')).toBeVisible()
    await expect(await within(card).findByText('Total semanal 82 h')).toBeVisible()
  },
}

export const EquipoSinHorarios: Story = {
  name: 'Estado vacío por equipo con puntería al Calendario operativo',
  args: {
    // Solo los equipos de Administración: el fixture no tiene horarios allí.
    equipos: equiposExistentesDemo.filas.filter((e) =>
      e.id.startsWith('eq-admin-')
    ),
  },
  play: async ({ canvas }) => {
    const vacios = await canvas.findAllByText(
      'Este equipo aún no tiene horarios asociados.'
    )
    expect(vacios.length).toBe(2)

    // Las dos tarjetas vacías repiten el puntería → findAllByText.
    const pistas = await canvas.findAllByText(
      /Créelos en «Calendario operativo» \(sección Edificaciones\)/
    )
    expect(pistas.length).toBe(2)
    await expect(pistas[0]).toBeVisible()
  },
}
