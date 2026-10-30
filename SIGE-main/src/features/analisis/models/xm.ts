/**
 * Modelo del benchmark de la API XM (servapibi.xm.com.co).
 *
 * Contiene los espejos Zod de las respuestas de XM, el contrato de las
 * server actions del benchmark, las constantes de catálogo (metadatos
 * oficiales citables) y los helpers puros de agregación, índice base 100
 * y variación interanual — probados en `xm.test.ts` sin red.
 *
 * Alcance verificado en vivo (13/10/2026):
 *  - `DemaSIN` (Sistema) publica por ventana diaria; `DemaComeNoReg`
 *    (Sistema) por ventana horaria; ambos aceptan meses completos (≤31 d).
 *  - El cruce `DemaComeNoReg/CIIU` ignora el filtro y un mes pesa 6,8 MB
 *    (12 s), por lo que los pares por sector NO son viables: el benchmark
 *    usa las series nacionales del SIN y lo declara en la UI.
 */

import { z } from 'zod'

// ───────────────────────────────────────────────────────────── constants

/** 13 meses completos: 12 para el índice + el antepenúltimo que habilita
 * la variación interanual del mes más reciente (mismo mes, 12 meses atrás). */
export const MESES_BENCHMARK = 13

/** Ventana de los 24 meses que alimenta la comparación interna SIGE
 * (12 recientes vs 12 previos, promedio mensual por edificación). */
export const MESES_COMPARACION_INTERNA = 24

export const TTL_CACHE_XM_MS = 6 * 60 * 60 * 1000 // 6 h

export const TIMEOUT_XM_MS = 6000 // por request; XM responde ~1–3 s

export const CONCURRENCIA_XM = 7 // máximo de POST simultáneos hacia XM

export const URLS_XM = {
  documentacion: 'https://github.com/EquipoAnaliticaXM/API_XM',
  portal: 'https://www.xm.com.co',
} as const

export type MetaSerieXm = {
  clave: 'sistema' | 'mercado'
  nombre: string
  metricId: string
  cruce: string
  endpoint: 'daily' | 'hourly'
}

export const SERIE_SISTEMA: MetaSerieXm = {
  clave: 'sistema',
  nombre: 'Demanda del SIN (sistema interconectado)',
  metricId: 'DemaSIN',
  cruce: 'Sistema',
  endpoint: 'daily',
}

export const SERIE_MERCADO: MetaSerieXm = {
  clave: 'mercado',
  nombre: 'Demanda comercial — mercado no regulado',
  metricId: 'DemaComeNoReg',
  cruce: 'Sistema',
  endpoint: 'hourly',
}

// ──────────────────────────────────────────────────────────────── types

export type PuntoSerieXm = {
  /** 'YYYY-MM' */
  periodo: string
  kwh: number
  /** Mes base = 100 en el primer punto con datos. */
  indice: number
}

export type SerieXm = {
  clave: 'sistema' | 'mercado'
  nombre: string
  puntos: PuntoSerieXm[]
  /** % (último mes vs mismo mes 12 meses atrás); null si falta la base. */
  variacionInteranual: number | null
}

export type RespuestaSerieXm =
  | { estado: 'ok'; serie: SerieXm; advertencias: string[] }
  | { estado: 'error'; mensaje: string }

export type FilaComparacionInterna = {
  edificacionId: string
  nombre: string
  mesesConDatos: number
  /** % de variación del promedio mensual: últimos 12 vs 12 previos. */
  variacionPct: number | null
  promedioKwh: number | null
}

export type ComparacionInterna = {
  ventanaReciente: string // '2025-10 → 2026-09'
  ventanaPrevia: string // '2024-10 → 2025-09'
  filas: FilaComparacionInterna[]
}

export type CatalogoMetricaXm = {
  metricId: string
  nombre: string
  descripcion: string
  unidades: string
  cruce: string
  endpoint: string
  maxDias: number
}

export type ContextoXm = {
  /** ISO de la última consulta efectiva (base del cache). */
  fechaConsulta: string
  comparacionInterna: ComparacionInterna
  catalogo: CatalogoMetricaXm[]
}

export type RespuestaContextoXm =
  | { estado: 'ok'; contexto: ContextoXm }
  | { estado: 'error'; mensaje: string }

// ─────────────────────────────────────────────────────── Zod mirrors

const registroDiarioSchema = z.object({
  Date: z.string(),
  DailyEntities: z
    .array(
      z.object({
        Id: z.string(),
        Value: z.union([z.string(), z.number()]),
      })
    )
    .default([]),
})

const registroHorarioSchema = z.object({
  Date: z.string(),
  HourlyEntities: z
    .array(
      z.object({
        Id: z.string(),
        Values: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
      })
    )
    .default([]),
})

const metricaSchema = z.object({
  Id: z.string(),
  Name: z.string(),
})

export const respuestaDiariaXmSchema = z.object({
  Metric: metricaSchema,
  Items: z.array(registroDiarioSchema),
})

export const respuestaHorariaXmSchema = z.object({
  Metric: metricaSchema,
  Items: z.array(registroHorarioSchema),
})

export type RegistroDiarioXm = z.infer<typeof registroDiarioSchema>
export type RegistroHorarioXm = z.infer<typeof registroHorarioSchema>

// ───────────────────────────────────────────────────── catálogo oficial

/**
 * Catálogo citable de las métricas consultadas. Los textos son los que
 * devuelve la propia API XM en `ListadoMetricas` (la descripción de
 * `DemaSIN` llega truncada a 200 caracteres desde la fuente).
 */
export const CATALOGO_XM: CatalogoMetricaXm[] = [
  {
    metricId: 'DemaSIN',
    nombre: 'Demanda Energia SIN por Sistema',
    descripcion:
      'Demanda del SIN, la cual se calcula con base en la generacion neta de las plantas e incluye: hidraulicas, termicas, plantas menores, cogeneradores , solares, eolicas, demanda no atendida, limitacion d…',
    unidades: 'kWh',
    cruce: 'Sistema',
    endpoint: 'https://servapibi.xm.com.co/daily',
    maxDias: 31,
  },
  {
    metricId: 'DemaComeNoReg',
    nombre: 'Demanda Comercial Mercado No Regulado por Sistema',
    descripcion:
      'Considera la demanda propia de cada comercializador mas la paticipacion en la perdidas del STN y los consumos propios de los generadores.',
    unidades: 'kWh',
    cruce: 'Sistema',
    endpoint: 'https://servapibi.xm.com.co/hourly',
    maxDias: 31,
  },
]

// ──────────────────────────────────────────────────────────── helpers

/** Últimos `cantidad` meses completos, del más antiguo al más reciente. */
export function mesesCompletosRecientes(
  cantidad: number,
  ref: Date = new Date()
): string[] {
  const salida: string[] = []
  let anio = ref.getFullYear()
  let mes = ref.getMonth() + 1 // mes actual, aún incompleto → se excluye
  for (let i = 0; i < cantidad; i += 1) {
    mes -= 1
    if (mes === 0) {
      mes = 12
      anio -= 1
    }
    salida.push(`${anio}-${String(mes).padStart(2, '0')}`)
  }
  return salida.reverse()
}

/** Ventana de consulta de un mes calendario completo ('YYYY-MM-01'..último día). */
export function ventanaDelMes(periodo: string): { inicio: string; fin: string } {
  const [anio, mes] = periodo.split('-').map(Number)
  const ultimoDia = new Date(anio, mes, 0).getDate()
  return {
    inicio: `${periodo}-01`,
    fin: `${periodo}-${String(ultimoDia).padStart(2, '0')}`,
  }
}

/** Resta meses a un período 'YYYY-MM' (soporta cruce de año). */
export function restarMeses(periodo: string, cantidad: number): string {
  const [anio, mes] = periodo.split('-').map(Number)
  const total = anio * 12 + (mes - 1) - cantidad
  const nuevoAnio = Math.floor(total / 12)
  const nuevoMes = ((total % 12) + 12) % 12 + 1
  return `${nuevoAnio}-${String(nuevoMes).padStart(2, '0')}`
}

function aNumero(valor: unknown): number {
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(n) ? n : Number.NaN
}

/** Suma la demanda diaria por mes calendario ('YYYY-MM' → kWh). */
export function agregarDiarioMensual(
  items: RegistroDiarioXm[]
): Map<string, number> {
  const porMes = new Map<string, number>()
  for (const item of items) {
    const mes = item.Date.slice(0, 7)
    for (const entidad of item.DailyEntities) {
      const kwh = aNumero(entidad.Value)
      if (!Number.isFinite(kwh)) continue
      porMes.set(mes, (porMes.get(mes) ?? 0) + kwh)
    }
  }
  return porMes
}

/** Agrega Hour01..Hour24 a kWh diarios y luego por mes calendario. */
export function agregarHorarioMensual(
  items: RegistroHorarioXm[]
): Map<string, number> {
  const porMes = new Map<string, number>()
  for (const item of items) {
    const mes = item.Date.slice(0, 7)
    let totalDia = 0
    for (const entidad of item.HourlyEntities) {
      for (let hora = 1; hora <= 24; hora += 1) {
        const clave = `Hour${String(hora).padStart(2, '0')}`
        const kwh = aNumero(entidad.Values[clave])
        if (Number.isFinite(kwh)) totalDia += kwh
      }
    }
    if (totalDia > 0) porMes.set(mes, (porMes.get(mes) ?? 0) + totalDia)
  }
  return porMes
}

/**
 * Convierte agregados mensuales en la serie del benchmark: puntos con
 * índice base 100 y variación interanual del último mes.
 */
export function construirSerie(
  clave: SerieXm['clave'],
  nombre: string,
  periodos: string[],
  porMes: Map<string, number>
): { serie: SerieXm; sinDatos: string[] } {
  const sinDatos = periodos.filter((p) => !porMes.has(p))
  const conDatos = periodos.filter((p) => porMes.has(p))
  const base = conDatos.length > 0 ? porMes.get(conDatos[0]) ?? 1 : 1

  const puntos: PuntoSerieXm[] = conDatos.map((p) => {
    const kwh = porMes.get(p) ?? 0
    return { periodo: p, kwh, indice: (kwh / base) * 100 }
  })

  let variacionInteranual: number | null = null
  const ultimo = puntos[puntos.length - 1]
  if (ultimo) {
    const previo = puntos.find((p) => p.periodo === restarMeses(ultimo.periodo, 12))
    if (previo && previo.kwh > 0) {
      variacionInteranual = (ultimo.kwh / previo.kwh - 1) * 100
    }
  }

  return { serie: { clave, nombre, puntos, variacionInteranual }, sinDatos }
}

/** Ejecuta las tareas con un tope de concurrencia; conserva el orden. */
export async function conLimite<T>(
  tareas: (() => Promise<T>)[],
  limite: number
): Promise<T[]> {
  const resultados = new Array<T>(tareas.length)
  let cursor = 0
  const obreros = Array.from(
    { length: Math.max(1, Math.min(limite, tareas.length)) },
    async () => {
      while (cursor < tareas.length) {
        const posicion = cursor
        cursor += 1
        resultados[posicion] = await tareas[posicion]()
      }
    }
  )
  await Promise.all(obreros)
  return resultados
}

/** Traza un sparkline en coordenadas SVG del índice (1..ancho, 1..alto). */
export function trazarSparkline(
  puntos: { indice: number }[],
  ancho = 132,
  alto = 40
): string {
  if (puntos.length < 2) return ''
  const valores = puntos.map((p) => p.indice)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min || 1
  return puntos
    .map((p, i) => {
      const x = 1 + (i / (puntos.length - 1)) * (ancho - 2)
      const y = alto - 1 - ((p.indice - min) / rango) * (alto - 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
