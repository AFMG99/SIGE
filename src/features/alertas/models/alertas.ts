/**
 * Módulo 4 — Alertas de consumo inusual por umbral (HU-08).
 *
 * Contrato PURO de evaluación: consume la salida del motor de análisis y decide
 * qué períodos disparan alerta. No reimplementa estadística — la banda de
 * confianza y su reclasificación viven en `features/analisis/models/analisis.ts`
 * (fuente única de verdad, la misma que reporta el módulo de Análisis).
 *
 * Reglas del contrato (decisiones de HU-08):
 *  R1. Mes sin banda construible (`banda.estimado`) ⇒ NO evaluable ⇒ sin alerta.
 *      `null` no es «no inusual», es «no se puede saber»: se cuenta aparte.
 *  R2. Solo `alza` (consumo > banda superior). HU-08 dice «supere el umbral»;
 *      la columna `direccion` queda lista para extender la regla.
 *  R3. Umbral normativo (±10 % ec. 3 / ±2·DesvEst ec. 4-5) ⇒ se usa la
 *      clasificación del motor tal cual. Umbral personalizado ⇒ se reclasifica
 *      con `simularUmbral` (el mismo simulador exploratorio del módulo de
 *      Análisis), filtrando los meses sin banda.
 *  R4. Severidad = exceso normalizado al semiancho de la banda (invariante a la
 *      escala del consumo; con el umbral normativo equivale a «σ sobre límite»).
 */

import { z } from 'zod'
import {
  UMBRAL_K_DEFECTO,
  UMBRAL_K_MAX,
  UMBRAL_K_MIN,
  UMBRAL_PCT_DEFECTO,
  UMBRAL_PCT_MAX,
  UMBRAL_PCT_MIN,
  simularUmbral,
  type ConfigUmbral,
  type SalidaAnalisis,
} from '@/features/analisis/models/analisis'

// ============================================================
// Catálogos y etiquetas
// ============================================================

export const ESTADOS_ALERTA = ['nueva', 'leida', 'descartada'] as const
export type EstadoAlerta = (typeof ESTADOS_ALERTA)[number]

export const SEVERIDADES_ALERTA = ['alta', 'media', 'baja'] as const
export type SeveridadAlerta = (typeof SEVERIDADES_ALERTA)[number]

export const DIRECCIONES_ALERTA = ['alza', 'caida'] as const
export type DireccionAlerta = (typeof DIRECCIONES_ALERTA)[number]

export const ESTADO_ALERTA_LABEL: Record<EstadoAlerta, string> = {
  nueva: 'Nueva',
  leida: 'Leída',
  descartada: 'Descartada',
}

export const SEVERIDAD_ALERTA_LABEL: Record<SeveridadAlerta, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

/** Base compartida por los badges del módulo (misma forma que el análisis). */
export const CLASE_BADGE =
  'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium'

export const SEVERIDAD_BADGE: Record<SeveridadAlerta, string> = {
  alta: 'border-rose-600/40 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300',
  media:
    'border-amber-600/40 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
  baja: 'border-sky-600/40 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300',
}

export const ESTADO_BADGE: Record<EstadoAlerta, string> = {
  nueva:
    'border-amber-600/40 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
  leida: 'border-sky-600/40 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300',
  descartada:
    'border-gray-300 bg-gray-100 text-gray-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

// Las columnas `estado`, `severidad` y `direccion` son String en la BD (el
// schema no usa enums de Prisma). Estas guardas estrechan el valor crudo a la
// unión del dominio al leer filas, sin confiar en un cast ciego.
export function esEstadoAlerta(valor: string): valor is EstadoAlerta {
  return (ESTADOS_ALERTA as readonly string[]).includes(valor)
}

export function esSeveridadAlerta(valor: string): valor is SeveridadAlerta {
  return (SEVERIDADES_ALERTA as readonly string[]).includes(valor)
}

export function esDireccionAlerta(valor: string): valor is DireccionAlerta {
  return (DIRECCIONES_ALERTA as readonly string[]).includes(valor)
}

// ============================================================
// Configuración del umbral (espejo del dominio del análisis)
// ============================================================

export interface ConfigAlerta {
  pct: number
  k: number
  /** false = no se generan alertas nuevas; NO borra las existentes. */
  activo: boolean
}

export const CONFIG_ALERTA_POR_DEFECTO: ConfigAlerta = {
  pct: UMBRAL_PCT_DEFECTO,
  k: UMBRAL_K_DEFECTO,
  activo: true,
}

// ============================================================
// Esquemas de entrada (re-validados siempre en servidor)
// ============================================================

export const generarAlertasSchema = z.object({
  edificacionId: z.string().trim().min(1, 'Debe indicar la edificación a evaluar.'),
})

export const cambiarEstadoAlertaSchema = z.object({
  id: z.string().trim().min(1, 'Alerta inválida.'),
  estado: z.enum(ESTADOS_ALERTA),
  nota: z
    .string()
    .trim()
    .max(300, 'La nota no puede superar los 300 caracteres.')
    .optional(),
})

export const guardarConfigAlertaSchema = z.object({
  edificacionId: z.string().trim().min(1, 'Debe indicar la edificación.'),
  pct: z
    .number()
    .int()
    .min(UMBRAL_PCT_MIN)
    .max(UMBRAL_PCT_MAX),
  k: z.number().min(UMBRAL_K_MIN).max(UMBRAL_K_MAX),
  activo: z.boolean(),
})

export type CambiarEstadoAlerta = z.infer<typeof cambiarEstadoAlertaSchema>
export type GuardarConfigAlerta = z.infer<typeof guardarConfigAlertaSchema>

// ============================================================
// Helpers puros
// ============================================================

/** (2024, 3) → '2024-03' — misma clave que `FacturaEnergia.periodo`. */
export function clavePeriodo(ano: number, mes: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`
}

/** ¿El umbral configurado es el normativo de la Resolución UPME 0016? */
export function esConfigNormativa(config: ConfigUmbral): boolean {
  return config.pct === UMBRAL_PCT_DEFECTO && config.k === UMBRAL_K_DEFECTO
}

/**
 * Severidad por exceso normalizado al semiancho de la banda:
 *   exceso = (consumo − bandaSup) / ((bandaSup − bandaInf) / 2)
 *   ≥ 1 → alta · ≥ 0.5 → media · > 0 → baja
 * Una banda degenerada (semiancho 0, p. ej. desviación típica nula) se trata
 * como exceso máximo: cualquier lectura por encima del límite es «alta».
 */
export function calcularSeveridad(
  consumoKwh: number,
  bandaInf: number,
  bandaSup: number
): SeveridadAlerta {
  const semiancho = (bandaSup - bandaInf) / 2
  if (!(semiancho > 0)) return 'alta'
  const exceso = (consumoKwh - bandaSup) / semiancho
  if (exceso >= 1) return 'alta'
  if (exceso >= 0.5) return 'media'
  return 'baja'
}

// ============================================================
// Contrato de evaluación
// ============================================================

export interface AlertaEvaluada {
  /** 'YYYY-MM' */
  periodo: string
  mes: number
  ano: number
  consumoKwh: number
  bandaInf: number
  bandaSup: number
  desviacionPct: number
  direccion: DireccionAlerta
  severidad: SeveridadAlerta
}

export interface ResultadoEvaluacionAlertas {
  alertas: AlertaEvaluada[]
  /** Meses del calendario sin banda construible: no evaluables (R1). */
  mesesNoEvaluables: number[]
  /** Períodos que SÍ tenían banda y por tanto se compararon con el umbral. */
  periodosEvaluables: number
  /** Snapshot del umbral aplicado a esta evaluación. */
  config: ConfigUmbral
}

/**
 * Evalúa el histórico contra el umbral y devuelve las alertas vigentes.
 *
 * `simularUmbral` SÍ proyecta sobre meses estimados (es exploratorio por
 * diseño), así que el filtro R1 es responsabilidad de este contrato: sin él,
 * una alerta podría dispararse sobre un mes sin base estadística.
 */
export function evaluarAlertas(
  salida: SalidaAnalisis,
  config: ConfigUmbral
): ResultadoEvaluacionAlertas {
  const sim = esConfigNormativa(config) ? null : simularUmbral(salida, config)

  const mesesConBanda = new Set(
    salida.bandas.filter((banda) => !banda.estimado).map((banda) => banda.mes)
  )

  const alertas: AlertaEvaluada[] = []
  let periodosEvaluables = 0

  for (const periodo of salida.periodos) {
    let bandaInf: number | null
    let bandaSup: number | null
    if (sim) {
      const banda = sim.bandasSim[periodo.mes - 1]
      bandaInf = banda?.inf ?? null
      bandaSup = banda?.sup ?? null
    } else {
      bandaInf = periodo.banda_inf
      bandaSup = periodo.banda_sup
    }

    // R1: sin banda (o mes marcado como estimado) no hay nada que evaluar.
    if (bandaInf === null || bandaSup === null) continue
    if (!mesesConBanda.has(periodo.mes)) continue

    periodosEvaluables += 1

    // R2: v1 solo alerta de alza.
    if (!(periodo.consumo_kwh > bandaSup)) continue

    alertas.push({
      periodo: clavePeriodo(periodo.ano, periodo.mes),
      mes: periodo.mes,
      ano: periodo.ano,
      consumoKwh: periodo.consumo_kwh,
      bandaInf,
      bandaSup,
      // No nulo cuando hay banda: invariante del motor.
      desviacionPct: periodo.desviacion_pct ?? 0,
      direccion: 'alza',
      severidad: calcularSeveridad(periodo.consumo_kwh, bandaInf, bandaSup),
    })
  }

  alertas.sort((a, b) => (a.periodo < b.periodo ? -1 : a.periodo > b.periodo ? 1 : 0))

  return {
    alertas,
    mesesNoEvaluables: [...salida.meses_insuficientes],
    periodosEvaluables,
    config: { pct: config.pct, k: config.k },
  }
}

// ============================================================
// Firma de la evaluación (invalidación de la caché)
// ============================================================

export interface EntradasFirmaEvaluacion {
  edificacionId: string
  config: ConfigAlerta
  facturas: { total: number; ultimaActualizacion: string | null; consumoTotal: number }
  variables: { total: number; ultimaCreacion: string | null }
  ajustes: { total: number; valorTotal: number }
  /** Versión del contrato del motor Python (VERSION_MOTOR_ANALISIS). */
  versionMotor: number
}

/** Evita que el ruido de coma flotante de un `sum()` invalide la firma. */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

/**
 * Huella determinista de las ENTRADAS de una evaluación (no de su resultado).
 * Cadena canónica en vez de un hash: es igual de determinista para comparar y
 * además es legible al depurar por qué una bandeja quedó desactualizada.
 */
export function firmaDeEntradas(entradas: EntradasFirmaEvaluacion): string {
  const { facturas, variables, ajustes, config } = entradas
  return [
    `edi=${entradas.edificacionId}`,
    `cfg=${config.pct}/${config.k}/${config.activo ? 1 : 0}`,
    `fac=${facturas.total}/${facturas.ultimaActualizacion ?? '-'}/${redondear(facturas.consumoTotal)}`,
    `var=${variables.total}/${variables.ultimaCreacion ?? '-'}`,
    `aju=${ajustes.total}/${redondear(ajustes.valorTotal)}`,
    `mot=${entradas.versionMotor}`,
  ].join('|')
}

// ============================================================
// Proyecciones hacia la UI
// ============================================================

/** Fila de alerta tal como viaja del servidor a la vista (serializable). */
export interface AlertaVista {
  id: string
  edificacionId: string
  edificacionNombre: string
  periodo: string
  mes: number
  ano: number
  consumoKwh: number
  bandaInf: number
  bandaSup: number
  desviacionPct: number
  direccion: DireccionAlerta
  severidad: SeveridadAlerta
  umbralPct: number
  umbralK: number
  estado: EstadoAlerta
  nota: string | null
  actualizadoAt: string
}

/** Estado de la última evaluación de una edificación (serializable). */
export interface EvaluacionVista {
  firma: string
  periodosEvaluables: number
  noEvaluables: number
  evaluadoEn: string | null
  /** true = nunca evaluada o los datos cambiaron desde entonces. */
  desactualizada: boolean
}

export interface ResumenAlertas {
  total: number
  nuevas: number
  leidas: number
  descartadas: number
  altas: number
}

export function resumirAlertas(alertas: readonly AlertaVista[]): ResumenAlertas {
  const resumen: ResumenAlertas = {
    total: alertas.length,
    nuevas: 0,
    leidas: 0,
    descartadas: 0,
    altas: 0,
  }
  for (const alerta of alertas) {
    if (alerta.estado === 'nueva') resumen.nuevas += 1
    else if (alerta.estado === 'leida') resumen.leidas += 1
    else resumen.descartadas += 1
    if (alerta.severidad === 'alta') resumen.altas += 1
  }
  return resumen
}
