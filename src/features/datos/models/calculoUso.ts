import { z } from 'zod'
import { mapaXeDelMes, usoEquiposDelMes } from './calendario'
import type { ConfigCalendario, PoliticaOperatividad, RangoFechas } from './calendario'
import { formatearDias, formatearFranja, formatearVigenciaCorta, horariosDelNivelGanador } from './horarios'
import type { CodigoAmbito, ContextoEquipo, HorarioConAmbito, HorarioHorasUso } from './horarios'

// ============================================================
// Cálculo de uso — fundamentos puros (SDD calculo-masivo-uso)
// Tipos, Zod, constantes, intervalo e integridad. 100% puro y
// seguro para el navegador: sin Prisma, sin Date.now() (el
// presupuesto recibe el reloj por parámetro).
// ============================================================

/** Máximo de periodos procesados por invocación del lote masivo (Vercel-safe). */
export const MAX_PERIODOS_POR_LLAMADA = 3

/** Presupuesto de tiempo por invocación del lote (ms): Vercel ≈60 s con 20 s de holgura. */
export const PRESUPUESTO_MS = 40_000

/** Un reclamo CALCULANDO más antiguo que esto (5 min) es retomable por otra ejecución. */
export const CLAIM_TTL_MS = 300_000

/** Año mínimo aceptado para un periodo de cálculo. */
export const ANO_MINIMO = 2000

/** Año máximo aceptado para un periodo de cálculo. */
export const ANO_MAXIMO = 2100

/** Tope blando de meses por intervalo (límite UX; la ejecución se trocea por lotes). */
export const MAX_MESES_POR_INTERVALO = 120

/** Referencia mes/año (mes 1..12). */
export interface PeriodoRef {
  mes: number
  ano: number
}

/** Diferencia en meses desde `desde` hasta `hasta` (0 = mismo mes; negativa si hasta < desde). */
export function diferenciaMeses(desde: PeriodoRef, hasta: PeriodoRef): number {
  return (hasta.ano - desde.ano) * 12 + (hasta.mes - desde.mes)
}

/** Clave estable de un periodo, formato `YYYY-MM` (vista previa, resumen, auditoría). */
export function clavePeriodo(periodo: PeriodoRef): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${periodo.ano}-${pad(periodo.mes)}`
}

/** Reglas cruzadas de un intervalo: hasta ≥ desde y cantidad de meses ≤ tope blando. */
const validaReglasDeIntervalo = (
  v: { desde: PeriodoRef; hasta: PeriodoRef },
  ctx: z.RefinementCtx
): void => {
  const diferencia = diferenciaMeses(v.desde, v.hasta)
  if (diferencia < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['hasta'],
      message: 'El mes final debe ser posterior o igual al inicial',
    })
    return
  }
  if (diferencia + 1 > MAX_MESES_POR_INTERVALO) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['hasta'],
      message: `El intervalo supera los ${MAX_MESES_POR_INTERVALO} meses permitidos. Divida el cálculo en varios intervalos.`,
    })
  }
}

/** Mes/año válidos: entero 1..12 y año dentro del rango 2000..2100. */
export const periodoSchema = z.object({
  mes: z
    .number()
    .int('El mes debe ser un número entero')
    .min(1, 'El mes debe estar entre 1 y 12')
    .max(12, 'El mes debe estar entre 1 y 12'),
  ano: z
    .number()
    .int('El año debe ser un número entero')
    .min(ANO_MINIMO, `El año debe estar entre ${ANO_MINIMO} y ${ANO_MAXIMO}`)
    .max(ANO_MAXIMO, `El año debe estar entre ${ANO_MINIMO} y ${ANO_MAXIMO}`),
})

/** Forma base de un intervalo inclusivo mes/año (compartida por los schemas de entrada). */
const intervaloBase = z.object({ desde: periodoSchema, hasta: periodoSchema })

/** Intervalo inclusivo mes/año (BR1): desde ≤ hasta, tope de MAX_MESES_POR_INTERVALO. */
export const intervaloSchema = intervaloBase.superRefine(validaReglasDeIntervalo)

export type IntervaloCalculo = z.infer<typeof intervaloSchema>

// ============================================================
// Estados y trazabilidad (espejo de los enums de Prisma)
// ============================================================

/** Estados de una fila de `uso_periodo` (máquina de estados del cálculo). */
export const USO_PERIODO_ESTADOS = [
  'PENDIENTE',
  'CALCULANDO',
  'CALCULADO',
  'FALLIDO',
  'REVISAR',
] as const
export type UsoPeriodoEstado = (typeof USO_PERIODO_ESTADOS)[number]

/** Origen de escritura de un resultado (individual, lote masivo o recálculo explícito). */
export const USO_ORIGENES = ['INDIVIDUAL', 'MASIVO', 'RECALCULO'] as const
export type UsoOrigen = (typeof USO_ORIGENES)[number]

// ============================================================
// Tipos de dominio del cálculo (AC1; el núcleo es T3)
// ============================================================

/** Motivo por el que un equipo queda en revisión (nunca se rellena con ceros, BR5). */
export type MotivoRevision = 'sin_horario_vigente' | 'sin_dias_operativos'

/** Equipo en alcance del periodo con sus ids jerárquicos exactos. */
export interface EquipoContexto {
  id: string
  bloqueId: string
  espacioId: string
}

/** Horario con ámbito jerárquico, la forma que consume `horariosDelNivelGanador`. */
export type HorarioContexto = HorarioHorasUso &
  HorarioConAmbito & {
    /** Nombre visible de la fila `horarios_equipo` (trazabilidad `NIVEL/Nombre`). */
    nombre?: string | null
  }

/**
 * Contexto precargado de un periodo (paso 1 del pipeline): equipos en alcance,
 * rangos del calendario, configuración operativa, política y horarios cuya
 * vigencia se solapa con el mes. Lo construye el controller con Prisma; el
 * núcleo puro solo lo recibe.
 */
export interface ContextoPeriodo {
  equipos: EquipoContexto[]
  rangos: RangoFechas[]
  config: Pick<ConfigCalendario, 'horaInicioOperacion' | 'horasOperacionDia'>
  /**
   * Opt-in S4: Xe desde los horarios vigentes. Es el MISMO flag que lee el
   * importador (`calendarioDeEdif.usarHorariosXe ?? false`); ausente = false
   * (H fijo), bit a bit con el legado.
   */
  usarHorariosXe?: boolean
  politica?: PoliticaOperatividad
  horarios: HorarioContexto[]
}

/** Resultado por equipo de un periodo (fila de `uso_equipo_periodo` + desglose). */
export interface DetalleEquipo {
  equipoId: string
  horasUsoDia: number
  diasUsoMes: number
  estado: UsoEquipoEstado
  horarioGanador: string | null
  motivoRevision?: MotivoRevision
  /** Desglose por fecha (`YYYY-MM-DD` → horas) usado en la trazabilidad; no se persiste. */
  porFecha: { fecha: string; horas: number }[]
}

/** Agregado display-only de un nivel jerárquico (D2: nunca se persiste). */
export interface ConsolidacionNivel {
  equipos: number
  horasUsoDia: number
  diasUsoMes: number
}

/** Consolidaciones por espacio, bloque y edificación derivadas bajo demanda. */
export interface Consolidaciones {
  espacios: (ConsolidacionNivel & { espacioId: string })[]
  bloques: (ConsolidacionNivel & { bloqueId: string })[]
  edificacion: ConsolidacionNivel
}

/** Salida del núcleo puro de cálculo de un periodo. */
export interface ResultadoPeriodo {
  detalle: DetalleEquipo[]
  consolidaciones: Consolidaciones
  advertencias: string[]
  trazabilidad: { equipoId: string; nivelGanador: string; vigencia: string; aportes: string[] }[]
  equiposEsperados: number
}

/** Fila de periodo de la vista previa (solo lectura, antes de escribir). */
export interface PeriodoVistaPrevia {
  clave: string
  estado: UsoPeriodoEstado | null
  clasificacion: Clasificacion
  equiposEsperados: number
  equiposCalculados: number
  conFactura: boolean
  advertencias: string[]
}

/** Vista previa completa del intervalo (AC4): se muestra antes de cualquier escritura. */
export interface VistaPrevia {
  intervalo: { desde: PeriodoRef; hasta: PeriodoRef; cantidadMeses: number }
  periodos: PeriodoVistaPrevia[]
  conteos: {
    existentes: number
    pendientes: number
    fallidos: number
    revisar: number
    conFactura: number
  }
  /** Periodos exactos que el modo por defecto escribirá (AC5.3). */
  seEscribiran: string[]
}

/** Contadores de una ejecución (parcial o final) que particionan el intervalo (AC8). */
export interface ResumenEjecucion {
  calculados: number
  conservados: number
  fallidos: number
  revisar: number
  pendientes: number
}

// ============================================================
// Integridad de resultados existentes (BR4, AC5)
// ============================================================

/** Estados del detalle por equipo que el clasificador espera encontrar en BD. */
export const USO_EQUIPO_ESTADOS = ['CALCULADO', 'REVISAR'] as const
export type UsoEquipoEstado = (typeof USO_EQUIPO_ESTADOS)[number]

/**
 * Clasificación de un periodo para la vista previa y el conjunto pendiente:
 * - `existente-intacto`: CALCULADO con toda la integridad en orden (se conserva, nunca se escribe).
 * - `pendiente`: sin resultado utilizable (PENDIENTE, CALCULANDO interrumpido, o CALCULADO que falla BR4.1–BR4.4).
 * - `desactualizado`: CALCULADO íntegro, pero el inventario de equipos cambió (falla BR4.5).
 * - `fallido` / `revisar`: estado almacenado que el modo por defecto reintenta.
 * - `nuevo`: aún no existe fila de resultado.
 */
export type Clasificacion =
  | 'existente-intacto'
  | 'pendiente'
  | 'desactualizado'
  | 'fallido'
  | 'revisar'
  | 'nuevo'

/** Fila de `uso_equipo_periodo` en la forma mínima que necesita la integridad. */
export interface DetalleAlmacenado {
  estado: UsoEquipoEstado
  horasUsoDia: number
  diasUsoMes: number
}

/** Fila de `uso_periodo` en la forma mínima que necesita la integridad. */
export interface PeriodoAlmacenado {
  estado: string
  equiposEsperados: number
  calculadoEn: Date | null
  calculadoPor: string | null
  detalles: DetalleAlmacenado[]
}

/**
 * Clasifica un periodo almacenado contra el inventario actual (AC5, BR4):
 * (1) estado CALCULADO; (2) filas de detalle = equiposEsperados; (3) detalle
 * CALCULADO con valores finitos no negativos; (4) calculadoEn y calculadoPor
 * presentes; (5) equipos actuales = equiposEsperados. Fallar (1)-(4) ⇒
 * `pendiente`; fallar solo (5) ⇒ `desactualizado`. Lee únicamente resultados
 * de uso: las facturas nunca participan (R3/AC3).
 */
export function clasificarPeriodos(
  periodo: PeriodoAlmacenado | null,
  equiposActuales: number
): Clasificacion {
  if (!periodo) return 'nuevo'
  if (periodo.estado === 'FALLIDO') return 'fallido'
  if (periodo.estado === 'REVISAR') return 'revisar'
  if (periodo.estado !== 'CALCULADO') return 'pendiente' // PENDIENTE o CALCULANDO interrumpido

  if (periodo.detalles.length !== periodo.equiposEsperados) return 'pendiente'
  const coherente = periodo.detalles.every(
    (d) =>
      d.estado === 'CALCULADO' &&
      Number.isFinite(d.horasUsoDia) &&
      d.horasUsoDia >= 0 &&
      Number.isFinite(d.diasUsoMes) &&
      d.diasUsoMes >= 0
  )
  if (!coherente) return 'pendiente'
  if (!periodo.calculadoEn || !periodo.calculadoPor) return 'pendiente'
  if (periodo.equiposEsperados !== equiposActuales) return 'desactualizado'
  return 'existente-intacto'
}

/**
 * Expansión inclusiva de un intervalo: todos los meses de `desde` a `hasta`
 * (AC2/AC13). Un intervalo invertido (sin validar) produce `[]`; los llamadores
 * validan antes con `intervaloSchema`.
 */
export function expandirIntervalo(desde: PeriodoRef, hasta: PeriodoRef): PeriodoRef[] {
  const total = diferenciaMeses(desde, hasta)
  const base = desde.ano * 12 + (desde.mes - 1)
  const periodos: PeriodoRef[] = []
  for (let i = 0; i <= total; i++) {
    const indice = base + i
    periodos.push({ ano: Math.floor(indice / 12), mes: (indice % 12) + 1 })
  }
  return periodos
}

/**
 * Milisegundos restantes del presupuesto de una invocación del lote (AC11):
 * el reloj entra por parámetro (nunca se lee Date.now() aquí) y el resultado
 * se planta en 0, nunca negativo.
 */
export function presupuestoRestante(ahora: number, inicio: number): number {
  return Math.max(0, inicio + PRESUPUESTO_MS - ahora)
}

/** Modo de ejecución del cálculo masivo. */
export type ModoCalculoUso = 'solo-vacios' | 'reemplazar'

/** Entrada de `ejecutarCalculoMasivo`: edificación + intervalo + lote opcional + modo. */
export const ejecutarSchema = intervaloBase
  .extend({
    edificacionId: z.string().min(1, 'La edificación es obligatoria'),
    loteId: z.string().min(1).optional(),
    modo: z.enum(['solo-vacios', 'reemplazar']).default('solo-vacios'),
  })
  .superRefine(validaReglasDeIntervalo)

export type EjecutarCalculoInput = z.infer<typeof ejecutarSchema>

/** Entrada de `recalcularPeriodos`: exige la confirmación explícita (AC9, literal true). */
export const recalcularSchema = z.object({
  edificacionId: z.string().min(1, 'La edificación es obligatoria'),
  periodos: z.array(periodoSchema).min(1, 'Seleccione al menos un periodo para recalcular'),
  confirmado: z.literal(true, {
    errorMap: () => ({ message: 'Confirme el recálculo para continuar' }),
  }),
})

export type RecalcularPeriodosInput = z.infer<typeof recalcularSchema>

// ============================================================
// Núcleo puro de cálculo de un periodo (T3 — AC1, AC13, BR2, BR5)
// Sin I/O, sin Prisma y sin Date.now(): mismas entradas ⇒ mismas salidas.
// Solo envuelve la librería existente (horarios.ts / calendario.ts), que no
// se modifica.
// ============================================================

/** Nivel activo de un horario ganador (espejo de `nivelDeHorario`, privado en horarios.ts). */
const nivelDeHorario = (h: HorarioContexto): CodigoAmbito =>
  h.equipoId ? 'EQUIPO' : h.espacioId ? 'ESPACIO' : h.bloqueId ? 'BLOQUE' : 'EDIFICACION'

/** Etiqueta del horario ganador: `NIVEL/Nombre` (o la franja descrita si la fila no trae nombre). */
const etiquetaHorario = (ganadores: HorarioContexto[]): string => {
  const nombres = ganadores.map((h) => {
    const nombre = h.nombre?.trim()
    return nombre || `${formatearDias(h.diasSemana)} ${formatearFranja(h.horaInicio, h.horaFin)}`
  })
  return `${nivelDeHorario(ganadores[0])}/${Array.from(new Set(nombres)).join(' + ')}`
}

/** Entrada del núcleo puro: periodo + contexto precargado (paso 1 del pipeline). */
export interface CalculoPeriodoInput {
  edificacionId: string
  mes: number
  ano: number
  contexto: ContextoPeriodo
  /**
   * Divergencia documentada (design §2.3): el importador resuelve el horario
   * SIN equipoId e ignora los horarios de nivel EQUIPO; el núcleo por defecto
   * sí lo pasa (spec R1 «jerarquía»). `false` reproduce la semántica del
   * importador y alimenta el test de caracterización.
   */
  incluirHorarioDeEquipo?: boolean
}

/**
 * Calcula las horas y días de uso de un periodo (AC1): por equipo, con el
 * horario efectivo de la jerarquía (equipo → espacio → bloque → edificación,
 * S1), desglose por fecha, advertencias, trazabilidad y consolidaciones (D2).
 *
 * BR5 (nunca rellenar con ceros): un equipo sin horario vigente o sin días
 * operativos NO produce fila de detalle; su motivo va a las advertencias del
 * periodo y el estado REVISAR lo decide el controller. BR2: un periodo sin
 * equipos queda CALCULADO con equiposEsperados 0 y la advertencia
 * «Sin equipos registrados».
 */
export function calcularPeriodo(p: CalculoPeriodoInput): ResultadoPeriodo {
  const { edificacionId, mes, ano, contexto } = p
  const incluirHorarioDeEquipo = p.incluirHorarioDeEquipo !== false
  const detalle: DetalleEquipo[] = []
  const trazabilidad: ResultadoPeriodo['trazabilidad'] = []
  const advertencias: string[] = []
  const advertir = (texto: string): void => {
    if (!advertencias.includes(texto)) advertencias.push(texto)
  }

  if (contexto.equipos.length === 0) advertir('Sin equipos registrados') // BR2: CALCULADO con 0 esperados

  for (const eq of contexto.equipos) {
    const contextoEquipo: ContextoEquipo = {
      edificacionId,
      bloqueId: eq.bloqueId,
      espacioId: eq.espacioId,
    }
    if (incluirHorarioDeEquipo) contextoEquipo.equipoId = eq.id
    const ganadores = horariosDelNivelGanador(contexto.horarios, contextoEquipo, { mes, ano })

    trazabilidad.push({
      equipoId: eq.id,
      nivelGanador: ganadores.length > 0 ? nivelDeHorario(ganadores[0]) : 'SIN_HORARIO',
      vigencia:
        ganadores.length > 0
          ? Array.from(new Set(ganadores.map((h) => formatearVigenciaCorta(h.desde ?? null, h.hasta ?? null)))).join(
              ' · '
            )
          : '—',
      aportes: ganadores.map((h) => `${formatearDias(h.diasSemana)} ${formatearFranja(h.horaInicio, h.horaFin)}`),
    })

    const params = {
      rangos: contexto.rangos,
      config: contexto.config,
      horarios: ganadores,
      usarHorariosXe: contexto.usarHorariosXe ?? false,
      mes,
      ano,
      politica: contexto.politica,
    }
    const base = usoEquiposDelMes(params)
    if (!base) {
      // BR5: sin fila de detalle (nunca ceros); el motivo queda en las
      // advertencias y el estado REVISAR lo decide el controller (design §2.1).
      if (ganadores.length === 0) advertir('Sin horario vigente')
      else advertir('Sin días operativos')
      continue
    }

    // Dos pasadas puras por equipo (design §2.1): usoEquiposDelMes sigue siendo
    // la fuente canónica de los valores; mapaXeDelMes solo alimenta el
    // desglose por fecha, sin duplicar reglas de redondeo.
    const mapa = mapaXeDelMes(params)
    detalle.push({
      equipoId: eq.id,
      horasUsoDia: base.horasUsoDia,
      diasUsoMes: base.diasUsoMes,
      estado: 'CALCULADO',
      horarioGanador: ganadores.length > 0 ? etiquetaHorario(ganadores) : null,
      porFecha: Array.from(mapa, ([fecha, horas]) => ({ fecha, horas })).sort((a, b) =>
        a.fecha.localeCompare(b.fecha)
      ),
    })
  }

  return {
    detalle,
    consolidaciones: consolidarPorNivel(detalle, contexto),
    advertencias,
    trazabilidad,
    equiposEsperados: contexto.equipos.length,
  }
}

/**
 * Consolidación por espacio, bloque y edificación (AC1, D2): display-only,
 * se deriva bajo demanda y NUNCA se persiste. Solo suma filas con detalle
 * calculado — los equipos en revisión no aportan.
 */
export function consolidarPorNivel(
  detalle: DetalleEquipo[],
  contexto: ContextoPeriodo
): Consolidaciones {
  const porEquipo = new Map(contexto.equipos.map((e) => [e.id, e]))
  const espacios = new Map<string, ConsolidacionNivel & { espacioId: string }>()
  const bloques = new Map<string, ConsolidacionNivel & { bloqueId: string }>()
  const edificacion: ConsolidacionNivel = { equipos: 0, horasUsoDia: 0, diasUsoMes: 0 }

  const sumar = (destino: ConsolidacionNivel, fila: DetalleEquipo): void => {
    destino.equipos += 1
    destino.horasUsoDia += fila.horasUsoDia
    destino.diasUsoMes += fila.diasUsoMes
  }
  const asegurar = <T extends ConsolidacionNivel>(
    mapa: Map<string, T>,
    clave: string,
    nuevo: () => T
  ): T => {
    const existente = mapa.get(clave)
    if (existente) return existente
    const creado = nuevo()
    mapa.set(clave, creado)
    return creado
  }

  for (const fila of detalle) {
    const eq = porEquipo.get(fila.equipoId)
    if (!eq) continue // fila huérfana: sin contexto jerárquico no se puede ubicar (fail-safe)
    sumar(edificacion, fila)
    sumar(
      asegurar(espacios, eq.espacioId, () => ({ espacioId: eq.espacioId, equipos: 0, horasUsoDia: 0, diasUsoMes: 0 })),
      fila
    )
    sumar(
      asegurar(bloques, eq.bloqueId, () => ({ bloqueId: eq.bloqueId, equipos: 0, horasUsoDia: 0, diasUsoMes: 0 })),
      fila
    )
  }

  return {
    espacios: Array.from(espacios.values()),
    bloques: Array.from(bloques.values()),
    edificacion,
  }
}
