/**
 * Helpers puros de fecha para las vistas del calendario (S5/S6, Fase 6).
 *
 * Todo el cálculo es UTC civil sobre `YYYY-MM-DD` (sin horas y sin zona
 * horaria): la vista semanal y la agenda se computan en cliente a partir del
 * catálogo determinista de `festivos.ts`, sin requests ni estado remoto
 * (impacto cero en el despliegue serverless de Vercel).
 */

import { festivosDelMes, type Festivo } from './festivos'

const pad = (n: number): string => String(n).padStart(2, '0')

/** Fecha local de hoy en formato `YYYY-MM-DD` (solo día civil). */
export function isoDeHoy(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Suma `delta` días a una fecha civil `YYYY-MM-DD` usando UTC. */
export function sumarDiasIso(iso: string, delta: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, dia + delta))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Semana civil (lunes→domingo) que contiene `anchorIso`: 7 fechas ISO. */
export function fechasDeLaSemana(anchorIso: string): string[] {
  const [ano, mes, dia] = anchorIso.split('-').map(Number)
  const lunes = new Date(Date.UTC(ano, mes - 1, dia))
  // Índice lunes-primero: ((getUTCDay() + 6) % 7), igual que la rejilla mensual.
  lunes.setUTCDate(lunes.getUTCDate() - ((lunes.getUTCDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => sumarDiasIso(
    `${lunes.getUTCFullYear()}-${pad(lunes.getUTCMonth() + 1)}-${pad(lunes.getUTCDate())}`,
    i
  ))
}

/**
 * Ancla por defecto de la vista semanal para un mes referido: hoy si cae en
 * ese mes, si no el día 1 del mes referido.
 */
export function anclaDeSemana(mes: number, ano: number, hoy: string): string {
  return hoy.startsWith(`${ano}-${pad(mes)}`) ? hoy : `${ano}-${pad(mes)}-01`
}

/**
 * Tipo de item de la agenda. Hoy solo existen los festivos nacionales; los
 * eventos institucionales/académicos/mantenimiento (T7) y los días lectivos
 * (T8) ampliarán este gremio sin tocar el renderizado por día.
 */
export type TipoItemAgenda = 'FESTIVO'

/** Item de la agenda: un evento concreto de una fecha `YYYY-MM-DD`. */
export interface ItemAgenda {
  fecha: string
  tipo: TipoItemAgenda
  titulo: string
  /** Aclaración opcional (p. ej. la regla de traslado de un festivo). */
  detalle?: string
  /** Origen visible como badge (FIJO | EMILIANI | PASCUA para festivos). */
  origen?: string
}

const detalleDelFestivo = (f: Festivo): string | undefined => {
  if (f.origen === 'EMILIANI') return 'Descanso trasladado al lunes siguiente (Ley Emiliani)'
  if (f.origen === 'PASCUA') return 'Fecha movible según el domingo de Pascua'
  return undefined
}

/**
 * Items de la agenda de un mes (1-12), ordenados por fecha. Hoy la agenda se
 * alimenta solo de `festivosDelMes` (ya ordenado cronológicamente).
 */
export function itemsDeAgenda(ano: number, mes: number): ItemAgenda[] {
  return festivosDelMes(ano, mes).map((f) => ({
    fecha: f.fecha,
    tipo: 'FESTIVO' as const,
    titulo: f.nombre,
    detalle: detalleDelFestivo(f),
    origen: f.origen,
  }))
}
