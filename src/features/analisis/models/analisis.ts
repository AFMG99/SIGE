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
}

export type RespuestaAnalisis =
  | { ok: true; analisis: AnalisisResultado }
  | { ok: false; error: string }

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
