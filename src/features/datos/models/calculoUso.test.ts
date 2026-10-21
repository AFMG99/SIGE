import { describe, expect, it, vi } from 'vitest'
import {
  CLAIM_TTL_MS,
  MAX_PERIODOS_POR_LLAMADA,
  PRESUPUESTO_MS,
  clasificarPeriodos,
  ejecutarSchema,
  expandirIntervalo,
  intervaloSchema,
  presupuestoRestante,
  recalcularSchema,
} from './calculoUso'
import type { PeriodoAlmacenado } from './calculoUso'

/** Periodo CALCULADO con todos los marcadores de integridad BR4 en orden. */
const periodoIntacto = (): PeriodoAlmacenado => ({
  estado: 'CALCULADO',
  equiposEsperados: 2,
  calculadoEn: new Date('2024-03-05T12:00:00Z'),
  calculadoPor: 'user-1',
  detalles: [
    { estado: 'CALCULADO', horasUsoDia: 8, diasUsoMes: 22 },
    { estado: 'CALCULADO', horasUsoDia: 10, diasUsoMes: 20 },
  ],
})

describe('intervaloSchema', () => {
  it('acepta un intervalo válido que cruza el año', () => {
    const r = intervaloSchema.safeParse({
      desde: { mes: 11, ano: 2024 },
      hasta: { mes: 2, ano: 2025 },
    })
    expect(r.success).toBe(true)
  })

  it('rechaza un mes fuera del rango 1..12 en cualquiera de los extremos', () => {
    expect(
      intervaloSchema.safeParse({ desde: { mes: 13, ano: 2024 }, hasta: { mes: 2, ano: 2025 } })
        .success
    ).toBe(false)
    expect(
      intervaloSchema.safeParse({ desde: { mes: 1, ano: 2024 }, hasta: { mes: 0, ano: 2024 } })
        .success
    ).toBe(false)
  })

  it('rechaza un año fuera del rango 2000..2100', () => {
    expect(
      intervaloSchema.safeParse({ desde: { mes: 1, ano: 1999 }, hasta: { mes: 1, ano: 2000 } })
        .success
    ).toBe(false)
    expect(
      intervaloSchema.safeParse({ desde: { mes: 1, ano: 2000 }, hasta: { mes: 1, ano: 2101 } })
        .success
    ).toBe(false)
  })

  it('rechaza un intervalo cuyo mes final sea anterior al inicial', () => {
    const r = intervaloSchema.safeParse({
      desde: { mes: 3, ano: 2024 },
      hasta: { mes: 2, ano: 2024 },
    })
    expect(r.success).toBe(false)
  })

  it('rechaza un intervalo que supera los 120 meses permitidos', () => {
    const r = intervaloSchema.safeParse({
      desde: { mes: 1, ano: 2000 },
      hasta: { mes: 2, ano: 2010 },
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => /120 meses/.test(i.message))).toBe(true)
    }
  })
})

describe('expandirIntervalo', () => {
  it('expande 2024-11 a 2025-02 en exactamente 4 periodos inclusivos', () => {
    const periodos = expandirIntervalo({ mes: 11, ano: 2024 }, { mes: 2, ano: 2025 })
    expect(periodos).toEqual([
      { mes: 11, ano: 2024 },
      { mes: 12, ano: 2024 },
      { mes: 1, ano: 2025 },
      { mes: 2, ano: 2025 },
    ])
  })

  it('devuelve un solo periodo cuando desde y hasta son el mismo mes', () => {
    expect(expandirIntervalo({ mes: 6, ano: 2023 }, { mes: 6, ano: 2023 })).toEqual([
      { mes: 6, ano: 2023 },
    ])
  })

  it('al cruzar el año (2024-12 → 2025-01) solo produce periodos válidos', () => {
    const periodos = expandirIntervalo({ mes: 12, ano: 2024 }, { mes: 1, ano: 2025 })
    expect(periodos).toEqual([
      { mes: 12, ano: 2024 },
      { mes: 1, ano: 2025 },
    ])
    for (const p of periodos) {
      expect(p.mes).toBeGreaterThanOrEqual(1)
      expect(p.mes).toBeLessThanOrEqual(12)
    }
  })

  it('no produce periodos cuando el intervalo está invertido', () => {
    expect(expandirIntervalo({ mes: 2, ano: 2025 }, { mes: 11, ano: 2024 })).toEqual([])
  })
})

describe('clasificarPeriodos (integridad BR4)', () => {
  it('clasifica como nuevo un periodo sin resultado almacenado', () => {
    expect(clasificarPeriodos(null, 2)).toBe('nuevo')
  })

  it('clasifica como fallido un periodo con estado FALLIDO', () => {
    expect(clasificarPeriodos({ ...periodoIntacto(), estado: 'FALLIDO' }, 2)).toBe('fallido')
  })

  it('clasifica como revisar un periodo con estado REVISAR', () => {
    expect(clasificarPeriodos({ ...periodoIntacto(), estado: 'REVISAR' }, 2)).toBe('revisar')
  })

  it('clasifica como pendiente un periodo PENDIENTE o CALCULANDO', () => {
    expect(clasificarPeriodos({ ...periodoIntacto(), estado: 'PENDIENTE' }, 2)).toBe('pendiente')
    expect(clasificarPeriodos({ ...periodoIntacto(), estado: 'CALCULANDO' }, 2)).toBe('pendiente')
  })

  it('clasifica como pendiente un CALCULADO con menos filas de detalle de las esperadas', () => {
    const p = periodoIntacto()
    expect(clasificarPeriodos({ ...p, detalles: p.detalles.slice(0, 1) }, 2)).toBe('pendiente')
  })

  it('clasifica como pendiente un CALCULADO con valores incoherentes en el detalle', () => {
    const p = periodoIntacto()
    expect(
      clasificarPeriodos(
        { ...p, detalles: [{ estado: 'CALCULADO', horasUsoDia: -1, diasUsoMes: 22 }, p.detalles[1]] },
        2
      )
    ).toBe('pendiente')
    expect(
      clasificarPeriodos(
        {
          ...p,
          detalles: [
            { estado: 'REVISAR', horasUsoDia: 8, diasUsoMes: 22 },
            p.detalles[1],
          ],
        },
        2
      )
    ).toBe('pendiente')
  })

  it('clasifica como pendiente un CALCULADO sin calculadoEn o sin calculadoPor', () => {
    const p = periodoIntacto()
    expect(clasificarPeriodos({ ...p, calculadoEn: null }, 2)).toBe('pendiente')
    expect(clasificarPeriodos({ ...p, calculadoPor: null }, 2)).toBe('pendiente')
  })

  it('clasifica como desactualizado un CALCULADO cuyo inventario de equipos cambió', () => {
    expect(clasificarPeriodos(periodoIntacto(), 3)).toBe('desactualizado')
  })

  it('clasifica como existente-intacto un CALCULADO con toda la integridad en orden', () => {
    expect(clasificarPeriodos(periodoIntacto(), 2)).toBe('existente-intacto')
  })

  it('trata como intacto un periodo sin equipos (equiposEsperados 0, BR2)', () => {
    const p: PeriodoAlmacenado = {
      estado: 'CALCULADO',
      equiposEsperados: 0,
      calculadoEn: new Date('2024-03-05T12:00:00Z'),
      calculadoPor: 'user-1',
      detalles: [],
    }
    expect(clasificarPeriodos(p, 0)).toBe('existente-intacto')
  })
})

describe('constantes de lote y presupuesto (AC11)', () => {
  it('usa los valores acordados para lote, presupuesto y reclamo', () => {
    expect(MAX_PERIODOS_POR_LLAMADA).toBe(3)
    expect(PRESUPUESTO_MS).toBe(40_000)
    expect(CLAIM_TTL_MS).toBe(300_000)
  })
})

describe('presupuestoRestante (reloj simulado)', () => {
  it('devuelve el presupuesto completo al inicio de la ejecución', () => {
    expect(presupuestoRestante(1_000_000, 1_000_000)).toBe(PRESUPUESTO_MS)
  })

  it('descuenta el tiempo transcurrido', () => {
    expect(presupuestoRestante(1_010_000, 1_000_000)).toBe(30_000)
  })

  it('se planta en 0 tras superar el presupuesto (nunca negativo)', () => {
    expect(presupuestoRestante(1_041_000, 1_000_000)).toBe(0)
  })

  it('con Date.now simulado devuelve 0 al pasar los 40 s', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2024-03-01T12:00:00Z'))
      const inicio = Date.now()
      vi.advanceTimersByTime(41_000)
      expect(presupuestoRestante(Date.now(), inicio)).toBe(0)
      vi.setSystemTime(new Date('2024-03-01T12:00:00Z'))
      vi.advanceTimersByTime(39_000)
      expect(presupuestoRestante(Date.now(), inicio)).toBe(1_000)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('ejecutarSchema', () => {
  it('acepta una ejecución válida con edificación e intervalo', () => {
    const r = ejecutarSchema.safeParse({
      edificacionId: 'abc123',
      desde: { mes: 1, ano: 2024 },
      hasta: { mes: 3, ano: 2024 },
    })
    expect(r.success).toBe(true)
  })

  it('acepta el loteId opcional de una ejecución masiva', () => {
    const r = ejecutarSchema.safeParse({
      edificacionId: 'abc123',
      desde: { mes: 1, ano: 2024 },
      hasta: { mes: 1, ano: 2024 },
      loteId: 'lote-1',
    })
    expect(r.success).toBe(true)
  })

  it('rechaza una ejecución sin edificación y con intervalo invertido', () => {
    expect(
      ejecutarSchema.safeParse({ desde: { mes: 1, ano: 2024 }, hasta: { mes: 3, ano: 2024 } })
        .success
    ).toBe(false)
    expect(
      ejecutarSchema.safeParse({
        edificacionId: 'abc123',
        desde: { mes: 3, ano: 2024 },
        hasta: { mes: 1, ano: 2024 },
      }).success
    ).toBe(false)
  })
})

describe('recalcularSchema (AC9)', () => {
  it('acepta un recálculo confirmado con la literal true', () => {
    const r = recalcularSchema.safeParse({
      edificacionId: 'abc123',
      periodos: [{ mes: 3, ano: 2024 }],
      confirmado: true,
    })
    expect(r.success).toBe(true)
  })

  it('rechaza confirmado=false, ausente o con cualquier otro valor', () => {
    for (const confirmado of [false, 'true', 1, undefined]) {
      const r = recalcularSchema.safeParse({
        edificacionId: 'abc123',
        periodos: [{ mes: 3, ano: 2024 }],
        confirmado,
      })
      expect(r.success).toBe(false)
    }
  })

  it('rechaza una lista de periodos vacía', () => {
    const r = recalcularSchema.safeParse({
      edificacionId: 'abc123',
      periodos: [],
      confirmado: true,
    })
    expect(r.success).toBe(false)
  })
})
