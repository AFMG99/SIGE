import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor } from 'storybook/test'

import { AnalisisView } from '../AnalisisView'
import {
  edificacionesAnalisisDemo,
  edificacionUnicaDemo,
} from '../__fixtures__/analisis'

/**
 * El panel de la story no tiene wrapper de página: los espaciados
 * `space-y-6` de la vista conviven con el fondo del canvas de Storybook.
 */

type UserEventClic = {
  click: (el: HTMLElement) => Promise<unknown>
}

/** Réplica mínima de `elegirListbox` (el panel es un portal en body). */
async function elegirListbox(
  trigger: HTMLElement,
  valor: string,
  userEvent: UserEventClic
): Promise<void> {
  await userEvent.click(trigger)
  const doc = trigger.ownerDocument
  const panel = await waitFor(() => {
    const abierto = doc.querySelector('[role="listbox"]')
    expect(abierto, 'listbox abierto').not.toBeNull()
    return abierto as HTMLElement
  })
  const opcion = panel.querySelector<HTMLElement>(`[data-value="${valor}"]`)
  expect(opcion, `opción con data-value "${valor}"`).not.toBeNull()
  await userEvent.click(opcion as HTMLElement)
}

const meta = {
  component: AnalisisView,
  tags: ['ai-generated'],
  args: {
    edificaciones: edificacionUnicaDemo,
    puedeAnalizar: true,
  },
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof AnalisisView>

export default meta
type Story = StoryObj<typeof meta>

export const SinAnalisis: Story = {
  name: 'Estado inicial · sin análisis ejecutado',
  play: async ({ canvas }) => {
    await canvas.findByText('Análisis estadístico y patrones')
    await canvas.findByText(/Sin análisis ejecutado/i)
    await canvas.findByText(/No se guarda información/i)

    // Con una sola edificación el selector viene elegido: solo falta ejecutar
    const boton = await canvas.findByRole('button', { name: /ejecutar análisis/i })
    await waitFor(() => expect(boton).toBeEnabled())
  },
}

export const ConResultados: Story = {
  name: 'Con resultados · tarjetas, gráfica y períodos inusuales',
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText(/Sin análisis ejecutado/i)
    await userEvent.click(canvas.getByRole('button', { name: /ejecutar análisis/i }))

    // Cabecera del análisis: edificación + rango
    await canvas.findByRole('heading', { level: 2, name: 'Campus Robledo' })
    await canvas.findByText(/2023-01 → 2025-12/)

    // Tarjetas de resumen
    await canvas.findByText('Períodos analizados')
    await canvas.findByText('Períodos inusuales')
    await canvas.findByText('Evaluados con banda')
    await canvas.findByText('Tendencia anual')
    await canvas.findByText('+0,8 %')

    // Gráfica SVG con su resumen accesible (36 períodos, 2 ámbar)
    await canvas.findByRole('img', {
      name: /serie mensual de consumo de 36 períodos/i,
    })
    await canvas.findByText(/media 10\.250 kWh/)

    // Leyenda de las capas
    await canvas.findByText(/Período inusual/i)
    await canvas.findByText(/Vacaciones \(calendario académico\)/i)

    // Tabla de períodos inusuales con su explicación estadística
    await canvas.findByText('Períodos inusuales')
    await canvas.findByText(/1 en alza · 1 en caída · 2 en período lectivo/)
    await canvas.findByText('marzo de 2024')
    await canvas.findByText(/El consumo de marzo de 2024 \(14\.000,0 kWh\)/)
    await canvas.findByText(/agosto de 2023 \(8\.000,0 kWh\)/)
    await canvas.findByText('↑ Alza')
    await canvas.findByText('↓ Caída')
    await canvas.findByText(/Período lectivo · 21 d/)

    // Los atípicos son focalizables en el teclado y anuncian su señal
    const punto = await canvas.findAllByRole('img', {
      name: /alza \(\+40,0 %\)/i,
    })
    expect(punto.length).toBeGreaterThan(0)
  },
}

export const SinAtipicos: Story = {
  name: 'Sin períodos inusuales · selector de 2 y estado vacío',
  args: {
    edificaciones: edificacionesAnalisisDemo,
  },
  play: async ({ canvas, userEvent }) => {
    // Con dos edificaciones empieza sin selección: el botón está bloqueado
    const boton = await canvas.findByRole('button', { name: /ejecutar análisis/i })
    await waitFor(() => expect(boton).toBeDisabled())

    const selector = canvas.getByLabelText(/^edificación$/i)
    await elegirListbox(selector, 'edi-demo-sede', userEvent)
    await waitFor(() => expect(boton).toBeEnabled())

    await userEvent.click(boton)
    await canvas.findByRole('heading', { level: 2, name: 'Sede Administrativa' })
    await canvas.findByText(/Sin períodos inusuales/i)
    await canvas.findByText(/quedaron dentro del rango esperado/i)

    // Sin atípicos no existe la tabla
    expect(canvas.queryByRole('table')).toBeNull()
  },
}

export const SinPermisoDeAnalisis: Story = {
  name: 'Sin permiso · controles deshabilitados',
  args: {
    puedeAnalizar: false,
  },
  play: async ({ canvas }) => {
    await canvas.findByText(/ejecutar análisis requiere el permiso/i)

    const boton = await canvas.findByRole('button', { name: /ejecutar análisis/i })
    await waitFor(() => expect(boton).toBeDisabled())

    // El selector (con la única edificación ya elegida) también está bloqueado
    const selector = await canvas.findByRole('button', { name: /campus robledo/i })
    await waitFor(() => expect(selector).toBeDisabled())
  },
}
