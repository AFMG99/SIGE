/**
 * Festivos nacionales de Colombia — catálogo determinista (sin API ni fetch).
 *
 * Fuentes legales: Ley 51 de 1983 (Ley Emiliani: traslado al lunes siguiente),
 * Ley 2578 de 2026 (Día de Nuestra Señora del Rosario de Chiquinquirá, aplica
 * desde 2026) y el cálculo movible por el domingo de Pascua. La salida del año
 * 2026 está fijada por test golden contra el calendario oficial del MinHacienda
 * (`festivos.test.ts`), con 19 festivos.
 *
 * Se computa en O(1) por año en cliente o servidor: la vista mensual no hace
 * requests (optimización para el despliegue serverless en Vercel).
 */

export interface Festivo {
  /** Fecha observada del descanso, formato `YYYY-MM-DD`. */
  fecha: string
  nombre: string
  /** Por qué esa fecha: fija en el año, trasladada por la Emiliani o por Pascua. */
  origen: 'FIJO' | 'EMILIANI' | 'PASCUA'
}

const pad = (n: number): string => String(n).padStart(2, '0')

const iso = (ano: number, mes: number, dia: number): string =>
  `${ano}-${pad(mes)}-${pad(dia)}`

/** Suma `delta` días a una fecha civil usando UTC (sin sorpresas de zona horaria). */
const masDias = (ano: number, mes: number, dia: number, delta: number): Date =>
  new Date(Date.UTC(ano, mes - 1, dia + delta))

/**
 * Domingo de Resurrección (algoritmo gregoriano de Meeus/Jones/Butcher).
 * Devuelve `YYYY-MM-DD`.
 */
export function pascua(ano: number): string {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return iso(ano, mes, dia)
}

/** Ley Emiliani: el descanso se vive el lunes siguiente (si ya es lunes, se queda). */
const emiliani = (ano: number, mes: number, dia: number): { fecha: string; dia: number; mes: number } => {
  const original = masDias(ano, mes, dia, 0)
  const delta = (1 - original.getUTCDay() + 7) % 7
  const observado = masDias(ano, mes, dia, delta)
  return {
    fecha: `${observado.getUTCFullYear()}-${pad(observado.getUTCMonth() + 1)}-${pad(observado.getUTCDate())}`,
    dia: observado.getUTCDate(),
    mes: observado.getUTCMonth() + 1,
  }
}

/** Festivos de fecha fija que NO se traslada a lunes. */
const FIJOS: { mes: number; dia: number; nombre: string }[] = [
  { mes: 1, dia: 1, nombre: 'Año Nuevo' },
  { mes: 5, dia: 1, nombre: 'Día del Trabajo' },
  { mes: 7, dia: 20, nombre: 'Día de la Independencia' },
  { mes: 8, dia: 7, nombre: 'Batalla de Boyacá' },
  { mes: 12, dia: 8, nombre: 'Inmaculada Concepción' },
  { mes: 12, dia: 25, nombre: 'Navidad' },
]

/** Festivos de fecha fija sujetos a la Ley Emiliani (lunes siguiente). */
const EMMILIANI: { mes: number; dia: number; nombre: string; desde?: number }[] = [
  { mes: 1, dia: 6, nombre: 'Día de los Reyes Magos' },
  { mes: 3, dia: 19, nombre: 'Día de San José' },
  { mes: 6, dia: 29, nombre: 'San Pedro y San Pablo' },
  // Ley 2578 de 2026: conmemoración el 9 de julio, descanso desde 2026.
  { mes: 7, dia: 9, nombre: 'Nuestra Señora del Rosario de Chiquinquirá', desde: 2026 },
  { mes: 8, dia: 15, nombre: 'Asunción de la Virgen' },
  { mes: 10, dia: 12, nombre: 'Día de la Diversidad Étnica y Cultural' },
  { mes: 11, dia: 1, nombre: 'Todos los Santos' },
  { mes: 11, dia: 11, nombre: 'Independencia de Cartagena' },
]

/** Festivos móviles calculados desde el domingo de Pascua. */
const MOVIBLES: { offset: number; nombre: string; lunes: boolean }[] = [
  { offset: -3, nombre: 'Jueves Santo', lunes: false },
  { offset: -2, nombre: 'Viernes Santo', lunes: false },
  { offset: 39, nombre: 'Ascensión del Señor', lunes: true },
  { offset: 60, nombre: 'Corpus Christi', lunes: true },
  { offset: 68, nombre: 'Sagrado Corazón de Jesús', lunes: true },
]

/** Los 19 (o menos, antes de 2026) festivos nacionales del año, ordenados. */
export function festivosDelAno(ano: number): Festivo[] {
  const lista: Festivo[] = []

  for (const f of FIJOS) {
    lista.push({ fecha: iso(ano, f.mes, f.dia), nombre: f.nombre, origen: 'FIJO' })
  }

  for (const f of EMMILIANI) {
    if (f.desde != null && ano < f.desde) continue
    lista.push({ fecha: emiliani(ano, f.mes, f.dia).fecha, nombre: f.nombre, origen: 'EMILIANI' })
  }

  const [pAno, pMes, pDia] = pascua(ano).split('-').map(Number)
  for (const m of MOVIBLES) {
    const original = masDias(pAno, pMes, pDia, m.offset)
    const fecha = m.lunes
      ? emiliani(original.getUTCFullYear(), original.getUTCMonth() + 1, original.getUTCDate()).fecha
      : `${original.getUTCFullYear()}-${pad(original.getUTCMonth() + 1)}-${pad(original.getUTCDate())}`
    lista.push({ fecha, nombre: m.nombre, origen: 'PASCUA' })
  }

  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** Festivos observados en un mes concreto (1-12). */
export function festivosDelMes(ano: number, mes: number): Festivo[] {
  const prefijo = `${ano}-${pad(mes)}`
  return festivosDelAno(ano).filter((f) => f.fecha.startsWith(prefijo))
}

const cacheAnos = new Map<number, Set<string>>()

/** ¿Es `fecha` (`YYYY-MM-DD`) festivo nacional? */
export function esFestivo(fecha: string): boolean {
  const ano = Number(fecha.slice(0, 4))
  if (!Number.isFinite(ano)) return false
  let set = cacheAnos.get(ano)
  if (!set) {
    set = new Set(festivosDelAno(ano).map((f) => f.fecha))
    cacheAnos.set(ano, set)
  }
  return set.has(fecha)
}
