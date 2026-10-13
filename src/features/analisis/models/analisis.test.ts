import { describe, expect, it } from 'vitest'

import {
  etiquetaEje,
  etiquetaPeriodo,
  formatoKwh,
  formatoNumero,
  formatoPct,
  gestionSchema,
  kwhDeLineaBaseGuardada,
  mejorLineaBaseGuardada,
  notaSinLineaBase,
  salidaAnalisisSchema,
  solicitudAnalisisSchema,
} from './analisis'
import {
  analisisDemo,
  analisisSinAtipicosDemo,
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
