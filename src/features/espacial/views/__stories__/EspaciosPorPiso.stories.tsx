import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn } from 'storybook/test'
import { EspaciosPorPiso } from '../ui/EspaciosPorPiso'
import { TODOS_LOS_PISOS } from '../../models/espaciosPorPiso'
import type { Edificacion3DScene } from '../../models/espacial.types'

const edificacionDemo: Edificacion3DScene = {
  id: 'ed-campus',
  nombre: 'Campus Bloque 5',
  tipo: 'EDUCATIVO_CAMPUS',
  area: 2400,
  bloques: [
    {
      id: 'bloque-5',
      codigo: 'B5',
      nombre: 'Bloque 5',
      areaUtil: 1800,
      areaHuellaM2: 900,
      largoM: 30,
      anchoM: 30,
      altoM: 12,
      factorInfraestructura: 2,
      renderMode: 'PARAMETRIC',
      position: [0, 3, 0],
      dimensions: [8.4, 3.36, 8.4],
      metricas: {
        areaUtil: 1800,
        potenciaTotalW: 8200,
        cantidadEquipos: 46,
        densidadPotenciaWm2: 4.56,
      },
      espacios: [
        {
          id: 'espacio-101',
          nombre: 'Aula 101',
          bloqueId: 'bloque-5',
          piso: '1',
          largoM: 8,
          anchoM: 6,
          altoM: 3,
          areaCalculadaM2: 48,
          equipos: [],
          potenciaTotalW: 2400,
          cantidadEquipos: 8,
        },
        {
          id: 'espacio-201',
          nombre: 'Aula 201',
          bloqueId: 'bloque-5',
          piso: '2',
          largoM: 7,
          anchoM: 6,
          altoM: 3,
          areaCalculadaM2: 42,
          equipos: [],
          potenciaTotalW: 1800,
          cantidadEquipos: 6,
        },
      ],
    },
  ],
  totales: {
    potenciaTotalW: 8200,
    areaTotalM2: 1800,
    cantidadEquipos: 46,
    densidadPromedioWm2: 4.56,
  },
}

const meta = {
  component: EspaciosPorPiso,
  tags: ['ai-generated'],
  args: {
    edificacion: edificacionDemo,
    pisoSeleccionado: TODOS_LOS_PISOS,
    onPisoChange: fn(),
    onVerBloque: fn(),
  },
} satisfies Meta<typeof EspaciosPorPiso>

export default meta
type Story = StoryObj<typeof meta>

export const CatalogoPorNivel: Story = {
  name: 'Consultar espacios por piso',
  render: (args) => {
    const [piso, setPiso] = useState(args.pisoSeleccionado)
    return (
      <EspaciosPorPiso
        {...args}
        pisoSeleccionado={piso}
        onPisoChange={setPiso}
      />
    )
  },
  play: async ({ canvas, userEvent, args }) => {
    const selector = canvas.getByRole('combobox', { name: 'Filtrar espacios por piso' })
    await userEvent.selectOptions(selector, '2')

    await expect(canvas.getByText('Aula 201')).toBeVisible()
    await expect(canvas.queryByText('Aula 101')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Ver bloque 3D' }))
    await expect(args.onVerBloque).toHaveBeenCalledWith('bloque-5')
  },
}
