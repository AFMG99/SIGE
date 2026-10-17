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
import { horasDeUsoEnFecha, type HorarioHorasUso } from './horarios'

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

/**
 * Apariencia del chip de tipo de día en el calendario (S9): etiqueta corta
 * (la del catálogo es larga, para los selects) y punto de color decorativo
 * por tipo. El texto de los chips es neutro; el color vive solo en el punto
 * (tokens de marca AA; nunca `emerald-500`, regla dura del repo).
 */
export interface ChipTipoDiaInfo {
  codigo: string
  etiqueta: string
  /** Clase del punto de color decorativo (`aria-hidden` en el render). */
  punto: string
}

export const CHIPS_TIPOS_DIA: ChipTipoDiaInfo[] = [
  { codigo: 'LECTIVO', etiqueta: 'Lectivo', punto: 'bg-uv-forest' },
  { codigo: 'HABIL', etiqueta: 'Hábil', punto: 'bg-uv-turquoise' },
  { codigo: 'VACACIONES', etiqueta: 'Vacaciones', punto: 'bg-uv-yellow' },
  { codigo: 'FESTIVO', etiqueta: 'Festivo', punto: 'bg-uv-deep' },
]

/** Chip de un tipo de día; `null` para un código fuera del catálogo. */
export const chipTipoDia = (codigo: string): ChipTipoDiaInfo | null =>
  CHIPS_TIPOS_DIA.find((c) => c.codigo === codigo) ?? null

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
   * `xe` (opcional, S4) son las horas de Xe usadas ese día.
   */
  detalle: { fecha: string; tp: number | null; grados: number; xe?: number }[]
  /**
   * S4: `true` cuando Xe salió de los horarios vigentes (mapa presente);
   * ausente/false = legado, Xe = H fijo. Opcional para no romper los mocks.
   */
  usarHorariosXe?: boolean
  /** S4: Σ Xe sobre los días operativos del mes (horas). Opcional. */
  xeTotalHoras?: number
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

/**
 * Tipo de día que cubre una fecha (S9 — superposición en el calendario): el
 * ÚLTIMO rango que la cubre gana, la MISMA regla que usa el cálculo de la GDE.
 * Sin cobertura: `null`. Función pura, sin I/O ni Prisma.
 */
export function tipoDiaEnFecha(rangos: RangoFechas[], fechaIso: string): string | null {
  let tipo: string | null = null
  for (const r of rangos) {
    if (r.fechaInicio <= fechaIso && fechaIso <= r.fechaFin) {
      tipo = r.tipoDia
    }
  }
  return tipo
}

/** Diagnóstico estructural de un mes: prioriza el último rango que lo cubre. */
function operativoEnFecha(rangos: RangoFechas[], fechaIso: string): boolean | null {
  const tipo = tipoDiaEnFecha(rangos, fechaIso)
  return tipo === null ? null : tipoDiaEsOperativo(tipo)
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

// ============================================================
// S4: fuente de Xe (H fijo vs. horarios vigentes)
// ============================================================

/**
 * Horario operativo efectivo `[hInicio, hInicio + duración)` de la config:
 * `hInicio` recortado a 0-23 y la duración a 1-(24 − hInicio) horas.
 */
function ventanaOperativa(
  config: Pick<ConfigCalendario, 'horaInicioOperacion' | 'horasOperacionDia'>
): [number, number] {
  const hInicio = Math.max(0, Math.min(23, Math.round(config.horaInicioOperacion)))
  const duracion = Math.max(1, Math.min(24 - hInicio, Math.round(config.horasOperacionDia)))
  return [hInicio, duracion]
}

/**
 * S4: mapa `fecha → Xe (horas)` de los DÍAS OPERATIVOS de (mes, ano).
 *
 * Con `usarHorariosXe` Xe sale de `horasDeUsoEnFecha` (horarios vigentes ese
 * día, ya recortada a 0-24); apagado Xe = H (duracion), que reproduce bit a
 * bit el cálculo legado al dividirse por la misma duración en `calcularGde`.
 * Compartido por el controller (mapa → `calcularGde`) y por la UI (valor de
 * Xe previo al clic) para que ambos muestren exactamente lo mismo.
 */
export function mapaXeDelMes(params: {
  rangos: RangoFechas[]
  config: Pick<ConfigCalendario, 'horaInicioOperacion' | 'horasOperacionDia'>
  horarios: HorarioHorasUso[]
  usarHorariosXe: boolean
  mes: number
  ano: number
}): Map<string, number> {
  const { rangos, config, horarios, usarHorariosXe, mes, ano } = params
  const [, duracion] = ventanaOperativa(config)
  const mapa = new Map<string, number>()
  const total = diasDelMes(ano, mes)
  for (let d = 1; d <= total; d++) {
    const fechaIso = iso(ano, mes, d)
    if (operativoEnFecha(rangos, fechaIso) !== true) continue
    mapa.set(fechaIso, usarHorariosXe ? horasDeUsoEnFecha(horarios, fechaIso) : duracion)
  }
  return mapa
}

/**
 * «Horas de uso por día» y «Días de uso por mes» derivados del calendario
 * (6d4/S5): la media de Xe sobre los días operativos del mes y el recuento de
 * esos días. Es la MISMA fuente que la GDE (`mapaXeDelMes`), de modo que el
 * valor sugerido y el cálculo regulatorio nunca divergen. Devuelve `null`
 * cuando el mes no tiene ningún día operativo (sin rangos, o todo el mes no
 * operativo): el formulario debe conservar entonces el valor manual.
 */
export function usoEquiposDelMes(params: {
  rangos: RangoFechas[]
  config: Pick<ConfigCalendario, 'horaInicioOperacion' | 'horasOperacionDia'>
  horarios: HorarioHorasUso[]
  usarHorariosXe: boolean
  mes: number
  ano: number
}): { horasUsoDia: number; diasUsoMes: number } | null {
  const mapa = mapaXeDelMes(params)
  if (mapa.size === 0) return null
  let total = 0
  mapa.forEach((v) => {
    total += v
  })
  // Entero positivo (la validación del importador lo exige); unión de franjas
  // muy cortas redondea a 1 h mínima en lugar de a 0.
  return { horasUsoDia: Math.max(1, Math.round(total / mapa.size)), diasUsoMes: mapa.size }
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
  /**
   * S4 (opt-in): horas de uso por día (`YYYY-MM-DD` → 0-24), calculadas con
   * `horasDeUsoEnFecha` sobre los horarios vigentes. `null`/ausente = flag
   * apagado: Xe = H (duracion), que reproduce bit a bit el legado.
   */
  horasUsoPorFecha?: ReadonlyMap<string, number> | null
}): ResultadoGde {
  const { rangos, config, tempsHorarias, mes, ano, horasUsoPorFecha } = params
  const total = diasDelMes(ano, mes)
  const porFecha = new Map(tempsHorarias.map((t) => [t.fecha, t.horas]))

  const [hInicio, duracion] = ventanaOperativa(config)

  let diasOperativos = 0
  let diasConTemperatura = 0
  let sumaGrados = 0
  let xeTotalHoras = 0
  const detalle: ResultadoGde['detalle'] = []

  for (let d = 1; d <= total; d++) {
    const fechaIso = iso(ano, mes, d)
    if (operativoEnFecha(rangos, fechaIso) !== true) continue
    diasOperativos++

    // Xe del día: con el flag encendido salen los horarios vigentes (recorte
    // defensivo a [0, 24]; el día ausente del mapa aporta 0). Con el flag
    // apagado Xe = H → peso 1 → (Tp − Tb) · 1 idéntico al cálculo legado.
    const xe = horasUsoPorFecha
      ? Math.max(0, Math.min(24, horasUsoPorFecha.get(fechaIso) ?? 0))
      : duracion
    xeTotalHoras += xe
    const peso = xe / duracion

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
          const gradosBrutos = tp - config.temperaturaBase
          grados = redondear2(gradosBrutos * peso)
          sumaGrados += gradosBrutos * peso
        }
      }
    }

    detalle.push({ fecha: fechaIso, tp, grados, xe })
  }

  return {
    gde: redondear2(sumaGrados),
    diasOperativos,
    diasConTemperatura,
    diasSinTemperatura: diasOperativos - diasConTemperatura,
    sumaGrados: redondear2(sumaGrados),
    detalle,
    usarHorariosXe: horasUsoPorFecha != null,
    xeTotalHoras,
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
  // Nombre visible de la ubicación elegida por ciudad/zona (S1 — geocoding
  // Open-Meteo): «Ciudad, Departamento». Vacío/nulo = solo coordenadas
  // (edificaciones preexistentes con lat/lon manuales).
  ubicacionNombre: z
    .string()
    .trim()
    .max(160, 'El nombre de la ubicación no puede superar los 160 caracteres')
    .nullish()
    .transform((v) => (v && v.trim() ? v : null)),
  // Opt-in S4 (Fase 6): usar las horas de uso derivadas de los horarios
  // vigentes como Xe en el cálculo nuevo de la GDE. Apagado por defecto;
  // los resultados históricos jamás se recalculan.
  usarHorariosXe: z.boolean().default(false),
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

// ============================================================
// Ubicación por ciudad/zona (S1): contrato y mapeo puro
// ============================================================
//
// Vive en `models/` (no en `controllers/clima.ts`) porque `'use server'`
// exige que TODOS los exports de ese módulo sean funciones async: la clase de
// error y el mapeador puro del geocoding no lo son. Aquí son valores normales,
// compartidos por la server action, el controlador del calendario y los tests.

/** Error amigable de la fuente climática/geocoding (Open-Meteo). */
export class ClimaFuenteError extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ClimaFuenteError'
  }
}

/** Resultado de búsqueda de ubicación listo para la UI (nombres en `es`). */
export interface UbicacionEncontrada {
  nombre: string
  admin1: string | null
  pais: string | null
  lat: number
  lon: number
  timezone: string | null
}

export type ResultadoBusquedaUbicacion =
  | { estado: 'ok'; ubicaciones: UbicacionEncontrada[] }
  | { estado: 'error'; mensaje: string }

/** Tope de resultados mostrados (el endpoint ya se limita a `count=8`). */
export const LIMITE_UBICACIONES = 8

/**
 * Mapea el payload del geocoding de Open-Meteo a un listado limpio y puro
 * (sin red ni Prisma): filtra entradas sin nombre o con coordenadas ausentes,
 * no numéricas o fuera de rango, y limita el listado a 8. Ante cualquier
 * payload irreconocible devuelve `[]` (la action traduce eso a «sin
 * coincidencias»).
 */
export function mapearUbicaciones(json: unknown): UbicacionEncontrada[] {
  const resultados = (json as { results?: unknown } | null | undefined)?.results
  if (!Array.isArray(resultados)) return []

  const ubicaciones: UbicacionEncontrada[] = []
  for (const crudo of resultados) {
    if (ubicaciones.length >= LIMITE_UBICACIONES) break
    if (!crudo || typeof crudo !== 'object') continue

    const r = crudo as Record<string, unknown>
    const nombre = typeof r.name === 'string' ? r.name.trim() : ''
    const lat = r.latitude
    const lon = r.longitude
    if (!nombre) continue
    if (typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90) continue
    if (typeof lon !== 'number' || !Number.isFinite(lon) || Math.abs(lon) > 180) continue

    ubicaciones.push({
      nombre,
      admin1: typeof r.admin1 === 'string' && r.admin1.trim() ? r.admin1.trim() : null,
      pais: typeof r.country === 'string' && r.country.trim() ? r.country.trim() : null,
      lat,
      lon,
      timezone: typeof r.timezone === 'string' && r.timezone ? r.timezone : null,
    })
  }
  return ubicaciones
}
