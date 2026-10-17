import { describe, expect, it } from 'vitest'

import type {
  BandaMes,
  PeriodoAnalizado,
  SalidaAnalisis,
} from '@/features/analisis/models/analisis'
import {
  calcularSeveridad,
  clavePeriodo,
  esConfigNormativa,
  evaluarAlertas,
  firmaDeEntradas,
  resumirAlertas,
  type AlertaVista,
} from './alertas'

// ============================================================
// Salida sintética del motor
// ------------------------------------------------------------
// El contrato solo mira `bandas[].estimado`, `periodos[]` y
// `meses_insuficientes`. Se construyen a mano para controlar los tres
// regímenes del motor:
//   · n = 12 → banda ±k·σ (ec. 4-5). σ = (sup − inf) / (2·K) = 50.
//   · n = 5  → banda ±10 % de la media (ec. 3 / 7), n < MIN_DATOS_IC.
//   · n = 2  → `estimado`: sin banda, NO evaluable (R1).
// ============================================================

function banda(mes: number, n: number, media: number, inf: number | null, sup: number | null): BandaMes {
  return {
    mes,
    n,
    media,
    limite_inferior: inf,
    limite_superior: sup,
    descartados: 0,
    estimado: n < 3,
  }
}

function periodo(
  ano: number,
  mes: number,
  consumo: number,
  bandaInf: number | null,
  bandaSup: number | null,
  esAtipico: boolean | null,
  direccion: 'alza' | 'caida' | null
): PeriodoAnalizado {
  return {
    mes,
    ano,
    consumo_kwh: consumo,
    media_mes: bandaInf === null ? null : 1000,
    banda_inf: bandaInf,
    banda_sup: bandaSup,
    es_atipico: esAtipico,
    direccion,
    desviacion_pct: bandaInf === null ? null : ((consumo - 1000) / 1000) * 100,
    dias_lectivos: 20,
    calendario: 'lectivo',
    explicacion: esAtipico ? 'Excede la banda del mes.' : null,
  }
}

const SALIDA: SalidaAnalisis = {
  ok: true,
  originales: 4,
  depurados: 4,
  criterio_depuracion: 'banda_10_pct',
  min_datos_ic: 10,
  min_valores_por_mes: 3,
  umbra_dias_lectivos: 15,
  estadisticos: {
    n: 4,
    media: 1000,
    mediana: 1000,
    desv_est: 50,
    coef_variacion: 0.05,
    minimo: 1000,
    maximo: 1200,
  },
  tendencia: { pendiente_kwh_por_mes: 0, variacion_pct_anual: 0 },
  bandas: [
    banda(1, 12, 1000, 900, 1100),
    banda(2, 12, 1000, 900, 1100),
    banda(3, 5, 1000, 900, 1100),
    banda(5, 2, 1000, null, null),
  ],
  meses_insuficientes: [5],
  ajustes_aplicados: [],
  periodos: [
    // Alza clara: exceso de una banda entera (semiancho 100) ⇒ severidad alta.
    periodo(2024, 1, 1200, 900, 1100, true, 'alza'),
    // Dentro de banda.
    periodo(2024, 2, 1000, 900, 1100, false, null),
    // Alza de medio semiancho ⇒ severidad media con el umbral normativo.
    periodo(2024, 3, 1150, 900, 1100, true, 'alza'),
    // Mes `estimado`: disparadísimo, pero sin banda construible ⇒ no evaluable.
    periodo(2024, 5, 9000, null, null, null, null),
  ],
  resumen: {
    periodos: 4,
    atipicos: 2,
    atipicos_alza: 2,
    atipicos_caida: 0,
    en_lectivo: 4,
    en_vacaciones: 0,
    sin_calendario: 0,
    periodos_con_banda: 3,
    ajustes: 0,
  },
  modelos: null,
}

const NORMATIVA = { pct: 10, k: 2 }

describe('clavePeriodo', () => {
  it('paddea año y mes al formato de FacturaEnergia', () => {
    expect(clavePeriodo(2024, 3)).toBe('2024-03')
    expect(clavePeriodo(2024, 12)).toBe('2024-12')
  })
})

describe('esConfigNormativa', () => {
  it('reconoce el criterio de la Resolución (±10 % / ±2·DesvEst)', () => {
    expect(esConfigNormativa(NORMATIVA)).toBe(true)
    expect(esConfigNormativa({ pct: 10, k: 1.5 })).toBe(false)
    expect(esConfigNormativa({ pct: 15, k: 2 })).toBe(false)
  })
})

describe('calcularSeveridad', () => {
  it('normaliza el exceso al semiancho de la banda', () => {
    // semiancho 100: 1000 > 1100 + 100 ⇒ exceso 1 ⇒ alta.
    expect(calcularSeveridad(1200, 900, 1100)).toBe('alta')
    // exceso 0.5 ⇒ media.
    expect(calcularSeveridad(1150, 900, 1100)).toBe('media')
    // exceso 0.2 ⇒ baja.
    expect(calcularSeveridad(1120, 900, 1100)).toBe('baja')
  })

  it('trata una banda degenerada como exceso máximo', () => {
    expect(calcularSeveridad(1010, 1000, 1000)).toBe('alta')
  })

  it('es invariante a la escala del consumo', () => {
    // El mismo exceso relativo en una edificación 100× más grande.
    expect(calcularSeveridad(120000, 90000, 110000)).toBe('alta')
    expect(calcularSeveridad(115000, 90000, 110000)).toBe('media')
  })
})

describe('evaluarAlertas — umbral normativo', () => {
  const resultado = evaluarAlertas(SALIDA, NORMATIVA)

  it('alerta solo los períodos que superan la banda superior (R2)', () => {
    expect(resultado.alertas.map((a) => a.periodo)).toEqual(['2024-01', '2024-03'])
    expect(resultado.alertas.every((a) => a.direccion === 'alza')).toBe(true)
  })

  it('adjunta banda, consumo y severidad de cada alerta', () => {
    expect(resultado.alertas[0]).toMatchObject({
      periodo: '2024-01',
      consumoKwh: 1200,
      bandaInf: 900,
      bandaSup: 1100,
      severidad: 'alta',
    })
    expect(resultado.alertas[1].severidad).toBe('media')
    expect(resultado.alertas[1].desviacionPct).toBeCloseTo(15, 6)
  })

  it('no alerta sobre meses sin banda y los cuenta como no evaluables (R1)', () => {
    // 2024-05 consume 9000 kWh, pero su mes es `estimado`.
    expect(resultado.alertas.some((a) => a.periodo === '2024-05')).toBe(false)
    expect(resultado.mesesNoEvaluables).toEqual([5])
    // Períodos que sí se compararon: 01, 02 y 03 (el 05 no tiene banda).
    expect(resultado.periodosEvaluables).toBe(3)
  })

  it('devuelve la config aplicada como snapshot', () => {
    expect(resultado.config).toEqual(NORMATIVA)
  })

  it('ordena las alertas de más antigua a más reciente', () => {
    const periodos = resultado.alertas.map((a) => a.periodo)
    expect([...periodos].sort()).toEqual(periodos)
  })
})

describe('evaluarAlertas — umbral personalizado', () => {
  it('reclasa los meses con n < min_datos_ic contra ±pct', () => {
    // pct 5 ⇒ sup = 1000 · 1,05 = 1050 (2024-03 excede y ahora es «alta»).
    const resultado = evaluarAlertas(SALIDA, { pct: 5, k: 2 })
    expect(resultado.alertas.map((a) => a.periodo)).toEqual(['2024-01', '2024-03'])
    expect(resultado.alertas[1].bandaSup).toBeCloseTo(1050, 6)
    expect(resultado.alertas[1].severidad).toBe('alta')
  })

  it('estrecha la banda de los meses con σ cuando k baja', () => {
    // k 1 ⇒ sup = 1000 + 1·50 = 1050 en los meses con n ≥ min_datos_ic.
    const resultado = evaluarAlertas(SALIDA, { pct: 10, k: 1 })
    expect(resultado.alertas[0].bandaSup).toBeCloseTo(1050, 6)
    expect(resultado.alertas[0].severidad).toBe('alta')
    // 2024-02 (1000 kWh) sigue dentro de la banda estrecha.
    expect(resultado.alertas.some((a) => a.periodo === '2024-02')).toBe(false)
  })

  it('mantiene la exclusión de los meses estimados (R1)', () => {
    const resultado = evaluarAlertas(SALIDA, { pct: 5, k: 1 })
    expect(resultado.alertas.some((a) => a.periodo === '2024-05')).toBe(false)
    expect(resultado.mesesNoEvaluables).toEqual([5])
  })
})

describe('firmaDeEntradas', () => {
  const base = {
    edificacionId: 'edi_1',
    config: { pct: 10, k: 2, activo: true },
    facturas: { total: 36, ultimaActualizacion: '2026-01-05T10:00:00.000Z', consumoTotal: 369000 },
    variables: { total: 36, ultimaCreacion: '2026-01-05T10:00:00.000Z' },
    ajustes: { total: 2, valorTotal: 1500 },
    versionMotor: 1,
  }

  it('es determinista para las mismas entradas', () => {
    expect(firmaDeEntradas(base)).toBe(firmaDeEntradas({ ...base }))
  })

  it('cambia cuando cambia la configuración', () => {
    expect(firmaDeEntradas({ ...base, config: { ...base.config, pct: 15 } })).not.toBe(
      firmaDeEntradas(base)
    )
    expect(firmaDeEntradas({ ...base, config: { ...base.config, activo: false } })).not.toBe(
      firmaDeEntradas(base)
    )
  })

  it('cambia cuando cambian los datos de entrada', () => {
    const conFacturaNueva = {
      ...base,
      facturas: { ...base.facturas, total: 37 },
    }
    expect(firmaDeEntradas(conFacturaNueva)).not.toBe(firmaDeEntradas(base))
    expect(
      firmaDeEntradas({ ...base, ajustes: { total: 3, valorTotal: 1500 } })
    ).not.toBe(firmaDeEntradas(base))
    expect(firmaDeEntradas({ ...base, versionMotor: 2 })).not.toBe(firmaDeEntradas(base))
  })

  it('ignora el ruido de coma flotante de las sumas', () => {
    const casi = { ...base, facturas: { ...base.facturas, consumoTotal: 369000.00000001 } }
    expect(firmaDeEntradas(casi)).toBe(firmaDeEntradas(base))
  })
})

describe('resumirAlertas', () => {
  it('cuenta por estado y severidad', () => {
    const alertas = [
      { estado: 'nueva', severidad: 'alta' },
      { estado: 'nueva', severidad: 'media' },
      { estado: 'leida', severidad: 'baja' },
      { estado: 'descartada', severidad: 'alta' },
    ] as AlertaVista[]
    expect(resumirAlertas(alertas)).toEqual({
      total: 4,
      nuevas: 2,
      leidas: 1,
      descartadas: 1,
      altas: 2,
    })
  })

  it('resume una bandeja vacía en ceros', () => {
    expect(resumirAlertas([])).toEqual({
      total: 0,
      nuevas: 0,
      leidas: 0,
      descartadas: 0,
      altas: 0,
    })
  })
})
