import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor } from 'storybook/test'

import { ComoFunciona } from '../ComoFunciona'

const meta = {
  component: ComoFunciona,
  tags: ['ai-generated'],
  args: { autoPlay: false },
} satisfies Meta<typeof ComoFunciona>

export default meta
type Story = StoryObj<typeof meta>

export const GuiaFacturas: Story = {
  name: 'Facturas de energía · 4 pasos con mock animado',
  play: async ({ canvas, userEvent }) => {
    // El paso 1 describe la lectura local del archivo
    const desc = await canvas.findByText(/se lee en el navegador/i)
    await waitFor(() => expect(desc).toBeVisible(), { timeout: 4000 })

    // El mock del paso 1 tipea el nombre del archivo (stage 1 @ 400 ms)
    const archivo = await canvas.findByText(/facturas_energia_2024/i, {}, { timeout: 4000 })
    await waitFor(() => expect(archivo).toBeVisible(), { timeout: 4000 })

    // Navegación manual al paso 3
    await userEvent.click(canvas.getByRole('button', { name: 'Ir al paso 3' }))

    // El mock del paso 3 muestra la vista previa con validación
    const mock3 = await canvas.findByText('Paso 3 · Vista previa con validación', {}, { timeout: 4000 })
    await waitFor(() => expect(mock3).toBeVisible(), { timeout: 4000 })
  },
}

export const GuiaEquipos: Story = {
  name: 'Equipos eléctricos · segmentación obligatoria',
  play: async ({ canvas, userEvent }) => {
    // Cambia la guía con el toggle (pill con layoutId)
    await userEvent.click(canvas.getByRole('button', { name: /equipos eléctricos/i }))

    // El paso 1 obliga a elegir edificación antes de leer el archivo
    const desc = await canvas.findByText(/elija o cree la edificación destino/i)
    await waitFor(() => expect(desc).toBeVisible(), { timeout: 4000 })

    // El mock despliega el catálogo de edificaciones (stage 1 @ 400 ms)
    const opcion = await canvas.findByText('Vivienda 1', {}, { timeout: 4000 })
    await waitFor(() => expect(opcion).toBeVisible(), { timeout: 4000 })

    // Al paso 3: mapeo con columnas adicionales (stage 2 @ 1300 ms)
    await userEvent.click(canvas.getByRole('button', { name: 'Ir al paso 3' }))
    const chip = await canvas.findByText('Columnas adicionales del inventario', {}, { timeout: 4000 })
    await waitFor(() => expect(chip).toBeVisible(), { timeout: 4000 })
  },
}

export const GuiaLineasBase: Story = {
  name: 'Líneas base · 4 pasos de la Resolución UPME',
  play: async ({ canvas, userEvent }) => {
    // Tercera guía del toggle (pill con layoutId)
    await userEvent.click(canvas.getByRole('button', { name: /líneas base/i }))

    // El paso 1 exige la ventana mínima de 36 meses depurados
    const desc = await canvas.findByText(/al menos 36 meses de consumo depurado/i, {}, { timeout: 4000 })
    await waitFor(() => expect(desc).toBeVisible(), { timeout: 4000 })

    // El mock del paso 1 selecciona el bloque y muestra sus meses (stage 3 @ 2200 ms)
    const chip = await canvas.findByText('48 meses de historia', {}, { timeout: 4000 })
    await waitFor(() => expect(chip).toBeVisible(), { timeout: 4000 })

    // Al paso 3: puertas UPME aprobadas (stage 3 @ 2200 ms)
    await userEvent.click(canvas.getByRole('button', { name: 'Ir al paso 3' }))
    const puertas = await canvas.findByText('4 de 4 puertas aprobadas', {}, { timeout: 4000 })
    await waitFor(() => expect(puertas).toBeVisible(), { timeout: 4000 })
  },
}

export const GuiaAutomatica: Story = {
  name: 'Auto-play activo (5 s por paso)',
  args: { autoPlay: true },
}
