import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor } from 'storybook/test'

import { VistaDatos } from '../VistaDatos'
import {
  construirPanelAjustes,
  construirPanelEquipos,
  construirPanelFacturas,
  construirPanelVariables,
} from '../existencias'
import {
  ajustesExistentesDemo,
  ajustesVaciosDemo,
  equiposExistentesDemo,
  equiposVaciosDemo,
  facturasExistentesDemo,
  facturasVaciasDemo,
  variablesExistentesDemo,
  variablesVaciasDemo,
} from '../__fixtures__/existencias'

const meta = {
  component: VistaDatos,
  tags: ['ai-generated'],
  args: construirPanelFacturas(facturasExistentesDemo),
} satisfies Meta<typeof VistaDatos>

export default meta
type Story = StoryObj<typeof meta>

export const Facturas: Story = {
  name: 'Facturas de energía · gráfico y tabla',
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('Último periodo')).toBeVisible()
    await expect(await canvas.findByText('Consumo total (kWh)')).toBeVisible()
    await expect(await canvas.findByText('Consumo mensual (kWh)')).toBeVisible()

    const buscar = await canvas.findByLabelText(/buscar en datos guardados/i)
    await userEvent.type(buscar, '2024-03')
    await waitFor(
      () => {
        expect(canvas.queryByText('2024-01')).toBeNull()
      },
      { timeout: 3000 }
    )
    await expect(await canvas.findByText('2024-03')).toBeVisible()

    await userEvent.clear(buscar)
    await userEvent.type(buscar, 'zzzzzz')
    await waitFor(
      () => {
        expect(canvas.getByText('Sin coincidencias')).toBeTruthy()
      },
      { timeout: 3000 }
    )
  },
}

export const Equipos: Story = {
  name: 'Equipos eléctricos · gráfico y tabla',
  args: construirPanelEquipos(equiposExistentesDemo),
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('Potencia instalada (kW)')).toBeVisible()
    await expect(await canvas.findByText('Edificaciones con inventario')).toBeVisible()
    await expect(await canvas.findByText('Equipos por edificación')).toBeVisible()

    const buscar = await canvas.findByLabelText(/buscar en datos guardados/i)
    await userEvent.type(buscar, 'laboratorio')
    await waitFor(
      () => {
        expect(canvas.queryByText('Aula 102')).toBeNull()
      },
      { timeout: 3000 }
    )
    await expect(await canvas.findByText('Laboratorio 201')).toBeVisible()
  },
}

export const SinFacturas: Story = {
  name: 'Base de datos vacía · facturas',
  args: construirPanelFacturas(facturasVaciasDemo),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/aún no hay facturas guardadas/i)).toBeVisible()
    await expect(await canvas.findByText('0 registros')).toBeVisible()
  },
}

export const SinEquipos: Story = {
  name: 'Base de datos vacía · equipos',
  args: construirPanelEquipos(equiposVaciosDemo),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/el inventario todavía está vacío/i)).toBeVisible()
    await expect(await canvas.findByText('0 registros')).toBeVisible()
  },
}

export const Variables: Story = {
  name: 'Variables operativas · tono sky',
  args: construirPanelVariables(variablesExistentesDemo),
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('GDE promedio')).toBeVisible()
    await expect(await canvas.findByText('Población flotante prom.')).toBeVisible()
    await expect(
      await canvas.findByText('GDE mensual (Grados Día de Enfriamiento)')
    ).toBeVisible()

    const buscar = await canvas.findByLabelText(/buscar en datos guardados/i)
    await userEvent.type(buscar, 'a-102')
    // Solo quedan las filas del bloque A-102 (2024-09 y 2024-08).
    await waitFor(
      () => {
        expect(canvas.queryByText('2024-11')).toBeNull()
      },
      { timeout: 3000 }
    )
    await expect(await canvas.findByText('2024-09')).toBeVisible()
  },
}

export const SinVariables: Story = {
  name: 'Base de datos vacía · variables',
  args: construirPanelVariables(variablesVaciasDemo),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/aún no hay variables operativas/i)).toBeVisible()
    await expect(await canvas.findByText('0 registros')).toBeVisible()
  },
}

export const Ajustes: Story = {
  name: 'Ajustes energéticos · tono purple',
  args: construirPanelAjustes(ajustesExistentesDemo),
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('Registros guardados')).toBeVisible()
    await expect(await canvas.findByText('Ajuste promedio')).toBeVisible()
    await expect(
      await canvas.findByText('Rutinarios / No rutinarios')
    ).toBeVisible()
    await expect(await canvas.findByText('Valor del ajuste (%)')).toBeVisible()

    const buscar = await canvas.findByLabelText(/buscar en datos guardados/i)
    await userEvent.type(buscar, 'adm-1')
    // Solo queda el ajuste del bloque ADM-1.
    await waitFor(
      () => {
        expect(canvas.queryByText('A-101 — Ala Norte')).toBeNull()
      },
      { timeout: 3000 }
    )
    await expect(await canvas.findByText('ADM-1 — Piso 1')).toBeVisible()
  },
}

export const SinAjustes: Story = {
  name: 'Base de datos vacía · ajustes',
  args: construirPanelAjustes(ajustesVaciosDemo),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/aún no hay ajustes energéticos/i)).toBeVisible()
    await expect(await canvas.findByText('0 registros')).toBeVisible()
  },
}
