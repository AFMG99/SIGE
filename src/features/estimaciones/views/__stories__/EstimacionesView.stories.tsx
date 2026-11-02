import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor } from 'storybook/test'

import { EstimacionesView } from '../EstimacionesView'
import {
  __setearHistorialCorto,
  __setearSinLineaBase,
} from '../__mocks__/serverActions'
import {
  bloquesDemo,
  edificacionesDemo,
} from '../__fixtures__/forecast'

const meta = {
  component: EstimacionesView,
  tags: ['ai-generated'],
  args: {
    edificaciones: [edificacionesDemo[0]],
    bloques: bloquesDemo,
    puedeEjecutar: true,
    puedeCrearOrden: true,
    puedeDiagnosticar: true,
  },
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof EstimacionesView>

export default meta
type Story = StoryObj<typeof meta>

export const ConfiguracionInicial: Story = {
  name: 'Configuración inicial · horizonte y orden automático',
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Estimaciones energéticas' })
    await canvas.findByLabelText('Edificación')
    await canvas.findByLabelText('Alcance de consumo')
    await canvas.findByRole('combobox', { name: 'Horizonte' })
    await canvas.findByText(/Se recomiendan al menos 36 meses depurados/)
    await canvas.findByRole('button', { name: 'Generar proyección' })
    await canvas.findByText(/no modifica la LBEn regulatoria/i)
  },
}

export const HistorialMenorA36Meses: Story = {
  name: 'Histórico menor a 36 meses · advertencia y estimación',
  play: async ({ canvas, userEvent }) => {
    __setearHistorialCorto(true)
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Generar proyección' }))
      await canvas.findByRole('heading', { name: 'Proyección para los próximos 3 meses' })
      await canvas.findByText(
        /Se requieren al menos 36 meses depurados; solo hay 35/i
      )
      await canvas.findByText('35 meses')
    } finally {
      __setearHistorialCorto(false)
    }
  },
}

export const ConProyeccion: Story = {
  name: 'Resultado · pronóstico, LBEn y diagnósticos',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Generar proyección' }))
    await canvas.findByRole('heading', { name: 'Proyección para los próximos 3 meses' })
    await canvas.findByRole('img', {
      name: /serie histórica y proyección mensual de Campus Robledo/i,
    })
    await canvas.findByText('Histórico depurado')
    await canvas.findByText('Proyección ARIMA')
    await canvas.findByText('LBEn guardada · bloque')
    await canvas.findByText('Atípicos imputados')
    await canvas.findByText('Diagnóstico del modelo')
    await canvas.findAllByText('2027-03')
    await waitFor(() => {
      expect(canvas.getByText(/no reemplaza ni modifica la LBEn/i)).toBeTruthy()
    })
  },
}

export const SoloConsulta: Story = {
  name: 'Consulta · sin controles avanzados',
  args: {
    edificaciones: [edificacionesDemo[0]],
    bloques: bloquesDemo,
    puedeEjecutar: true,
    puedeCrearOrden: false,
    puedeDiagnosticar: false,
  },
  play: async ({ canvas }) => {
    await canvas.findByRole('button', { name: 'Generar proyección' })
    expect(canvas.queryByText('Opciones avanzadas')).toBeNull()
    expect(
      canvas.queryByLabelText('Definir orden ARIMA manual (p, d, q)')
    ).toBeNull()
  },
}

export const SoloEvaluacion: Story = {
  name: 'Evaluación · diagnósticos sin orden manual',
  args: {
    edificaciones: [edificacionesDemo[0]],
    bloques: bloquesDemo,
    puedeEjecutar: true,
    puedeCrearOrden: false,
    puedeDiagnosticar: true,
  },
  play: async ({ canvas }) => {
    await canvas.findByRole('button', { name: 'Generar proyección' })
    expect(canvas.queryByText('Opciones avanzadas')).toBeNull()
    expect(
      canvas.queryByLabelText('Definir orden ARIMA manual (p, d, q)')
    ).toBeNull()
  },
}

export const SinLineaBaseGuardada: Story = {
  name: 'Sin LBEn guardada · proyección sin comparación',
  play: async ({ canvas, userEvent }) => {
    __setearSinLineaBase(true)
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Generar proyección' }))
      await canvas.findByRole('heading', { name: 'Proyección para los próximos 3 meses' })
      await canvas.findByText(/No hay una LBEn de valor absoluto guardada para comparar/)
      await canvas.findByRole('img', {
        name: /serie histórica y proyección mensual/i,
      })
    } finally {
      __setearSinLineaBase(false)
    }
  },
}
