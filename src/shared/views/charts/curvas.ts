/**
 * Geometría pura de los gráficos SVG compartidos (dashboard + análisis).
 *
 * Sin React ni DOM: funciones testeadas en `curvas.test.ts`. Las unidades son
 * coordenadas del viewBox (no píxeles): el escalado lo resuelve el SVG.
 */

export type PuntoXY = { x: number; y: number }

function pasoBonito(bruto: number): number {
  const exp = Math.floor(Math.log10(bruto))
  const base = Math.pow(10, exp)
  const fraccion = bruto / base
  const bonito = fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10
  return bonito * base
}

/**
 * Ticks del eje Y con paso «bonito» (1/2/5×10ᵏ) dentro de [min, max].
 * Máximo 12 ticks; devuelve [min] si el rango es degenerado.
 */
export function ticksBonitos(min: number, max: number, cantidad = 5): number[] {
  if (!(max > min)) return [min]
  const paso = pasoBonito((max - min) / Math.max(1, cantidad - 1))
  const inicio = Math.ceil(min / paso) * paso
  const ticks: number[] = []
  for (let v = inicio; v <= max + paso * 1e-6 && ticks.length < 12; v += paso) {
    ticks.push(Math.round(v / paso) * paso)
  }
  return ticks
}

/**
 * Rango [min, max] de una serie con margen simétrico (8 % por defecto).
 * `desdeCero` ancla el piso en 0 (barras/kWh acumulados); un rango plano se
 * expande alrededor del valor para evitar división por cero en la escala.
 */
export function limitesSerie(
  valores: readonly number[],
  opciones: { margen?: number; desdeCero?: boolean } = {}
): [number, number] {
  const { margen = 0.08, desdeCero = false } = opciones
  if (valores.length === 0) return [0, 1]
  let min = Math.min(...valores)
  let max = Math.max(...valores)
  if (desdeCero) min = Math.min(0, min)
  if (!(max > min)) {
    // Serie plana: abre un ±5 % (o ±1 si el valor es 0) para poder escalar.
    const centro = max
    const delta = Math.abs(centro) * 0.05 || 1
    return [centro - delta, centro + delta]
  }
  const amplitud = max - min
  if (desdeCero) return [0, max + amplitud * margen]
  return [min - amplitud * margen, max + amplitud * margen]
}

/**
 * Camino cúbico monotono (Fritsch–Carlson): curvas suaves que NUNCA
 * sobrepasan los datos — el estándar de las librerías de charts
 * profesionales, sin dependencia externa.
 */
export function caminoMonotono(puntos: readonly PuntoXY[]): string {
  const n = puntos.length
  if (n === 0) return ''
  if (n === 1) return `M${redondear(puntos[0].x)},${redondear(puntos[0].y)}`
  if (n === 2) {
    return `M${redondear(puntos[0].x)},${redondear(puntos[0].y)}L${redondear(puntos[1].x)},${redondear(puntos[1].y)}`
  }

  // Pendientes secante entre puntos consecutivos.
  const secantes: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const dx = puntos[i + 1].x - puntos[i].x
    secantes.push(dx === 0 ? 0 : (puntos[i + 1].y - puntos[i].y) / dx)
  }

  // Tangentes de Hermite con la condición de monotonía de Fritsch–Carlson.
  const tangentes: number[] = new Array(n)
  tangentes[0] = secantes[0]
  tangentes[n - 1] = secantes[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (secantes[i - 1] * secantes[i] <= 0) {
      tangentes[i] = 0
    } else {
      const hPrevio = puntos[i].x - puntos[i - 1].x
      const hSig = puntos[i + 1].x - puntos[i].x
      const w1 = 2 * hSig + hPrevio
      const w2 = hSig + 2 * hPrevio
      tangentes[i] = (w1 + w2) / (w1 / secantes[i - 1] + w2 / secantes[i])
    }
  }

  let camino = `M${redondear(puntos[0].x)},${redondear(puntos[0].y)}`
  for (let i = 0; i < n - 1; i++) {
    const h = puntos[i + 1].x - puntos[i].x
    const c1 = { x: puntos[i].x + h / 3, y: puntos[i].y + (tangentes[i] * h) / 3 }
    const c2 = { x: puntos[i + 1].x - h / 3, y: puntos[i + 1].y - (tangentes[i + 1] * h) / 3 }
    camino += `C${redondear(c1.x)},${redondear(c1.y)} ${redondear(c2.x)},${redondear(c2.y)} ${redondear(puntos[i + 1].x)},${redondear(puntos[i + 1].y)}`
  }
  return camino
}

/** Índices de los tramos continuos: un null/undefined/NaN rompe el tramo. */
export function tramosContinuos(
  valores: readonly (number | null | undefined)[]
): number[][] {
  const tramos: number[][] = []
  let actual: number[] = []
  valores.forEach((v, i) => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      actual.push(i)
    } else if (actual.length > 0) {
      tramos.push(actual)
      actual = []
    }
  })
  if (actual.length > 0) tramos.push(actual)
  return tramos
}

/** Coordenadas XY de un tramo de índices dado un mapeo de valores a Y. */
export function puntosTramo(
  indices: readonly number[],
  xDe: (i: number) => number,
  yDe: (v: number) => number,
  valores: readonly (number | null | undefined)[]
): PuntoXY[] {
  return indices.map((i) => ({ x: xDe(i), y: yDe(valores[i] as number) }))
}

/** 1234.5678 → «1234.6» sin romper con notación exponencial en cifras mínimas. */
function redondear(v: number): string {
  return (Math.round(v * 100) / 100).toString()
}
