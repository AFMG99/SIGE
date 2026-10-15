/**
 * Modelo puro del dashboard (T2): selección de LBEn por mejor R², series
 * mensuales, deltas, distribución, cobertura y ranking ahorro+costo.
 */
import { describe, expect, it } from 'vitest'

import {
  construirResumen,
  indiceMes,
  mejorModelo,
  modeloUtilizable,
  serieMensualModelo,
  type EnergySummary,
  type ModeloSerie,
} from './dashboardModel'

function modelo(parcial: Partial<ModeloSerie> & { tipo: string }): ModeloSerie {
  return { r2: null, coeficientes: {}, ...parcial }
}

describe('serieMensualModelo', () => {
  it('usa lben_mensual (12) preservando los nulls de meses sin datos', () => {
    const m = modelo({
      tipo: 'valor_absoluto',
      coeficientes: { lben_mensual: [10, 11, null, 13, null, null, null, null, null, null, null, null] },
    })
    const serie = serieMensualModelo(m)!
    expect(serie).toHaveLength(12)
    expect(serie[0]).toBe(10)
    expect(serie[2]).toBeNull()
    expect(serie[11]).toBeNull()
  })

  it('modelos planos: cociente/confort/valor absoluto con su kWh/mes', () => {
    expect(serieMensualModelo(modelo({ tipo: 'cociente', coeficientes: { consumo_promedio: 42 } }))).toEqual(
      Array.from({ length: 12 }, () => 42)
    )
    expect(
      serieMensualModelo(modelo({ tipo: 'confort', coeficientes: { consumo_base_kwh: 77 } }))
    ).toEqual(Array.from({ length: 12 }, () => 77))
    expect(
      serieMensualModelo(modelo({ tipo: 'valor_absoluto', coeficientes: { consumo_promedio_mensual: 5 } }))
    ).toEqual(Array.from({ length: 12 }, () => 5))
  })

  it('regresión sin lben_mensual no expone serie (no se inventa)', () => {
    expect(
      serieMensualModelo(
        modelo({ tipo: 'regresion', r2: 0.91, coeficientes: { consumo_promedio_mensual: 30 } })
      )
    ).toBeNull()
  })

  it('lben_mensual totalmente vacío cae al plano; plano no positivo → null', () => {
    expect(
      serieMensualModelo(modelo({ tipo: 'valor_absoluto', coeficientes: { lben_mensual: [null], consumo_promedio_mensual: 9 } }))
    ).toEqual(Array.from({ length: 12 }, () => 9))
    expect(
      serieMensualModelo(modelo({ tipo: 'cociente', coeficientes: { consumo_promedio: 0 } }))
    ).toBeNull()
  })

  it('modeloUtilizable refleja la existencia de serie', () => {
    expect(modeloUtilizable(modelo({ tipo: 'cociente', coeficientes: { consumo_promedio: 1 } }))).toBe(true)
    expect(modeloUtilizable(modelo({ tipo: 'regresion', coeficientes: {} }))).toBe(false)
  })
})

describe('mejorModelo', () => {
  it('gana el mayor R²; nulls al final; desempate alfabético por tipo', () => {
    const modelos = [
      modelo({ tipo: 'cociente', r2: 0.71, coeficientes: { consumo_promedio: 10 } }),
      modelo({ tipo: 'valor_absoluto', r2: 0.88, coeficientes: { consumo_promedio_mensual: 11 } }),
      modelo({ tipo: 'confort', r2: null, coeficientes: { consumo_base_kwh: 12 } }),
    ]
    expect(mejorModelo(modelos)?.tipo).toBe('valor_absoluto')

    const conEmpate = [
      modelo({ tipo: 'cociente', r2: 0.8, coeficientes: { consumo_promedio: 10 } }),
      modelo({ tipo: 'confort', r2: 0.8, coeficientes: { consumo_base_kwh: 12 } }),
    ]
    expect(mejorModelo(conEmpate)?.tipo).toBe('cociente')
  })

  it('ignora los no usables (regresión sin serie) y devuelve null sin alternativa', () => {
    const soloRegresion = [modelo({ tipo: 'regresion', r2: 0.99, coeficientes: {} })]
    expect(mejorModelo(soloRegresion)).toBeNull()
    expect(mejorModelo([])).toBeNull()
  })
})

describe('indiceMes', () => {
  it("parsea 'YYYY-MM' a índice 0-based y falla hacia 0", () => {
    expect(indiceMes('2026-03')).toBe(2)
    expect(indiceMes('2026-12')).toBe(11)
    expect(indiceMes('basura')).toBe(0)
    expect(indiceMes('2026-13')).toBe(0)
  })
})

// ─────────────────────────────────────────────────── construirResumen

function base(): EnergySummary {
  return {
    facturas: 24,
    ultimoPeriodo: '2026-08',
    edificaciones: 2,
    bloques: 2,
    serie: [
      { periodo: '2026-08', consumoNormalizado: 90, costoCop: 900 },
      { periodo: '2026-07', consumoNormalizado: 100, costoCop: 1000 },
      { periodo: '2026-06', consumoNormalizado: 80, costoCop: 800 },
    ],
    ultimasFacturas: [
      {
        id: 'f1',
        periodo: '2026-08',
        edificacionId: 'e1',
        edificacionNombre: 'Campus Norte',
        consumoKwh: 88,
        consumoNormalizado: 90,
        costoCop: 900,
        diasFacturados: 30,
      },
    ],
    lineasBase: [
      {
        bloqueId: 'b1',
        edificacionId: 'e1',
        modelos: [
          modelo({ tipo: 'valor_absoluto', r2: 0.8, coeficientes: { lben_mensual: [0, 0, 0, 0, 0, 95, 95, 100] } }),
        ],
      },
      { bloqueId: 'b2', edificacionId: 'e2', modelos: [modelo({ tipo: 'regresion', r2: 0.9, coeficientes: {} })] },
    ],
    periodoActual: [
      { edificacionId: 'e1', nombre: 'Campus Norte', consumoNormalizado: 90, costoCop: 900 },
      { edificacionId: 'e2', nombre: 'Residencia', consumoNormalizado: 40, costoCop: 400 },
    ],
    periodoPrevio: [
      { edificacionId: 'e1', nombre: 'Campus Norte', consumoNormalizado: 100, costoCop: 1000 },
      { edificacionId: 'e2', nombre: 'Residencia', consumoNormalizado: 20, costoCop: 200 },
    ],
  }
}

describe('construirResumen', () => {
  it('ordena la serie ascendente y alinea la LBEn por mes calendario', () => {
    const r = construirResumen(base())
    expect(r.serie.map((p) => p.periodo)).toEqual(['2026-06', '2026-07', '2026-08'])
    // jun(julio→idx5=95), jul(idx6=95), ago(idx7=100): solo e1 tiene modelo usable
    expect(r.serieLb).toEqual([95, 95, 100])
  })

  it('KPIs: delta real vs el período anterior (y null con un solo punto)', () => {
    const r = construirResumen(base())
    expect(r.consumo.valor).toBe(90)
    expect(r.consumo.deltaPct).toBeCloseTo(-10)
    expect(r.costo.deltaPct).toBeCloseTo(-10)

    const una = { ...base(), serie: [base().serie[0]] }
    expect(construirResumen(una).consumo.deltaPct).toBeNull()
  })

  it('ahorro = LB − consumo del último período; null sin cobertura', () => {
    const r = construirResumen(base())
    expect(r.ahorro).toEqual({ kwh: 10, pct: 10, lbKwh: 100 })

    const sinLb = { ...base(), lineasBase: [] }
    const r2 = construirResumen(sinLb)
    expect(r2.ahorro).toBeNull()
    expect(r2.cobertura).toEqual({ bloquesConLb: 0, bloquesTotales: 2 })
  })

  it('cobertura cuenta solo bloques con modelo usable', () => {
    // b2 solo tiene regresión sin serie → no cuenta
    expect(construirResumen(base()).cobertura).toEqual({ bloquesConLb: 1, bloquesTotales: 2 })
  })

  it('distribución: orden desc, share % y Δ por edificación', () => {
    const r = construirResumen(base())
    expect(r.distribucion.map((d) => d.clave)).toEqual(['e1', 'e2'])
    expect(r.distribucion[0].sharePct).toBeCloseTo((90 / 130) * 100)
    expect(r.distribucion[0].delta).toBeCloseTo(-10)
    expect(r.distribucion[1].delta).toBeCloseTo(100)
    expect(r.distribucion[0].textoValor).toContain('%')
  })

  it('badge factual de cobertura en las últimas facturas', () => {
    const r = construirResumen(base())
    expect(r.facturas[0].conLineaBase).toBe(true)

    const facturaE2 = {
      ...base(),
      ultimasFacturas: [
        { ...base().ultimasFacturas[0], id: 'f2', edificacionId: 'e2', edificacionNombre: 'Residencia' },
      ],
    }
    expect(construirResumen(facturaE2).facturas[0].conLineaBase).toBe(false)
  })

  it('ranking: solo edificaciones con LB, ahorro desc, tope 5, con costo', () => {
    const r = construirResumen(base())
    // Solo e1 (e2 no tiene modelo usable): ahorro 100 − 90 = 10
    expect(r.ranking).toHaveLength(1)
    expect(r.ranking[0]).toEqual({
      clave: 'e1',
      nombre: 'Campus Norte',
      ahorroKwh: 10,
      ahorroPct: 10,
      costoCop: 900,
    })
  })

  it('estado vacío: nada inventado', () => {
    const vacio: EnergySummary = {
      facturas: 0,
      ultimoPeriodo: null,
      edificaciones: 0,
      bloques: 0,
      serie: [],
      ultimasFacturas: [],
      lineasBase: [],
      periodoActual: null,
      periodoPrevio: null,
    }
    const r = construirResumen(vacio)
    expect(r.serie).toEqual([])
    expect(r.serieLb).toEqual([])
    expect(r.consumo.valor).toBeNull()
    expect(r.ahorro).toBeNull()
    expect(r.ranking).toEqual([])
  })
})
