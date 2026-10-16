/**
 * Calendario operativo por edificación y cálculo de la GDE
 * (Resolución UPME 0016/2024, §7.1/§7.3).
 *
 * - GDE = Σ(Tp − Tb)·Xd  sobre los días operativos del mes:
 *   - Tp: temperatura promedio durante el horario operativo [H, H + duración).
 *   - Tb: temperatura base de climatización (por tipo de edificación).
 *   - Xd = 1 en días operativos; 0 en días no operativos (implícito en la suma).
 * - El calendario NO está hardcodeado: los `RangoCalendarioInfo` son datos
 *   configurables por edificación (plantilla TdeA incluida, editable).
 * - La fuente de la serie horaria (Open-Meteo u otra) vive fuera de este
 *   módulo: aquí solo entra la serie ya descargada (`tempsHorarias`).
 */

import { z } from 'zod'

// ============================================================
// Catálogo de tipos de día
// ============================================================

export interface TipoDiaInfo {
  codigo: string
  etiqueta: string
  /** true → es un día operativo que aporta a la GDE. */
  operativo: boolean
}

export const CATALOGO_TIPOS_DIA: TipoDiaInfo[] = [
  { codigo: 'LECTIVO', etiqueta: 'Día lectivo / hábil (operativo)', operativo: true },
  { codigo: 'HABIL', etiqueta: 'Día hábil sin clases (operativo)', operativo: true },
  { codigo: 'VACACIONES', etiqueta: 'Vacaciones / receso (no operativo)', operativo: false },
  { codigo: 'FESTIVO', etiqueta: 'Festivo (no operativo)', operativo: false },
]

export const tipoDiaEsOperativo = (codigo: string): boolean =>
  CATALOGO_TIPOS_DIA.find((t) => t.codigo === codigo)?.operativo ?? false

// ============================================================
// Tipos
// ============================================================

/** Rango de fechas con tipo de día (fechas ISO `YYYY-MM-DD`, zona UTC). */
export interface RangoCalendarioInfo {
  id: string
  fechaInicio: string
  fechaFin: string
  tipoDia: string
  nombre?: string | null
}

/**
 * Campos que el cálculo necesita de un rango (sin `id`): permite consumir
 * tanto filas de BD como la plantilla (`TDEA_PLANTILLA.rangos`).
 */
export type RangoFechas = Pick<RangoCalendarioInfo, 'fechaInicio' | 'fechaFin' | 'tipoDia'>

/** Configuración operativa fija de la edificación. */
export interface ConfigCalendario {
  horaInicioOperacion: number // 0-23
  horasOperacionDia: number // 1-24
  temperaturaBase: number // °C
}

/** Temperatura horaria (24 valores, °C) de un día. */
export interface TempDia {
  fecha: string // YYYY-MM-DD
  horas: number[] // índice 0-23
}

export interface ResultadoGde {
  /** GDE del mes en °C·día, redondeada a 2 decimales. */
  gde: number
  /** Días operativos según el calendario. */
  diasOperativos: number
  /** Días operativos que tenían datos de temperatura. */
  diasConTemperatura: number
  /** Días operativos sin datos de temperatura (no aportan a la suma). */
  diasSinTemperatura: number
  /** Suma de los grados por encima de Tb (antes de la ausencia de datos). */
  sumaGrados: number
  /**
   * Desglose por día operativo (para mostrar la fórmula con los valores
   * sustituidos junto al resultado — requisito de interpretabilidad).
   * `tp` es null cuando el día no tenía datos climáticos.
   */
  detalle: { fecha: string; tp: number | null; grados: number }[]
}

// ============================================================
// Utilidades de fecha (UTC, sin sorpresas de zona horaria)
// ============================================================

const diasDelMes = (ano: number, mes: number): number =>
  new Date(Date.UTC(ano, mes, 0)).getUTCDate()

const iso = (ano: number, mes: number, dia: number): string =>
  new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10)

// ============================================================
// Núcleo de cálculo
// ============================================================

/** Diagnóstico estructural de un mes: prioriza el último rango que lo cubre. */
function operativoEnFecha(rangos: RangoFechas[], fechaIso: string): boolean | null {
  let visto = false
  let operativo = false
  for (const r of rangos) {
    if (r.fechaInicio <= fechaIso && fechaIso <= r.fechaFin) {
      visto = true
      operativo = tipoDiaEsOperativo(r.tipoDia)
    }
  }
  return visto ? operativo : null
}

/**
 * Cuenta los días operativos de (mes, ano) según los rangos del calendario.
 * Un día sin rango que lo cubra NO cuenta como operativo (fail-safe: mejor no
 * sumar grados que sumar de más).
 */
export function diasOperativosDelMes(
  rangos: RangoFechas[],
  mes: number,
  ano: number
): number {
  const total = diasDelMes(ano, mes)
  let cuenta = 0
  for (let d = 1; d <= total; d++) {
    if (operativoEnFecha(rangos, iso(ano, mes, d)) === true) cuenta++
  }
  return cuenta
}

/**
 * Calcula la GDE mensual: para cada día operativo con temperatura disponible,
 * promedia las horas del horario operativo [H, H + duración) y suma (Tp − Tb)
 * solo cuando Tp > Tb (grados de enfriamiento; nunca aporta grados negativos).
 */
export function calcularGde(params: {
  rangos: RangoFechas[]
  config: ConfigCalendario
  tempsHorarias: TempDia[]
  mes: number
  ano: number
}): ResultadoGde {
  const { rangos, config, tempsHorarias, mes, ano } = params
  const total = diasDelMes(ano, mes)
  const porFecha = new Map(tempsHorarias.map((t) => [t.fecha, t.horas]))

  const hInicio = Math.max(0, Math.min(23, Math.round(config.horaInicioOperacion)))
  const duracion = Math.max(1, Math.min(24 - hInicio, Math.round(config.horasOperacionDia)))

  let diasOperativos = 0
  let diasConTemperatura = 0
  let sumaGrados = 0
  const detalle: ResultadoGde['detalle'] = []

  for (let d = 1; d <= total; d++) {
    const fechaIso = iso(ano, mes, d)
    if (operativoEnFecha(rangos, fechaIso) !== true) continue
    diasOperativos++

    const horas = porFecha.get(fechaIso)
    let tp: number | null = null
    let grados = 0

    if (horas) {
      let sumaHoras = 0
      let conteoHoras = 0
      for (let h = hInicio; h < hInicio + duracion; h++) {
        const t = horas[h]
        if (Number.isFinite(t)) {
          sumaHoras += t
          conteoHoras++
        }
      }
      if (conteoHoras > 0) {
        diasConTemperatura++
        tp = redondear2(sumaHoras / conteoHoras)
        if (tp > config.temperaturaBase) {
          grados = redondear2(tp - config.temperaturaBase)
          sumaGrados += tp - config.temperaturaBase
        }
      }
    }

    detalle.push({ fecha: fechaIso, tp, grados })
  }

  return {
    gde: redondear2(sumaGrados),
    diasOperativos,
    diasConTemperatura,
    diasSinTemperatura: diasOperativos - diasConTemperatura,
    sumaGrados: redondear2(sumaGrados),
    detalle,
  }
}

const redondear2 = (n: number): number => Math.round(n * 100) / 100

// ============================================================
// Validaciones Zod (consumidas por los server actions)
// ============================================================

export const rangoCalendarioSchema = z
  .object({
    fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inicial inválida'),
    fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha final inválida'),
    tipoDia: z.string().refine(
      (c) => CATALOGO_TIPOS_DIA.some((t) => t.codigo === c),
      'Tipo de día inválido'
    ),
    nombre: z.string().trim().max(80).optional(),
  })
  .refine((v) => v.fechaInicio <= v.fechaFin, {
    message: 'La fecha inicial no puede ser posterior a la final',
    path: ['fechaFin'],
  })

export const configCalendarioSchema = z.object({
  horaInicioOperacion: z.number().int().min(0).max(23),
  horasOperacionDia: z.number().int().min(1).max(24),
  temperaturaBase: z.number().min(10).max(40),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
})

export const consultaGdeSchema = z.object({
  mes: z.number().int().min(1).max(12),
  ano: z.number().int().min(2020).max(2100),
})

// ============================================================
// Plantilla: calendario académico del TdeA (ejemplo editable)
// ============================================================

/**
 * Rangos extraídos de los calendarios oficiales del TdeA en `docs/`
 * (calendario-2026-1.pdf, calendario-2026-2.pdf, calendario-2027-1.pdf):
 *   Período académico 2026-1: 09/02/2026 – 13/06/2026
 *   Período académico 2026-2: 03/08/2026 – 28/11/2026
 *   Período académico 2027-1: 08/02/2027 – 12/06/2027
 * Los rangos de vacaciones son la continuación entre períodos y están sujetos a
 * verificación: es una PLANTILLA de datos iniciales, no lógica — se puede
 * editar por completo desde la UI.
 */
export const TDEA_PLANTILLA: {
  id: string
  nombre: string
  descripcion: string
  rangos: Omit<RangoCalendarioInfo, 'id'>[]
} = {
  id: 'tdea-2026-2027',
  nombre: 'Plantilla TdeA 2026-2027',
  descripcion:
    'Calendario académico del Tecnológico de Antioquia tomado de los PDF oficiales de docs/; fechas editables.',
  rangos: [
    { fechaInicio: '2025-12-01', fechaFin: '2026-02-08', tipoDia: 'VACACIONES', nombre: 'Vacaciones diciembre–enero' },
    { fechaInicio: '2026-02-09', fechaFin: '2026-06-13', tipoDia: 'LECTIVO', nombre: 'Período académico 2026-1' },
    { fechaInicio: '2026-06-14', fechaFin: '2026-08-02', tipoDia: 'VACACIONES', nombre: 'Vacaciones e intersemestral 2026-1' },
    { fechaInicio: '2026-08-03', fechaFin: '2026-11-28', tipoDia: 'LECTIVO', nombre: 'Período académico 2026-2' },
    { fechaInicio: '2026-11-29', fechaFin: '2027-02-07', tipoDia: 'VACACIONES', nombre: 'Vacaciones diciembre–enero' },
    { fechaInicio: '2027-02-08', fechaFin: '2027-06-12', tipoDia: 'LECTIVO', nombre: 'Período académico 2027-1' },
    { fechaInicio: '2027-06-13', fechaFin: '2027-08-01', tipoDia: 'VACACIONES', nombre: 'Vacaciones e intersemestral 2027-1' },
  ],
}
