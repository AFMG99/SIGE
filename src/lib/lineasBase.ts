/**
 * Tipos y constantes compartidos del módulo de Línea Base Energética (LBEn).
 *
 * El cálculo real vive en la server action `@/actions/lineasBase`, que
 * invoca `scripts/lben_cli.py` (wrapper de `lben_engine.py`, Resolución
 * UPME 0016 de 2024). Estos tipos viajan del CLI → action → UI y también
 * se usan en los doubles de Storybook.
 */

/** Ids de modelo en la UI (pills de navegación). */
export const MODELOS_LBEN = [
  'valor_absoluto',
  'cociente',
  'regresion',
  'confort',
] as const

export type ModeloLbenId = (typeof MODELOS_LBEN)[number]

/** `LineaBaseEnergia.tipo` en BD, alineado con la semilla del seed. */
export const TIPO_LBEN_DB: Record<ModeloLbenId, string> = {
  valor_absoluto: 'VALOR_ABSOLUTO',
  cociente: 'COCIENTE',
  regresion: 'REGRESSION_ESTADISTICA',
  confort: 'CONFORT_THERMAL',
}

/**
 * Etiqueta amigable de `LineaBaseEnergia.tipo` (BD → UI), espejo de
 * `MODELOS[].label` en `LineasBase.tsx` para la pestaña de gestión.
 */
export const LABEL_POR_TIPO_LBEN: Record<string, string> = Object.fromEntries(
  (
    [
      ['valor_absoluto', 'Valor Absoluto'],
      ['cociente', 'Cociente'],
      ['regresion', 'Regresión'],
      ['confort', 'Confort Térmico'],
    ] as const
  ).map(([id, label]) => [TIPO_LBEN_DB[id], label])
)

/** Constantes normativas UPME 0016/2024 (espejo de lben_engine.py). */
export const UPME_MIN_MESES = 36

/**
 * Criterio con el que se derivó el `share` de un cálculo.
 *
 * - `facturas_area`: reparto relativo por `área útil × factor de
 *   infraestructura`. Solo es válido con cobertura completa (todos los
 *   bloques registrados con `areaUtil > 0`), porque normaliza contra Σ de
 *   lo que haya cargado y con un subconjunto se repartiría el 100 %.
 * - `modelo_ingenieria`: `share = carga nominal del bloque ÷ factura media
 *   global`. Normaliza contra un dataset completo (la factura global), por
 *   lo que nunca infla el reparto aunque falten bloques. Es una
 *   **estimación**, no una medición.
 */
export type OrigenShare = 'facturas_area' | 'modelo_ingenieria'
export const UPME_P_VALUE = 0.05
export const UPME_MAPE_MAXIMO = 5 // en % · confiabilidad (ejemplo Anexo 3)
export const UPME_RANGO_CONFIANZA = 0.1 // ±10 % · ec. 3 (criterio por defecto)

/**
 * Factor k = 2 de la ec. 4 (`LBEn_m ± k·DesvEst`): la imagen oficial de la
 * Resolución escribe «dos(2)·DesvEst» (§7.5.1); ancho del rescate cuando
 * los depurados quedan < 36.
 */
export const UPME_K_INTERVALO = 2

/**
 * N mínimo de registros para que la ec. 4-5 sea elegible (§7.5.1: «con 10 o
 * más datos…»); guardia del rescate cuando los depurados quedan < 36.
 */
export const UPME_MIN_DATOS_IC = 10

/**
 * Criterio de depuración aplicado por el motor (espejo de
 * `lben_engine.depurar_con_bandas`, regla de dos pases):
 * - `banda_10_pct`: pase 1, criterio por defecto — banda ±10 % de la ec. 3
 *   (es lo que aplican los ejemplos de los Anexos con 36 datos).
 * - `ic_2sigma`: rescate — si tras el pase 1 los depurados quedan < 36 y
 *   N ≥ `UPME_MIN_DATOS_IC`, se reintenta con el intervalo de confianza de
 *   las ec. 4-5, centro ± `UPME_K_INTERVALO`·DesvEst (DesvEst poblacional,
 *   ÷N, ec. 5); solo se conserva si mejora el recuento.
 */
export type CriterioDepuracion = 'ic_2sigma' | 'banda_10_pct'

/**
 * Textos display por criterio para captions, badges y chips de la UI
 * (cabecera de resultados, tabla de preparación, gráfica).
 */
export const TEXTOS_CRITERIO: Record<
  CriterioDepuracion,
  {
    /** Nombre corto del criterio (captions, cabeceras). */
    nombre: string
    /** Frase del badge de descarte (se usa tras «Descartado · »). */
    descarte: string
    /** Etiqueta del chip de leyenda de descartados en la gráfica. */
    descartados: string
  }
> = {
  ic_2sigma: {
    nombre: 'IC ec. 4-5 (±2·DesvEst)',
    descarte: 'fuera del IC ec. 4-5 (±2·DesvEst)',
    descartados: 'Descartados (IC ec. 4-5)',
  },
  banda_10_pct: {
    nombre: 'banda ±10 % (ec. 3)',
    descarte: 'fuera de banda ±10 %',
    descartados: 'Descartados (banda ±10 %)',
  },
}

/**
 * Valores mínimos por mes calendario para armar la banda de confianza (§7.5.1:
 * «cuando el número de datos sea inferior a tres, se sugiere…»).
 *
 * No hay tope de R²: §7.5.3 dice textualmente que un R² bajo no invalida
 * la regresión (el antiguo `UPME_R2_MAXIMO` se eliminó por eso).
 */
export const UPME_MIN_VALORES_MES = 3

/** Punto mensual de la serie para las gráficas (kWh/30 d, post-asignación). */
export type PuntoSerie = {
  mes: number
  ano: number
  real: number | null
  descartado: boolean
  /** Banda del mes calendario (ec. 4-5 o ±10 %); null si salió `estimado`. */
  banda_inf: number | null
  banda_sup: number | null
  /** Mes con menos de `UPME_MIN_VALORES_MES` valores: sin banda (§7.5.1). */
  estimado: boolean
  pred_va: number | null
  pred_coc: number | null
  pred_reg: number | null
  pred_conf: number | null
}

/** Resultado crudo de un modelo según lben_engine.py (campos variables). */
export type ResultadoModelo = {
  tipo?: string
  r2?: number | null
  mape?: number | null
  coeficientes?: Record<string, number>
  p_values?: Record<string, number>
  consumo_promedio_mensual?: number
  consumo_mediana?: number
  desvio_estandar?: number
  rango_confianza_10_pct?: [number, number]
  /**
   * Intervalo de confianza ec. 4: envolvente de las 12 `LBEn_m` con ancho
   * `k·DesvEst`; `null`/ausente si N < `UPME_MIN_DATOS_IC` (la ec. 4-5 no
   * aplica).
   */
  intervalo_confianza?: [number, number] | null
  /** 12 `LBEn_m` de la ec.(2); null en meses sin datos (§7.5.1). */
  lben_mensual?: (number | null)[]
  consumo_promedio?: number
  variable_referencia_promedio?: number
  cociente_estimado?: number
  /** 12 cocientes mensuales de la ec.(6); null en meses sin datos. */
  cociente_mensual?: (number | null)[]
  unidad?: string
  variable_dependiente?: string
  variables_explicativas_usadas?: string[]
  r2_ajustado?: number
  f_statistic?: number
  temperatura_promedio?: number
  en_rango_confort?: boolean
  modo_operacion?: string
  consumo_base_kwh?: number
  energia_virtual_kwh?: number
  delta_temperatura?: number
  observaciones?: string
  [clave: string]: unknown
}

export type EstadoModelo =
  | { estado: 'ok'; resultado: ResultadoModelo }
  | { estado: 'error'; mensaje: string }

/**
 * Alcance de un cálculo según la jerarquía de consumo:
 * facturas (global) → bloques → espacios del bloque.
 */
export type AlcanceTipo = 'global' | 'bloque' | 'espacio'

export type Alcance = {
  tipo: AlcanceTipo
  /** CUID del bloque o del espacio; `null` en alcance global. */
  id: string | null
  nombre: string
  /** Etiqueta display (código del bloque, nombre de la edificación, etc.). */
  codigo: string
  /** Bloque dueño del alcance; `null` solo en global (varios bloques). */
  bloqueId: string | null
  /** Share acumulado de la cadena global → bloque → espacio. */
  share: number
  /** Criterio del que salió el `share` (ver `OrigenShare`). */
  origen: OrigenShare
}

/**
 * Solicitud del cliente hacia `calcularModelosLineaBase`.
 * `edificacionId` acota el cálculo a una edificación; `null`/ausente
 * significa todas las edificaciones (comportamiento global histórico).
 */
export type AlcanceSolicitud = {
  tipo: AlcanceTipo
  id?: string | null
  edificacionId?: string | null
}

/**
 * Banda de confianza de un mes calendario (pase 1: banda ±10 % de la
 * ec. 3; rescate ec. 4-5 con N ≥ `UPME_MIN_DATOS_IC` cuando los depurados
 * quedan < 36; espejo de `lben_engine._banda_de_grupo`). `media` ya
 * incluye el recomputo tras el descarte.
 */
export type DepuracionBandas = {
  mes: number
  n: number
  media: number | null
  limiteInferior: number | null
  limiteSuperior: number | null
  descartados: number
  /** n < `UPME_MIN_VALORES_MES`: sin banda, se calcula con lo que haya. */
  estimado: boolean
}

/** Fila de la tabla de preparación: una factura (mes) antes de modelar. */
export type FilaPreparacion = {
  periodo: string
  /** Consumo crudo de la factura de energía (kWh del periodo). */
  consumoKwh: number
  diasFacturados: number
  costoCop: number
  /** Normalizado a 30 días de la factura. */
  consumoNormalizado: number
  /** Share acumulado aplicado a esta factura. */
  share: number
  /** kWh/30 d efectivamente enviados al motor (normalizado × share). */
  consumoAsignado: number
  /** Decisión real del motor (columna `descartado` de la serie). */
  descartado: boolean
  /** Motivo del descarte derivado del valor ya asignado. */
  motivoDescarte: 'banda' | 'cero' | null
}

/** Nodo del árbol de segmentación facturas → bloques → espacios. */
export type NodoJerarquia = {
  nivel: 'global' | 'bloque' | 'espacio'
  id: string | null
  nombre: string
  codigo: string
  padreId: string | null
  /** Criterio de peso aplicado en este nivel. */
  criterio: string
  /** Peso absoluto del nodo (1 en global). */
  peso: number
  /** Share acumulado desde la raíz. */
  share: number
  /** Promedio histórico de consumo asignado a este nodo (kWh/mes). */
  consumoPromedio: number
}

/** Cálculo completo de los 4 modelos para un alcance de la jerarquía. */
export type CalculoLineaBase = {
  alcance: Alcance
  /** Criterio usado para todos los shares del árbol. */
  origen: OrigenShare
  /**
   * Aviso no bloqueante del cálculo (cobertura parcial, share estimado,
   * variables operativas ausentes…). La UI lo pinta como callout.
   */
  aviso?: string
  originales: number
  depurados: number
  minMeses: number
  /** Criterio de depuración aplicado por el motor (ec. 4-5 o ec. 3). */
  criterioDepuracion: CriterioDepuracion
  /** DesvEst poblacional (ec. 5) usada para trazar la banda; null si ec. 3. */
  desvEst: number | null
  /** k del intervalo de confianza (ec. 4); null si el criterio es ec. 3. */
  kIntervalo: number | null
  /** Bandas por mes (§7.5.1); la serie los refleja en `banda_inf/sup`. */
  bandas: DepuracionBandas[]
  /** Meses con menos de `minValoresMes` valores: sin banda, `estimado`. */
  mesesInsuficientes: number[]
  minValoresMes: number
  variablesRegresion: string[]
  resultados: Record<ModeloLbenId, EstadoModelo>
  serie: PuntoSerie[]
  preparacion: FilaPreparacion[]
  jerarquia: NodoJerarquia[]
  calculadoEn: string
}

export type RespuestaCalculo =
  | { ok: true; calculo: CalculoLineaBase }
  | { ok: false; error: string }

export type RespuestaGuardar =
  | { ok: true; mensaje: string }
  | { ok: false; error: string }

/** Columna del PuntoSerie que grafica cada modelo. */
export const PRED_POR_MODELO: Record<
  ModeloLbenId,
  'pred_va' | 'pred_coc' | 'pred_reg' | 'pred_conf'
> = {
  valor_absoluto: 'pred_va',
  cociente: 'pred_coc',
  regresion: 'pred_reg',
  confort: 'pred_conf',
}

/**
 * Línea base del modelo activo expresada en kWh/mes, para desglosarla
 * por la jerarquía (hijo = LB × share acumulado).
 */
export function lineaBaseKwh(
  modelo: ModeloLbenId,
  r: ResultadoModelo,
  serie: PuntoSerie[]
): number | null {
  if (modelo === 'valor_absoluto') return r.consumo_promedio_mensual ?? null
  if (modelo === 'cociente') return r.consumo_promedio ?? null
  if (modelo === 'confort') return r.consumo_base_kwh ?? null
  const preds = serie
    .filter((p) => !p.descartado && typeof p.pred_reg === 'number')
    .map((p) => p.pred_reg as number)
  if (preds.length === 0) return null
  return preds.reduce((suma, v) => suma + v, 0) / preds.length
}
