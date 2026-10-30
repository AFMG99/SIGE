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
  type AhorroModelo,
  type AnalisisResultado,
  type EntradaNivelGestion,
  type ModeloClave,
  type ModeloLBEn,
  type ModelosLBEn,
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

// ───────────────────────────────── Sección `modelos` espejo del motor ────
//
// Valores obtenidos ejecutando `analizar_desde_payload` (python/lben/
// analisis.py) con ESTAS mismas series: son golden del motor, no datos
// inventados. Si el motor cambia un texto o un redondeo, cambia aquí.

const TEXTOS_MOTOR: Record<
  ModeloClave,
  { etiqueta: string; formula: string; unidad: string }
> = {
  valor_absoluto: {
    etiqueta: 'Valor absoluto',
    formula: 'LBEn_m = promedio simple de los consumos normalizados del mes (ec. 2)',
    unidad: 'kWh/mes',
  },
  cociente: {
    etiqueta: 'Cociente de valores medidos',
    formula:
      'cociente = consumo normalizado ÷ población (ec. 6); LBEn_m = promedio de los cocientes del mes (ec. 7)',
    unidad: 'kWh/persona·mes',
  },
  regresion: {
    etiqueta: 'Regresión estadística',
    formula: 'consumo = β0 + β1·población + β2·GDE + … (ec. 8)',
    unidad: 'kWh/mes',
  },
  ingenieria: {
    etiqueta: 'Modelo de ingeniería',
    formula: 'simulación de cargas de la edificación (§7.4.4)',
    unidad: 'kWh/mes',
  },
  confort: {
    etiqueta: 'Confort térmico (ASHRAE 55)',
    formula:
      'energía base + ΔT · 15 kWh/°C (indicador propio, no es uno de los cuatro modelos de la Resolución)',
    unidad: 'kWh/mes',
  },
}

const MOTIVO_REGRESION_36 =
  'Hay 34 < 36 datos depurados: la regresión exige al menos 36 meses (§7.1-7.2).'
const MOTIVO_REGRESION_VARIABLES =
  'Sin variables operativas con variación en el periodo (población, GDE); la regresión no puede ajustarse.'
const MOTIVO_INGENIERIA =
  'Modelo de ingeniería/simulación (§7.4.4): requiere el modelo físico de la edificación; fuera de alcance de esta versión.'
const MOTIVO_COCIENTE_POBLACION =
  'Se requieren al menos 3 registros con población mayor que cero (§7.5.2); hay 0.'
const NOTA_CONFORT =
  'Indicador complementario (ASHRAE 55): su línea base es el consumo base medio del periodo, sin desglose mensual, y la §8.1 no define potencial de ahorro para él.'

/** `_num()` del motor: 4 decimales, mismo redondeo que el JSON del motor. */
function r4(valor: number): number {
  return Math.round(valor * 10000) / 10000
}

function hojaNoDisponible(clave: ModeloClave, motivo: string): ModeloLBEn {
  const { etiqueta, formula, unidad } = TEXTOS_MOTOR[clave]
  return {
    estado: 'no_disponible',
    motivo,
    etiqueta,
    formula,
    unidad,
    n: 0,
    lben_mensual: Array.from({ length: 12 }, () => null),
    validacion: {
      n: 0,
      min_datos_ic: 10,
      criterio: null,
      intervalo_inf: null,
      intervalo_sup: null,
      r2: null,
      mape: null,
      p_value_max: null,
    },
    ahorro: null,
    nota: null,
  }
}

function hojaDisponible(
  clave: ModeloClave,
  opciones: {
    n: number
    lben: (number | null)[]
    r2?: number | null
    mape?: number | null
    ahorro: AhorroModelo | null
    nota?: string | null
  }
): ModeloLBEn {
  const { etiqueta, formula, unidad } = TEXTOS_MOTOR[clave]
  return {
    estado: 'disponible',
    motivo: null,
    etiqueta,
    formula,
    unidad,
    n: opciones.n,
    lben_mensual: opciones.lben,
    validacion: {
      n: opciones.n,
      min_datos_ic: 10,
      criterio: 'banda_10_pct',
      intervalo_inf: null,
      intervalo_sup: null,
      r2: opciones.r2 ?? null,
      mape: opciones.mape ?? null,
      p_value_max: null,
    },
    ahorro: opciones.ahorro,
    nota: opciones.nota ?? null,
  }
}

/** §8.1 con lben = mejor (serie exactamente plana): potencial 0 en todo. */
function ahorroPlano(lbens: number[]): AhorroModelo {
  return {
    por_mes: lbens.map((lben, i) => ({
      mes: i + 1,
      lben,
      mejor: lben,
      potencial: 0,
      potencial_pct: 0,
    })),
    potencial_mensual: 0,
    potencial_pct: 0,
  }
}

/**
 * `modelos` de una serie plana con población flotante fija = 100
 * (cociente viable y sin variación → regresión sin variables). El motivo
 * de regresión distingue el gate de datos (34 < 36) del de variables.
 */
function modelosPlanos(
  periodos: PeriodoAnalizado[],
  motivoRegresion: string
): ModelosLBEn {
  const conservados = periodos.filter((p) => p.es_atipico !== true)
  const mediaDe = (mes: number): number => {
    const delMes = conservados.filter((p) => p.mes === mes).map((p) => p.consumo_kwh)
    return r4(delMes.reduce((suma, v) => suma + v, 0) / delMes.length)
  }
  const lbenMes = Array.from({ length: 12 }, (_, i) => mediaDe(i + 1))
  const base = r4(
    conservados.reduce((suma, p) => suma + p.consumo_kwh, 0) / conservados.length
  )
  return {
    valor_absoluto: hojaDisponible('valor_absoluto', {
      n: conservados.length,
      lben: lbenMes,
      r2: 1,
      mape: 0,
      ahorro: ahorroPlano(lbenMes),
    }),
    cociente: hojaDisponible('cociente', {
      n: conservados.length,
      lben: lbenMes.map((v) => r4(v / 100)),
      r2: 1,
      mape: 0,
      ahorro: ahorroPlano(lbenMes.map((v) => r4(v / 100))),
    }),
    regresion: hojaNoDisponible('regresion', motivoRegresion),
    ingenieria: hojaNoDisponible('ingenieria', MOTIVO_INGENIERIA),
    confort: hojaDisponible('confort', {
      n: conservados.length,
      lben: Array.from({ length: 12 }, () => base),
      ahorro: null,
      nota: NOTA_CONFORT,
    }),
  }
}

export const edificacionesAnalisisDemo = [
  { id: 'edi-demo-campus', nombre: 'Campus Robledo' },
  { id: 'edi-demo-sede', nombre: 'Sede Administrativa' },
  // Nuevas rutas del mock: ahorro §8.1 no nulo (golden Anexo 1) y un
  // motor antiguo sin la sección `modelos`.
  { id: 'edi-demo-variacion', nombre: 'Auditorio Mayor' },
  { id: 'edi-demo-sin-modelos', nombre: 'Biblioteca Central' },
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

const PERIODOS_DEMO = crearPeriodos()

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
    periodos: PERIODOS_DEMO,
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
    // 34 depurados → regresión en el gate de 36 meses (no llega a variables).
    modelos: modelosPlanos(PERIODOS_DEMO, MOTIVO_REGRESION_36),
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
const PERIODOS_SIN_ATIPICOS = analisisDemo.salida.periodos.map((p) => ({
  ...p,
  // Los dos períodos plantados vuelven a su valor esperado.
  consumo_kwh: p.es_atipico && p.media_mes !== null ? p.media_mes : p.consumo_kwh,
  es_atipico: false,
  direccion: null,
  explicacion: null,
  desviacion_pct: 0,
}))

const SALIDA_SIN_ATIPICOS: SalidaAnalisis = {
  ...SALIDA_DEMO,
    depurados: 36,
    periodos: PERIODOS_SIN_ATIPICOS,
    resumen: {
      ...SALIDA_DEMO.resumen,
      atipicos: 0,
      atipicos_alza: 0,
      atipicos_caida: 0,
      en_lectivo: 0,
      en_vacaciones: 0,
    },
    // 36 depurados → la regresión pasa el gate de datos y tropieza con el
    // de variables (población y GDE sin variación en esta serie).
    modelos: modelosPlanos(PERIODOS_SIN_ATIPICOS, MOTIVO_REGRESION_VARIABLES),
}

export const analisisSinAtipicosDemo: AnalisisResultado = {
  ...analisisDemo,
  salida: SALIDA_SIN_ATIPICOS,
  gestion: construirGestion(ENTRADAS_GESTION, SALIDA_SIN_ATIPICOS),
}

// ───────────────────── Variación (golden Anexo 1) y sin modelos demo ─────

/**
 * Los 36 valores de la tabla del Anexo 1: serie con variación real, así
 * que el potencial de ahorro §8.1 NO es cero (enero 830,33 kWh / 7,5 %;
 * «Promedio x Año» 467,61 kWh y 4,1 %). Golden espejo de
 * `test_valor_absoluto_golden_anexo_1` en python/tests/test_analisis.py.
 */
const TABLA_ANEXO_1: Record<number, [number, number, number]> = {
  1: [10204, 11264, 11635],
  2: [11112, 10886, 11158],
  3: [11318, 11496, 11810],
  4: [11242, 11883, 11306],
  5: [11277, 12486, 11839],
  6: [11715, 11009, 11870],
  7: [12219, 11719, 11891],
  8: [11146, 11637, 11784],
  9: [10300, 12028, 11765],
  10: [11348, 10383, 10783],
  11: [11434, 11435, 10639],
  12: [11374, 11662, 10927],
}

function mediaAnexo1(mes: number): number {
  const [a, b, c] = TABLA_ANEXO_1[mes]
  return (a + b + c) / 3
}

function mediaGlobalAnexo1(): number {
  const todos: number[] = []
  for (let mes = 1; mes <= 12; mes += 1) todos.push(...TABLA_ANEXO_1[mes])
  return todos.reduce((suma, v) => suma + v, 0) / todos.length
}

function periodosAnexo1(): PeriodoAnalizado[] {
  const periodos: PeriodoAnalizado[] = []
  for (const ano of ANIOS) {
    const indice = ANIOS.indexOf(ano)
    for (let mes = 1; mes <= 12; mes += 1) {
      const consumo = TABLA_ANEXO_1[mes][indice]
      const media = mediaAnexo1(mes)
      const dias = DIAS_LECTIVOS_POR_MES[mes]
      periodos.push({
        mes,
        ano,
        consumo_kwh: consumo,
        media_mes: r4(media),
        banda_inf: r4(media * 0.9),
        banda_sup: r4(media * 1.1),
        // Ningún valor se sale de ±10 % (0 descartados en el motor).
        es_atipico: false,
        direccion: null,
        desviacion_pct: r4(((consumo - media) / media) * 100),
        dias_lectivos: dias,
        calendario: dias > 12 ? 'lectivo' : 'vacaciones',
        explicacion: null,
      })
    }
  }
  return periodos
}

/** `modelos` del Anexo 1 (sin población → cociente y regresión caen). */
function modelosAnexo1(): ModelosLBEn {
  const lbenMes = Array.from({ length: 12 }, (_, i) => r4(mediaAnexo1(i + 1)))
  const filas = lbenMes.map((_, i) => {
    const mes = i + 1
    const media = mediaAnexo1(mes)
    const mejor = Math.min(...TABLA_ANEXO_1[mes])
    const potencial = Math.max(media - mejor, 0)
    return {
      mes,
      lben: r4(media),
      mejor,
      potencial: r4(potencial),
      potencial_pct: r4((potencial / media) * 100),
    }
  })
  // En el motor, `potencial_mensual` promedia las filas YA redondeadas.
  const potencialMensual = r4(
    filas.reduce((suma, f) => suma + f.potencial, 0) / filas.length
  )
  const lbenMedia = filas.reduce((suma, f) => suma + f.lben, 0) / filas.length
  return {
    valor_absoluto: hojaDisponible('valor_absoluto', {
      n: 36,
      lben: lbenMes,
      r2: 0.3782,
      mape: 2.92,
      ahorro: {
        por_mes: filas,
        potencial_mensual: potencialMensual,
        potencial_pct: r4((potencialMensual / lbenMedia) * 100),
      },
    }),
    cociente: hojaNoDisponible('cociente', MOTIVO_COCIENTE_POBLACION),
    regresion: hojaNoDisponible('regresion', MOTIVO_REGRESION_VARIABLES),
    ingenieria: hojaNoDisponible('ingenieria', MOTIVO_INGENIERIA),
    confort: hojaDisponible('confort', {
      n: 36,
      lben: Array.from({ length: 12 }, () => r4(mediaGlobalAnexo1())),
      ahorro: null,
      nota: NOTA_CONFORT,
    }),
  }
}

const PERIODOS_VARIACION = periodosAnexo1()

const SALIDA_VARIACION: SalidaAnalisis = {
  ok: true,
  originales: 36,
  depurados: 36,
  criterio_depuracion: 'banda_10_pct',
  min_datos_ic: 10,
  min_valores_por_mes: 3,
  umbra_dias_lectivos: 12,
  // Golden del motor para esta serie (salida real, redondeos incluidos).
  estadisticos: {
    n: 36,
    media: 11388.4444,
    mediana: 11404,
    desv_est: 514.4577,
    coef_variacion: 4.5174,
    minimo: 10204,
    maximo: 12486,
  },
  tendencia: {
    pendiente_kwh_por_mes: 7.6615,
    variacion_pct_anual: 0.8073,
  },
  bandas: Array.from({ length: 12 }, (_, i) => {
    const media = mediaAnexo1(i + 1)
    return {
      mes: i + 1,
      n: 3,
      media: r4(media),
      limite_inferior: r4(media * 0.9),
      limite_superior: r4(media * 1.1),
      descartados: 0,
      estimado: false,
    }
  }),
  meses_insuficientes: [],
  ajustes_aplicados: [],
  periodos: PERIODOS_VARIACION,
  resumen: {
    periodos: 36,
    atipicos: 0,
    atipicos_alza: 0,
    atipicos_caida: 0,
    en_lectivo: 0,
    en_vacaciones: 0,
    sin_calendario: 0,
    periodos_con_banda: 36,
    ajustes: 0,
  },
  modelos: modelosAnexo1(),
}

export const analisisVariacionDemo: AnalisisResultado = {
  nombreEdificacion: 'Auditorio Mayor',
  desde: '2023-01',
  hasta: '2025-12',
  calculadoEn: '2026-10-13T15:00:00.000Z',
  salida: SALIDA_VARIACION,
  gestion: construirGestion(ENTRADAS_GESTION, SALIDA_VARIACION),
}

/**
 * Salida de un motor desplegado SIN la sección `modelos` (versión
 * anterior): la vista degrada a un callout en vez de romper el contrato.
 */
export const analisisSinModelosDemo: AnalisisResultado = {
  ...analisisDemo,
  salida: { ...SALIDA_DEMO, modelos: null },
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
