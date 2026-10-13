import { describe, expect, it } from 'vitest'

import {
  etiquetaEje,
  etiquetaPeriodo,
  formatoKwh,
  formatoNumero,
  formatoPct,
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
