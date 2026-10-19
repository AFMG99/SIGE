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
  TEXTOS_CRITERIO,
  TIPO_LBEN_DB,
} from '@/features/datos/models/lineasBase'
import type { CriterioDepuracion } from '@/features/datos/models/lineasBase'

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

// ── Sección `modelos` (selector de modelo, §7.4-7.5 + ahorro §8.1) ─────
//
// Espejo exacto de `_modelos()` en python/lben/analisis.py: el motor
// calcula los 5 modelos en UNA pasada y la UI elige al vuelo (sin
// red) cuál pintar. Todas las hojas tienen la MISMA forma para que
// el selector, los chips y la tabla §8.1 no tengan casos especiales.

/** Orden de presentación del selector (§7.4 de la Resolución). */
export const ORDEN_MODELOS = [
  'valor_absoluto',
  'cociente',
  'regresion',
  'ingenieria',
  'confort',
] as const
export type ModeloClave = (typeof ORDEN_MODELOS)[number]

export const estadoModeloSchema = z.enum(['disponible', 'no_disponible'])
export type EstadoModelo = z.infer<typeof estadoModeloSchema>

/** Chips de validación del modelo: null donde el criterio no aplica. */
export const validacionModeloSchema = z.object({
  n: z.number().int(),
  min_datos_ic: z.number().int(),
  criterio: z.string().nullable(),
  intervalo_inf: z.number().nullable(),
  intervalo_sup: z.number().nullable(),
  r2: z.number().nullable(),
  mape: z.number().nullable(),
  p_value_max: z.number().nullable(),
})
export type ValidacionModelo = z.infer<typeof validacionModeloSchema>

/** Fila de la tabla §8.1: potencial de ahorro de un mes calendario. */
export const filaAhorroSchema = z.object({
  mes: z.number().int().min(1).max(12),
  /** LBEn del modelo para ese mes (kWh/mes). */
  lben: z.number(),
  /** Consumo real mínimo del mes en el periodo base (ec. 9). */
  mejor: z.number(),
  /** max(LBEn − mejor, 0) en kWh. */
  potencial: z.number(),
  /** potencial/LBEn × 100 (ec. 12); null si LBEn = 0. */
  potencial_pct: z.number().nullable(),
})
export type FilaAhorro = z.infer<typeof filaAhorroSchema>

export const ahorroModeloSchema = z.object({
  por_mes: z.array(filaAhorroSchema),
  /** «Promedio x Año» del Anexo 1: media de los 12 potenciales (kWh/mes). */
  potencial_mensual: z.number(),
  /** ec. 12 sobre ese promedio; null si la LBEn media es 0. */
  potencial_pct: z.number().nullable(),
})
export type AhorroModelo = z.infer<typeof ahorroModeloSchema>

export const modeloLBEnSchema = z.object({
  estado: estadoModeloSchema,
  /** Por qué no está disponible (null cuando está disponible). */
  motivo: z.string().nullable(),
  etiqueta: z.string(),
  formula: z.string(),
  unidad: z.string(),
  /** Datos depurados con los que se evaluó el modelo. */
  n: z.number().int(),
  /** LBEn por mes calendario (12); null donde el modelo no tiene valor. */
  lben_mensual: z.array(z.number().nullable()).length(12),
  validacion: validacionModeloSchema,
  /** §8.1 (ec. 9-12); null cuando la Resolución no define potencial. */
  ahorro: ahorroModeloSchema.nullable(),
  /** Nota complementaria (p. ej. ASHRAE para confort). */
  nota: z.string().nullable(),
})
export type ModeloLBEn = z.infer<typeof modeloLBEnSchema>

export const modelosSchema = z.object({
  valor_absoluto: modeloLBEnSchema,
  cociente: modeloLBEnSchema,
  regresion: modeloLBEnSchema,
  ingenieria: modeloLBEnSchema,
  confort: modeloLBEnSchema,
})
export type ModelosLBEn = z.infer<typeof modelosSchema>

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
  /**
   * Los 5 modelos calculados al vuelo. `nullish` porque un motor
   * desplegado sin esta sección (versión anterior) no debe tumbar el
   * análisis: la vista degrada a un callout explícito.
   */
  modelos: modelosSchema.nullish(),
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

// ── Selector de modelo (§7.4) y ahorro §8.1 ────────────────────────────

/**
 * Descripción larga de cada modelo. El motor manda `etiqueta` y
 * `formula` (fuente única en Python); este texto explica CUÁNDO usarlo
 * y vive aquí porque es copy de UI, no de dominio.
 */
export const TEXTO_MODELO: Record<ModeloClave, string> = {
  valor_absoluto:
    'Promedio simple de cada mes calendario del periodo base (§7.5.1). Simple y auditable: exige que el consumo no cambie estructuralmente entre años.',
  cociente:
    'Expresa el consumo por persona atendida —población flotante, como el motor de líneas base— y absorbe los cambios de ocupación entre periodos (§7.5.2, Anexo 2).',
  regresion:
    'Ajusta el consumo a las variables operativas (población y grados día de enfriamiento) con selección de variables por p-value (§7.5.3).',
  ingenieria:
    'Simulación física de las cargas de la edificación (§7.4.4). Requiere el modelo de la edificación: fuera de alcance de esta versión.',
  confort:
    'Indicador complementario ASHRAE 55 —no es uno de los cuatro modelos de la Resolución— que controla la operación sobre el rango de confort adaptativo de Medellín.',
}

/**
 * Fórmula visible del potencial de ahorro §8.1 (ec. 9-12) por familia
 * de modelo. Confort e ingeniería no tienen: §8.1 no define potencial
 * para ellos (`ahorro: null`).
 */
export const FORMULA_AHORRO: Partial<Record<ModeloClave, string>> = {
  valor_absoluto:
    'potencial_m = LBEn_m − mínimo_m (ec. 9) · %_m = potencial_m ÷ LBEn_m × 100 (ec. 12)',
  cociente:
    'potencial_m = LBEn_m − mínimo_m (ec. 9) en el espacio del cociente (Anexo 2) · %_m = potencial_m ÷ LBEn_m × 100 (ec. 12)',
  regresion:
    'dif_i = real_i − pred_i (ec. 10); los mejores desempeños ajustan la recta consumo ~ variable (ec. 11) · %_m = potencial_m ÷ LBEn_m × 100 (ec. 12)',
}

export type Periodicidad = 'dia' | 'semana' | 'mes' | 'ano'

/**
 * Granularidades de la serie. Día y semana existen en el selector pero
 * DESHABILITADAS: el histórico de facturas es mensual y el motor de
 * Carga no ingesta datos diarios todavía. El motivo se muestra en la UI.
 */
export const PERIODICIDAD: readonly {
  valor: Periodicidad
  etiqueta: string
  habilitado: boolean
  /** Indisponibilidad legible (null cuando está habilitada). */
  motivo: string | null
}[] = [
  {
    valor: 'dia',
    etiqueta: 'Día',
    habilitado: false,
    motivo: 'Requiere datos diarios (pendiente en Carga)',
  },
  {
    valor: 'semana',
    etiqueta: 'Semana',
    habilitado: false,
    motivo: 'Requiere datos diarios (pendiente en Carga)',
  },
  { valor: 'mes', etiqueta: 'Mes', habilitado: true, motivo: null },
  { valor: 'ano', etiqueta: 'Año', habilitado: true, motivo: null },
]

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

// ── Helpers puros del selector (unit-test en analisis.test.ts) ─────────

/** Chip legible del criterio de depuración (fallback: el crudo). */
export function textoCriterio(criterio: string | null): string | null {
  if (!criterio) return null
  return TEXTOS_CRITERIO[criterio as CriterioDepuracion]?.nombre ?? criterio
}

export type OpcionModelo = {
  clave: ModeloClave
  etiqueta: string
  /** false → opción deshabilitada con `motivo` visible en la UI. */
  habilitado: boolean
  /** null cuando está disponible. */
  motivo: string | null
}

/** Opciones del selector en orden §7.4 según la salida del motor. */
export function opcionesModelo(
  modelos: ModelosLBEn | null | undefined
): OpcionModelo[] {
  if (!modelos) return []
  return ORDEN_MODELOS.map((clave) => {
    const modelo = modelos[clave]
    return {
      clave,
      etiqueta: modelo.etiqueta,
      habilitado: modelo.estado === 'disponible',
      motivo: modelo.estado === 'disponible' ? null : modelo.motivo,
    }
  })
}

/** Selección inicial: primer modelo disponible (§7.4: valor absoluto). */
export function modeloPorDefecto(
  modelos: ModelosLBEn | null | undefined
): ModeloClave | null {
  return (
    ORDEN_MODELOS.find((clave) => modelos?.[clave]?.estado === 'disponible') ??
    null
  )
}

/** LBEn media del modelo seleccionado (kWh/mes); null si no tiene valores. */
export function lbenPromedio(modelo: ModeloLBEn | null | undefined): number | null {
  if (!modelo) return null
  const valores = modelo.lben_mensual.filter(
    (v): v is number => typeof v === 'number'
  )
  if (valores.length === 0) return null
  return valores.reduce((suma, v) => suma + v, 0) / valores.length
}

export type PuntoAnual = {
  ano: number
  /** Meses con dato en el año. */
  meses: number
  /** Media del consumo normalizado (kWh/mes: misma unidad que la serie mensual). */
  consumo: number
  /** Media de la LBEn de los meses presentes; null si el modelo no tiene valores. */
  lben: number | null
  /** Períodos inusuales del año (→ punto ámbar en la gráfica). */
  atipicos: number
}

/**
 * Agrega la serie mensual a un punto por año (selector «Año»): media de
 * `consumo_kwh` por año, recuento de inusuales y —si se pasa el modelo—
 * media de su LBEn de los meses presentes. La unidad NO cambia: sigue
 * siendo kWh/mes, sólo cambia la granularidad temporal.
 */
export function agregarAnual(
  periodos: PeriodoAnalizado[],
  lbenMensual?: readonly (number | null)[] | null
): PuntoAnual[] {
  const porAno = new Map<number, PeriodoAnalizado[]>()
  for (const periodo of periodos) {
    const grupo = porAno.get(periodo.ano)
    if (grupo) grupo.push(periodo)
    else porAno.set(periodo.ano, [periodo])
  }
  return Array.from(porAno.keys())
    .sort((a, b) => a - b)
    .map((ano) => {
      const grupo = porAno.get(ano) as PeriodoAnalizado[]
      const consumo =
        grupo.reduce((suma, p) => suma + p.consumo_kwh, 0) / grupo.length
      const lbens = grupo
        .map((p) => lbenMensual?.[p.mes - 1] ?? null)
        .filter((v): v is number => typeof v === 'number')
      const lben =
        lbens.length > 0 ? lbens.reduce((suma, v) => suma + v, 0) / lbens.length : null
      return {
        ano,
        meses: grupo.length,
        consumo,
        lben,
        atipicos: grupo.filter((p) => p.es_atipico === true).length,
      }
    })
}

export type ResumenAhorroAnual = {
  meses: number
  lben: number
  mejor: number
  potencial: number
  potencial_pct: number | null
}

/**
 * La tabla §8.1 en modo anual: Σ de las filas mensuales (kWh/año) con
 * la ec. 12 sobre los totales — el «Promedio x Año» del Anexo 1 es
 * `ahorro.potencial_mensual`, no esta función.
 */
export function ahorroAnual(ahorro: AhorroModelo): ResumenAhorroAnual {
  const filas = ahorro.por_mes
  const lben = filas.reduce((suma, f) => suma + f.lben, 0)
  const mejor = filas.reduce((suma, f) => suma + f.mejor, 0)
  const potencial = filas.reduce((suma, f) => suma + f.potencial, 0)
  return {
    meses: filas.length,
    lben,
    mejor,
    potencial,
    potencial_pct: lben > 0 ? (potencial / lben) * 100 : null,
  }
}

// ── Simulador de umbral (exploratorio, solo cliente) ────────────────────
//
// §7.5.1: la detección NORMATIVA usa ±10 % (ec. 3) cuando el mes tiene
// n < 10, y media ± k·DesvEst (ec. 4-5, k = 2, DesvEst poblacional ÷N)
// cuando n ≥ 10. El simulador deja mover ambos umbrales para proyectar
// cuántos períodos quedarían señalados SIN invocar el motor ni alterar
// `es_atipico`: la salida normativa sigue siendo la del análisis.
//
// La σ mensual no viaja en la respuesta, pero se recupera de los
// límites que SÍ trae el motor (son simétricos: inf = media − 2σ,
// sup = media + 2σ ⇒ σ = (sup − inf) ÷ (2 · K_INTERVALO_MOTOR)).

export const UMBRAL_PCT_DEFECTO = 10
export const UMBRAL_PCT_MIN = 5
export const UMBRAL_PCT_MAX = 30
export const UMBRAL_K_DEFECTO = 2
export const UMBRAL_K_MIN = 1
export const UMBRAL_K_MAX = 3
export const UMBRAL_K_PASO = 0.5

/** K de la ec. 4 del motor (`python/lben/constants.py: K_INTERVALO = 2`). */
export const K_INTERVALO_MOTOR = 2

/**
 * Versión del CONTRATO del motor de análisis (`python/lben/analisis.py`).
 * Subirla invalida toda evaluación derivada (p. ej. las alertas persistidas):
 * un motor nuevo puede clasificar distinto los mismos datos, así que las
 * bandejas aguas abajo deben recalcularse.
 */
export const VERSION_MOTOR_ANALISIS = 1

export type ConfigUmbral = { pct: number; k: number }

/** Estado del simulador en el shell (sobrevive al cambio de submódulo). */
export type EstadoSimulador = ConfigUmbral & { activo: boolean }

export const SIMULADOR_POR_DEFECTO: EstadoSimulador = {
  activo: false,
  pct: UMBRAL_PCT_DEFECTO,
  k: UMBRAL_K_DEFECTO,
}

/** Banda simulada de un mes calendario (kWh). */
export type BandaSimulada = { inf: number; sup: number }

export type SimulacionUmbral = {
  /** Banda simulada por mes (índice mes−1); null = mes sin media. */
  bandasSim: (BandaSimulada | null)[]
  /** Períodos que quedarían señalados con el umbral simulado. */
  atipicosSim: number
  /** Períodos evaluables con banda simulada (los demás son «sin banda»). */
  evaluados: number
  /** Normativamente dentro de banda que entrarían como inusuales. */
  entrarian: PeriodoAnalizado[]
  /** Normativamente inusuales que dejarían de estarlo. */
  saldrian: PeriodoAnalizado[]
}

/**
 * Reclasa cada período contra la banda del SU mes con el umbral elegido
 * (pct para meses con n < `min_datos_ic`, k·σ para el resto). Opera
 * sobre la serie YA depurada: no repite la depuración de la §7.5.1, la
 * proyección es exploratoria y así se declara en la UI.
 */
export function simularUmbral(
  salida: SalidaAnalisis,
  config: ConfigUmbral
): SimulacionUmbral {
  const bandasSim: (BandaSimulada | null)[] = Array.from({ length: 12 }, () => null)
  for (const banda of salida.bandas) {
    if (banda.media === null) {
      bandasSim[banda.mes - 1] = null
      continue
    }
    const media = banda.media
    const conSigma =
      banda.n >= salida.min_datos_ic &&
      banda.limite_inferior !== null &&
      banda.limite_superior !== null
    if (conSigma) {
      // ec. 4-5: límites simétricos alrededor de la media final.
      const sigma =
        ((banda.limite_superior as number) - (banda.limite_inferior as number)) /
        (2 * K_INTERVALO_MOTOR)
      bandasSim[banda.mes - 1] = {
        inf: media - config.k * sigma,
        sup: media + config.k * sigma,
      }
    } else {
      // ec. 3: porcentaje de la media del mes.
      bandasSim[banda.mes - 1] = {
        inf: media * (1 - config.pct / 100),
        sup: media * (1 + config.pct / 100),
      }
    }
  }

  let atipicosSim = 0
  let evaluados = 0
  const entrarian: PeriodoAnalizado[] = []
  const saldrian: PeriodoAnalizado[] = []
  for (const p of salida.periodos) {
    const banda = bandasSim[p.mes - 1]
    if (!banda) continue
    evaluados += 1
    const atipico = p.consumo_kwh < banda.inf || p.consumo_kwh > banda.sup
    if (atipico) atipicosSim += 1
    if (atipico && p.es_atipico === false) entrarian.push(p)
    else if (!atipico && p.es_atipico === true) saldrian.push(p)
  }

  return { bandasSim, atipicosSim, evaluados, entrarian, saldrian }
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
