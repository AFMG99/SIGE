import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, screen, userEvent, waitFor } from 'storybook/test'

import { ToastProvider } from '@/shared/views/ui/ToastProvider'
import { CalculoUso } from '../CalculoUso'
import { edificacionesCalculoDemo } from '../__fixtures__/calculoUso'

/**
 * Sección «Cálculo de uso» (T5). Las actions del módulo están aliadas al
 * doble determinista de `../__mocks__/serverActions.ts` (ver
 * `.storybook/main.ts`): cada edificación del catálogo demo ramifica un
 * estado distinto (ver la cabecera de `__fixtures__/calculoUso.ts`).
 *
 * Los toasts los pinta el `ToastProvider` fuera del árbol del canvas, así
 * que se consultan con `screen`, no con `canvas`.
 */

const meta = {
  component: CalculoUso,
  tags: ['ai-generated'],
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  args: {
    edificaciones: edificacionesCalculoDemo,
    puedeCargar: true,
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CalculoUso>

export default meta
type Story = StoryObj<typeof meta>

type ContextoPlay = Parameters<NonNullable<Story['play']>>[0]
type Canvas = ContextoPlay['canvas']
type UserEvent = ContextoPlay['userEvent']

/** Año anterior al actual: las stories de intervalo lo usan para ser estables. */
const ANO_PREVIO = new Date().getFullYear() - 1
const ANO_ACTUAL = new Date().getFullYear()

/** Elige una opción del ListboxSelect de edificación (el panel es un portal). */
async function elegirEdificacion(
  canvas: Canvas,
  userEvent: UserEvent,
  valor: string
): Promise<void> {
  const trigger = await canvas.findByLabelText('Edificación')
  await userEvent.click(trigger)
  const doc = trigger.ownerDocument
  const panel = await waitFor(() => {
    const listbox = doc.querySelector('[role="listbox"]')
    expect(listbox, 'listbox abierto').not.toBeNull()
    return listbox as HTMLElement
  })
  const opcion = panel.querySelector<HTMLElement>(`[data-value="${valor}"]`)
  expect(opcion, `opción ${valor}`).not.toBeNull()
  await userEvent.click(opcion as HTMLElement)
}

/** Fija un `<select>` nativo controlado por su id. */
async function elegirSelect(userEvent: UserEvent, id: string, valor: string): Promise<void> {
  const select = document.querySelector<HTMLSelectElement>(`#${id}`)
  expect(select, `select #${id}`).not.toBeNull()
  await userEvent.selectOptions(select as HTMLSelectElement, valor)
}

export const SinEdificacion: Story = {
  name: 'Sin edificación · estado vacío antes de los flujos',
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { level: 2, name: 'Cálculo de uso' })
    await canvas.findByText('Seleccione una edificación para calcular las horas de uso.')

    // Sin edificación no hay flujos: los selectores de periodo aún no existen.
    expect(canvas.queryByLabelText('Mes')).toBeNull()
    expect(canvas.queryByRole('button', { name: 'Calcular' })).toBeNull()
    expect(canvas.queryByRole('button', { name: 'Vista previa' })).toBeNull()
  },
}

export const Individual: Story = {
  name: 'Individual · detalle, desglose, consolidaciones y trazabilidad (AC1)',
  play: async ({ canvas, userEvent }) => {
    await elegirEdificacion(canvas, userEvent, 'ed-campus-00000001')

    // Selectores del cálculo individual (AC2) y botón primario.
    await canvas.findByLabelText('Mes')
    await canvas.findByLabelText('Año')
    const boton = await canvas.findByRole('button', { name: 'Calcular' })

    // Periodo fijo (marzo) para que el desglose sea determinista.
    await elegirSelect(userEvent, 'calculo-uso-mes', '3')
    await userEvent.click(boton)

    // Toast de éxito del hook + estado del periodo (REVISAR: 1 equipo sin horario).
    await screen.findByText(/Periodo \d{4}-03 calculado: 2 equipo\(s\)\./)
    await canvas.findByText('REVISAR')

    // 1) Detalle por equipo: horas/día, días/mes y horario ganador en su fila.
    const filas = await canvas.findAllByRole('row')
    const filaHvac = filas.find((f) => f.textContent?.includes('eq-campus-hvac-01'))
    expect(filaHvac, 'fila del HVAC').toBeTruthy()
    expect(filaHvac!.textContent).toContain('14')
    expect(filaHvac!.textContent).toContain('21')
    expect(filaHvac!.textContent).toContain('EDIFICACION/Período académico')
    const filaIlum = filas.find((f) => f.textContent?.includes('eq-campus-ilum-02'))
    expect(filaIlum, 'fila de iluminación').toBeTruthy()
    expect(filaIlum!.textContent).toContain('16')
    expect(filaIlum!.textContent).toContain('20')

    // 2) Desglose por fecha (la traza de los valores del mes): 2 fechas × 2 equipos.
    expect((await canvas.findAllByText(`${ANO_ACTUAL}-03-01`)).length).toBe(2)
    expect((await canvas.findAllByText(`${ANO_ACTUAL}-03-02`)).length).toBe(2)

    // 3) Consolidaciones de los tres niveles (D2, solo visualización).
    await canvas.findByRole('columnheader', { name: 'Nivel' })
    const filasConsolidacion = filas.filter(
      (f) =>
        f.textContent?.includes('sp-campus-101-0001') ||
        f.textContent?.includes('bk-campus-a101-001') ||
        /^Edificación/.test(f.textContent?.trim() ?? '')
    )
    expect(filasConsolidacion.length).toBe(3)
    expect(filasConsolidacion[0].textContent).toContain('30')
    expect(filasConsolidacion[0].textContent).toContain('41')

    // 4) Advertencia BR5: el equipo sin horario nunca es fila de detalle
    //    (aparece SOLO en la trazabilidad) y el periodo queda REVISAR.
    await canvas.findByText('Sin horario vigente')
    expect(filas.filter((f) => f.textContent?.includes('eq-campus-lab-03')).length).toBe(1)

    // 5) Trazabilidad: aportes del horario ganador por equipo.
    await canvas.findByText('Lun–Vie · 06:00–22:00')

    // 6) Nombre visible del equipo en cada tabla de resultado (decisión T6):
    //    el nombre es el texto principal y el id queda como dato secundario.
    expect(filaHvac!.textContent).toContain('HVAC · Laboratorio 101')
    expect(filaIlum!.textContent).toContain('ILUMINACION · Aula 102')
    const filaLab = filas.find((f) => f.textContent?.includes('eq-campus-lab-03'))
    expect(filaLab, 'fila de trazabilidad del equipo sin horario').toBeTruthy()
    expect(filaLab!.textContent).toContain('MOTORES · Taller de máquinas')
  },
}

export const VistaPrevia: Story = {
  name: 'Vista previa · intervalo, contadores y seis clasificaciones (AC4)',
  play: async ({ canvas, userEvent }) => {
    await elegirEdificacion(canvas, userEvent, 'ed-campus-00000001')

    // Selectores del intervalo (AC2): enero–junio del año previo ⇒ 6 periodos,
    // que recorren las seis clasificaciones del BR4 por posición.
    await canvas.findByLabelText('Mes inicial')
    await elegirSelect(userEvent, 'calculo-uso-mes-inicial', '1')
    await elegirSelect(userEvent, 'calculo-uso-ano-inicial', String(ANO_PREVIO))
    await elegirSelect(userEvent, 'calculo-uso-mes-final', '6')
    await elegirSelect(userEvent, 'calculo-uso-ano-final', String(ANO_PREVIO))

    await userEvent.click(await canvas.findByRole('button', { name: 'Vista previa' }))

    // Contadores del encabezado (spec §6.2).
    await canvas.findByText('Meses en el intervalo: 6')
    await canvas.findByText('Resultados existentes: 1')
    await canvas.findByText('Periodos pendientes: 5')
    await canvas.findByText('Con factura: 3 de 6')

    // Una fila por periodo, con su clasificación en español.
    await canvas.findByText(`${ANO_PREVIO}-01`)
    await canvas.findByText('Existente')
    await canvas.findByText(`${ANO_PREVIO}-02`)
    await canvas.findByText('Pendiente')
    await canvas.findByText('Desactualizado')
    await canvas.findByText('Fallido')
    await canvas.findByText('Revisar')
    await canvas.findByText('Nuevo')

    // Factura: solo referencia, repartida en posiciones pares (3 de 6).
    expect(canvas.getAllByText('Con factura').length).toBe(3)
    expect(canvas.getAllByText('Sin factura').length).toBe(3)

    // El periodo intacto muestra sus equipos calculados/esperados.
    const filaIntacta = (await canvas.findAllByRole('row')).find((f) =>
      f.textContent?.includes(`${ANO_PREVIO}-01`)
    )
    expect(filaIntacta, 'fila del periodo intacto').toBeTruthy()
    expect(filaIntacta!.textContent).toContain('3 / 3')
  },
}

export const EstadosVacios: Story = {
  name: 'Estados vacíos · sin horario vigente, sin equipos y sin resultados',
  play: async ({ canvas, userEvent }) => {
    // Administración: ningún equipo con horario vigente ⇒ estado vacío (spec §6.6).
    await elegirEdificacion(canvas, userEvent, 'ed-oficina-000001')
    await userEvent.click(await canvas.findByRole('button', { name: 'Calcular' }))
    await canvas.findByText(
      'Sin horario vigente para calcular este periodo. Revise la configuración del calendario.'
    )
    await canvas.findByText('Sin horario vigente')

    // Cambiar de edificación limpia los resultados en pantalla.
    await elegirEdificacion(canvas, userEvent, 'ed-vivienda-00001')
    expect(
      canvas.queryByText(
        'Sin horario vigente para calcular este periodo. Revise la configuración del calendario.'
      )
    ).toBeNull()

    // Vivienda 1: sin equipos registrados (BR2) ⇒ su propio estado vacío.
    await userEvent.click(await canvas.findByRole('button', { name: 'Calcular' }))
    await canvas.findByText('No hay equipos registrados en la edificación seleccionada.')

    // La vista previa de un intervalo sin resultados lo dice explícitamente.
    await userEvent.click(await canvas.findByRole('button', { name: 'Vista previa' }))
    await canvas.findByText('Todavía no hay resultados de uso para este intervalo.')
  },
}

export const ConservadoYError: Story = {
  name: 'Conservado y error · periodo intacto y fallo de la action',
  play: async ({ canvas, userEvent }) => {
    await elegirEdificacion(canvas, userEvent, 'ed-campus-00000001')
    await canvas.findByLabelText('Mes')

    // Enero del año en curso está calculado e íntegro: se conserva sin escribir.
    await elegirSelect(userEvent, 'calculo-uso-mes', '1')
    await userEvent.click(await canvas.findByRole('button', { name: 'Calcular' }))
    await canvas.findByText(/Resultado existente conservado/)
    await screen.findByText(/ya estaba calculado y se conservó sin cambios/)

    // Fallo simulado de la action: toast de error con el mensaje del servidor.
    await elegirEdificacion(canvas, userEvent, 'ed-error-0000001')
    await userEvent.click(await canvas.findByRole('button', { name: 'Calcular' }))
    await screen.findByText('No fue posible conectar con el servicio de cálculo. Intente de nuevo.')
  },
}

/** Fija el intervalo enero–junio del año previo (seis clasificaciones BR4). */
async function fijarIntervaloSeisMeses(canvas: Canvas, userEvent: UserEvent): Promise<void> {
  await elegirSelect(userEvent, 'calculo-uso-mes-inicial', '1')
  await elegirSelect(userEvent, 'calculo-uso-ano-inicial', String(ANO_PREVIO))
  await elegirSelect(userEvent, 'calculo-uso-mes-final', '6')
  await elegirSelect(userEvent, 'calculo-uso-ano-final', String(ANO_PREVIO))
  await userEvent.click(await canvas.findByRole('button', { name: 'Vista previa' }))
}

export const EjecutarMasivo: Story = {
  name: 'Ejecutar cálculo masivo · lote, progreso y resumen (AC6/AC8/AC11)',
  play: async ({ canvas, userEvent }) => {
    await elegirEdificacion(canvas, userEvent, 'ed-campus-00000001')
    await fijarIntervaloSeisMeses(canvas, userEvent)
    await canvas.findByText('Periodos pendientes: 5')

    // El CTA nace de la lista de pendientes de la vista previa (spec §6.2).
    const cta = await canvas.findByRole('button', {
      name: /Ejecutar cálculo masivo \(5 periodos pendientes\)/,
    })
    await userEvent.click(cta)

    // Progreso del lote mientras corre: periodo en curso, barra y Detener.
    await canvas.findByText(/Procesando \d{4}-\d{2}…/)
    await canvas.findByRole('progressbar')
    await canvas.findByRole('button', { name: 'Detener' })

    // Resumen final: las cuatro cubetas exclusivas particionan los 6 meses
    // (1 intacto + 3 calculados + 1 fallido + 1 en revisión = 6, AC8).
    await canvas.findByText('Resumen de la ejecución')
    await canvas.findByText('Calculados: 3')
    await canvas.findByText('Conservados: 1')
    await canvas.findByText('Fallidos: 1')
    await canvas.findByText('Pendientes de revisión: 1')

    // El fallo queda trazable con su mensaje y es accionable (AC6/AC8):
    // se busca la fila accionable de la tabla de resumen (tiene «Reintentar»),
    // no la de la vista previa, que comparte la misma clave.
    const filaFallo = (await canvas.findAllByRole('row')).find(
      (f) =>
        f.textContent?.includes(`${ANO_PREVIO}-04`) &&
        f.textContent?.includes('Reintentar')
    )
    expect(filaFallo, 'fila del periodo fallido').toBeTruthy()
    expect(filaFallo!.textContent).toContain(
      'No fue posible calcular las horas de uso. Intente de nuevo.'
    )
    await canvas.findByRole('button', { name: /Reintentar/ })

    // Toast de cierre (spec §6.2) y fin del lote: sin progreso ni Detener.
    await screen.findByText(/Cálculo masivo finalizado/)
    expect(canvas.queryByRole('progressbar')).toBeNull()
    expect(canvas.queryByRole('button', { name: 'Detener' })).toBeNull()

    // Reintentar reitera SOLO lo aún pendiente y vuelve a resumir: lo ya
    // calculado por corridas previas aparece conservado (AC10/retomada).
    await userEvent.click(await canvas.findByRole('button', { name: /Reintentar/ }))
    await canvas.findByText('Conservados: 4')
    await canvas.findByText('Calculados: 0')
  },
}

export const DetenerEjecucion: Story = {
  name: 'Detener a mitad de lote · resumen parcial y reanudación (AC11)',
  play: async ({ canvas, userEvent }) => {
    await elegirEdificacion(canvas, userEvent, 'ed-campus-00000001')
    await fijarIntervaloSeisMeses(canvas, userEvent)
    await canvas.findByText('Periodos pendientes: 5')

    await userEvent.click(
      await canvas.findByRole('button', { name: /Ejecutar cálculo masivo/ })
    )

    // La cancelación es segura: se corta DESPUÉS de la llamada en vuelo; lo
    // ya persistido se conserva y el resumen refleja el avance parcial.
    await userEvent.click(await canvas.findByRole('button', { name: 'Detener' }))
    await screen.findByText(/Ejecución detenida/)

    await canvas.findByText('Resumen de la ejecución')
    await canvas.findByText('Calculados: 2')
    await canvas.findByText('Conservados: 1')
    await canvas.findByText('Fallidos: 1')
    await canvas.findByText('Pendientes de revisión: 1')
    await canvas.findByText(/aún sin procesar/)
    expect(canvas.queryByRole('button', { name: 'Detener' })).toBeNull()
  },
}
