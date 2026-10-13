// Modelos del Módulo 3 — Análisis estadístico y detección de patrones
// (HU-07 escenario 2, HU-04 escenario 2).
//
// Espejo del contrato JSON de `python/lben/analisis.py`: la salida del
// motor SIEMPRE se valida con `salidaAnalisisSchema` en el servidor antes
// de llegar a la UI. La detección reutiliza la depuración normativa de la
// §7.5.1 (banda ±10 % de la ec. 3 por mes calendario; la ec. 4-5 se evalúa
// por mes con n ≥ 10 — decisión D1), de modo que un período es atípico
// cuando cae fuera de la banda de SU mes, no de una banda global.

import { z } from 'zod'
import {
  LABEL_POR_TIPO_LBEN,
  TIPO_LBEN_DB,
} from '@/features/datos/models/lineasBase'

// ── Solicitud ───────────────────────────────────────────────────────────

export const solicitudAnalisisSchema = z.object({
  /** CUID de la edificación cuyo histórico de facturas se analiza. */
  edificacionId: z.string().min(1, 'Seleccione una edificación.'),
})
export type SolicitudAnalisis = z.infer<typeof solicitudAnalisisSchema>

// ── Salida del motor (espejo de python/lben/analisis.py) ───────────────

export const direccionAtipicoSchema = z.enum(['alza', 'caida'])
export type DireccionAtipico = z.infer<typeof direccionAtipicoSchema>

export const calendarioPeriodoSchema = z.enum([
  'lectivo',
  'vacaciones',
  'sin_datos',
])
export type CalendarioPeriodo = z.infer<typeof calendarioPeriodoSchema>

/** Banda de confianza de un mes calendario (§7.5.1). */
export const bandaMesSchema = z.object({
  mes: z.number().int().min(1).max(12),
  n: z.number().int(),
  media: z.number().nullable(),
  limite_inferior: z.number().nullable(),
  limite_superior: z.number().nullable(),
  descartados: z.number().int(),
  /** n < valores mínimos del mes: sin banda construible. */
  estimado: z.boolean(),
})
export type BandaMes = z.infer<typeof bandaMesSchema>

/** Período del histórico evaluado contra la banda de su mes. */
export const periodoAnalizadoSchema = z.object({
  mes: z.number().int().min(1).max(12),
  ano: z.number().int(),
  consumo_kwh: z.number(),
  media_mes: z.number().nullable(),
  banda_inf: z.number().nullable(),
  banda_sup: z.number().nullable(),
  /** null = mes sin banda (n < mínimos): no determinable. */
  es_atipico: z.boolean().nullable(),
  direccion: direccionAtipicoSchema.nullable(),
  desviacion_pct: z.number().nullable(),
  dias_lectivos: z.number().int().nullable(),
  calendario: calendarioPeriodoSchema,
  /** Frase con la explicación estadística; solo en atípicos. */
  explicacion: z.string().nullable(),
})
export type PeriodoAnalizado = z.infer<typeof periodoAnalizadoSchema>

export const estadisticosSchema = z.object({
  n: z.number().int(),
  media: z.number().nullable(),
  mediana: z.number().nullable(),
  /** DesvEst poblacional (ec. 5) post-ajuste/pre-descarte; null si n < 10. */
  desv_est: z.number().nullable(),
  coef_variacion: z.number().nullable(),
  minimo: z.number().nullable(),
  maximo: z.number().nullable(),
})
export type Estadisticos = z.infer<typeof estadisticosSchema>

export const tendenciaSchema = z.object({
  pendiente_kwh_por_mes: z.number().nullable(),
  variacion_pct_anual: z.number().nullable(),
})
export type Tendencia = z.infer<typeof tendenciaSchema>

export const ajusteAplicadoSchema = z.object({
  ano: z.number().int(),
  mes: z.number().int(),
  proporcion: z.number(),
  direccion: z.string(),
  descripcion: z.string(),
})
export type AjusteAplicado = z.infer<typeof ajusteAplicadoSchema>

export const resumenAnalisisSchema = z.object({
  periodos: z.number().int(),
  atipicos: z.number().int(),
  atipicos_alza: z.number().int(),
  atipicos_caida: z.number().int(),
  en_lectivo: z.number().int(),
  en_vacaciones: z.number().int(),
  sin_calendario: z.number().int(),
  /** Períodos evaluados con banda (los demás son `estimado`). */
  periodos_con_banda: z.number().int(),
  ajustes: z.number().int(),
})
export type ResumenAnalisis = z.infer<typeof resumenAnalisisSchema>

export const salidaAnalisisSchema = z.object({
  ok: z.literal(true),
  originales: z.number().int(),
  depurados: z.number().int(),
  criterio_depuracion: z.string(),
  min_datos_ic: z.number().int(),
  min_valores_por_mes: z.number().int(),
  umbra_dias_lectivos: z.number().int(),
  estadisticos: estadisticosSchema,
  tendencia: tendenciaSchema,
  bandas: z.array(bandaMesSchema),
  meses_insuficientes: z.array(z.number().int()),
  ajustes_aplicados: z.array(ajusteAplicadoSchema),
  periodos: z.array(periodoAnalizadoSchema),
  resumen: resumenAnalisisSchema,
})
export type SalidaAnalisis = z.infer<typeof salidaAnalisisSchema>

// ── Respuesta de la server action ───────────────────────────────────────

export type AnalisisResultado = {
  nombreEdificacion: string
  /** Primer y último período del histórico analizado ('YYYY-MM'). */
  desde: string
  hasta: string
  /** Fecha/hora (ISO) en que se ejecutó el análisis. */
  calculadoEn: string
  salida: SalidaAnalisis
  /** KPIs de gestión desagregados por niveles (edificación/bloque/espacio). */
  gestion: Gestion
}

export type RespuestaAnalisis =
  | { ok: true; analisis: AnalisisResultado }
  | { ok: false; error: string }

// ── KPIs de gestión por nivel (HU-07 esc. 2 · issue #75) ───────────────
//
// El análisis se ejecuta sobre facturas de la EDIFICACIÓN (dato medido);
// los KPIs de ahorro/consumo elevado se desagregan por niveles con la
// etiqueta de precisión visible: edificación = exacto, bloque = share
// estimado (models/shares.ts), espacio = inventario eléctrico estimado.

export const precisionNivelSchema = z.enum(['exacto', 'estimado'])
export type PrecisionNivel = z.infer<typeof precisionNivelSchema>

export const tipoNivelGestionSchema = z.enum(['edificacion', 'bloque', 'espacio'])
export type TipoNivelGestion = z.infer<typeof tipoNivelGestionSchema>

/** Ahorro frente a la línea base guardada (kWh/mes, período 30 d). */
export const ahorroKpiSchema = z.object({
  /** Línea base del nivel en kWh/mes; null si no hay LB utilizable. */
  lbKwh: z.number().nullable(),
  /** Etiqueta del modelo del que salió la LB (p. ej. «Cociente»). */
  lbModelo: z.string().nullable(),
  /** Cobertura de la LB (solo nivel edificación: «2 de 3 bloques…»). */
  lbCobertura: z.string().nullable(),
  /** lb − consumo promedio; positivo = ahorro, negativo = sobre la LB. */
  ahorroKwh: z.number().nullable(),
  /** (lb − consumo)/lb × 100; null si no hay LB. */
  ahorroPct: z.number().nullable(),
  /** Razón legible de la ausencia de ahorro (null cuando hay LB). */
  nota: z.string().nullable(),
})
export type AhorroKpi = z.infer<typeof ahorroKpiSchema>

/** Consumo elevado: períodos por encima de la banda superior (ec. 3). */
export const consumoElevadoKpiSchema = z.object({
  /** Invariante a la escala (la detección es por mes calendario). */
  meses: z.number().int(),
  /** Período máximo del histórico del nivel ('YYYY-MM'). */
  maximoPeriodo: z.string().nullable(),
  /** kWh del máximo, ya escala al nivel (share aplicado). */
  maximoKwh: z.number().nullable(),
  /** Variación interanual (%); invariante a la escala. */
  variacionPctAnual: z.number().nullable(),
})
export type ConsumoElevadoKpi = z.infer<typeof consumoElevadoKpiSchema>

/** Períodos inusuales del nivel: conteo invariante + kWh ya escala. */
export const inusualesKpiSchema = z.object({
  cantidad: z.number().int(),
  kwh: z.number(),
})
export type InusualesKpi = z.infer<typeof inusualesKpiSchema>

export const nivelGestionSchema = z.object({
  tipo: tipoNivelGestionSchema,
  /** Clave estable para el selector: 'edi' | 'b:<id>' | 'e:<id>'. */
  clave: z.string().min(1),
  nombre: z.string(),
  precision: precisionNivelSchema,
  /** Share acumulado; null en nivel edificación (exacto). */
  share: z.number().nullable(),
  consumoPromedioKwh: z.number(),
  ahorro: ahorroKpiSchema,
  elevado: consumoElevadoKpiSchema,
  inusuales: inusualesKpiSchema,
})
export type NivelGestion = z.infer<typeof nivelGestionSchema>

export const gestionSchema = z.object({
  niveles: z.array(nivelGestionSchema).min(1),
})
export type Gestion = z.infer<typeof gestionSchema>

/** Etiqueta de precisión visible por tipo de nivel (UI + stories). */
export const PRECISION_TEXTO: Record<TipoNivelGestion, string> = {
  edificacion: 'Exacto — facturas medidas',
  bloque: 'Estimado — share del bloque',
  espacio: 'Estimado — inventario eléctrico',
}

// ── Constantes de UI (espejo de python/lben/analisis.py) ───────────────

export const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

export const TEXTO_CALENDARIO: Record<CalendarioPeriodo, string> = {
  lectivo: 'Período lectivo',
  vacaciones: 'Vacaciones',
  sin_datos: 'Sin datos de calendario',
}

export const TEXTO_DIRECCION: Record<DireccionAtipico, string> = {
  alza: 'Alza',
  caida: 'Caída',
}

// ── Helpers puros (unit-test en analisis.test.ts) ──────────────────────

/** mes+ano → «marzo de 2024» (1-based, es-CO). */
export function etiquetaPeriodo(mes: number, ano: number): string {
  return `${MESES_ES[mes - 1] ?? `mes ${mes}`} de ${ano}`
}

/** «mar 24» para el eje X de la gráfica (mes 1-based). */
export function etiquetaEje(mes: number, ano: number): string {
  const corto = (MESES_ES[mes - 1] ?? '').slice(0, 3)
  return `${corto} ${String(ano).slice(2)}`
}

/** 12480.5 → «12.480,5» (es-CO: punto de miles, coma decimal). */
export function formatoNumero(valor: number, decimales = 1): string {
  const [entero, decimal] = valor.toFixed(decimales).split('.')
  const signo = entero.startsWith('-') ? '-' : ''
  const digitos = signo ? entero.slice(1) : entero
  const conMiles = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decimal ? `${signo}${conMiles},${decimal}` : `${signo}${conMiles}`
}

/** 12480.5 → «12.480,5 kWh». */
export function formatoKwh(valor: number): string {
  return `${formatoNumero(valor)} kWh`
}

/** 40 → «+40,0 %»; −33.33 → «−33,3 %» (siempre con signo). */
export function formatoPct(valor: number, decimales = 1): string {
  const base = formatoNumero(Math.abs(valor), decimales)
  return `${valor < 0 ? '−' : '+'}${base} %`
}

// ── Helpers puros de gestión (unit-test en analisis.test.ts) ───────────

/** Prioridad entre los modelos guardados de un bloque para el ahorro. */
export const PRIORIDAD_LB = [
  TIPO_LBEN_DB.cociente,
  TIPO_LBEN_DB.valor_absoluto,
  TIPO_LBEN_DB.confort,
] as const

type FilaLineaBase = { tipo: string; coeficientes: unknown }

function numeroDe(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * kWh/mes que persistió una línea base guardada. La regresión (ec. 4-5)
 * no almacena kWh/mes: su resultado son coeficientes y requiere la serie
 * (pred_reg), así que devuelve null de forma honesta.
 */
export function kwhDeLineaBaseGuardada(
  tipo: string,
  coeficientes: unknown
): number | null {
  if (!coeficientes || typeof coeficientes !== 'object') return null
  const r = coeficientes as Record<string, unknown>
  if (tipo === TIPO_LBEN_DB.valor_absoluto) return numeroDe(r.consumo_promedio_mensual)
  if (tipo === TIPO_LBEN_DB.cociente) return numeroDe(r.consumo_promedio)
  if (tipo === TIPO_LBEN_DB.confort) return numeroDe(r.consumo_base_kwh)
  return null
}

export type LineaBaseUtil = { kwh: number; tipo: string; modelo: string }

/** Mejor línea base utilizable de un bloque (prioridad `PRIORIDAD_LB`). */
export function mejorLineaBaseGuardada(
  filas: FilaLineaBase[]
): LineaBaseUtil | null {
  for (const tipo of PRIORIDAD_LB) {
    const fila = filas.find((f) => f.tipo === tipo)
    if (!fila) continue
    const kwh = kwhDeLineaBaseGuardada(fila.tipo, fila.coeficientes)
    if (kwh !== null && kwh > 0) {
      return { kwh, tipo: fila.tipo, modelo: LABEL_POR_TIPO_LBEN[fila.tipo] ?? fila.tipo }
    }
  }
  return null
}

/** Razón legible de la ausencia de línea base utilizable en un nivel. */
export function notaSinLineaBase(filas: FilaLineaBase[]): string {
  if (filas.length === 0) {
    return 'No hay línea base guardada para este nivel. Calcule y guarde una en Datos › Líneas base.'
  }
  return 'La línea base guardada es de regresión, que no persiste kWh/mes (requiere la serie del modelo). Guarde Cociente, Valor absoluto o Confort para habilitar el ahorro.'
}

export type EntradaNivelGestion = {
  tipo: TipoNivelGestion
  clave: string
  nombre: string
  precision: PrecisionNivel
  /** Share acumulado; null en edificación (exacto). */
  share: number | null
  /** Baseline del nivel en kWh/mes + trazabilidad de su procedencia. */
  lb: {
    kwh: number | null
    modelo: string | null
    cobertura: string | null
    nota: string | null
  }
}

/**
 * KPIs de un nivel: promedio y máximos escalados por el share (los
 * conteos de períodos son invariantes a la escala — la detección es por
 * mes calendario — y se muestran igual en todos los niveles).
 */
export function construirNivelGestion(
  entrada: EntradaNivelGestion,
  salida: SalidaAnalisis
): NivelGestion {
  const factor = entrada.share ?? 1
  const periodos = salida.periodos
  const consumoPromedioKwh =
    periodos.length > 0
      ? (periodos.reduce((suma, p) => suma + p.consumo_kwh, 0) / periodos.length) * factor
      : 0

  const lbValida = entrada.lb.kwh !== null && entrada.lb.kwh > 0 ? entrada.lb.kwh : null
  const ahorroKwh = lbValida !== null ? lbValida - consumoPromedioKwh : null
  const ahorroPct =
    lbValida !== null && ahorroKwh !== null ? (ahorroKwh / lbValida) * 100 : null

  let maximo: PeriodoAnalizado | null = null
  for (const p of periodos) {
    if (!maximo || p.consumo_kwh > maximo.consumo_kwh) maximo = p
  }

  const inusualesKwh =
    periodos
      .filter((p) => p.es_atipico)
      .reduce((suma, p) => suma + p.consumo_kwh, 0) * factor

  return {
    tipo: entrada.tipo,
    clave: entrada.clave,
    nombre: entrada.nombre,
    precision: entrada.precision,
    share: entrada.share,
    consumoPromedioKwh,
    ahorro: {
      lbKwh: lbValida,
      lbModelo: lbValida !== null ? entrada.lb.modelo : null,
      lbCobertura: entrada.lb.cobertura,
      ahorroKwh,
      ahorroPct,
      nota: lbValida !== null ? null : entrada.lb.nota,
    },
    elevado: {
      meses: salida.resumen.atipicos_alza,
      maximoPeriodo: maximo
        ? `${String(maximo.ano).padStart(4, '0')}-${String(maximo.mes).padStart(2, '0')}`
        : null,
      maximoKwh: maximo ? maximo.consumo_kwh * factor : null,
      variacionPctAnual: salida.tendencia.variacion_pct_anual,
    },
    inusuales: { cantidad: salida.resumen.atipicos, kwh: inusualesKwh },
  }
}

export function construirGestion(
  entradas: EntradaNivelGestion[],
  salida: SalidaAnalisis
): Gestion {
  return { niveles: entradas.map((e) => construirNivelGestion(e, salida)) }
}
