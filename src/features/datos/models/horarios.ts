/**
 * Horarios de funcionamiento de equipos por edificación
 * (Resolución UPME 0016/2024, §7.1/§7.3: horarios de operación).
 *
 * Un horario = un grupo de equipos (nombre libre) + días de la semana +
 * una franja horaria diaria. La UI y el servidor comparten este catálogo
 * y estas validaciones.
 */

import { z } from 'zod'

// ============================================================
// Catálogo de días
// ============================================================

export interface DiaInfo {
  codigo: string
  etiqueta: string
  abrev: string
}

export const CATALOGO_DIAS: DiaInfo[] = [
  { codigo: 'LUN', etiqueta: 'Lunes', abrev: 'Lun' },
  { codigo: 'MAR', etiqueta: 'Martes', abrev: 'Mar' },
  { codigo: 'MIE', etiqueta: 'Miércoles', abrev: 'Mié' },
  { codigo: 'JUE', etiqueta: 'Jueves', abrev: 'Jue' },
  { codigo: 'VIE', etiqueta: 'Viernes', abrev: 'Vie' },
  { codigo: 'SAB', etiqueta: 'Sábado', abrev: 'Sáb' },
  { codigo: 'DOM', etiqueta: 'Domingo', abrev: 'Dom' },
]

const CODIGOS = CATALOGO_DIAS.map((d) => d.codigo) as [
  'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM',
]

// ============================================================
// Catálogo de ámbitos jerárquicos (S12)
// ============================================================

export type CodigoAmbito = 'EDIFICACION' | 'BLOQUE' | 'ESPACIO' | 'EQUIPO'

export interface AmbitoInfo {
  codigo: CodigoAmbito
  etiqueta: string
}

export const CATALOGO_AMBITOS: AmbitoInfo[] = [
  { codigo: 'EDIFICACION', etiqueta: 'Edificación completa' },
  { codigo: 'BLOQUE', etiqueta: 'Bloque' },
  { codigo: 'ESPACIO', etiqueta: 'Espacio / aula' },
  { codigo: 'EQUIPO', etiqueta: 'Equipo' },
]

// ============================================================
// Validación (server + client)
// ============================================================

/** Id de un nivel jerárquico; cadena vacía/nula = sin seleccionar. */
const idOpcional = z
  .string()
  .trim()
  .max(64)
  .nullish()
  .transform((v) => (v && v.trim() ? v.trim() : null))

/** Fecha `YYYY-MM-DD` opcional; vacía/nula = sin límite. */
const fechaOpcional = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (use AAAA-MM-DD)').nullable()
)

/**
 * Ámbito jerárquico del horario (S12): todos nulos = edificación completa;
 * si no, el nivel activo es el más específico de la cascada
 * equipo → espacio → bloque → edificación.
 */
export interface AmbitoHorario {
  bloqueId?: string | null
  espacioId?: string | null
  equipoId?: string | null
}

const cascadaValida = (ambito?: AmbitoHorario): boolean => {
  if (!ambito) return true
  if (ambito.equipoId && (!ambito.espacioId || !ambito.bloqueId)) return false
  if (ambito.espacioId && !ambito.bloqueId) return false
  return true
}

export const horarioEquipoSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(80, 'El nombre no puede superar los 80 caracteres'),
    diasSemana: z
      .array(z.enum(CODIGOS))
      .min(1, 'Seleccione al menos un día'),
    horaInicio: z.number().int().min(0).max(23),
    horaFin: z.number().int().min(1).max(24),
    ambito: z
      .object({ bloqueId: idOpcional, espacioId: idOpcional, equipoId: idOpcional })
      .optional(),
    desde: fechaOpcional.optional(),
    hasta: fechaOpcional.optional(),
  })
  .refine((v) => v.horaFin > v.horaInicio, {
    message: 'La hora final debe ser posterior a la inicial (sin cruce de medianoche)',
    path: ['horaFin'],
  })
  .refine((v) => cascadaValida(v.ambito), {
    message:
      'La selección jerárquica está incompleta: un equipo requiere su espacio y su bloque, y un espacio requiere su bloque.',
    path: ['ambito'],
  })
  .refine((v) => !v.desde || !v.hasta || v.desde <= v.hasta, {
    message: 'La fecha final de vigencia debe ser posterior o igual a la inicial',
    path: ['hasta'],
  })

export type HorarioEquipoInput = z.infer<typeof horarioEquipoSchema>

// ============================================================
// Ámbito y conflictos (S12)
// ============================================================

/** Identidad del ámbito por su nivel más específico (para agrupar/conflictos). */
export function claveAmbito(ambito: AmbitoHorario): string {
  if (ambito.equipoId) return `equipo:${ambito.equipoId}`
  if (ambito.espacioId) return `espacio:${ambito.espacioId}`
  if (ambito.bloqueId) return `bloque:${ambito.bloqueId}`
  return 'edificacion'
}

/**
 * Horario comparable para la detección de conflictos: el dominio puro no
 * conoce Prisma, solo estos campos.
 */
export interface HorarioComparable {
  edificacionId: string
  ambito: AmbitoHorario
  diasSemana: string[]
  horaInicio: number
  horaFin: number
  /** `YYYY-MM-DD`; null = sin límite (extremo abierto). */
  desde: string | null
  hasta: string | null
}

/**
 * Campos de un horario que necesita el cálculo de horas de uso (S4): el
 * dominio puro no conoce Prisma ni la UI; la fila de BD y
 * `HorarioEquipoInfo` cumplen esta forma estructuralmente.
 */
export interface HorarioHorasUso {
  /** Códigos de día: LUN..DOM (CATALOGO_DIAS). */
  diasSemana: string[]
  /** Hora de inicio (0-23) y final (1-24), sin cruce de medianoche. */
  horaInicio: number
  horaFin: number
  /** Vigencia (`YYYY-MM-DD`); null en un extremo = infinito pasado/futuro. */
  desde?: string | null
  hasta?: string | null
}

/** Código de día (LUN..DOM) de una fecha ISO, en zona UTC. */
const codigoDiaDeFecha = (fechaIso: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIso)) return null
  const dow = new Date(`${fechaIso}T00:00:00Z`).getUTCDay() // 0 = domingo
  return ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'][dow] ?? null
}

/**
 * Horas de uso (0-24) en una fecha concreta: unión de las franjas de los
 * horarios vigentes ese día. Solo cuentan los horarios cuya vigencia contiene
 * la fecha (desde ≤ fecha ≤ hasta, inclusiva por día, misma convención que
 * `hayConflictoHorario`) y cuyo `diasSemana` incluye el día de la semana de la
 * fecha. Las franjas solapadas o contiguas se consolidan (unión): el solape
 * nunca se cuenta dos veces. Función pura, sin I/O ni Prisma; una fecha mal
 * formada aporta 0 (fail-safe: mejor no sumar de más).
 */
export function horasDeUsoEnFecha(
  horarios: HorarioHorasUso[],
  fechaIso: string
): number {
  const codigo = codigoDiaDeFecha(fechaIso)
  if (!codigo) return 0

  const franjas: [number, number][] = []
  for (const h of horarios) {
    if (!h.diasSemana.includes(codigo)) continue
    if (h.desde && fechaIso < h.desde) continue
    if (h.hasta && fechaIso > h.hasta) continue
    franjas.push([h.horaInicio, h.horaFin])
  }
  if (franjas.length === 0) return 0

  franjas.sort((a, b) => a[0] - b[0])
  let total = 0
  let inicio = franjas[0][0]
  let fin = franjas[0][1]
  for (let i = 1; i < franjas.length; i++) {
    const [ini, finI] = franjas[i]
    if (ini > fin) {
      total += fin - inicio
      inicio = ini
      fin = finI
    } else if (finI > fin) {
      fin = finI
    }
  }
  total += fin - inicio

  return Math.min(24, Math.max(0, total))
}

/**
 * Conflicto (S12): mismo edificio + mismo ámbito + al menos un día en común +
 * franjas horarias que se solapan (semicerradas: [inicio, fin)) + vigencias
 * que se solapan (inclusive por día: vigencia [desde, hasta] con extremos
 * abiertos). El nombre del grupo no importa: dos grupos distintos en el mismo
 * ámbito con el mismo horario chocan igual.
 */
export function hayConflictoHorario(a: HorarioComparable, b: HorarioComparable): boolean {
  if (a.edificacionId !== b.edificacionId) return false
  if (claveAmbito(a.ambito) !== claveAmbito(b.ambito)) return false
  if (!a.diasSemana.some((d) => b.diasSemana.includes(d))) return false
  if (!(a.horaInicio < b.horaFin && b.horaInicio < a.horaFin)) return false
  return (
    (!a.hasta || !b.desde || a.hasta >= b.desde) &&
    (!b.hasta || !a.desde || b.hasta >= a.desde)
  )
}

// ============================================================
// Presentación
// ============================================================

const abrev = (codigo: string): string =>
  CATALOGO_DIAS.find((d) => d.codigo === codigo)?.abrev ?? codigo

/**
 * Formatea los días en orden canónico. Bloques corridos de 3+ días se
 * abrevian como rango ("Lun–Vie"); bloques de 1 o 2 días se listan
 * ("Sáb, Dom").
 */
export function formatearDias(codigos: string[]): string {
  const orden = CATALOGO_DIAS.map((d) => d.codigo)
  const seleccionados = orden.filter((c) => codigos.includes(c))
  if (seleccionados.length === 0) return '—'

  const grupos: string[][] = []
  for (const codigo of seleccionados) {
    const ultimo = grupos[grupos.length - 1]
    const esCorrido =
      ultimo && orden.indexOf(codigo) === orden.indexOf(ultimo[ultimo.length - 1]) + 1
    if (esCorrido) {
      ultimo.push(codigo)
    } else {
      grupos.push([codigo])
    }
  }

  return grupos
    .map((g) =>
      g.length >= 3
        ? `${abrev(g[0])}–${abrev(g[g.length - 1])}`
        : g.map(abrev).join(', ')
    )
    .join(', ')
}

/** Franja horaria en formato 24h: `06:00–18:00`. */
export function formatearFranja(horaInicio: number, horaFin: number): string {
  const dos = (h: number) => String(h).padStart(2, '0')
  return `${dos(horaInicio)}:00–${dos(horaFin)}:00`
}

const fechaEs = (iso: string): string => {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** Vigencia en es-CO: `01/08/2026 → 15/12/2026`, `Desde …`, `Hasta …` o texto libre. */
export function formatearVigencia(desde: string | null, hasta: string | null): string {
  if (!desde && !hasta) return 'Sin vigencia registrada'
  if (desde && !hasta) return `Desde ${fechaEs(desde)}`
  if (!desde && hasta) return `Hasta ${fechaEs(hasta)}`
  return `${fechaEs(desde as string)} → ${fechaEs(hasta as string)}`
}
