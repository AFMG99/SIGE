import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { LineasBase } from '../LineasBase'

const bloquesDemo = [
  { id: 'cmuofv5pw0002p3jxuul4li7m', codigo: 'BLOQUE-A-001', nombre: 'Bloque de Aulas Mayores' },
]

const espaciosDemo = [
  { id: 'esp-aula-mayor', bloqueId: 'cmuofv5pw0002p3jxuul4li7m', nombre: 'Aula Mayor' },
  { id: 'esp-pasillo', bloqueId: 'cmuofv5pw0002p3jxuul4li7m', nombre: 'Pasillo' },
]

const meta = {
  component: LineasBase,
  tags: ['ai-generated'],
  args: { total: 4 },
} satisfies Meta<typeof LineasBase>

export default meta
type Story = StoryObj<typeof meta>

export const ModeloValorAbsoluto: Story = {
  name: 'Valor Absoluto · modelo inicial',
  play: async ({ canvas }) => {
    // El concepto del modelo activo por defecto
    const desc = await canvas.findByText(/periodo base de al menos 36 meses/i)
    await waitFor(() => expect(desc).toBeVisible())

    // Su fórmula y su ejemplo
    await canvas.findByText('LBEn_m = (1 / n_m) · Σ consumo_normalizado(m)')
    await canvas.findByText(/banda por defecto \(ec\. 3, ±10 %\) es 11\.232 – 13\.728 kWh/i)
  },
}

export const NavegacionEntreModelos: Story = {
  name: 'Navegación entre los 4 modelos (pills)',
  play: async ({ canvas, userEvent }) => {
    // Pill Cociente → concepto y ejemplo propios
    await userEvent.click(canvas.getByRole('button', { name: /cociente/i }))
    await canvas.findByText(/kWh\/m²·mes o kWh\/persona·mes/i)
    await canvas.findByText(/el cociente es 3,12 kWh\/m²·mes/i)

    // Pill Regresión → fórmula OLS
    await userEvent.click(canvas.getByRole('button', { name: /regresión/i }))
    await canvas.findByText(/β₀ \+ β₁·Población/i)
    await canvas.findByText(/R² = 0,87 y p = 0,001/i)

    // Pill Confort Térmico → rango ASHRAE 55
    await userEvent.click(
      canvas.getByRole('button', { name: /confort térmico/i })
    )
    await canvas.findByText(/E_virtual = consumo_base/i)
    await canvas.findByText(/modo CONFORT/i)

    // Vuelta al modelo inicial
    await userEvent.click(
      canvas.getByRole('button', { name: /valor absoluto/i })
    )
    const desc = await canvas.findByText(/periodo base de al menos 36 meses/i)
    await waitFor(() => expect(desc).toBeVisible())
  },
}

export const CriteriosYConteo: Story = {
  name: 'Criterios UPME y total de modelos',
  play: async ({ canvas }) => {
    // Contenido de la tarjeta compartida de criterios
    await canvas.findByText(/Periodo base mínimo: 36 meses/i, {
      selector: 'li',
    })
    await canvas.findByText(/MAPE ≤ 5 %/i, { selector: 'li' })

    // El total llega por prop
    const total = await canvas.findByText(/4 modelos guardados/i)
    await waitFor(() => expect(total).toBeVisible())
  },
}

export const EstadoVacioSinPermisos: Story = {
  name: 'Sin permisos · estado vacío y controles deshabilitados',
  args: { bloques: bloquesDemo, puedeCalcular: false, puedeGuardar: false },
  play: async ({ canvas }) => {
    // Estado vacío del panel de resultados (sin botón de calcular ahí)
    await canvas.findByText(/Aún no se ha calculado este modelo/i)
    const botones = canvas.getAllByRole('button', { name: /calcular modelos/i })
    await waitFor(() => expect(botones).toHaveLength(1))
    await waitFor(() => expect(botones[0]).toBeDisabled())

    // Aviso de permiso bajo los controles
    await canvas.findByText(/no tiene permiso para calcular/i)
  },
}

export const CalculoRealYGuardado: Story = {
  name: 'Cálculo real → métricas, puertas, gráfica y guardado',
  args: {
    bloques: bloquesDemo,
    espacios: espaciosDemo,
    puedeCalcular: true,
    puedeGuardar: true,
  },
  play: async ({ canvas, userEvent }) => {
    // Estado vacío antes de calcular (hay dos botones con el mismo nombre:
    // el de la barra de controles y el del estado vacío)
    await canvas.findByText(/Aún no se ha calculado este modelo/i)
    const botonesCalcular = canvas.getAllByRole('button', {
      name: /calcular modelos/i,
    })
    await userEvent.click(botonesCalcular[0])

    // Métricas del Valor Absoluto con datos espejo del dry-run
    await canvas.findByText(/Resultados reales/i)
    await canvas.findByText('Línea base (kWh/mes)', { selector: 'dt' })
    await canvas.findByText('21.527,4')
    await canvas.findByText(/19\.374,6 – 23\.680,1/)

    // Puertas UPME del modelo (incluye la regla 3×12 nueva)
    await canvas.findByText(/48 meses depurados \(mín\. 36\)/)
    await canvas.findByText(/3×12: 12 meses con ≥3 valores/, {
      selector: 'li',
    })
    await canvas.findByText(/MAPE 5,77 % ≤ 5 %/)

    // Gráfica SVG de la serie contra la línea base
    await canvas.findByRole('img', {
      name: /serie mensual de consumo contra línea base/i,
    })

    // Guardado explícito del modelo
    await userEvent.click(canvas.getByRole('button', { name: /guardar modelo/i }))
    await canvas.findByRole('button', { name: /guardado ✓/i })
  },
}

export const GraficaInteractiva: Story = {
  name: 'Gráfica interactiva · tooltip, teclado y leyenda',
  args: {
    bloques: bloquesDemo,
    espacios: espaciosDemo,
    puedeCalcular: true,
    puedeGuardar: true,
  },
  play: async ({ canvas, userEvent, canvasElement }) => {
    const botones = canvas.getAllByRole('button', { name: /calcular modelos/i })
    await userEvent.click(botones[0])

    // La gráfica conserva su identidad accesible y sus capas con clase
    await canvas.findByRole('img', {
      name: /serie mensual de consumo contra línea base/i,
    })
    expect(canvasElement.querySelector('.serie-real')).toBeTruthy()
    expect(canvasElement.querySelector('.ref-base')).toBeTruthy()
    expect(canvasElement.querySelector('.serie-descartado')).toBeTruthy()

    // Teclado: el overlay role="slider" recorre los 12 meses calendario
    const slider = canvas.getByRole('slider', {
      name: /explorador de la serie/i,
    })
    slider.focus()
    await waitFor(() => expect(slider.getAttribute('aria-valuenow')).toBe('0'))
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(slider.getAttribute('aria-valuenow')).toBe('1'))
    expect(slider.getAttribute('aria-valuetext')).toMatch(/febrero/)

    const tip = await canvas.findByRole('tooltip')
    await waitFor(() => expect(within(tip).getByText('febrero')).toBeTruthy())

    // El mes descartado por el criterio de depuración (agosto, índice 7;
    // el mock descarta 2023-08) muestra su badge con el texto del criterio
    // efectivo (banda_10_pct)
    await userEvent.keyboard('{Home}')
    for (let k = 0; k < 7; k += 1) {
      await userEvent.keyboard('{ArrowRight}')
    }
    await waitFor(() => expect(slider.getAttribute('aria-valuenow')).toBe('7'))
    expect(slider.getAttribute('aria-valuetext')).toMatch(/descartado/i)
    await waitFor(() =>
      expect(
        within(tip).getByText(/Descartado · fuera de banda ±10 %/i)
      ).toBeTruthy()
    )

    // Ratón: hover con coordenadas al centro del overlay (userEvent.hover
    // no trae clientX y el handler los necesita para mapear el índice; el
    // centro del viewBox cae en junio, índice 5)
    const rect = slider.getBoundingClientRect()
    await userEvent.pointer({
      target: slider,
      coords: {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      },
    })
    await waitFor(() => expect(slider.getAttribute('aria-valuenow')).toBe('5'))
    await waitFor(() => expect(within(tip).getByText('junio')).toBeTruthy())
    expect(within(tip).getAllByText(/kWh/).length).toBeGreaterThan(0)

    // Leyenda interactiva: ocultar un año baja su serie sin tocar las demás
    const leyenda2023 = canvas.getByRole('button', { name: '2023' })
    expect(leyenda2023.getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(leyenda2023)
    await waitFor(() =>
      expect(leyenda2023.getAttribute('aria-pressed')).toBe('false')
    )
    expect(canvasElement.querySelector('.serie-real-2023')).toBeNull()
    expect(canvasElement.querySelector('.serie-real-2024')).toBeTruthy()

    await userEvent.click(leyenda2023)
    await waitFor(() =>
      expect(leyenda2023.getAttribute('aria-pressed')).toBe('true')
    )
    expect(canvasElement.querySelector('.serie-real-2023')).toBeTruthy()
  },
}

export const CambioDeModeloConResultados: Story = {
  name: 'Con resultados · cambio de pill muestra cada métrica',
  args: {
    bloques: bloquesDemo,
    espacios: espaciosDemo,
    puedeCalcular: true,
    puedeGuardar: true,
  },
  play: async ({ canvas, userEvent }) => {
    const botonesCalcular = canvas.getAllByRole('button', {
      name: /calcular modelos/i,
    })
    await userEvent.click(botonesCalcular[0])
    await canvas.findByText(/Resultados reales/i)

    // Regresión: coeficientes β con sus p-values
    await userEvent.click(canvas.getByRole('button', { name: /regresión/i }))
    await canvas.findByText(/β = 46,0467/)
    await canvas.findByText('grades_dia_enfriamiento')
    await canvas.findByText(/p = < 0,001/)
    // Sin puerta de R² (§7.5.3: un R² bajo no invalida); sí la 3×12 y la p
    await canvas.findByText(/3×12: 12 meses con ≥3 valores/, {
      selector: 'li',
    })
    await canvas.findByText(/p máximo .+ ≤ 0,05/, { selector: 'li' })

    // Confort: energía virtual y rango ASHRAE
    await userEvent.click(
      canvas.getByRole('button', { name: /confort térmico/i })
    )
    await canvas.findByText('Energía virtual', { selector: 'dt' })
    await canvas.findByText(/En rango/)
    await canvas.findByText(/T = 25 °C en rango ASHRAE 55/)
  },
}

export const TablasDePreparacionYJerarquia: Story = {
  name: 'Tablas de preparación y jerarquía (ancho completo)',
  args: {
    bloques: bloquesDemo,
    espacios: espaciosDemo,
    puedeCalcular: true,
    puedeGuardar: true,
  },
  play: async ({ canvas, userEvent }) => {
    const botones = canvas.getAllByRole('button', { name: /calcular modelos/i })
    await userEvent.click(botones[0])
    await canvas.findByText(/Resultados reales/i)

    // Tabla de preparación: columnas del flujo factura → serie
    await canvas.findByText(/Preparación y depuración de los datos/i)
    await canvas.findByText('Factura cruda (kWh)')
    await canvas.findByText('Normalizado 30 d (kWh)')
    await canvas.findByText('Asignado al alcance (kWh)')
    await canvas.findByText(/49 meses · 1 descartados/)

    // Criterio de depuración §7.5.1 en el caption de la tabla
    // (el mock declara criterioDepuracion: 'banda_10_pct')
    await canvas.findByText(/Banda ±10 % por mes \(§7\.5\.1, ec\. 3\):/)
    await canvas.findByText(/3×12 completo/)

    // Fila descartada y filas con periodo legible
    await canvas.findByText(/Descartado · fuera de banda ±10 %/, {
      selector: 'span',
    })
    await canvas.findByText('ene 2023')

    // Tabla de jerarquía: criterios de la cadena facturas → bloques → espacios
    await canvas.findByText(/Jerarquía de segmentación/i)
    await canvas.findByText('Criterio de peso')
    expect(
      canvas.getAllByText('Carga nominal de equipos (kWh/mes)')
    ).toHaveLength(4)

    // El alcance por defecto (primer bloque) está marcado en la tabla
    await canvas.findByText(/← alcance/)
  },
}

export const AlcanceEspacio: Story = {
  name: 'Alcance espacio · serie proporcional y guardado restringido',
  args: {
    bloques: bloquesDemo,
    espacios: espaciosDemo,
    puedeCalcular: true,
    puedeGuardar: true,
  },
  play: async ({ canvas, userEvent }) => {
    // Elegir un espacio de la jerarquía (rellena el total por su share)
    const select = canvas.getByLabelText(/alcance/i)
    await userEvent.selectOptions(select, 'e:esp-aula-mayor')

    const botones = canvas.getAllByRole('button', { name: /calcular modelos/i })
    await userEvent.click(botones[0])

    // Cabecera con el chip del alcance y su share
    await canvas.findByText('BLOQUE-A-001 › Aula Mayor')
    await canvas.findByText(/share 4,83 %/)

    // La preparación refleja el share aplicado en cada fila
    await canvas.findByText(/share aplicado 4,83 %/)

    // Jerarquía: solo la fila del espacio elegido está marcada
    const marcas = await canvas.findAllByText(/← alcance/)
    expect(marcas).toHaveLength(1)

    // El guardado oficial sigue restringido a nivel de bloque
    await canvas.findByText(/guardado oficial aplica a nivel de bloque/i)
    expect(
      canvas.queryByRole('button', { name: /guardar modelo/i })
    ).toBeNull()
  },
}

export const SelectorEdificacion: Story = {
  name: 'Selector de edificación · ámbito acotado y reset de alcance',
  args: {
    edificaciones: [
      { id: 'ed-campus-00000001', nombre: 'Campus Bloque A' },
      { id: 'ed-oficina-000001', nombre: 'Administración Principal' },
    ],
    bloques: [
      {
        id: 'cmuofv5pw0002p3jxuul4li7m',
        codigo: 'BLOQUE-A-001',
        nombre: 'Bloque de Aulas Mayores',
        edificacionId: 'ed-campus-00000001',
      },
    ],
    espacios: espaciosDemo,
    puedeCalcular: true,
    puedeGuardar: true,
  },
  play: async ({ canvas, userEvent }) => {
    const edifSel = canvas.getByLabelText(/^edificación$/i)
    const alcanceSel = canvas.getByLabelText(/alcance/i)

    // Por defecto: todas las edificaciones y alcance en el primer bloque
    expect((alcanceSel as HTMLSelectElement).value).toBe(
      'b:cmuofv5pw0002p3jxuul4li7m'
    )
    expect(
      within(alcanceSel).getByRole('option', {
        name: 'BLOQUE-A-001 — Bloque de Aulas Mayores',
      })
    ).toBeTruthy()

    // Acotar a una edificación sin ese bloque → reset al total de ella
    await userEvent.selectOptions(edifSel, 'ed-oficina-000001')
    expect((alcanceSel as HTMLSelectElement).value).toBe('global')
    expect(
      within(alcanceSel).queryByRole('option', {
        name: 'BLOQUE-A-001 — Bloque de Aulas Mayores',
      })
    ).toBeNull()
    expect(
      within(alcanceSel).getByRole('option', {
        name: 'Total — facturas de energía (Administración Principal)',
      })
    ).toBeTruthy()

    // Calcular en ese ámbito: la jerarquía declara el criterio filtrado
    const botones = canvas.getAllByRole('button', { name: /calcular modelos/i })
    await userEvent.click(botones[0])
    await canvas.findByText(/Resultados reales/i)
    await canvas.findByText('Facturas de energía (de la edificación, kWh/mes)')
    await canvas.findByText(/Total global · share 100,00 %/)

    // De vuelta a la campus, el bloque vuelve a estar disponible
    await userEvent.selectOptions(edifSel, 'ed-campus-00000001')
    expect(
      within(alcanceSel).getByRole('option', {
        name: 'BLOQUE-A-001 — Bloque de Aulas Mayores',
      })
    ).toBeTruthy()
    expect((alcanceSel as HTMLSelectElement).value).toBe(
      'b:cmuofv5pw0002p3jxuul4li7m'
    )
  },
}


// ── Share estimado y guardas del share (opción «modelo de ingeniería») ──

export const ShareEstimadoConAviso: Story = {
  name: 'Share estimado · badge, aviso de cobertura y criterio',
  args: {
    bloques: [
      { id: 'bloque-sin-area', codigo: 'BLOQUE-B-002', nombre: 'Piso 3' },
    ],
    puedeCalcular: true,
  },
  play: async ({ canvas, userEvent }) => {
    const botones = canvas.getAllByRole('button', { name: /calcular modelos/i })
    await userEvent.click(botones[0])
    await canvas.findByText(/Resultados reales/i)

    // El share sale de la carga nominal ÷ factura media (5545 / 21500)
    await canvas.findByText(/share 25,79 %/)
    await canvas.findByText(/share aplicado 25,79 %/)

    // Queda marcado como estimado, no como medido
    await canvas.findByText('Share estimado')
    await canvas.findByText(/Aviso del cálculo/i)
    await canvas.findByText(/share estimado por modelo de ingeniería/i)

    // La jerarquía declara el criterio real en vez del de área
    await canvas.findByText('Carga nominal ÷ factura media (kWh/mes, estimado)')
  },
}

export const ErrorShareIndeterminado: Story = {
  name: 'Error · share indeterminado (sin área ni equipos)',
  args: {
    bloques: [
      { id: 'err-share-indeterminado', codigo: 'BLOQUE-X-001', nombre: 'Sin datos' },
    ],
    puedeCalcular: true,
  },
  play: async ({ canvas, userEvent }) => {
    const botones = canvas.getAllByRole('button', { name: /calcular modelos/i })
    await userEvent.click(botones[0])
    await canvas.findByText(/Share indeterminado/i)
    expect(canvas.queryByText(/Resultados reales/i)).toBeNull()
  },
}

export const ErrorSinInventario: Story = {
  name: 'Error · bloque sin inventario de equipos',
  args: {
    bloques: [
      { id: 'err-sin-inventario', codigo: 'BLOQUE-B-002', nombre: 'Piso 3' },
    ],
    puedeCalcular: true,
  },
  play: async ({ canvas, userEvent }) => {
    const botones = canvas.getAllByRole('button', { name: /calcular modelos/i })
    await userEvent.click(botones[0])
    await canvas.findByText(/no tiene inventario de equipos/i, {
      selector: '.ui-callout-danger',
    })
    expect(canvas.queryByText(/Resultados reales/i)).toBeNull()
  },
}

export const ErrorShareSobre100: Story = {
  name: 'Error · carga teórica por encima de la factura global',
  args: {
    bloques: [
      { id: 'err-share-sobre-100', codigo: 'BLOQUE-C-001', nombre: 'Local Técnico' },
    ],
    puedeCalcular: true,
  },
  play: async ({ canvas, userEvent }) => {
    const botones = canvas.getAllByRole('button', { name: /calcular modelos/i })
    await userEvent.click(botones[0])
    await canvas.findByText(/iguala o supera la factura media global/i, {
      selector: '.ui-callout-danger',
    })
    expect(canvas.queryByText(/Resultados reales/i)).toBeNull()
  },
}


export const PreguntasFrecuentesLBEn: Story = {
  name: 'Preguntas y respuestas · acordeón de referencia',
  play: async ({ canvas, userEvent }) => {
    // La sección de referencia existe SIN haber calculado nada
    const titulo = await canvas.findByText('Preguntas y respuestas sobre LBEn')
    await waitFor(() => expect(titulo).toBeVisible())

    // Las 5 categorías (Procedimiento, Datos, Motores, Errores, Normativa)
    expect(canvas.getAllByRole('heading', { level: 4 })).toHaveLength(5)

    // Cerradas por defecto: el fragmento de código no está a la vista
    const cerrado = canvas.getByText(
      /normalizarJsonNoEstandar\(texto: string\)/
    ).closest('details')
    expect(cerrado).not.toBeNull()
    expect(cerrado?.open).toBe(false)

    await userEvent.click(
      canvas.getByText('¿Qué hace normalizarJsonNoEstandar?')
    )
    expect(cerrado?.open).toBe(true)
    await waitFor(() =>
      expect(
        canvas.getByText(/normalizarJsonNoEstandar\(texto: string\)/)
      ).toBeVisible()
    )

    // Normativa: el snippet de CRITERIOS con su cita literal
    await userEvent.click(
      canvas.getByText('¿Qué exige la Resolución UPME 0016 de 2024 y cómo se aplica aquí?')
    )
    await waitFor(() =>
      expect(
        canvas.getByText(/Periodo base mínimo: 36 meses \(3 años\)'/)
      ).toBeVisible()
    )

    // Errores: mensaje literal con su causa y solución
    await userEvent.click(
      canvas.getByText(
        'Aparece «El bloque … no tiene inventario de equipos con consumo…»'
      )
    )
    await waitFor(() =>
      expect(
        canvas.getByText(/no aporta ninguna carga nominal que dividir/)
      ).toBeVisible()
    )
  },
}
