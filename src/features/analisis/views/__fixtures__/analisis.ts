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

import type { AnalisisResultado, PeriodoAnalizado, SalidaAnalisis } from '../../models/analisis'

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

export const analisisDemo: AnalisisResultado = {
  nombreEdificacion: 'Campus Robledo',
  desde: '2023-01',
  hasta: '2025-12',
  calculadoEn: '2026-10-12T15:00:00.000Z',
  salida: {
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
  },
}

/** Misma serie sin atípicos: ejercita el estado «Sin períodos inusuales». */
export const analisisSinAtipicosDemo: AnalisisResultado = {
  ...analisisDemo,
  salida: {
    ...analisisDemo.salida,
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
      ...analisisDemo.salida.resumen,
      atipicos: 0,
      atipicos_alza: 0,
      atipicos_caida: 0,
      en_lectivo: 0,
      en_vacaciones: 0,
    },
  },
}
