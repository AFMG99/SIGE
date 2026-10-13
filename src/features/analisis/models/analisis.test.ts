import { describe, expect, it } from 'vitest'

import {
  agregarAnual,
  ahorroAnual,
  etiquetaEje,
  etiquetaPeriodo,
  formatoKwh,
  formatoNumero,
  formatoPct,
  FORMULA_AHORRO,
  gestionSchema,
  kwhDeLineaBaseGuardada,
  lbenPromedio,
  mejorLineaBaseGuardada,
  modeloPorDefecto,
  modelosSchema,
  notaSinLineaBase,
  opcionesModelo,
  ORDEN_MODELOS,
  PERIODICIDAD,
  salidaAnalisisSchema,
  solicitudAnalisisSchema,
  TEXTO_MODELO,
  textoCriterio,
} from './analisis'
import {
  analisisDemo,
  analisisSinAtipicosDemo,
  analisisSinModelosDemo,
  analisisVariacionDemo,
} from '../views/__fixtures__/analisis'

describe('formatoNumero (es-CO)', () => {
  it('usa punto de miles y coma decimal', () => {
    expect(formatoNumero(12480.5)).toBe('12.480,5')
    expect(formatoNumero(1000, 0)).toBe('1.000')
    expect(formatoNumero(0.8438, 1)).toBe('0,8')
  })

  it('conserva el signo negativo delante del punto de miles', () => {
    expect(formatoNumero(-33.3333, 1)).toBe('-33,3')
    expect(formatoNumero(-1234.5)).toBe('-1.234,5')
  })
})

describe('etiquetas', () => {
  it('etiquetaPeriodo escribe el mes en español', () => {
    expect(etiquetaPeriodo(3, 2024)).toBe('marzo de 2024')
    expect(etiquetaPeriodo(1, 2023)).toBe('enero de 2023')
    expect(etiquetaPeriodo(12, 2025)).toBe('diciembre de 2025')
  })

  it('etiquetaEje es compacta para el eje X', () => {
    expect(etiquetaEje(3, 2024)).toBe('mar 24')
    expect(etiquetaEje(10, 2025)).toBe('oct 25')
  })
})

describe('formatoKwh y formatoPct', () => {
  it('formatea kWh con la unidad', () => {
    expect(formatoKwh(12480.5)).toBe('12.480,5 kWh')
    expect(formatoKwh(8000)).toBe('8.000,0 kWh')
  })

  it('formatoPct siempre lleva signo (U+2212 en negativos)', () => {
    expect(formatoPct(40)).toBe('+40,0 %')
    expect(formatoPct(-33.3333)).toBe('−33,3 %')
    expect(formatoPct(0)).toBe('+0,0 %')
  })
})

describe('salidaAnalisisSchema (espejo del motor)', () => {
  it('acepta la salida completa del fixture', () => {
    const parse = salidaAnalisisSchema.safeParse(analisisDemo.salida)
    expect(parse.success).toBe(true)
    expect(parse.success && parse.data.resumen.atipicos).toBe(2)
    expect(parse.success && parse.data.periodos).toHaveLength(36)
  })

  it('acepta la variante sin atípicos', () => {
    expect(salidaAnalisisSchema.safeParse(analisisSinAtipicosDemo.salida).success).toBe(true)
  })

  it('rechaza una salida incompleta del motor', () => {
    expect(salidaAnalisisSchema.safeParse({ ok: true }).success).toBe(false)
    expect(salidaAnalisisSchema.safeParse({ ok: false }).success).toBe(false)
    const parcial = { ...analisisDemo.salida }
    delete (parcial as Record<string, unknown>).estadisticos
    expect(salidaAnalisisSchema.safeParse(parcial).success).toBe(false)
  })

  it('rechaza períodos con mes fuera de rango', () => {
    const corrupto = {
      ...analisisDemo.salida,
      periodos: [{ ...analisisDemo.salida.periodos[0], mes: 13 }],
    }
    expect(salidaAnalisisSchema.safeParse(corrupto).success).toBe(false)
  })
})

describe('solicitudAnalisisSchema', () => {
  it('exige una edificación', () => {
    expect(solicitudAnalisisSchema.safeParse({ edificacionId: '' }).success).toBe(false)
    expect(solicitudAnalisisSchema.safeParse({}).success).toBe(false)
    expect(
      solicitudAnalisisSchema.safeParse({ edificacionId: 'edi-demo-campus' }).success
    ).toBe(true)
  })
})

describe('KPIs de gestión por nivel', () => {
  it('el espejo Zod acepta la gestión construida del fixture', () => {
    expect(gestionSchema.safeParse(analisisDemo.gestion).success).toBe(true)
    expect(analisisDemo.gestion.niveles).toHaveLength(4)
    expect(gestionSchema.safeParse({ niveles: [] }).success).toBe(false)
  })

  it('kwhDeLineaBaseGuardada extrae kWh por modelo y la regresión da null', () => {
    expect(kwhDeLineaBaseGuardada('VALOR_ABSOLUTO', { consumo_promedio_mensual: 500 })).toBe(500)
    expect(kwhDeLineaBaseGuardada('COCIENTE', { consumo_promedio: 750 })).toBe(750)
    expect(kwhDeLineaBaseGuardada('CONFORT_THERMAL', { consumo_base_kwh: 300 })).toBe(300)
    expect(
      kwhDeLineaBaseGuardada('REGRESSION_ESTADISTICA', { coeficientes: { x: 1 } })
    ).toBeNull()
    expect(kwhDeLineaBaseGuardada('COCIENTE', null)).toBeNull()
  })

  it('mejorLineaBaseGuardada prioriza Cociente sobre Valor absoluto', () => {
    const lb = mejorLineaBaseGuardada([
      { tipo: 'VALOR_ABSOLUTO', coeficientes: { consumo_promedio_mensual: 500 } },
      { tipo: 'COCIENTE', coeficientes: { consumo_promedio: 750 } },
    ])
    expect(lb).toEqual({ kwh: 750, tipo: 'COCIENTE', modelo: 'Cociente' })
    expect(
      mejorLineaBaseGuardada([{ tipo: 'REGRESSION_ESTADISTICA', coeficientes: {} }])
    ).toBeNull()
    expect(mejorLineaBaseGuardada([])).toBeNull()
  })

  it('notaSinLineaBase distingue «sin LB» de «solo regresión»', () => {
    expect(notaSinLineaBase([])).toMatch(/No hay línea base/)
    expect(
      notaSinLineaBase([{ tipo: 'REGRESSION_ESTADISTICA', coeficientes: {} }])
    ).toMatch(/regresión/)
  })

  it('la edificación exacta calcula ahorro contra su LB (Σ de bloques)', () => {
    const nivel = analisisDemo.gestion.niveles.find((n) => n.clave === 'edi')
    expect(nivel?.precision).toBe('exacto')
    expect(nivel?.share).toBeNull()
    // media 10.250 kWh/mes vs LB 11.000 → ahorro 750 kWh (+6,8 %)
    expect(nivel?.consumoPromedioKwh).toBeCloseTo(10250, 6)
    expect(nivel?.ahorro.ahorroKwh).toBeCloseTo(750, 6)
    expect(nivel?.ahorro.ahorroPct).toBeCloseTo((750 / 11000) * 100, 6)
    expect(nivel?.ahorro.nota).toBeNull()
    expect(nivel?.elevado.meses).toBe(1)
    expect(nivel?.elevado.maximoPeriodo).toBe('2024-03')
    expect(nivel?.elevado.maximoKwh).toBe(14000)
    expect(nivel?.inusuales).toEqual({ cantidad: 2, kwh: 22000 })
  })

  it('los niveles con share escalan kWh pero no los conteos', () => {
    const bloque = analisisDemo.gestion.niveles.find((n) => n.clave === 'b:bloque-a')
    expect(bloque?.precision).toBe('estimado')
    expect(bloque?.consumoPromedioKwh).toBeCloseTo(10250 * 0.6, 6)
    expect(bloque?.ahorro.ahorroKwh).toBeCloseTo(6600 - 10250 * 0.6, 6)
    expect(bloque?.elevado.meses).toBe(1) // invariante a la escala
    expect(bloque?.elevado.maximoKwh).toBeCloseTo(14000 * 0.6, 6)
    expect(bloque?.inusuales.cantidad).toBe(2) // invariante a la escala
    expect(bloque?.inusuales.kwh).toBeCloseTo(22000 * 0.6, 6)
  })

  it('un nivel sin LB utilizable lleva la nota y nulls en el ahorro', () => {
    const bloqueB = analisisDemo.gestion.niveles.find((n) => n.clave === 'b:bloque-b')
    expect(bloqueB?.ahorro.lbKwh).toBeNull()
    expect(bloqueB?.ahorro.ahorroKwh).toBeNull()
    expect(bloqueB?.ahorro.ahorroPct).toBeNull()
    expect(bloqueB?.ahorro.nota).toMatch(/regresión/)
  })

  it('la variante sin atípicos refleja cero en sus KPIs', () => {
    const nivel = analisisSinAtipicosDemo.gestion.niveles.find((n) => n.clave === 'edi')
    expect(nivel?.elevado.meses).toBe(0)
    expect(nivel?.inusuales).toEqual({ cantidad: 0, kwh: 0 })
  })
})

describe('sección `modelos` (contrato del selector §7.4-7.5)', () => {
  it('el espejo Zod acepta los fixtures y degrada con `modelos` null', () => {
    expect(modelosSchema.safeParse(analisisDemo.salida.modelos).success).toBe(true)
    expect(modelosSchema.safeParse(analisisVariacionDemo.salida.modelos).success).toBe(true)
    expect(analisisSinModelosDemo.salida.modelos).toBeNull()
    expect(salidaAnalisisSchema.safeParse(analisisSinModelosDemo.salida).success).toBe(true)
  })

  it('todas las hojas comparten la misma forma', () => {
    const modelos = analisisDemo.salida.modelos
    expect(modelos).not.toBeNull()
    for (const clave of ORDEN_MODELOS) {
      const hoja = modelos?.[clave]
      expect(hoja?.lben_mensual).toHaveLength(12)
      expect(hoja?.etiqueta.length).toBeGreaterThan(0)
      expect(hoja?.formula.length).toBeGreaterThan(0)
      expect(hoja?.validacion.min_datos_ic).toBe(10)
      if (hoja?.estado === 'no_disponible') {
        expect(hoja.motivo).toBeTruthy()
        expect(hoja.n).toBe(0)
        expect(hoja.ahorro).toBeNull()
        expect(hoja.lben_mensual.every((v) => v === null)).toBe(true)
      }
    }
  })

  it('la serie plana deja ahorro en cero y regresión en el gate 34 < 36', () => {
    const modelos = analisisDemo.salida.modelos
    const va = modelos?.valor_absoluto
    expect(va?.estado).toBe('disponible')
    expect(va?.lben_mensual).toEqual([
      8500, 10000, 10000, 10000, 10000, 11000, 8000, 12000, 11500, 11500, 11500, 9000,
    ])
    expect(va?.validacion.r2).toBe(1)
    expect(va?.validacion.mape).toBe(0)
    expect(va?.ahorro?.potencial_mensual).toBe(0)
    expect(modelos?.cociente.estado).toBe('disponible')
    expect(modelos?.cociente.unidad).toBe('kWh/persona·mes')
    expect(modelos?.cociente.lben_mensual[0]).toBe(85)
    expect(modelos?.cociente.ahorro?.potencial_mensual).toBe(0)
    expect(modelos?.regresion.estado).toBe('no_disponible')
    expect(modelos?.regresion.motivo).toMatch(/34 < 36/)
    expect(modelos?.ingenieria.motivo).toMatch(/§7\.4\.4/)
    expect(modelos?.confort.lben_mensual[0]).toBeCloseTo(10205.8824, 4)
    expect(modelos?.confort.ahorro).toBeNull()
    expect(modelos?.confort.nota).toMatch(/ASHRAE/)
  })

  it('sin atípicos la regresión cae en el gate de variables, no de datos', () => {
    const regresion = analisisSinAtipicosDemo.salida.modelos?.regresion
    expect(regresion?.estado).toBe('no_disponible')
    expect(regresion?.motivo).toMatch(/Sin variables operativas/)
    expect(analisisSinAtipicosDemo.salida.modelos?.valor_absoluto?.n).toBe(36)
    expect(analisisSinAtipicosDemo.salida.modelos?.confort.lben_mensual[0]).toBe(10250)
  })
})

describe('golden del Anexo 1 (§8.1, ec. 9-12)', () => {
  const modelos = analisisVariacionDemo.salida.modelos
  const va = modelos?.valor_absoluto

  it('reproduce el ahorro trabajado del ejemplo del Anexo 1', () => {
    // enero: LBEn 11.034,3333 · mínimo 10.204 → 830,3333 kWh (7,525 %)
    expect(va?.lben_mensual[0]).toBeCloseTo(11034.3333, 4)
    const enero = va?.ahorro?.por_mes[0]
    expect(enero?.mejor).toBe(10204)
    expect(enero?.potencial).toBeCloseTo(830.3333, 4)
    expect(enero?.potencial_pct).toBeCloseTo(7.525, 3)
    // «Promedio x Año»: 468 kWh ≈ 467,6111 y 4,106 %
    expect(va?.ahorro?.potencial_mensual).toBeCloseTo(467.6111, 4)
    expect(va?.ahorro?.potencial_pct).toBeCloseTo(4.106, 3)
    expect(va?.validacion.r2).toBe(0.3782)
    expect(va?.validacion.mape).toBe(2.92)
  })

  it('sin población el cociente no puede ajustarse', () => {
    expect(modelos?.cociente.estado).toBe('no_disponible')
    expect(modelos?.cociente.motivo).toMatch(/población/)
    expect(modelos?.confort.lben_mensual[0]).toBeCloseTo(11388.4444, 4)
    expect(modelos?.confort.ahorro).toBeNull()
  })
})

describe('selector de modelo (helpers puros)', () => {
  it('opcionesModelo sigue el orden §7.4 y desactiva lo no disponible', () => {
    const opciones = opcionesModelo(analisisDemo.salida.modelos)
    expect(opciones.map((o) => o.clave)).toEqual([...ORDEN_MODELOS])
    expect(opciones.filter((o) => o.habilitado)).toHaveLength(3) // VA, cociente, confort
    const ingenieria = opciones.find((o) => o.clave === 'ingenieria')
    expect(ingenieria?.habilitado).toBe(false)
    expect(ingenieria?.motivo).toMatch(/fuera de alcance/)
    expect(opcionesModelo(null)).toEqual([])
  })

  it('modeloPorDefecto elige el primero disponible (valor absoluto)', () => {
    expect(modeloPorDefecto(analisisDemo.salida.modelos)).toBe('valor_absoluto')
    expect(modeloPorDefecto(analisisVariacionDemo.salida.modelos)).toBe('valor_absoluto')
    expect(modeloPorDefecto(null)).toBeNull()
  })

  it('lbenPromedio promedia los meses con valor del modelo', () => {
    expect(lbenPromedio(analisisDemo.salida.modelos?.valor_absoluto)).toBeCloseTo(10250, 4)
    expect(
      lbenPromedio(analisisVariacionDemo.salida.modelos?.valor_absoluto)
    ).toBeCloseTo(11388.4444, 4)
    expect(lbenPromedio(null)).toBeNull()
    expect(lbenPromedio(analisisDemo.salida.modelos?.ingenieria)).toBeNull()
  })

  it('TEXTO_MODELO y FORMULA_AHORRO cubren el alcance decidido', () => {
    for (const clave of ORDEN_MODELOS) {
      expect(TEXTO_MODELO[clave].length).toBeGreaterThan(20)
    }
    // §8.1 aplica a VA, cociente y regresión; confort e ingeniería no.
    expect(Object.keys(FORMULA_AHORRO).sort()).toEqual([
      'cociente',
      'regresion',
      'valor_absoluto',
    ])
    expect(FORMULA_AHORRO.valor_absoluto).toMatch(/ec\. 9/)
  })
})

describe('periodicidad de la serie', () => {
  it('día y semana existen pero deshabilitadas con su motivo', () => {
    expect(PERIODICIDAD).toHaveLength(4)
    const dia = PERIODICIDAD.find((p) => p.valor === 'dia')
    const semana = PERIODICIDAD.find((p) => p.valor === 'semana')
    expect(dia?.habilitado).toBe(false)
    expect(semana?.habilitado).toBe(false)
    expect(dia?.motivo).toMatch(/datos diarios/)
    expect(
      PERIODICIDAD.filter((p) => p.habilitado).map((p) => p.valor)
    ).toEqual(['mes', 'ano'])
  })
})

describe('agregarAnual y ahorroAnual', () => {
  it('agrega la serie plana a 3 años contando sus inusuales', () => {
    const puntos = agregarAnual(
      analisisDemo.salida.periodos,
      analisisDemo.salida.modelos?.valor_absoluto?.lben_mensual
    )
    expect(puntos.map((p) => p.ano)).toEqual([2023, 2024, 2025])
    expect(puntos.map((p) => p.meses)).toEqual([12, 12, 12])
    expect(puntos.map((p) => p.atipicos)).toEqual([1, 1, 0])
    // 2023 con la caída de agosto (8.000 en vez de 12.000)
    expect(puntos[0].consumo).toBeCloseTo((123000 - 12000 + 8000) / 12, 4)
    // La LBEn anual es la media de sus 12 meses (10.250 en la serie plana)
    expect(puntos[0].lben).toBeCloseTo(10250, 3)
    expect(puntos[2].lben).toBeCloseTo(10250, 3)
  })

  it('ahorroAnual suma las filas mensuales y aplica la ec. 12 a los totales', () => {
    const ahorro = analisisVariacionDemo.salida.modelos?.valor_absoluto?.ahorro
    expect(ahorro).not.toBeNull()
    if (!ahorro) return
    const anual = ahorroAnual(ahorro)
    expect(anual.meses).toBe(12)
    expect(anual.potencial).toBeCloseTo(5611.3331, 3)
    expect(anual.lben).toBeCloseTo(136661.3331, 3)
    expect(anual.potencial_pct).toBeCloseTo(4.106, 3)
  })
})

describe('textoCriterio', () => {
  it('traduce el criterio del motor y hace fallback del crudo', () => {
    expect(textoCriterio('banda_10_pct')).toMatch(/±10/)
    expect(textoCriterio(null)).toBeNull()
    expect(textoCriterio('criterio_desconocido')).toBe('criterio_desconocido')
  })
})
