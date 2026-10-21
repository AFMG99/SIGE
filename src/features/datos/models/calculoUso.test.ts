import { describe, expect, it, vi } from 'vitest'
import {
  CLAIM_TTL_MS,
  MAX_PERIODOS_POR_LLAMADA,
  PRESUPUESTO_MS,
  calcularPeriodo,
  clasificarPeriodos,
  ejecutarSchema,
  expandirIntervalo,
  intervaloSchema,
  presupuestoRestante,
  recalcularSchema,
} from './calculoUso'
import type { ContextoPeriodo, HorarioContexto, PeriodoAlmacenado, ResultadoPeriodo, UsoOrigen } from './calculoUso'
import type { RangoFechas } from './calendario'

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

// ============================================================
// T3 — Núcleo puro de cálculo (AC1, AC13, BR2, BR5) + equivalencia (AC12)
// ============================================================

const CONFIG_USO = { horaInicioOperacion: 6, horasOperacionDia: 12 }

/** Todo marzo 2024 operativo: 31 días (21 hábiles LUN–VIE, 10 de fin de semana). */
const RANGOS_MARZO_2024: RangoFechas[] = [
  { fechaInicio: '2024-03-01', fechaFin: '2024-03-31', tipoDia: 'LECTIVO' },
]

/** Jornada de edificación LUN–VIE 08:00–18:00 (10 h). */
const HORARIO_EDIFICACION: HorarioContexto = {
  edificacionId: 'edi-1',
  nombre: 'Jornada de edificación',
  diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
  horaInicio: 8,
  horaFin: 18,
}

/** Franja de espacio LUN–VIE 09:00–17:00 (8 h) en esp-1 — gana a la de edificación. */
const HORARIO_ESPACIO: HorarioContexto = {
  edificacionId: 'edi-1',
  espacioId: 'esp-1',
  nombre: 'Aula 101',
  diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
  horaInicio: 9,
  horaFin: 17,
}

/** Contexto de marzo 2024 con dos equipos (uno con horario de espacio, otro no). */
const contextoMarzo = (sobrescribir: Partial<ContextoPeriodo> = {}): ContextoPeriodo => ({
  equipos: [
    { id: 'eq-1', bloqueId: 'blo-1', espacioId: 'esp-1' },
    { id: 'eq-2', bloqueId: 'blo-1', espacioId: 'esp-2' },
  ],
  rangos: RANGOS_MARZO_2024,
  config: CONFIG_USO,
  usarHorariosXe: true,
  horarios: [HORARIO_EDIFICACION, HORARIO_ESPACIO],
  ...sobrescribir,
})

const calcularMarzo = (contexto: ContextoPeriodo) =>
  calcularPeriodo({ edificacionId: 'edi-1', mes: 3, ano: 2024, contexto })

describe('calcularPeriodo (AC1)', () => {
  it('devuelve detalle por equipo y fecha, advertencias y trazabilidad del horario ganador', () => {
    const r = calcularMarzo(contextoMarzo())

    expect(r.equiposEsperados).toBe(2)
    expect(r.advertencias).toEqual([])
    expect(r.detalle.map((d) => d.equipoId)).toEqual(['eq-1', 'eq-2'])

    const eq1 = r.detalle[0]
    expect(eq1).toMatchObject({
      horasUsoDia: 8,
      diasUsoMes: 21,
      estado: 'CALCULADO',
      horarioGanador: 'ESPACIO/Aula 101',
    })
    expect(eq1.porFecha).toHaveLength(31)
    expect(eq1.porFecha[0]).toEqual({ fecha: '2024-03-01', horas: 8 })
    expect(eq1.porFecha[eq1.porFecha.length - 1]).toEqual({ fecha: '2024-03-31', horas: 0 })
    expect(eq1.porFecha.filter((d) => d.horas > 0)).toHaveLength(21)

    const eq2 = r.detalle[1]
    expect(eq2).toMatchObject({
      horasUsoDia: 10,
      diasUsoMes: 21,
      horarioGanador: 'EDIFICACION/Jornada de edificación',
    })

    expect(r.trazabilidad).toEqual([
      { equipoId: 'eq-1', nivelGanador: 'ESPACIO', vigencia: 'abierta', aportes: ['Lun–Vie 09:00–17:00'] },
      { equipoId: 'eq-2', nivelGanador: 'EDIFICACION', vigencia: 'abierta', aportes: ['Lun–Vie 08:00–18:00'] },
    ])
  })

  it('BR2: un periodo sin equipos queda con equiposEsperados 0 y la advertencia de sin registros', () => {
    const r = calcularMarzo(contextoMarzo({ equipos: [] }))

    expect(r.equiposEsperados).toBe(0)
    expect(r.detalle).toEqual([])
    expect(r.trazabilidad).toEqual([])
    expect(r.advertencias).toEqual(['Sin equipos registrados'])
  })

  it('BR5: sin horario vigente no hay fila de detalle (nunca ceros) y la advertencia nombra el motivo', () => {
    const r = calcularMarzo(contextoMarzo({ horarios: [] }))

    expect(r.detalle).toEqual([])
    expect(r.advertencias).toEqual(['Sin horario vigente'])
    expect(r.trazabilidad.map((t) => t.nivelGanador)).toEqual(['SIN_HORARIO', 'SIN_HORARIO'])
    expect(r.equiposEsperados).toBe(2)
  })

  it('BR5: con horario vigente pero sin días operativos no hay fila y la advertencia dice sin días', () => {
    const r = calcularMarzo(
      contextoMarzo({
        rangos: [{ fechaInicio: '2024-03-01', fechaFin: '2024-03-31', tipoDia: 'VACACIONES' }],
      })
    )

    expect(r.detalle).toEqual([])
    expect(r.advertencias).toEqual(['Sin días operativos'])
    // El horario SÍ está vigente: la trazabilidad lo sigue resolviendo.
    expect(r.trazabilidad.map((t) => t.nivelGanador)).toEqual(['ESPACIO', 'EDIFICACION'])
  })
})

describe('consolidarPorNivel (AC1, D2 display-only)', () => {
  it('consolida los equipos calculados por espacio, bloque y edificación', () => {
    const r = calcularMarzo(contextoMarzo())

    expect(r.consolidaciones.espacios).toEqual([
      { espacioId: 'esp-1', equipos: 1, horasUsoDia: 8, diasUsoMes: 21 },
      { espacioId: 'esp-2', equipos: 1, horasUsoDia: 10, diasUsoMes: 21 },
    ])
    expect(r.consolidaciones.bloques).toEqual([
      { bloqueId: 'blo-1', equipos: 2, horasUsoDia: 18, diasUsoMes: 42 },
    ])
    expect(r.consolidaciones.edificacion).toEqual({ equipos: 2, horasUsoDia: 18, diasUsoMes: 42 })
  })

  it('los equipos en revisión (sin fila) no aportan a la consolidación', () => {
    // Solo horario de esp-1: eq-2 (esp-2) se queda sin horario vigente.
    const r = calcularMarzo(contextoMarzo({ horarios: [HORARIO_ESPACIO] }))

    expect(r.detalle.map((d) => d.equipoId)).toEqual(['eq-1'])
    expect(r.advertencias).toEqual(['Sin horario vigente'])
    expect(r.consolidaciones.espacios).toEqual([
      { espacioId: 'esp-1', equipos: 1, horasUsoDia: 8, diasUsoMes: 21 },
    ])
    expect(r.consolidaciones.bloques).toEqual([
      { bloqueId: 'blo-1', equipos: 1, horasUsoDia: 8, diasUsoMes: 21 },
    ])
    expect(r.consolidaciones.edificacion).toEqual({ equipos: 1, horasUsoDia: 8, diasUsoMes: 21 })
  })
})

describe('calcularPeriodo (AC13 — bisiesto y largo de mes)', () => {
  /** Febrero de 2024 y 2025 con el mismo horario y todo el mes operativo. */
  const contextoFebrero = (): ContextoPeriodo => ({
    equipos: [{ id: 'eq-2', bloqueId: 'blo-1', espacioId: 'esp-2' }],
    rangos: [{ fechaInicio: '2024-01-01', fechaFin: '2025-03-31', tipoDia: 'LECTIVO' }],
    config: CONFIG_USO,
    usarHorariosXe: true,
    horarios: [HORARIO_EDIFICACION],
  })

  it('2024-02 alcanza el día 29 y 2025-02 se detiene en el 28 con el mismo horario', () => {
    const bisiesto = calcularPeriodo({ edificacionId: 'edi-1', mes: 2, ano: 2024, contexto: contextoFebrero() })
    const normal = calcularPeriodo({ edificacionId: 'edi-1', mes: 2, ano: 2025, contexto: contextoFebrero() })

    expect(bisiesto.detalle[0].porFecha).toHaveLength(29)
    expect(bisiesto.detalle[0].porFecha[28].fecha).toBe('2024-02-29')
    expect(normal.detalle[0].porFecha).toHaveLength(28)
    expect(normal.detalle[0].porFecha[27].fecha).toBe('2025-02-28')

    // El 29/02/2024 es jueves (hábil y operativo): los días de uso difieren exactamente en 1.
    expect(bisiesto.detalle[0].diasUsoMes).toBe(21)
    expect(normal.detalle[0].diasUsoMes).toBe(20)
    expect(bisiesto.detalle[0].horasUsoDia).toBe(normal.detalle[0].horasUsoDia)
    expect(bisiesto.detalle[0].horasUsoDia).toBe(10)
  })
})

describe('equivalencia individual ≡ masivo (AC12, nivel puro)', () => {
  /** Resultado + metadatos de camino: exactamente lo que el diff EXCLUYE (spec §3.4). */
  type ResultadoConMeta = ResultadoPeriodo & {
    origen: UsoOrigen
    loteId: string | null
    calculadoEn: Date | null
  }

  /** Filas comparables: los campos de `uso_equipo_periodo`, sin porFecha ni metadatos. */
  const filasPersistidas = (r: ResultadoConMeta) =>
    r.detalle
      .map(({ equipoId, horasUsoDia, diasUsoMes, estado, horarioGanador }) => ({
        equipoId,
        horasUsoDia,
        diasUsoMes,
        estado,
        horarioGanador,
      }))
      .sort((a, b) => a.equipoId.localeCompare(b.equipoId))

  /** Campos comparables de `uso_periodo`: estado derivado, contadores y advertencias. */
  const resumenPersistido = (r: ResultadoConMeta) => ({
    estado: r.detalle.length === r.equiposEsperados ? 'CALCULADO' : 'REVISAR',
    equiposEsperados: r.equiposEsperados,
    equiposCalculados: r.detalle.length,
    equiposRevisar: r.equiposEsperados - r.detalle.length,
    advertencias: r.advertencias,
  })

  /** El lote masivo itera un intervalo; el contexto por periodo es el mismo que carga el individual. */
  const contextoDelPeriodo = (): ContextoPeriodo => ({
    ...contextoMarzo(),
    rangos: [{ fechaInicio: '2024-01-01', fechaFin: '2024-12-31', tipoDia: 'LECTIVO' }],
  })

  const comoIndividual = (periodo: { mes: number; ano: number }): ResultadoConMeta => ({
    ...calcularPeriodo({
      edificacionId: 'edi-1',
      mes: periodo.mes,
      ano: periodo.ano,
      contexto: contextoDelPeriodo(),
    }),
    origen: 'INDIVIDUAL',
    loteId: null,
    calculadoEn: new Date('2024-04-01T10:00:00Z'),
  })

  const comoMasivo = (
    desde: { mes: number; ano: number },
    hasta: { mes: number; ano: number },
    loteId: string
  ) =>
    expandirIntervalo(desde, hasta).map((periodo) => ({
      periodo,
      resultado: {
        ...calcularPeriodo({
          edificacionId: 'edi-1',
          mes: periodo.mes,
          ano: periodo.ano,
          contexto: contextoDelPeriodo(),
        }),
        origen: 'MASIVO',
        loteId,
        calculadoEn: new Date('2024-04-02T08:30:00Z'),
      } as ResultadoConMeta,
    }))

  it('produce las mismas filas y el mismo resumen ignorando timestamps, origen y loteId', () => {
    const periodo = { mes: 3, ano: 2024 }
    const individual = comoIndividual(periodo)
    const lote = comoMasivo({ mes: 2, ano: 2024 }, { mes: 4, ano: 2024 }, 'lote-xyz')
    expect(lote).toHaveLength(3)
    const delMasivo = lote.find((e) => e.periodo.mes === periodo.mes && e.periodo.ano === periodo.ano)!.resultado

    expect(filasPersistidas(delMasivo)).toEqual(filasPersistidas(individual))
    expect(resumenPersistido(delMasivo)).toEqual(resumenPersistido(individual))

    // Prueba de que el filtro es real: los metadatos de camino SÍ difieren.
    expect(delMasivo.calculadoEn).not.toEqual(individual.calculadoEn)
    expect(delMasivo.origen).not.toBe(individual.origen)
    expect(delMasivo.loteId).not.toBe(individual.loteId)
  })
})
