import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, screen } from 'storybook/test'

import { ToastProvider } from '@/shared/views/ui/ToastProvider'
import { CalculoUsoOpcional } from '../CalculoUsoOpcional'
import { EDIFICACION_CAMPUS } from '../__fixtures__/calculoUso'

/**
 * Paso opcional de cálculo al cierre de los importadores (spec §6).
 *
 * Reutiliza el doble determinista de `../__mocks__/serverActions.ts` (ver
 * `.storybook/main.ts`): el Campus Bloque A reproduce el intervalo de seis
 * meses con una clasificación BR4 por posición, de modo que la ejecución deja
 * 3 calculados, 1 conservado, 1 fallido y 1 en revisión.
 */

/** Año previo al actual: intervalo estable para las stories. */
const ANO_PREVIO = new Date().getFullYear() - 1

const meta = {
  component: CalculoUsoOpcional,
  tags: ['ai-generated'],
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  args: {
    edificacionId: EDIFICACION_CAMPUS,
    edificacionNombre: 'Campus Tecnológico',
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CalculoUsoOpcional>

export default meta
type Story = StoryObj<typeof meta>

type ContextoPlay = Parameters<NonNullable<Story['play']>>[0]
type Canvas = ContextoPlay['canvas']
type UserEvent = ContextoPlay['userEvent']

/** Valor visible de una cubeta del resumen (`ui-stat` = número + etiqueta). */
function valorDeCubeta(canvas: Canvas, etiqueta: string): string {
  return canvas.getByText(etiqueta).closest('.ui-stat')?.textContent ?? ''
}

export const SinEdificacion: Story = {
  name: 'Sin edificación · el paso no se monta',
  args: { edificacionId: '', edificacionNombre: undefined },
  play: async ({ canvas }) => {
    expect(
      canvas.queryByRole('heading', { name: 'Cálculo de horas de uso (opcional)' })
    ).toBeNull()
    expect(canvas.queryByRole('button', { name: 'Revisar periodos' })).toBeNull()
  },
}

export const EjecutarCalculo: Story = {
  name: 'Vista previa y ejecución · seis meses del año previo',
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('heading', { name: 'Cálculo de horas de uso (opcional)' })
    await canvas.findByText(/Edificación: Campus Tecnológico/)

    // Intervalo enero–junio del año previo: seis clasificaciones BR4.
    await userEvent.selectOptions(await canvas.findByLabelText('Mes inicial'), '1')
    await userEvent.selectOptions(
      await canvas.findByLabelText('Año inicial'),
      String(ANO_PREVIO)
    )
    await userEvent.selectOptions(await canvas.findByLabelText('Mes final'), '6')
    await userEvent.selectOptions(
      await canvas.findByLabelText('Año final'),
      String(ANO_PREVIO)
    )

    await userEvent.click(await canvas.findByRole('button', { name: 'Revisar periodos' }))

    // Contadores de la vista previa (solo lectura).
    await canvas.findByText('Meses en el intervalo: 6')
    await canvas.findByText('Resultados existentes: 1')
    await canvas.findByText('Periodos pendientes: 5')
    await canvas.findByText('Se calcularán ahora: 5')

    // El CTA nace de los periodos que el modo por defecto escribirá.
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Ejecutar cálculo (5 periodos)' })
    )

    // Progreso del lote: barra y «Detener» mientras corre.
    await canvas.findByRole('progressbar')
    await canvas.findByRole('button', { name: 'Detener' })

    // Resumen final: las cuatro cubetas exclusivas (AC8).
    await canvas.findByText('Resultado del cálculo')
    expect(valorDeCubeta(canvas, 'Calculados')).toContain('3')
    expect(valorDeCubeta(canvas, 'Conservados')).toContain('1')
    expect(valorDeCubeta(canvas, 'Fallidos')).toContain('1')
    expect(valorDeCubeta(canvas, 'En revisión')).toContain('1')

    // Toast de cierre y fin del lote: sin progreso ni «Detener».
    await screen.findByText(/Cálculo masivo finalizado/)
    expect(canvas.queryByRole('progressbar')).toBeNull()
    expect(canvas.queryByRole('button', { name: 'Detener' })).toBeNull()
    expect(canvas.queryByRole('button', { name: /Ejecutar cálculo/ })).toBeNull()
  },
}

export const SinPendientes: Story = {
  name: 'Sin pendientes · el intervalo ya está calculado',
  play: async ({ canvas, userEvent }) => {
    // El mes en curso del Campus ya está calculado: no hay nada que escribir.
    await userEvent.click(await canvas.findByRole('button', { name: 'Revisar periodos' }))
    await canvas.findByText('Resultados existentes: 1')
    await canvas.findByText('Se calcularán ahora: 0')
    await canvas.findByText(/No hay periodos pendientes en este intervalo/)
    expect(canvas.queryByRole('button', { name: /Ejecutar cálculo/ })).toBeNull()
  },
}
