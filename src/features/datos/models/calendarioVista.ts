/**
 * Helpers puros de fecha para las vistas del calendario (S5/S6, Fase 6).
 *
 * Todo el cálculo es UTC civil sobre `YYYY-MM-DD` (sin horas y sin zona
 * horaria): la vista semanal y la agenda se computan en cliente a partir del
 * catálogo determinista de `festivos.ts`, sin requests ni estado remoto
 * (impacto cero en el despliegue serverless de Vercel).
 */

import { festivosDelMes, type Festivo } from './festivos'
import { CATALOGO_TIPOS_EVENTO } from './eventos'

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
 * Tipo de item de la agenda: festivos nacionales (S6) y eventos del árbol de
 * la edificación seleccionada (S9 — herencia S8 ya aplicada por el llamador).
 */
export type TipoItemAgenda = 'FESTIVO' | 'EVENTO'

/** Item de la agenda: un evento concreto de una fecha `YYYY-MM-DD`. */
export interface ItemAgenda {
  fecha: string
  tipo: TipoItemAgenda
  titulo: string
  /** Aclaración opcional (p. ej. la regla de traslado de un festivo). */
  detalle?: string
  /** Origen visible como badge (FIJO | EMILIANI | PASCUA para festivos). */
  origen?: string
  /** Punto de color del tipo de evento (clase AA del catálogo; solo EVENTO). */
  punto?: string
  /** Etiqueta del tipo de evento («Institucional»…; solo EVENTO). */
  etiquetaTipo?: string
  /** Nivel + objetivo del ámbito (badge; solo EVENTO). */
  ambito?: string
}

/**
 * Evento (S7/S8) ya filtrado para el contexto del calendario, con fechas ISO
 * `YYYY-MM-DD` y la etiqueta de ámbito opcional para el badge de la agenda.
 */
export interface EventoAgenda {
  tipo: string
  nombre: string
  descripcion?: string | null
  /** `YYYY-MM-DD`. */
  fechaInicio: string
  /** `YYYY-MM-DD`; null/anterior = día único. */
  fechaFin?: string | null
  /** Nivel + objetivo del ámbito para el badge (ver `etiquetaAmbitoDeEvento`). */
  ambito?: string | null
}

/** Evento mínimo que la vista dibuja por fecha (celdas, semana y agenda). */
export interface ItemFechaEvento {
  id: string
  /** `CATALOGO_TIPOS_EVENTO`. */
  tipo: string
  nombre: string
  /** `YYYY-MM-DD`. */
  fechaInicio: string
  /** `YYYY-MM-DD`; null/anterior = día único. */
  fechaFin?: string | null
}

const detalleDelFestivo = (f: Festivo): string | undefined => {
  if (f.origen === 'EMILIANI') return 'Descanso trasladado al lunes siguiente (Ley Emiliani)'
  if (f.origen === 'PASCUA') return 'Fecha movible según el domingo de Pascua'
  return undefined
}

/** Clase del punto de color de un tipo de evento (token de marca AA). */
export const puntoDeTipoEvento = (codigo: string): string =>
  CATALOGO_TIPOS_EVENTO.find((t) => t.codigo === codigo)?.punto ?? 'bg-uv-mid'

/** Etiqueta del tipo de evento (chip/badge neutro). */
export const etiquetaDeTipoEvento = (codigo: string): string =>
  CATALOGO_TIPOS_EVENTO.find((t) => t.codigo === codigo)?.etiqueta ?? codigo

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Items de la agenda de un mes (1-12), ordenados por fecha. Festivos del
 * catálogo puro + los eventos visibles (S9), expandidos sobre cada día que
 * cubren su rango (inclusivo); un mismo día agrupa festivo y eventos, con el
 * festivo primero. Sin eventos el comportamiento es el de S6.
 */
export function itemsDeAgenda(
  ano: number,
  mes: number,
  eventos: EventoAgenda[] = []
): ItemAgenda[] {
  const items: ItemAgenda[] = festivosDelMes(ano, mes).map((f) => ({
    fecha: f.fecha,
    tipo: 'FESTIVO' as const,
    titulo: f.nombre,
    detalle: detalleDelFestivo(f),
    origen: f.origen,
  }))

  const prefijo = `${ano}-${pad(mes)}`
  eventos.forEach((ev) => {
    if (!FECHA_ISO.test(ev.fechaInicio)) return
    const fin =
      ev.fechaFin && FECHA_ISO.test(ev.fechaFin) && ev.fechaFin > ev.fechaInicio
        ? ev.fechaFin
        : ev.fechaInicio
    let fecha = ev.fechaInicio
    while (fecha <= fin) {
      if (fecha.startsWith(prefijo)) {
        items.push({
          fecha,
          tipo: 'EVENTO',
          titulo: ev.nombre,
          detalle: ev.descripcion ?? undefined,
          punto: puntoDeTipoEvento(ev.tipo),
          etiquetaTipo: etiquetaDeTipoEvento(ev.tipo),
          ambito: ev.ambito ?? undefined,
        })
      }
      if (fecha === fin) break
      fecha = sumarDiasIso(fecha, 1)
    }
  })

  // Orden cronológico; en un mismo día, festivos antes que eventos y luego
  // por nombre (el sort es estable, pero el tiebreak lo hace determinista).
  const peso = (i: ItemAgenda): number => (i.tipo === 'FESTIVO' ? 0 : 1)
  return items.sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) || peso(a) - peso(b) || a.titulo.localeCompare(b.titulo)
  )
}

/**
 * Mapa `fecha → eventos` (S9) para las celdas mensuales y las columnas
 * semanales: cada evento se expande sobre TODOS los días de su rango
 * (inclusivo; null/anterior en `fechaFin` = día único). Falla seguro con
 * fechas mal formadas (no las expande). La lista de cada día queda ordenada
 * por tipo y nombre (determinista, sin depender del orden de entrada).
 */
export function eventosPorFecha(
  eventos: ItemFechaEvento[]
): Map<string, ItemFechaEvento[]> {
  const mapa = new Map<string, ItemFechaEvento[]>()
  eventos.forEach((ev) => {
    if (!FECHA_ISO.test(ev.fechaInicio)) return
    const fin =
      ev.fechaFin && FECHA_ISO.test(ev.fechaFin) && ev.fechaFin > ev.fechaInicio
        ? ev.fechaFin
        : ev.fechaInicio
    let fecha = ev.fechaInicio
    while (fecha <= fin) {
      const delDia = mapa.get(fecha)
      if (delDia) {
        delDia.push(ev)
      } else {
        mapa.set(fecha, [ev])
      }
      if (fecha === fin) break
      fecha = sumarDiasIso(fecha, 1)
    }
  })
  mapa.forEach((lista) =>
    lista.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nombre.localeCompare(b.nombre))
  )
  return mapa
}
