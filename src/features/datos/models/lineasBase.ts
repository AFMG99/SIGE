/**
 * Tipos y constantes compartidos del módulo de Línea Base Energética (LBEn).
 *
 * El cálculo real vive en la server action `@/features/datos/controllers/lineasBase`, que
 * invoca `python/lben/cli.py` (wrapper del paquete `lben`, Resolución
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

/** Constantes normativas UPME 0016/2024 (espejo de python/lben/). */
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
 * Resolución escribe «dos(2)·DesvEst» (§7.5.1); ancho de la banda mensual
 * cuando el mes tiene n ≥ `UPME_MIN_DATOS_IC` (D1) y del IC de la tarjeta.
 */
export const UPME_K_INTERVALO = 2

/**
 * N mínimo de registros EN UN MES para que la ec. 4-5 se use en ese mes
 * (§7.5.1: «con 10 o más datos…»; decisión D1: el gate es por mes).
 */
export const UPME_MIN_DATOS_IC = 10

/**
 * Criterio de depuración aplicado por el motor (espejo de
 * `lben.depurar_con_bandas`):
 * - `banda_10_pct`: única ruta — banda ±10 % de la ec. 3 por mes, con
 *   recomputo de la media tras el descarte (es lo que aplican los
 *   ejemplos de los Anexos con 36 datos). La ec. 4-5 se evalúa por mes
 *   (D1) dentro de esa misma pasada; el rescate `ic_2sigma` ya no existe.
 */
export type CriterioDepuracion = 'banda_10_pct'

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

/** Punto mensual de la serie para las gráficas (kWh/30 d, post-asignación y ajustes Anexo 4). */
export type PuntoSerie = {
  mes: number
  ano: number
  real: number | null
  descartado: boolean
  /** Banda del mes calendario (±10 %, ec. 3/7); null si salió `estimado`. */
  banda_inf: number | null
  banda_sup: number | null
  /** Mes con menos de `UPME_MIN_VALORES_MES` valores: sin banda (§7.5.1). */
  estimado: boolean
  pred_va: number | null
  pred_coc: number | null
  pred_reg: number | null
  pred_conf: number | null
}

/** Resultado crudo de un modelo según python/lben/ (campos variables). */
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
   * Intervalo de confianza ec. 4 (D1: por mes): envolvente de las 12
   * `LBEn_m ± k·σ_m` con σ_m poblacional (÷N, ec. 5) de cada mes; solo si
   * los 12 meses están presentes y cada uno tiene n ≥ `UPME_MIN_DATOS_IC`
   * (si no, `null`).
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
 * Banda de confianza de un mes calendario (±10 % de la ec. 3 / ec. 7; la
 * ec. 4-5 se evalúa por mes con n ≥ `UPME_MIN_DATOS_IC` — D1 — dentro de
 * la misma pasada; espejo de `lben.bandas._banda_de_grupo`). `media` ya
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
  /** kWh/30 d efectivamente enviados al motor (normalizado × share, con ajustes Anexo 4). */
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
  /** Criterio de depuración aplicado por el motor (banda ±10 %, ec. 3). */
  criterioDepuracion: CriterioDepuracion
  /** §9.2: DesvEst poblacional (ec. 5) de todos los datos post-ajuste/pre-descarte; null si n < 10. */
  desvEst: number | null
  /** k de la ec. 4 (ancho de la banda mensual y del IC); null en el criterio ec. 3. */
  kIntervalo: number | null
  /** Bandas por mes (§7.5.1); la serie los refleja en `banda_inf/sup`. */
  bandas: DepuracionBandas[]
  /** Meses con menos de `minValoresMes` valores: sin banda, `estimado`. */
  mesesInsuficientes: number[]
  minValoresMes: number
  variablesRegresion: string[]
  /** Ajustes no rutinarios aplicados durante la depuración (Anexo 4). */
  ajustesAplicados: { ano: number; mes: number; proporcion: number; direccion: string; descripcion: string }[]
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
  | { ok: true; mensaje: string; advertencia?: string }
  | { ok: false; error: string }

/**
 * Advertencia transitoria (no persistida) cuando la línea base no alcanza
 * los mínimos regulatorios: se guarda igual, pero se sugiere cargar y
 * depurar más meses antes de usarla para los respectivos ajustes.
 * Devuelve `null` cuando el cálculo cumple los mínimos.
 */
export function advertenciaMinimos(entrada: {
  mesesFacturados: number
  depurados: number
  mesesInsuficientes?: number[]
}): string | null {
  const insuficientes = (entrada.mesesInsuficientes ?? []).filter(
    (m) => Number.isInteger(m) && m >= 1 && m <= 12
  )
  const conforme =
    entrada.mesesFacturados >= UPME_MIN_MESES &&
    entrada.depurados >= UPME_MIN_MESES &&
    insuficientes.length === 0
  if (conforme) return null

  const parte3x12 =
    insuficientes.length > 0
      ? `; además, faltan al menos ${UPME_MIN_VALORES_MES} valores en el(los) mes(es) ${insuficientes.join(', ')} (regla 3×12)`
      : ''
  return (
    `Esta línea base tiene ${entrada.depurados} de ${entrada.mesesFacturados} meses y no alcanza el mínimo de ${UPME_MIN_MESES} meses de la Resolución UPME 0016 de 2024${parte3x12}. ` +
    `Se sugiere cargar y depurar al menos ${UPME_MIN_MESES} meses antes de usarla para los respectivos ajustes de ahorro.`
  )
}

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
