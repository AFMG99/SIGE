/**
 * Eventos del calendario por edificación (S7/S8 — Fase 6, slice 6c).
 *
 * Un evento = un tipo del catálogo (institucional, académico, mantenimiento o
 * excepción) + nombre + descripción opcional + rango de ocurrencia
 * (`fechaInicio` / `fechaFin` opcional = día único; NO hay segunda ventana de
 * validez: el rango de fechas ES la vigencia, pin L8) + ámbito jerárquico con
 * la misma cascada que los horarios (edificación → bloque → espacio → equipo).
 *
 * La herencia (S8) es una función pura: un evento de un nivel superior se ve
 * en sus niveles inferiores (ancestro-o-propio); nunca cruza el árbol de otra
 * edificación y no hay mecanismos de exclusión.
 */

import { z } from 'zod'
import type { CodigoAmbito } from './horarios'

// ============================================================
// Catálogo de tipos de evento (S7)
// ============================================================

export type TipoEvento = 'INSTITUCIONAL' | 'ACADEMICO' | 'MANTENIMIENTO' | 'EXCEPCION'

export interface TipoEventoInfo {
  codigo: TipoEvento
  etiqueta: string
  /** Clase del punto de color (token de marca AA; el texto de la etiqueta queda neutro). */
  punto: string
}

export const CATALOGO_TIPOS_EVENTO: TipoEventoInfo[] = [
  { codigo: 'INSTITUCIONAL', etiqueta: 'Institucional', punto: 'bg-uv-forest' },
  { codigo: 'ACADEMICO', etiqueta: 'Académico', punto: 'bg-uv-purple' },
  { codigo: 'MANTENIMIENTO', etiqueta: 'Mantenimiento', punto: 'bg-uv-turquoise' },
  { codigo: 'EXCEPCION', etiqueta: 'Excepción', punto: 'bg-uv-deep' },
]

const TIPOS = CATALOGO_TIPOS_EVENTO.map((t) => t.codigo) as [
  'INSTITUCIONAL', 'ACADEMICO', 'MANTENIMIENTO', 'EXCEPCION',
]

// ============================================================
// Validación (server + client) — misma convención que los horarios
// ============================================================

/** Id de un nivel jerárquico; cadena vacía/nula = sin seleccionar. */
const idOpcional = z
  .string()
  .trim()
  .max(64)
  .nullish()
  .transform((v) => (v && v.trim() ? v.trim() : null))

const fechaRequerida = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (use AAAA-MM-DD)')

/** Fecha `YYYY-MM-DD` opcional; vacía/nula = día único (sin `fechaFin`). */
const fechaOpcional = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  fechaRequerida.nullable()
)

/** Ámbito jerárquico del evento: el nivel activo es el más específico de la cascada. */
export interface AmbitoEvento {
  bloqueId?: string | null
  espacioId?: string | null
  equipoId?: string | null
}

const cascadaValida = (ambito?: AmbitoEvento): boolean => {
  if (!ambito) return true
  if (ambito.equipoId && (!ambito.espacioId || !ambito.bloqueId)) return false
  if (ambito.espacioId && !ambito.bloqueId) return false
  return true
}

export const eventoSchema = z
  .object({
    tipo: z.enum(TIPOS, { errorMap: () => ({ message: 'Tipo de evento inválido.' }) }),
    nombre: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(120, 'El nombre no puede superar los 120 caracteres'),
    descripcion: z
      .string()
      .trim()
      .max(500, 'La descripción no puede superar los 500 caracteres')
      .nullish()
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    fechaInicio: fechaRequerida,
    fechaFin: fechaOpcional.optional(),
    ambito: z
      .object({ bloqueId: idOpcional, espacioId: idOpcional, equipoId: idOpcional })
      .optional(),
  })
  .refine((v) => !v.fechaFin || v.fechaFin >= v.fechaInicio, {
    message: 'La fecha final debe ser posterior o igual a la inicial',
    path: ['fechaFin'],
  })
  .refine((v) => cascadaValida(v.ambito), {
    message:
      'La selección jerárquica está incompleta: un equipo requiere su espacio y su bloque, y un espacio requiere su bloque.',
    path: ['ambito'],
  })

export type EventoInput = z.infer<typeof eventoSchema>

// ============================================================
// Herencia por niveles (S8) — función pura
// ============================================================

/** Contexto jerárquico desde el que se consulta (ids exactos por nivel). */
export interface ContextoEvento {
  edificacionId: string
  bloqueId?: string | null
  espacioId?: string | null
  equipoId?: string | null
}

/**
 * Campos de ámbito en forma plana que necesita la herencia: la fila de BD
 * (`evento`) y `EventoInfo` cumplen esta forma estructuralmente; el dominio no
 * conoce Prisma ni la UI.
 */
export interface EventoConAmbito {
  edificacionId: string
  bloqueId?: string | null
  espacioId?: string | null
  equipoId?: string | null
}

/** Nivel activo de un evento: el más específico de la cascada (igual que los horarios). */
export function nivelDeEvento(e: EventoConAmbito): CodigoAmbito {
  return e.equipoId ? 'EQUIPO' : e.espacioId ? 'ESPACIO' : e.bloqueId ? 'BLOQUE' : 'EDIFICACION'
}

/**
 * Herencia de eventos (S8): un evento es visible para un contexto cuando su
 * ámbito es el contexto mismo o uno de sus ANCESTROS — un evento de
 * edificación se ve en toda su descendencia, uno de bloque en sus espacios y
 * equipos, uno de espacio en sus equipos y uno de equipo solo en sí mismo.
 * Nunca cruza a otra edificación (el `edificacionId` siempre debe coincidir)
 * y un contexto parcial (p. ej. solo edificación) no ve los niveles por
 * debajo de su alcance. Conserva el orden de entrada. Sin coincidencias: `[]`.
 */
export function eventosVisiblesPara<T extends EventoConAmbito>(
  eventos: T[],
  contexto: ContextoEvento
): T[] {
  return eventos.filter((evento) => {
    if (evento.edificacionId !== contexto.edificacionId) return false
    const nivel = nivelDeEvento(evento)
    if (nivel === 'EQUIPO') return !!contexto.equipoId && evento.equipoId === contexto.equipoId
    if (nivel === 'ESPACIO') return !!contexto.espacioId && evento.espacioId === contexto.espacioId
    if (nivel === 'BLOQUE') return !!contexto.bloqueId && evento.bloqueId === contexto.bloqueId
    return true
  })
}

// ============================================================
// Presentación
// ============================================================

const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

/**
 * Rango de ocurrencia en es-CO: «15 nov» (día único), «15–20 nov» (mismo
 * mes), «15 nov – 2 dic» (mismo año) o «30 dic 2025 – 2 ene 2026» (cruza año).
 */
export function formatearRangoEvento(fechaInicio: string, fechaFin: string | null): string {
  const [a1, m1, d1] = fechaInicio.split('-')
  const dia1 = Number(d1)
  const mes1 = MESES_CORTOS[Number(m1) - 1] ?? m1
  if (!fechaFin || fechaFin === fechaInicio) return `${dia1} ${mes1}`

  const [a2, m2, d2] = fechaFin.split('-')
  const dia2 = Number(d2)
  const mes2 = MESES_CORTOS[Number(m2) - 1] ?? m2
  if (a1 === a2 && m1 === m2) return `${dia1}–${dia2} ${mes1}`
  if (a1 === a2) return `${dia1} ${mes1} – ${dia2} ${mes2}`
  return `${dia1} ${mes1} ${a1} – ${dia2} ${mes2} ${a2}`
}

// ============================================================
// View-model serializable (props de la vista)
// ============================================================

/** Evento guardado con fechas ISO `YYYY-MM-DD` (para props server → client). */
export interface EventoInfo {
  id: string
  edificacionId: string
  /** `CATALOGO_TIPOS_EVENTO`. */
  tipo: string
  nombre: string
  descripcion: string | null
  /** `YYYY-MM-DD`. */
  fechaInicio: string
  /** `YYYY-MM-DD`; null = día único. */
  fechaFin: string | null
  /** Ámbito jerárquico: vacío/null = edificación completa. */
  bloqueId?: string | null
  espacioId?: string | null
  equipoId?: string | null
}
