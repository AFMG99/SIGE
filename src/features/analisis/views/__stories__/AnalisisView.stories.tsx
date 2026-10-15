import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fireEvent, waitFor } from 'storybook/test'

import { AnalisisView } from '../AnalisisView'
import {
  edificacionesAnalisisDemo,
  edificacionUnicaDemo,
} from '../__fixtures__/analisis'
import { __setearFalloXm } from '../__mocks__/serverActions'

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

/** Cambia de submódulo eligiendo su sección en el sidebar del módulo. */
async function navegarA(
  canvas: { findByRole: (role: string, options: { name: string }) => Promise<HTMLElement> },
  userEvent: UserEventClic,
  nombre: string
): Promise<void> {
  const item = await canvas.findByRole('button', { name: nombre })
  await userEvent.click(item)
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

    // La navegación entre submódulos es el sidebar del módulo (4 secciones),
    // presente incluso sin resultado — igual que el módulo de datos.
    await canvas.findByRole('button', { name: 'Resumen' })
    await canvas.findByRole('button', { name: 'Comparativo' })
    await canvas.findByRole('button', { name: 'Patrones de consumo' })
    await canvas.findByRole('button', { name: 'Ahorros' })

    // Con una sola edificación el selector viene elegido: solo falta ejecutar
    const boton = await canvas.findByRole('button', { name: /ejecutar análisis/i })
    await waitFor(() => expect(boton).toBeEnabled())
  },
}

export const ConResultados: Story = {
  name: 'Con resultados · submódulos, tarjetas y períodos inusuales',
  play: async ({ canvas, userEvent }) => {
    __setearFalloXm('ninguno')
    await canvas.findByText(/Sin análisis ejecutado/i)
    await userEvent.click(canvas.getByRole('button', { name: /ejecutar análisis/i }))

    // Cabecera del análisis: edificación + rango (barra y cabecera)
    await canvas.findByRole('heading', { level: 2, name: 'Campus Robledo' })
    await canvas.findByText('2023-01 → 2025-12')
    await canvas.findByText(/2023-01 → 2025-12 · calculado el/)

    // Submódulo Resumen (activo por defecto): tarjetas de resumen
    await canvas.findByRole('button', { name: 'Resumen' })
    await canvas.findByText('Períodos analizados')
    await canvas.findByText('Períodos inusuales', { selector: 'p' })
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

    // Los atípicos son focalizables en el teclado y anuncian su señal
    const punto = await canvas.findAllByRole('img', {
      name: /alza \(\+40,0 %\)/i,
    })
    expect(punto.length).toBeGreaterThan(0)

    // Simulador de umbral (issue #79): por defecto = normativo (±10 % / 2σ)
    await canvas.findByRole('heading', { level: 3, name: 'Simulador de umbral' })
    await canvas.findByText('Normativo: 2 · 36 períodos evaluados con banda')
    await canvas.findByText(/Sin cambios frente al análisis normativo/)

    // Contrato de submódulos: sólo el panel activo está en el DOM
    expect(
      canvas.queryByRole('heading', { level: 3, name: 'Períodos inusuales' })
    ).toBeNull()

    // Submódulo Patrones de consumo: gestión por nivel + tabla de inusuales
    await navegarA(canvas, userEvent, 'Patrones de consumo')
    await canvas.findByRole('heading', { level: 3, name: 'Períodos inusuales' })
    await canvas.findByText(/1 en alza · 1 en caída · 2 en período lectivo/)
    // También aparece en las barras de desviación: basta con que exista.
    await canvas.findAllByText('marzo de 2024')
    await canvas.findByText('↑ Alza')
    await canvas.findByText('↓ Caída')
    // La explicación estadística vive en una fila expandible por período
    const verMarzo = await canvas.findByRole('button', {
      name: 'Ver explicación de marzo de 2024',
    })
    await userEvent.click(verMarzo)
    await canvas.findByText(/El consumo de marzo de 2024 \(14\.000,0 kWh\)/)
    await expect(verMarzo).toHaveAttribute('aria-expanded', 'true')
    const verAgosto = await canvas.findByRole('button', {
      name: 'Ver explicación de agosto de 2023',
    })
    await userEvent.click(verAgosto)
    await canvas.findByText(/agosto de 2023 \(8\.000,0 kWh\)/)
    // Ambos atípicos caen en meses lectivos de 21 días: dos badges idénticos
    const badges = await canvas.findAllByText(/Período lectivo · 21 d/)
    expect(badges).toHaveLength(2)

    // Indicadores de gestión: nivel exacto por defecto (issue #75)
    await canvas.findByText('Ahorro y consumo elevado')
    await canvas.findByText('Ahorro vs línea base')
    await canvas.findByText('+6,8 %') // media 10.250 vs LB 11.000 kWh/mes
    await canvas.findByText('Exacto — facturas medidas')

    // Cambiar a un nivel estimado reescala los KPIs por el share del bloque
    const nivelSelector = await canvas.findByLabelText('Nivel de análisis')
    await elegirListbox(nivelSelector, 'b:bloque-a', userEvent)
    await canvas.findByText('Estimado — share del bloque')
    await canvas.findByText(/share 60,0 %/)

    // Submódulo Ahorros: modelo automático §7.4 + ahorros §8.1
    await navegarA(canvas, userEvent, 'Ahorros')
    await canvas.findByRole('heading', {
      level: 3,
      name: 'Línea base del análisis',
    })
    // Default = valor absoluto sobre la serie plana: 10.250 kWh/mes de LBEn,
    // ahorro en cero y la regresión exponiendo su gate de 36 meses.
    await canvas.findByText('10.250 kWh/mes')
    await canvas.findByText('0,0 kWh/mes')
    await canvas.findByText(/Hay 34 < 36 datos depurados/)
    await canvas.findByText('enero')

    // Periodicidad anual: la tabla §8.1 colapsa a una fila Σ del año…
    const periodicidad = await canvas.findByLabelText('Periodicidad')
    await elegirListbox(periodicidad, 'ano', userEvent)
    await canvas.findByText(/Total anual \(12 meses\)/)

    // …y la gráfica del submódulo Resumen agrega a 3 puntos (kWh/mes):
    // el modo anual elegido en Ahorros gobierna también la serie.
    await navegarA(canvas, userEvent, 'Resumen')
    await canvas.findByRole('img', { name: /serie anual de consumo de 3 años/i })

    // Confort (ASHRAE 55) en Ahorros: §8.1 no define potencial → vacío
    await navegarA(canvas, userEvent, 'Ahorros')
    const modeloSelector = await canvas.findByLabelText('Modelo de línea base')
    await elegirListbox(modeloSelector, 'confort', userEvent)
    await canvas.findByText('§8.1 no define potencial')
    await canvas.findByText('No aplica')
    await canvas.findByText(/sin desglose mensual/)

    // Submódulo Comparativo: primero la referencia externa XM (issue #76)
    // con índice base 100…
    await navegarA(canvas, userEvent, 'Comparativo')
    await canvas.findByRole('heading', {
      name: 'Referencia externa — datos nacionales XM',
    })
    // El nombre aparece en la tarjeta XM y en la leyenda de la gráfica nueva.
    await canvas.findAllByText('Demanda del SIN (sistema interconectado)')
    await canvas.findByText('Índice 105,1') // 7.460 GWh vs base 7.100 GWh
    await canvas.findByText('Interanual +5,1 %')
    await canvas.findByRole('img', { name: /Índice de Demanda del SIN/ })

    // Comparación interna SIGE: la edificación actual resaltada
    await canvas.findByRole('heading', {
      name: 'Tendencia interna entre edificaciones SIGE',
    })
    await canvas.findByText('Tu edificación')

    // Catálogo oficial citable: enlaces visibles siempre y tabla colapsada
    await canvas.findByRole('heading', { name: 'Datos y documentos XM' })
    await canvas.findByText('Documentación oficial de la API XM')
    const desplegar = await canvas.findByText('Catálogo de métricas (fuente citable)')
    await userEvent.click(desplegar)
    await canvas.findByText('Demanda Energia SIN por Sistema')
  },
}

export const SinAtipicos: Story = {
  name: 'Sin períodos inusuales · selector de 2 y estado vacío',
  args: {
    edificaciones: edificacionesAnalisisDemo,
  },
  play: async ({ canvas, userEvent }) => {
    __setearFalloXm('ninguno')
    // Con varias edificaciones empieza sin selección: el botón está bloqueado
    const boton = await canvas.findByRole('button', { name: /ejecutar análisis/i })
    await waitFor(() => expect(boton).toBeDisabled())

    const selector = canvas.getByLabelText(/^edificación$/i)
    await elegirListbox(selector, 'edi-demo-sede', userEvent)
    await waitFor(() => expect(boton).toBeEnabled())

    await userEvent.click(boton)
    await canvas.findByRole('heading', { level: 2, name: 'Sede Administrativa' })

    // El estado vacío de inusuales vive en el submódulo Patrones
    await navegarA(canvas, userEvent, 'Patrones de consumo')
    await canvas.findByText(/Sin períodos inusuales/i)
    await canvas.findByText(/quedaron dentro del rango esperado/i)

    // Sin atípicos no existe la tabla de períodos inusuales: su columna
    // «Explicación» es exclusiva de esa tabla (las del benchmark XM no la traen).
    expect(canvas.queryByText('Explicación')).toBeNull()
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

    // El selector (con la única edificación ya elegida) también está bloqueado.
    // Se localiza por su <label for>: su nombre accesible es «Edificación».
    const selector = await canvas.findByLabelText(/^edificación$/i)
    await waitFor(() => expect(selector).toBeDisabled())
  },
}

export const XmNoDisponible: Story = {
  name: 'API XM caída · degradación con callout sin romper el análisis',
  args: {
    edificaciones: edificacionesAnalisisDemo,
  },
  play: async ({ canvas, userEvent }) => {
    __setearFalloXm('xm')
    try {
      const boton = await canvas.findByRole('button', { name: /ejecutar análisis/i })
      const selector = canvas.getByLabelText(/^edificación$/i)
      await elegirListbox(selector, 'edi-demo-campus', userEvent)
      await waitFor(() => expect(boton).toBeEnabled())
      await userEvent.click(boton)

      await canvas.findByRole('heading', { level: 2, name: 'Campus Robledo' })

      // El benchmark degrada con callout de advertencia…
      await navegarA(canvas, userEvent, 'Comparativo')
      await canvas.findByText(/La API de XM no está disponible en este momento/i)
      // …pero la nota honesta, la comparación interna y el catálogo siguen.
      await canvas.findByText(/XM no publica consumo por edificación/i)
      const desplegar = await canvas.findByText('Catálogo de métricas (fuente citable)')
      await userEvent.click(desplegar)
      await canvas.findByText('Demanda Energia SIN por Sistema')

      // Y el análisis queda intacto en Patrones de consumo.
      await navegarA(canvas, userEvent, 'Patrones de consumo')
      await canvas.findByRole('heading', {
        level: 3,
        name: 'Ahorro y consumo elevado',
      })
      await canvas.findByText('+6,8 %')
    } finally {
      __setearFalloXm('ninguno')
    }
  },
}

export const ConVariacionAhorro: Story = {
  name: 'Ahorro §8.1 (golden Anexo 1) · modo anual',
  args: {
    edificaciones: edificacionesAnalisisDemo,
  },
  play: async ({ canvas, userEvent }) => {
    __setearFalloXm('ninguno')
    const boton = await canvas.findByRole('button', { name: /ejecutar análisis/i })
    const selector = canvas.getByLabelText(/^edificación$/i)
    await elegirListbox(selector, 'edi-demo-variacion', userEvent)
    await waitFor(() => expect(boton).toBeEnabled())
    await userEvent.click(boton)

    await canvas.findByRole('heading', { level: 2, name: 'Auditorio Mayor' })

    // El golden del Anexo 1 vive en el submódulo Ahorros:
    // «Promedio x Año» 468 kWh ≈ 467,6 kWh/mes (4,1 %)
    await navegarA(canvas, userEvent, 'Ahorros')
    await canvas.findByText('467,6 kWh/mes')
    await canvas.findByText('4,1 %')
    await canvas.findByText(/LBEn_m = promedio simple/)
    // enero: 11.034,3 − 10.204 → 830,3 kWh = 7,5 % de la LBEn del mes
    await canvas.findByText('830,3')
    await canvas.findByText('7,5 %')

    // Sin población la serie expone el gate §7.5.2 en la lista de faltantes
    await canvas.findByText(/al menos 3 registros con población/)

    // Modo anual: Σ de las 12 filas en kWh/año sobre una sola fila
    const periodicidad = await canvas.findByLabelText('Periodicidad')
    await elegirListbox(periodicidad, 'ano', userEvent)
    await canvas.findByText(/Total anual \(12 meses\)/)
    await canvas.findByText('5.611,3')

    // La serie anual se renderiza en la gráfica del submódulo Resumen
    await navegarA(canvas, userEvent, 'Resumen')
    await canvas.findByRole('img', { name: /serie anual de consumo de 3 años/i })
  },
}

export const SinModelos: Story = {
  name: 'Motor antiguo · sin sección de modelos',
  args: {
    edificaciones: edificacionesAnalisisDemo,
  },
  play: async ({ canvas, userEvent }) => {
    __setearFalloXm('ninguno')
    const boton = await canvas.findByRole('button', { name: /ejecutar análisis/i })
    const selector = canvas.getByLabelText(/^edificación$/i)
    await elegirListbox(selector, 'edi-demo-sin-modelos', userEvent)
    await waitFor(() => expect(boton).toBeEnabled())
    await userEvent.click(boton)

    await canvas.findByRole('heading', { level: 2, name: 'Biblioteca Central' })

    // La serie del Resumen sigue intacta…
    await canvas.findByRole('img', { name: /serie mensual de consumo de 36 períodos/i })

    // …callout honesto donde iría la sección de modelos en Ahorros…
    await navegarA(canvas, userEvent, 'Ahorros')
    await canvas.findByText(/El motor no devolvió la sección de modelos/)
    expect(canvas.queryByText('Línea base del análisis')).toBeNull()

    // …sin tocar los indicadores de gestión de Patrones de consumo.
    await navegarA(canvas, userEvent, 'Patrones de consumo')
    await canvas.findByRole('heading', {
      level: 3,
      name: 'Ahorro y consumo elevado',
    })
    await canvas.findByText('+6,8 %')
  },
}

export const SimuladorDeUmbral: Story = {
  name: 'Simulador de umbral · explora ±5 % sin tocar la detección normativa',
  args: {
    edificaciones: edificacionesAnalisisDemo,
  },
  play: async ({ canvas, userEvent }) => {
    __setearFalloXm('ninguno')
    const boton = await canvas.findByRole('button', { name: /ejecutar análisis/i })
    const selector = canvas.getByLabelText(/^edificación$/i)
    await elegirListbox(selector, 'edi-demo-variacion', userEvent)
    await waitFor(() => expect(boton).toBeEnabled())
    await userEvent.click(boton)
    await canvas.findByRole('heading', { level: 2, name: 'Auditorio Mayor' })

    // Estado por defecto: ±10 % (ec. 3) = análisis normativo → 0 inusuales
    await canvas.findByRole('heading', { level: 3, name: 'Simulador de umbral' })
    await canvas.findByText('Normativo: 0 · 36 períodos evaluados con banda')
    await canvas.findByText(/Sin cambios frente al análisis normativo/)

    // Estrechar el porcentaje a ±5 % (meses con n < 10): entran 5 períodos.
    // Los sliders son inputs controlados: se cambian con fireEvent.change.
    const pct = await canvas.findByLabelText(/Umbral porcentual/)
    await fireEvent.change(pct, { target: { value: '5' } })
    await canvas.findByText('Entrarían como inusuales (+5)')
    await canvas.findByText(/septiembre de 2023/)
    // La cifra NORMATIVA jamás se reemplaza: sigue visible e intacta.
    await canvas.findByText('Normativo: 0 · 36 períodos evaluados con banda')

    // Superponer la simulación a la gráfica: banda y anillo en violeta
    const casilla = await canvas.findByLabelText(
      'Superponer la banda simulada a la gráfica'
    )
    await userEvent.click(casilla)
    await canvas.findByText(/Banda simulada \(exploratoria\)/)
    await canvas.findByRole('img', {
      name: /banda simulada \(exploratoria\) se superpone en violeta/i,
    })
  },
}
