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
export const codigoDiaDeFecha = (fechaIso: string): string | null => {
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
// Fase 6 — trazabilidad de horarios por equipo (S3)
// ============================================================

/** Contexto jerárquico de un equipo del inventario (ids exactos por nivel). */
export interface ContextoEquipo {
  edificacionId: string
  bloqueId: string
  espacioId: string
  equipoId?: string | null
}

/**
 * Campos de ámbito en forma plana que necesita la aplicabilidad (S3): la fila
 * de BD (`horarioEquipo`) y `HorarioEquipoInfo` cumplen esta forma
 * estructuralmente; el dominio no conoce Prisma ni la UI.
 */
export interface HorarioConAmbito {
  edificacionId: string
  bloqueId?: string | null
  espacioId?: string | null
  equipoId?: string | null
}

/** Horario que aplica a un equipo + el nivel jerárquico por el que coincide. */
export interface HorarioAplicable<T> {
  horario: T
  nivel: CodigoAmbito
}

/** Menor índice = más específico (el orden de salida de la aplicabilidad). */
const ORDEN_NIVEL: Record<CodigoAmbito, number> = {
  EQUIPO: 0,
  ESPACIO: 1,
  BLOQUE: 2,
  EDIFICACION: 3,
}

/** Nivel activo de un horario: el más específico de la cascada (igual que `claveAmbito`). */
const nivelDeHorario = (h: HorarioConAmbito): CodigoAmbito =>
  h.equipoId ? 'EQUIPO' : h.espacioId ? 'ESPACIO' : h.bloqueId ? 'BLOQUE' : 'EDIFICACION'

/**
 * Horarios aplicables a un equipo (S3): coincide el nivel activo del horario
 * (equipo → espacio → bloque → edificación) con el id exacto del contexto del
 * equipo; solo se compara ese nivel más específico (un id equivocado en otro
 * nivel nunca casa). Devuelve TODAS las filas aplicables — también las aún no
 * vigentes o vencidas, porque la sección es de trazabilidad — ordenadas por
 * especificidad (equipo → espacio → bloque → edificación) y, dentro de un
 * nivel, en el orden original. Sin coincidencias: `[]`.
 */
export function horariosAplicablesAEquipo<T extends HorarioConAmbito>(
  horarios: T[],
  contexto: ContextoEquipo
): HorarioAplicable<T>[] {
  const coincidencias: { horario: T; nivel: CodigoAmbito; indice: number }[] = []
  horarios.forEach((horario, indice) => {
    const nivel = nivelDeHorario(horario)
    const coincide =
      nivel === 'EQUIPO'
        ? !!contexto.equipoId && horario.equipoId === contexto.equipoId
        : nivel === 'ESPACIO'
          ? horario.espacioId === contexto.espacioId
          : nivel === 'BLOQUE'
            ? horario.bloqueId === contexto.bloqueId
            : horario.edificacionId === contexto.edificacionId
    if (coincide) coincidencias.push({ horario, nivel, indice })
  })
  coincidencias.sort(
    (a, b) => ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel] || a.indice - b.indice
  )
  return coincidencias.map(({ horario, nivel }) => ({ horario, nivel }))
}

/** ¿La vigencia del horario (extremos abiertos = infinito) se solapa con el mes? */
const vigenciaTraslapaMes = (
  h: Pick<HorarioHorasUso, 'desde' | 'hasta'>,
  ventana: { mes: number; ano: number }
): boolean => {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const primerDia = `${ventana.ano}-${pad(ventana.mes)}-01`
  const ultimoDia = new Date(Date.UTC(ventana.ano, ventana.mes, 0)).getUTCDate()
  const ultimo = `${ventana.ano}-${pad(ventana.mes)}-${pad(ultimoDia)}`
  return (!h.hasta || h.hasta >= primerDia) && (!h.desde || h.desde <= ultimo)
}

/**
 * S1 — horario efectivo por ámbito (override): el nivel más específico con al
 * menos un horario VIGENTE en la ventana manda para todos los días; si ese
 * nivel no tiene, se cae al siguiente (equipo → espacio → bloque →
 * edificación). Dentro del nivel ganador se conservan todos sus horarios;
 * entre niveles NO se suman. Sin ventana (trazabilidad) cuenta cualquier fila
 * del nivel. Sin horarios en ningún nivel: `[]`.
 */
export function horariosDelNivelGanador<
  T extends HorarioConAmbito & Pick<HorarioHorasUso, 'desde' | 'hasta'>
>(horarios: T[], contexto: ContextoEquipo, ventana?: { mes: number; ano: number }): T[] {
  const candidatos = ventana ? horarios.filter((h) => vigenciaTraslapaMes(h, ventana)) : horarios
  const aplicables = horariosAplicablesAEquipo(candidatos, contexto)
  const ganador = aplicables[0]?.nivel
  if (!ganador) return []
  return aplicables.filter((a) => a.nivel === ganador).map((a) => a.horario)
}

/** Día de un resumen semanal: código LUN..DOM, fecha ISO y horas de uso. */
export interface DiaHorasUso {
  codigo: string
  fecha: string
  horas: number
}

/** Horas de uso de una semana completa (S3): «esta semana» es un número anclado. */
export interface ResumenHorasUso {
  /** Lunes y domingo de la semana anclada (`YYYY-MM-DD`). */
  lunes: string
  domingo: string
  /** 7 entradas en orden LUN..DOM. */
  dias: DiaHorasUso[]
  /** Suma de las horas diarias (unión por día, sin doble conteo). */
  total: number
}

const fechaHoyIso = (): string => new Date().toISOString().slice(0, 10)

/**
 * Lunes de la semana que contiene `fechaIso` (UTC; domingo pertenece a la
 * semana que empezó el lunes anterior). Sin fecha o con una fecha mal formada
 * devuelve el lunes de la semana en curso (fail-safe, como el resto del módulo).
 */
export function lunesDeSemana(fechaIso?: string): string {
  const iso = fechaIso && /^\d{4}-\d{2}-\d{2}$/.test(fechaIso) ? fechaIso : fechaHoyIso()
  const fecha = new Date(`${iso}T00:00:00Z`)
  const desfaseLunes = (fecha.getUTCDay() + 6) % 7 // 0 si ya es lunes
  fecha.setUTCDate(fecha.getUTCDate() - desfaseLunes)
  return fecha.toISOString().slice(0, 10)
}

/**
 * Horas de uso por día de la semana (L…D) y total semanal (S3), etiquetados
 * como «esta semana»: la vigencia hace que las horas dependan del periodo, así
 * que el resumen se ancla a una semana concreta (por defecto la en curso,
 * lunes → domingo). Solo aportan horas los horarios con vigencia solapada a la
 * semana; dentro de cada día se reutiliza `horasDeUsoEnFecha`, que respeta
 * vigencia inclusiva, `diasSemana` y la unión de franjas (el solape entre
 * horarios nunca se cuenta dos veces). Función pura, sin I/O ni Prisma.
 */
export function resumenHorasUsoDeSemana(
  horarios: HorarioHorasUso[],
  lunesIso?: string
): ResumenHorasUso {
  const lunes = lunesDeSemana(lunesIso)
  const lunesFecha = new Date(`${lunes}T00:00:00Z`)
  const domingoFecha = new Date(lunesFecha)
  domingoFecha.setUTCDate(domingoFecha.getUTCDate() + 6)
  const domingo = domingoFecha.toISOString().slice(0, 10)

  const vigentesEnSemana = horarios.filter(
    (h) => (!h.hasta || h.hasta >= lunes) && (!h.desde || h.desde <= domingo)
  )

  const dias: DiaHorasUso[] = CATALOGO_DIAS.map((d, i) => {
    const fecha = new Date(lunesFecha)
    fecha.setUTCDate(fecha.getUTCDate() + i)
    const fechaIso = fecha.toISOString().slice(0, 10)
    return {
      codigo: d.codigo,
      fecha: fechaIso,
      horas: horasDeUsoEnFecha(vigentesEnSemana, fechaIso),
    }
  })

  return { lunes, domingo, dias, total: dias.reduce((suma, d) => suma + d.horas, 0) }
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

/**
 * Vigencia corta para la trazabilidad por equipo (S3): rango `desde`–`hasta`;
 * un extremo sin fecha se muestra como «abierta» en su posición y sin fechas
 * la vigencia es «abierta».
 */
export function formatearVigenciaCorta(desde: string | null, hasta: string | null): string {
  if (desde && hasta) return `${fechaEs(desde)} – ${fechaEs(hasta)}`
  if (desde) return `${fechaEs(desde)} – abierta`
  if (hasta) return `abierta – ${fechaEs(hasta)}`
  return 'abierta'
}
