/**
 * Fixtures deterministas del Módulo 3 de Análisis.
 *
 * La serie replica el golden test de `python/tests/test_analisis.py`:
 * 36 meses (2023-2025) con patrón estacional fijo por mes calendario y
 * dos atípicos plantados — alza del 40 % en marzo 2024 y caída del
 * 33,3 % en agosto 2023 — ambos en meses lectivos. Los estadísticos son
 * los que el motor devuelve para esa serie (media 10.250 kWh; DesvEst
 * poblacional 1.401,8837 kWh, ec. 5).
 */

import {
  construirGestion,
  notaSinLineaBase,
  type AnalisisResultado,
  type EntradaNivelGestion,
  type PeriodoAnalizado,
  type SalidaAnalisis,
} from '../../models/analisis'
import {
  CATALOGO_XM,
  construirSerie,
  type RespuestaContextoXm,
  type RespuestaSerieXm,
} from '../../models/xm'

const BASE_POR_MES: Record<number, number> = {
  1: 8500,
  2: 10000,
  3: 10000,
  4: 10000,
  5: 10000,
  6: 11000,
  7: 8000,
  8: 12000,
  9: 11500,
  10: 11500,
  11: 11500,
  12: 9000,
}

const DIAS_LECTIVOS_POR_MES: Record<number, number> = {
  1: 8,
  2: 21,
  3: 21,
  4: 21,
  5: 21,
  6: 20,
  7: 5,
  8: 21,
  9: 21,
  10: 22,
  11: 20,
  12: 6,
}

const ANIOS = [2023, 2024, 2025] as const

const EXPLICACION_ALZA =
  'El consumo de marzo de 2024 (14.000,0 kWh) supera el límite superior de la banda de marzo (11.000,0 kWh, media 10.000,0 kWh, ±10 % (ec. 3, n=3)) en un 40.0 %; el mes fue lectivo (21 días clase).'

const EXPLICACION_CAIDA =
  'El consumo de agosto de 2023 (8.000,0 kWh) queda por debajo del límite inferior de la banda de agosto (10.800,0 kWh, media 12.000,0 kWh, ±10 % (ec. 3, n=3)) en un 33.3 %; el mes fue lectivo (21 días clase).'

function crearPeriodos(): PeriodoAnalizado[] {
  const periodos: PeriodoAnalizado[] = []
  for (const ano of ANIOS) {
    for (let mes = 1; mes <= 12; mes += 1) {
      const base = BASE_POR_MES[mes]
      const dias = DIAS_LECTIVOS_POR_MES[mes]
      let consumo = base
      let esAtipico: boolean | null = false
      let direccion: 'alza' | 'caida' | null = null
      let desviacion: number | null = (consumo - base) / base * 100
      let explicacion: string | null = null

      if (ano === 2024 && mes === 3) {
        consumo = 14000
        esAtipico = true
        direccion = 'alza'
        desviacion = 40
        explicacion = EXPLICACION_ALZA
      } else if (ano === 2023 && mes === 8) {
        consumo = 8000
        esAtipico = true
        direccion = 'caida'
        desviacion = -33.3333
        explicacion = EXPLICACION_CAIDA
      }

      periodos.push({
        mes,
        ano,
        consumo_kwh: consumo,
        media_mes: base,
        banda_inf: base * 0.9,
        banda_sup: base * 1.1,
        es_atipico: esAtipico,
        direccion,
        desviacion_pct: Number(desviacion.toFixed(4)),
        dias_lectivos: dias,
        calendario: dias > 12 ? 'lectivo' : 'vacaciones',
        explicacion,
      })
    }
  }
  return periodos
}

export const edificacionesAnalisisDemo = [
  { id: 'edi-demo-campus', nombre: 'Campus Robledo' },
  { id: 'edi-demo-sede', nombre: 'Sede Administrativa' },
]

export const edificacionUnicaDemo = [edificacionesAnalisisDemo[0]]

/**
 * Niveles de gestión demo: edificación (exacta, LB completa de 2 bloques),
 * bloque con share 0,6 (área×factor), un espacio al 50 % de su bloque y un
 * segundo bloque cuya única LB es de regresión (nota honesta, sin kWh).
 */
const ENTRADAS_GESTION: EntradaNivelGestion[] = [
  {
    tipo: 'edificacion',
    clave: 'edi',
    nombre: 'Campus Robledo',
    precision: 'exacto',
    share: null,
    lb: {
      kwh: 11000,
      modelo: 'Cociente',
      cobertura: '2 de 2 bloques con línea base',
      nota: null,
    },
  },
  {
    tipo: 'bloque',
    clave: 'b:bloque-a',
    nombre: 'BLO-A — Aulas mayores',
    precision: 'estimado',
    share: 0.6,
    lb: { kwh: 6600, modelo: 'Cociente', cobertura: null, nota: null },
  },
  {
    tipo: 'espacio',
    clave: 'e:espacio-101',
    nombre: 'BLO-A › Salón 101',
    precision: 'estimado',
    share: 0.3,
    lb: { kwh: 3300, modelo: 'Cociente', cobertura: null, nota: null },
  },
  {
    tipo: 'bloque',
    clave: 'b:bloque-b',
    nombre: 'BLO-B — Laboratorios',
    precision: 'estimado',
    share: 0.4,
    lb: {
      kwh: null,
      modelo: null,
      cobertura: null,
      nota: notaSinLineaBase([{ tipo: 'REGRESSION_ESTADISTICA', coeficientes: {} }]),
    },
  },
]

const SALIDA_DEMO: SalidaAnalisis = {
    ok: true,
    originales: 36,
    depurados: 34,
    criterio_depuracion: 'banda_10_pct',
    min_datos_ic: 10,
    min_valores_por_mes: 3,
    umbra_dias_lectivos: 12,
    estadisticos: {
      n: 36,
      media: 10250,
      mediana: 10000,
      desv_est: 1401.8837,
      coef_variacion: 13.6769,
      minimo: 8000,
      maximo: 14000,
    },
    tendencia: {
      pendiente_kwh_por_mes: 7.2072,
      variacion_pct_anual: 0.8438,
    },
    bandas: Object.entries(BASE_POR_MES).map(([mes, base]) => ({
      mes: Number(mes),
      n: 3,
      media: base,
      limite_inferior: base * 0.9,
      limite_superior: base * 1.1,
      descartados: mes === '3' || mes === '8' ? 1 : 0,
      estimado: false,
    })),
    meses_insuficientes: [],
    ajustes_aplicados: [],
    periodos: crearPeriodos(),
    resumen: {
      periodos: 36,
      atipicos: 2,
      atipicos_alza: 1,
      atipicos_caida: 1,
      en_lectivo: 2,
      en_vacaciones: 0,
      sin_calendario: 0,
      periodos_con_banda: 36,
      ajustes: 0,
    },
}

export const analisisDemo: AnalisisResultado = {
  nombreEdificacion: 'Campus Robledo',
  desde: '2023-01',
  hasta: '2025-12',
  calculadoEn: '2026-10-12T15:00:00.000Z',
  salida: SALIDA_DEMO,
  gestion: construirGestion(ENTRADAS_GESTION, SALIDA_DEMO),
}

/** Misma serie sin atípicos: ejercita el estado «Sin períodos inusuales». */
const SALIDA_SIN_ATIPICOS: SalidaAnalisis = {
  ...SALIDA_DEMO,
    depurados: 36,
    periodos: analisisDemo.salida.periodos.map((p) => ({
      ...p,
      // Los dos períodos plantados vuelven a su valor esperado.
      consumo_kwh: p.es_atipico && p.media_mes !== null ? p.media_mes : p.consumo_kwh,
      es_atipico: false,
      direccion: null,
      explicacion: null,
      desviacion_pct: 0,
    })),
    resumen: {
      ...SALIDA_DEMO.resumen,
      atipicos: 0,
      atipicos_alza: 0,
      atipicos_caida: 0,
      en_lectivo: 0,
      en_vacaciones: 0,
    },
}

export const analisisSinAtipicosDemo: AnalisisResultado = {
  ...analisisDemo,
  salida: SALIDA_SIN_ATIPICOS,
  gestion: construirGestion(ENTRADAS_GESTION, SALIDA_SIN_ATIPICOS),
}

// ───────────────────────────────────────────────── Benchmark XM demo ──

/** 13 meses completos de referencia: septiembre 2025 → septiembre 2026. */
const MESES_BENCHMARK_DEMO: string[] = (() => {
  const periodos: string[] = []
  let anio = 2025
  let mes = 9
  for (let i = 0; i < 13; i += 1) {
    periodos.push(`${anio}-${String(mes).padStart(2, '0')}`)
    mes += 1
    if (mes === 13) {
      mes = 1
      anio += 1
    }
  }
  return periodos
})()

/** Demanda mensual del SIN en kWh (orden sep-2025 → sep-2026). */
const KWH_SISTEMA_DEMO = [
  7_100_000_000, 7_350_000_000, 7_420_000_000, 7_610_000_000, 7_480_000_000,
  7_300_000_000, 7_550_000_000, 7_700_000_000, 7_640_000_000, 7_500_000_000,
  7_390_000_000, 7_250_000_000, 7_460_000_000,
]

/** Demanda mensual del mercado no regulado en kWh (mismo orden). */
const KWH_MERCADO_DEMO = [
  1_720_000_000, 1_780_000_000, 1_810_000_000, 1_860_000_000, 1_830_000_000,
  1_790_000_000, 1_840_000_000, 1_900_000_000, 1_880_000_000, 1_850_000_000,
  1_820_000_000, 1_760_000_000, 1_805_000_000,
]

function mapaMensual(kwh: number[]): Map<string, number> {
  return new Map(MESES_BENCHMARK_DEMO.map((periodo, i) => [periodo, kwh[i]]))
}

export const serieSistemaDemo: RespuestaSerieXm = {
  estado: 'ok',
  serie: construirSerie(
    'sistema',
    'Demanda del SIN (sistema interconectado)',
    MESES_BENCHMARK_DEMO,
    mapaMensual(KWH_SISTEMA_DEMO)
  ).serie,
  advertencias: [],
}

export const serieMercadoDemo: RespuestaSerieXm = {
  estado: 'ok',
  serie: construirSerie(
    'mercado',
    'Demanda comercial — mercado no regulado',
    MESES_BENCHMARK_DEMO,
    mapaMensual(KWH_MERCADO_DEMO)
  ).serie,
  advertencias: [],
}

export const contextoDemo: RespuestaContextoXm = {
  estado: 'ok',
  contexto: {
    fechaConsulta: '2026-10-13T12:00:00.000Z',
    comparacionInterna: {
      ventanaReciente: '2025-10 → 2026-09',
      ventanaPrevia: '2024-10 → 2025-09',
      filas: [
        {
          edificacionId: 'edi-demo-campus',
          nombre: 'Campus Robledo',
          mesesConDatos: 24,
          variacionPct: -3.4,
          promedioKwh: 10100,
        },
        {
          edificacionId: 'edi-demo-sede',
          nombre: 'Sede Administrativa',
          mesesConDatos: 18,
          variacionPct: 2.1,
          promedioKwh: 6420,
        },
        {
          edificacionId: 'edi-demo-lab',
          nombre: 'Laboratorio Central',
          mesesConDatos: 9,
          variacionPct: null,
          promedioKwh: null,
        },
      ],
    },
    catalogo: CATALOGO_XM,
  },
}
