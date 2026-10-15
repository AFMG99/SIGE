/**
 * Modelo puro del resumen del dashboard (T2 del rediseño).
 *
 * Transforma los agregados del servidor en el view-model que pinta
 * `DashboardHome`: KPIs con delta, serie «consumo vs línea base»,
 * distribución por edificación, últimas facturas y ranking ahorro+costo.
 *
 * Reglas (decisión del mantenedor, L4 del feature doc):
 *  - «Target» = mejor R² entre los modelos GUARDADOS con serie mensual
 *    utilizable. La regresión no persiste serie mensual (sus predicciones
 *    dependen de variables operativas del mes), así que solo aporta si el
 *    motor guardó `lben_mensual`; si no, gana el siguiente mejor modelo.
 *  - Nada de cifras inventadas: sin datos → null y la vista pinta empty
 *    state / callout, nunca un número fabricado.
 *  - Unidades alineadas: `consumoNormalizado` (kWh/30 d) vs LBEn (kWh/mes).
 *
 * Sin React ni Prisma: unit-test en `dashboardModel.test.ts`.
 */

// ─────────────────────────────────────────────── entradas (props del servidor)

/** Últimos períodos agregados (Prisma groupBy), orden descendente. */
export type SeriePeriodo = {
  periodo: string
  consumoNormalizado: number
  costoCop: number
}

export type FacturaReciente = {
  id: string
  periodo: string
  edificacionId: string
  edificacionNombre: string
  consumoKwh: number
  consumoNormalizado: number
  costoCop: number
  diasFacturados: number
}

/** Campos del resultado Python que el dashboard necesita ( Json en BD ). */
export type CoeficientesLben = {
  lben_mensual?: (number | null)[]
  consumo_promedio?: number
  consumo_base_kwh?: number
  consumo_promedio_mensual?: number
}

export type ModeloSerie = {
  tipo: string
  r2: number | null
  coeficientes: CoeficientesLben
}

export type LineaBaseBloque = {
  bloqueId: string
  edificacionId: string
  modelos: ModeloSerie[]
}

export type EdificacionPeriodo = {
  edificacionId: string
  nombre: string
  consumoNormalizado: number
  costoCop: number
}

export interface EnergySummary {
  facturas: number
  ultimoPeriodo: string | null
  edificaciones: number
  bloques: number
  /** Histórico agregado, desc desde el servidor (≤12). */
  serie: SeriePeriodo[]
  ultimasFacturas: FacturaReciente[]
  lineasBase: LineaBaseBloque[]
  /** Consumo/costo por edificación del último período (si existe). */
  periodoActual: EdificacionPeriodo[] | null
  /** Ídem del período anterior (para deltas); null si no existe. */
  periodoPrevio: EdificacionPeriodo[] | null
}

// ───────────────────────────────────────────────────────── salida (view-model)

export type KpiVariacion = { valor: number | null; deltaPct: number | null }

export type FilaDistribucion = {
  clave: string
  etiqueta: string
  valor: number
  sharePct: number
  /** Δ vs el período anterior de la misma edificación; null sin base. */
  delta?: number | null
  textoValor: string
}

export type FilaFactura = FacturaReciente & { conLineaBase: boolean }

export type FilaRanking = {
  clave: string
  nombre: string
  ahorroKwh: number
  ahorroPct: number
  costoCop: number
}

export type ResumenDashboard = {
  periodoActual: string | null
  /** Ascendente (antiguo → reciente), ≤12 puntos. */
  serie: { periodo: string; consumo: number; costo: number }[]
  /** LBEn agregada alineada a `serie`; null donde no hay cobertura. */
  serieLb: (number | null)[]
  consumo: KpiVariacion
  costo: KpiVariacion
  /** LB − consumo del último período; null sin cobertura (nunca inventado). */
  ahorro: { kwh: number; pct: number; lbKwh: number } | null
  cobertura: { bloquesConLb: number; bloquesTotales: number }
  distribucion: FilaDistribucion[]
  facturas: FilaFactura[]
  ranking: FilaRanking[]
}

export const SERIE_MAX = 12
export const FACTURAS_MAX = 6
export const RANKING_MAX = 5

// ───────────────────────────────────────────────────────────── formateadores

const fmtEntero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

/** 1234567 → «$ 1.234.567» (COP, sin decimales). */
export function formatoCop(valor: number): string {
  return `$ ${fmtEntero.format(Math.round(valor))}`
}

/** 45800 → «45.800 kWh». */
export function formatoKwh(valor: number, decimales = 0): string {
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: decimales }).format(valor)} kWh`
}

/** −1.4 → «−1,4 %»; 3.2 → «+3,2 %» (siempre con signo). */
export function formatoDelta(valor: number): string {
  const signo = valor < 0 ? '−' : '+'
  return `${signo}${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(valor))} %`
}

/** 'YYYY-MM' → índice de mes 0-based (fallback 0 si el formato falla). */
export function indiceMes(periodo: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo)
  if (!m) return 0
  const mes = Number(m[2])
  return mes >= 1 && mes <= 12 ? mes - 1 : 0
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** '2026-08' → 'ago 26' (eje X compacto); devuelve el período si no parsea. */
export function etiquetaPeriodoCorta(periodo: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo)
  if (!m) return periodo
  const mes = Number(m[2])
  if (mes < 1 || mes > 12) return periodo
  return `${MESES_CORTOS[mes - 1]} ${m[1].slice(2)}`
}

// ──────────────────────────────────────────────── selección de línea base

/**
 * ¿Existe una serie mensual utilizable en este modelo guardado?
 *  - `lben_mensual` con ≥1 valor numérico: sí (cualquier tipo que lo guarde).
 *  - Plano por tipo: cociente/confort/valor absoluto tienen kWh/mes propio.
 *  - Regresión sin `lben_mensual`: no (sus predicciones no se persisten).
 */
export function modeloUtilizable(m: ModeloSerie): boolean {
  return serieMensualModelo(m) !== null
}

/** Serie mensual (12) de un modelo; null si el modelo no la expone. */
export function serieMensualModelo(m: ModeloSerie): (number | null)[] | null {
  const c = m.coeficientes ?? {}
  const lben = Array.isArray(c.lben_mensual) ? c.lben_mensual : null
  if (lben && lben.some((v) => typeof v === 'number' && Number.isFinite(v))) {
    const serie: (number | null)[] = Array.from({ length: 12 }, (_, i) => {
      const v = lben[i]
      return typeof v === 'number' && Number.isFinite(v) ? v : null
    })
    return serie
  }
  const plano =
    m.tipo === 'cociente'
      ? c.consumo_promedio
      : m.tipo === 'confort'
        ? c.consumo_base_kwh
        : m.tipo === 'valor_absoluto'
          ? c.consumo_promedio_mensual
          : undefined
  if (typeof plano === 'number' && Number.isFinite(plano) && plano > 0) {
    return Array.from({ length: 12 }, () => plano)
  }
  return null
}

/** Mejor modelo usable del bloque: mayor R² (nulls al final), desempate por tipo. */
export function mejorModelo(modelos: readonly ModeloSerie[]): ModeloSerie | null {
  const usables = modelos.filter(modeloUtilizable)
  if (usables.length === 0) return null
  const orden = [...usables].sort((a, b) => {
    const r2a = typeof a.r2 === 'number' ? a.r2 : Number.NEGATIVE_INFINITY
    const r2b = typeof b.r2 === 'number' ? b.r2 : Number.NEGATIVE_INFINITY
    if (r2a !== r2b) return r2b - r2a
    return a.tipo.localeCompare(b.tipo)
  })
  return orden[0]
}

// ─────────────────────────────────────────────────────────── construcción

function deltaPct(actual: number | null, previo: number | null): number | null {
  if (actual === null || previo === null || !(previo > 0)) return null
  return (actual / previo - 1) * 100
}

/**
 * Construye el resumen completo a partir de los agregados del servidor.
 * Determinista y sin efectos: cualquier hueco se vuelve `null`/lista vacía.
 */
export function construirResumen(energy: EnergySummary): ResumenDashboard {
  const serieAsc = [...energy.serie]
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .slice(-SERIE_MAX)

  // Mejor modelo por bloque → contribución mensual por edificación.
  const modeloPorBloque = energy.lineasBase.map((lb) => ({
    edificacionId: lb.edificacionId,
    modelo: mejorModelo(lb.modelos),
  }))
  const bloquesConLb = modeloPorBloque.filter((b) => b.modelo !== null).length
  const conLb = new Set(
    modeloPorBloque.filter((b) => b.modelo !== null).map((b) => b.edificacionId)
  )

  const lbDeMes = (mes: number): number | null => {
    let suma = 0
    let hay = false
    for (const { modelo } of modeloPorBloque) {
      if (!modelo) continue
      const v = serieMensualModelo(modelo)?.[mes]
      if (typeof v === 'number' && Number.isFinite(v)) {
        suma += v
        hay = true
      }
    }
    return hay ? suma : null
  }

  const serie = serieAsc.map((p) => ({
    periodo: p.periodo,
    consumo: p.consumoNormalizado,
    costo: p.costoCop,
  }))
  const serieLb = serieAsc.map((p) => lbDeMes(indiceMes(p.periodo)))

  const ultimo = serie[serie.length - 1] ?? null
  const previo = serie[serie.length - 2] ?? null

  const consumo: KpiVariacion = {
    valor: ultimo ? ultimo.consumo : null,
    deltaPct: ultimo && previo ? deltaPct(ultimo.consumo, previo.consumo) : null,
  }
  const costo: KpiVariacion = {
    valor: ultimo ? ultimo.costo : null,
    deltaPct: ultimo && previo ? deltaPct(ultimo.costo, previo.costo) : null,
  }

  const lbUltimo = ultimo ? lbDeMes(indiceMes(ultimo.periodo)) : null
  const ahorro =
    ultimo && lbUltimo !== null && lbUltimo > 0
      ? { kwh: lbUltimo - ultimo.consumo, pct: ((lbUltimo - ultimo.consumo) / lbUltimo) * 100, lbKwh: lbUltimo }
      : null

  // Distribución del último período por edificación (desc por consumo),
  // con Δ real vs el período anterior de cada edificación.
  const previoPorEdif = new Map(
    (energy.periodoPrevio ?? []).map((e) => [e.edificacionId, e] as const)
  )
  const actuales = energy.periodoActual ?? []
  const totalConsumo = actuales.reduce((s, e) => s + e.consumoNormalizado, 0)
  const distribucion: FilaDistribucion[] = [...actuales]
    .sort((a, b) => b.consumoNormalizado - a.consumoNormalizado)
    .map((e) => ({
      clave: e.edificacionId,
      etiqueta: e.nombre,
      valor: e.consumoNormalizado,
      sharePct: totalConsumo > 0 ? (e.consumoNormalizado / totalConsumo) * 100 : 0,
      delta: deltaPct(
        e.consumoNormalizado,
        previoPorEdif.get(e.edificacionId)?.consumoNormalizado ?? null
      ),
      textoValor: `${formatoKwh(e.consumoNormalizado)} · ${new Intl.NumberFormat('es-CO', {
        maximumFractionDigits: 0,
      }).format(totalConsumo > 0 ? (e.consumoNormalizado / totalConsumo) * 100 : 0)} %`,
    }))

  // Últimas facturas + badge factual de cobertura de línea base.
  const facturas: FilaFactura[] = energy.ultimasFacturas.map((f) => ({
    ...f,
    conLineaBase: conLb.has(f.edificacionId),
  }))

  // Ranking por ahorro vs línea base del último período (con costo junto).
  const ranking: FilaRanking[] = actuales
    .map((e) => {
      if (!conLb.has(e.edificacionId)) return null
      // LB de la edificación = suma de sus bloques con modelo usable.
      const mes = indiceMes(energy.ultimoPeriodo ?? '')
      const lbEdif = modeloPorBloque.reduce((s, b) => {
        if (b.edificacionId !== e.edificacionId || !b.modelo) return s
        const v = serieMensualModelo(b.modelo)?.[mes]
        return typeof v === 'number' && Number.isFinite(v) ? s + v : s
      }, 0)
      if (lbEdif <= 0) return null
      const ahorroKwh = lbEdif - e.consumoNormalizado
      return {
        clave: e.edificacionId,
        nombre: e.nombre,
        ahorroKwh,
        ahorroPct: (ahorroKwh / lbEdif) * 100,
        costoCop: e.costoCop,
      }
    })
    .filter((f): f is FilaRanking => f !== null)
    .sort((a, b) => b.ahorroKwh - a.ahorroKwh)
    .slice(0, RANKING_MAX)

  return {
    periodoActual: energy.ultimoPeriodo,
    serie,
    serieLb,
    consumo,
    costo,
    ahorro,
    cobertura: { bloquesConLb, bloquesTotales: energy.bloques },
    distribucion,
    facturas,
    ranking,
  }
}
