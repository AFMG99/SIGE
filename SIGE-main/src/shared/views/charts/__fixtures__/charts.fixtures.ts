/**
 * Fixtures deterministas de los gráficos compartidos (T1).
 * Datos sintéticos SOLO para stories/tests: la UI real recibe datos reales
 * del servidor (S2 — nunca inventar cifras en producción).
 */

/** 12 meses de consumo real vs línea base (kWh/mes), con un hueco. */
export const ETIQUETAS_12M = [
  'sep 25', 'oct 25', 'nov 25', 'dic 25',
  'ene 26', 'feb 26', 'mar 26', 'abr 26',
  'may 26', 'jun 26', 'jul 26', 'ago 26',
]

export const CONSUMO_12M = [
  41200, 43800, 45100, 38900,
  47600, 46200, 44800, null,
  42100, 40900, 43300, 45800,
]

export const LINEA_BASE_12M = [
  44000, 44000, 44000, 44000,
  44000, 44000, 44000, 44000,
  44000, 44000, 44000, 44000,
]

export const INDICE_XM = [
  100, 101.4, 99.8, 96.2, 103.1, 104.5,
  102.9, 101.2, 99.1, 98.4, 100.6, 102.3,
]

/** Barras: consumo del último período por edificación (kWh + Δ mensual). */
export const BARRAS_EDIFICACION = [
  { clave: 'campus-norte', etiqueta: 'Campus Norte', valor: 18420, delta: 3.2 },
  { clave: 'bloque-admin', etiqueta: 'Bloque Administrativo', valor: 11870, delta: -1.4 },
  { clave: 'residencia', etiqueta: 'Residencia Estudiantil', valor: 9640, delta: 8.7 },
  { clave: 'biblioteca', etiqueta: 'Biblioteca Central', valor: 5890, delta: -0.6 },
]

export const SERIE_PLANES_24M = Array.from({ length: 24 }, (_, i) =>
  40000 + Math.round(Math.sin(i / 3.5) * 2600) + i * 90
)
