'use server'

// ============================================================
// Cálculo de uso — server actions (SDD calculo-masivo-uso, T4)
// Autorización → validación Zod → contexto (Prisma) → núcleo puro
// (`calcularPeriodo`) → persistencia con reclamo (transacción por
// periodo) → auditoría. Solo este módulo transiciona el estado de
// `uso_periodo` (design §4). `cargarContextoPeriodo` y
// `persistirPeriodo` NO se exportan a propósito: en un archivo
// `'use server'` todo export es una acción invocable desde el
// cliente, y exponer la persistencia permitiría escribir resultados
// con `meta` falsificada (AC14).
// ============================================================

import { prisma } from '@/shared/models/prisma'
import { canWithOverrides, getCurrentUser } from '@/shared/models/authz'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import {
  CLAIM_TTL_MS,
  MAX_PERIODOS_POR_LLAMADA,
  calcularPeriodo,
  clasificarPeriodos,
  clavePeriodo,
  ejecutarSchema,
  expandirIntervalo,
  intervaloSchema,
  periodoSchema,
  presupuestoRestante,
  recalcularSchema,
  type Clasificacion,
  type ContextoPeriodo,
  type DetalleAlmacenado,
  type DetalleEquipo,
  type PeriodoAlmacenado,
  type PeriodoRef,
  type PeriodoVistaPrevia,
  type RecalcularPeriodosInput,
  type ResumenEjecucion,
  type ResultadoPeriodo,
  type UsoOrigen,
  type UsoPeriodoEstado,
  type VistaPrevia,
} from '@/features/datos/models/calculoUso'

/** Resultado discriminado de una server action (convención del repo). */
export type Exito<T> = ({ estado: 'ok' } & T) | { estado: 'error'; mensaje: string }

/** Autorización de las acciones de cálculo; `userId` alimenta `calculadoPor`. */
export type AuthCarga = { ok: true; userId: string } | { ok: false; mensaje: string }

const MSJ_SESION = 'Sesión expirada. Inicie sesión nuevamente.'
const MSJ_PERMISO = 'Su rol no tiene permiso para calcular horas de uso.'
const MSJ_FALLA = 'No fue posible calcular las horas de uso. Intente de nuevo.'
const MSJ_VISTA_FALLA = 'No fue posible preparar la vista previa. Intente de nuevo.'
const MSJ_CLAIM = 'Hay un cálculo de este periodo en curso. Intente de nuevo en unos minutos.'

/**
 * El periodo tiene un reclamo CALCULANDO vigente de OTRA ejecución (TTL no
 * vencido). Se propaga como error propio para que el caller la distinga del
 * FALLIDO genérico: NUNCA se marca FALLIDO ni se escribe nada (AC7: un fallo
 * ajeno no corrompe periodos).
 */
class ReclamoDenegado extends Error {
  constructor() {
    super(MSJ_CLAIM)
    this.name = 'ReclamoDenegado'
  }
}

/**
 * Falla controlada de la carga de contexto (p. ej. edificación sin calendario
 * operativo): el usuario debe ver el mensaje específico, no el genérico.
 */
class ErrorDeCarga extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorDeCarga'
  }
}

/**
 * Etiqueta visible de un equipo en las tablas de resultados (decisión de
 * binding de T6): `EquipoElectrico` NO tiene columna `nombre`, así que el
 * proyecto compone «TIPO · Espacio» (mismo criterio que el módulo de
 * horarios); el `equipoId` queda como dato secundario.
 */
function etiquetaEquipo(tipo: string, espacioNombre?: string | null): string {
  return espacioNombre ? `${tipo} · ${espacioNombre}` : tipo
}

/**
 * Gate de autorización de TODAS las acciones de cálculo (AC14), espejo de
 * `autorizarCarga` (edificaciones.ts) con mensaje propio. Devuelve también
 * `userId` para `calculadoPor` (extensión compatible: los llamadores solo
 * revisan `.ok` / `.mensaje`).
 */
export async function autorizarCalculoUso(): Promise<AuthCarga> {
  try {
    const user = await getCurrentUser()
    if (!user) return { ok: false, mensaje: MSJ_SESION }
    if (!(await canWithOverrides(user, 'consumption', 'upload'))) {
      return { ok: false, mensaje: MSJ_PERMISO }
    }
    return { ok: true, userId: user.id }
  } catch (error) {
    console.error('Error al autorizar el cálculo de uso:', error)
    return { ok: false, mensaje: MSJ_FALLA }
  }
}

/** `advertencias` se persiste como JSON; tolerante a null/JSON inválido. */
function parsearAdvertencias(texto: string | null): string[] {
  if (!texto) return []
  try {
    const valor: unknown = JSON.parse(texto)
    return Array.isArray(valor) ? valor.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * ¿Solapa la vigencia de la fila (extremos nulos = infinitos) el mes pedido?
 * Espejo de `vigenciaTraslapaMes` (privada en models/horarios.ts): la librería
 * no se modifica (regresión cero); este filtro de precarga vive en el controller.
 */
function vigenciaTraslapaMes(
  h: { desde: Date | null; hasta: Date | null },
  ventana: { mes: number; ano: number }
): boolean {
  const primero = new Date(Date.UTC(ventana.ano, ventana.mes - 1, 1))
  const ultimo = new Date(Date.UTC(ventana.ano, ventana.mes, 0))
  return (!h.hasta || h.hasta >= primero) && (!h.desde || h.desde <= ultimo)
}

/** Etiqueta compuesta de cada equipo del alcance, por id (tablas de resultados). */
type EtiquetasEquipo = Map<string, string>

type ResultadoCarga =
  | { ok: true; contexto: ContextoPeriodo; equipoEtiquetas: EtiquetasEquipo }
  | { ok: false; mensaje: string }

/**
 * Fila almacenada del periodo con sus detalles, en la forma mínima que
 * consume `clasificarPeriodos` (AC5/BR4). Lectura previa al cálculo para
 * decidir conservación; no escribe.
 */
async function cargarPeriodoAlmacenado(
  edificacionId: string,
  mes: number,
  ano: number
): Promise<(PeriodoAlmacenado & { advertencias: string[] }) | null> {
  const [fila, detalles] = await Promise.all([
    prisma.usoPeriodo.findUnique({
      where: { edificacionId_mes_ano: { edificacionId, mes, ano } },
    }),
    prisma.usoEquipoPeriodo.findMany({
      where: { mes, ano, equipo: { bloque: { edificacionId } } },
      select: { estado: true, horasUsoDia: true, diasUsoMes: true },
    }),
  ])
  if (!fila) return null
  return {
    estado: fila.estado,
    equiposEsperados: fila.equiposEsperados,
    calculadoEn: fila.calculadoEn,
    calculadoPor: fila.calculadoPor,
    detalles,
    advertencias: parsearAdvertencias(fila.advertencias),
  }
}

/**
 * Paso 1 del pipeline (paso impuro): equipos en alcance + relaciones, rangos
 * del calendario, configuración operativa, política de operatividad
 * (domingos/festivos — los festivos colombianos son la lista pura
 * `models/festivos`, sin tabla) y horarios de la edificación cuya vigencia se
 * solapa con el mes. Los eventos del calendario (models/eventos.ts) son
 * display-only y ningún consumidor del cálculo los lee, por lo que no se
 * cargan (design §2.1 define ContextoPeriodo sin ellos).
 */
async function cargarContextoPeriodo(
  edificacionId: string,
  mes: number,
  ano: number
): Promise<ResultadoCarga> {
  const edificacion = await prisma.edificacion.findUnique({
    where: { id: edificacionId },
    select: { id: true, calendario: true },
  })
  if (!edificacion) return { ok: false, mensaje: 'La edificación indicada no existe.' }
  if (!edificacion.calendario) {
    return {
      ok: false,
      mensaje:
        'Esta edificación no tiene configuración operativa. Complete el calendario antes de calcular horas de uso.',
    }
  }

  const [rangos, equipos, horarios] = await Promise.all([
    prisma.rangoCalendario.findMany({
      where: { calendario: { edificacionId } },
      orderBy: { fechaInicio: 'asc' },
      select: { fechaInicio: true, fechaFin: true, tipoDia: true },
    }),
    prisma.equipoElectrico.findMany({
      where: { bloque: { edificacionId } },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        bloqueId: true,
        espacioId: true,
        tipo: true,
        espacio: { select: { nombre: true } },
      },
    }),
    prisma.horarioEquipo.findMany({
      where: { edificacionId },
      select: {
        nombre: true,
        diasSemana: true,
        horaInicio: true,
        horaFin: true,
        desde: true,
        hasta: true,
        bloqueId: true,
        espacioId: true,
        equipoId: true,
      },
    }),
  ])

  const iso = (d: Date): string => d.toISOString().slice(0, 10)
  const calendario = edificacion.calendario

  // Etiquetas de equipo para las tablas (T6): se componen AQUÍ porque el
  // contexto puro (`ContextoPeriodo`) es de models y no conoce el nombre.
  const equipoEtiquetas: EtiquetasEquipo = new Map(
    equipos.map((e) => [e.id, etiquetaEquipo(e.tipo, e.espacio?.nombre)] as const)
  )

  const contexto: ContextoPeriodo = {
    equipos: equipos.map((e) => ({ id: e.id, bloqueId: e.bloqueId, espacioId: e.espacioId })),
    rangos: rangos.map((r) => ({
      fechaInicio: iso(r.fechaInicio),
      fechaFin: iso(r.fechaFin),
      tipoDia: r.tipoDia,
    })),
    config: {
      horaInicioOperacion: calendario.horaInicioOperacion,
      horasOperacionDia: calendario.horasOperacionDia,
    },
    politica: {
      domingosOperativos: calendario.domingosOperativos ?? true,
      festivosOperativos: calendario.festivosOperativos ?? true,
    },
    horarios: horarios
      .filter((h) => vigenciaTraslapaMes(h, { mes, ano }))
      .map((h) => ({
        nombre: h.nombre,
        diasSemana: h.diasSemana,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        desde: h.desde ? iso(h.desde) : null,
        hasta: h.hasta ? iso(h.hasta) : null,
        edificacionId,
        bloqueId: h.bloqueId,
        espacioId: h.espacioId,
        equipoId: h.equipoId,
      })),
  }
  return {
    ok: true,
    equipoEtiquetas,
    contexto: {
      ...contexto,
      // AC6: mismo flag que lee el importador (calendario); ausente = H fijo.
      usarHorariosXe: calendario.usarHorariosXe === true,
    },
  }
}

/** Metadatos de la escritura: quién escribió, desde qué camino y con qué lote. */
interface MetaPersistencia {
  origen: UsoOrigen
  calculadoPor: string | null
  loteId?: string | null
}

/**
 * Marca el periodo como FALLIDO con su mensaje (AC6: trazabilidad del fallo).
 * Guarda AC7: un resultado CALCULADO ya comprometido JAMÁS se degrada — el
 * fallo se reporta al caller pero el estado persistido queda intacto.
 *
 * `meta` (T6): cuando el fallo pertenece a un lote masivo se registra su
 * `origen`, `loteId` y `calculadoPor` para que el resumen y la trazabilidad
 * distingan corridas; sin `meta` el comportamiento es el histórico.
 */
async function marcarFallido(
  periodo: { edificacionId: string; mes: number; ano: number },
  mensaje: string,
  meta?: { origen: UsoOrigen; loteId?: string | null; calculadoPor?: string | null }
): Promise<void> {
  const clave = {
    edificacionId_mes_ano: {
      edificacionId: periodo.edificacionId,
      mes: periodo.mes,
      ano: periodo.ano,
    },
  }
  await prisma.$transaction(async (tx) => {
    const previo = await tx.usoPeriodo.findUnique({ where: clave })
    if (previo?.estado === 'CALCULADO') return
    const ahora = new Date()
    await tx.usoPeriodo.upsert({
      where: clave,
      update: {
        estado: 'FALLIDO',
        error: mensaje,
        calculandoEn: null,
        ...(meta
          ? { origen: meta.origen, loteId: meta.loteId ?? null, calculadoPor: meta.calculadoPor ?? null }
          : {}),
      },
      create: {
        edificacionId: periodo.edificacionId,
        mes: periodo.mes,
        ano: periodo.ano,
        estado: 'FALLIDO',
        error: mensaje,
        origen: meta?.origen ?? 'INDIVIDUAL',
        loteId: meta?.loteId ?? null,
        calculadoPor: meta?.calculadoPor ?? null,
        calculandoEn: null,
        calculadoEn: ahora,
      },
    })
  })
}

type ResultadoPersistencia = {
  estado: UsoPeriodoEstado
  equiposCalculados: number
  equiposRevisar: number
}

/**
 * Paso 4 del pipeline: UNA transacción por periodo (design §3.3):
 * claim `CALCULANDO` → reescritura completa del detalle del periodo → upsert
 * final con estado/contadores/advertencias. Idempotente por las claves
 * únicas `@@unique([edificacionId, mes, ano])` y `@@unique([equipoId, mes,
 * ano])`. Solo este módulo transiciona estados (design §4).
 *
 * Resolución BR5 (spec §3.3 + design §2.1, lectura estricta y consistente):
 * un equipo sin horario vigente o sin días operativos NO genera fila de
 * detalle (nunca filas «rellenadas con ceros»); su motivo («Sin horario
 * vigente» / «Sin días operativos») vive en `advertencias` del periodo y el
 * periodo queda en REVISAR vía `equiposRevisar = equiposEsperados −
 * detalle.length`. En consecuencia, `motivoRevision` y el estado REVISAR de
 * `uso_equipo_periodo` solo aplican a filas PERSISTIDAS, y este pipeline
 * persiste únicamente filas que el núcleo calculó (horas/días ≥ 1, garantía
 * de `usoEquiposDelMes`); una anomalía de uso cero se superficia a nivel de
 * periodo, jamás como fila en ceros.
 */
async function persistirPeriodo(
  periodo: { edificacionId: string; mes: number; ano: number },
  resultado: ResultadoPeriodo,
  meta: MetaPersistencia
): Promise<ResultadoPersistencia> {
  const ahora = new Date()
  const equiposCalculados = resultado.detalle.length
  const equiposRevisar = Math.max(0, resultado.equiposEsperados - equiposCalculados)
  const estadoFinal: UsoPeriodoEstado = equiposRevisar > 0 ? 'REVISAR' : 'CALCULADO'
  const advertencias = JSON.stringify(resultado.advertencias)
  const clave = {
    edificacionId_mes_ano: {
      edificacionId: periodo.edificacionId,
      mes: periodo.mes,
      ano: periodo.ano,
    },
  }
  const base = {
    edificacionId: periodo.edificacionId,
    mes: periodo.mes,
    ano: periodo.ano,
  }

  return await prisma.$transaction(async (tx) => {
    // Reclamo (design §4): un reclamo CALCULANDO con TTL vigente es de otra
    // ejecución ⇒ se niega sin escribir; uno vencido se recupera (CLAIM_TTL_MS).
    const previo = await tx.usoPeriodo.findUnique({ where: clave })
    if (previo?.estado === 'CALCULANDO' && previo.calculandoEn) {
      const fresco = ahora.getTime() - previo.calculandoEn.getTime() < CLAIM_TTL_MS
      if (fresco) throw new ReclamoDenegado()
    }

    // La fila queda CALCULANDO mientras corre el periodo.
    await tx.usoPeriodo.upsert({
      where: clave,
      update: { estado: 'CALCULANDO', calculandoEn: ahora, error: null },
      create: { ...base, estado: 'CALCULANDO', calculandoEn: ahora, origen: meta.origen },
    })

    // Reescritura completa del alcance periodo + edificación (nunca hay
    // duplicados: se borra el alcance antes del createMany).
    await tx.usoEquipoPeriodo.deleteMany({
      where: {
        mes: periodo.mes,
        ano: periodo.ano,
        equipo: { bloque: { edificacionId: periodo.edificacionId } },
      },
    })
    if (resultado.detalle.length > 0) {
      await tx.usoEquipoPeriodo.createMany({
        data: resultado.detalle.map((d) => ({
          equipoId: d.equipoId,
          mes: periodo.mes,
          ano: periodo.ano,
          horasUsoDia: d.horasUsoDia,
          diasUsoMes: d.diasUsoMes,
          estado: d.estado,
          horarioGanador: d.horarioGanador,
          motivoRevision: d.motivoRevision ?? null,
        })),
      })
    }

    const final = {
      estado: estadoFinal,
      equiposEsperados: resultado.equiposEsperados,
      equiposCalculados,
      equiposRevisar,
      advertencias,
      error: null,
      origen: meta.origen,
      loteId: meta.loteId ?? null,
      calculadoEn: ahora,
      calculadoPor: meta.calculadoPor,
      calculandoEn: null,
    }
    await tx.usoPeriodo.upsert({ where: clave, update: final, create: { ...base, ...final } })

    return { estado: estadoFinal, equiposCalculados, equiposRevisar }
  })
}

/** Fila de `uso_periodo` mínima para decidir conservación y retomada (T6). */
type FilaPeriodoGuardada = {
  estado: string
  loteId: string | null
  calculandoEn: Date | null
}

/** Periodo del intervalo con su clasificación BR4 y su fila almacenada. */
type PeriodoClasificado = {
  clave: string
  mes: number
  ano: number
  estado: UsoPeriodoEstado | null
  clasificacion: Clasificacion
  equiposEsperados: number
  equiposCalculados: number
  advertencias: string[]
  fila: FilaPeriodoGuardada | null
}

/**
 * Clasificación BR4 de TODO el intervalo leyendo únicamente resultados de uso
 * (AC5/AC3: las facturas nunca participan). Compartida por la vista previa
 * (AC4) y el executor (T6): ambos deben ver exactamente lo mismo.
 */
async function clasificarIntervalo(
  edificacionId: string,
  desde: PeriodoRef,
  hasta: PeriodoRef
): Promise<PeriodoClasificado[]> {
  const [equiposActuales, periodosAlmacenados, detallesAlmacenados] = await Promise.all([
    prisma.equipoElectrico.count({ where: { bloque: { edificacionId } } }),
    prisma.usoPeriodo.findMany({
      where: { edificacionId, ano: { gte: desde.ano, lte: hasta.ano } },
    }),
    prisma.usoEquipoPeriodo.findMany({
      where: { ano: { gte: desde.ano, lte: hasta.ano }, equipo: { bloque: { edificacionId } } },
    }),
  ])

  const periodos = expandirIntervalo(desde, hasta)
  const claves = new Set(periodos.map(clavePeriodo))
  const guardados = new Map(
    periodosAlmacenados
      .filter((p) => claves.has(clavePeriodo(p)))
      .map((p) => [clavePeriodo(p), p] as const)
  )
  const detalles = new Map<string, DetalleAlmacenado[]>()
  for (const d of detallesAlmacenados) {
    const clave = clavePeriodo({ mes: d.mes, ano: d.ano })
    if (!claves.has(clave)) continue
    const lista = detalles.get(clave) ?? []
    lista.push({ estado: d.estado, horasUsoDia: d.horasUsoDia, diasUsoMes: d.diasUsoMes })
    detalles.set(clave, lista)
  }

  return periodos.map((p) => {
    const clave = clavePeriodo(p)
    const guardado = guardados.get(clave) ?? null
    const almacenado: PeriodoAlmacenado | null = guardado && {
      estado: guardado.estado,
      equiposEsperados: guardado.equiposEsperados,
      calculadoEn: guardado.calculadoEn,
      calculadoPor: guardado.calculadoPor,
      detalles: detalles.get(clave) ?? [],
    }
    return {
      clave,
      mes: p.mes,
      ano: p.ano,
      estado: guardado?.estado ?? null,
      clasificacion: clasificarPeriodos(almacenado, equiposActuales),
      equiposEsperados: guardado?.equiposEsperados ?? equiposActuales,
      equiposCalculados: guardado?.equiposCalculados ?? 0,
      advertencias: parsearAdvertencias(guardado?.advertencias ?? null),
      fila: guardado && {
        estado: guardado.estado,
        loteId: guardado.loteId,
        calculandoEn: guardado.calculandoEn,
      },
    }
  })
}

/** Vista previa de intervalo masivo (AC4/AC5) — SOLO LECTURA. */
export async function prepararCalculoMasivo(
  edificacionId: string,
  desde: PeriodoRef,
  hasta: PeriodoRef
): Promise<Exito<{ vistaPrevia: VistaPrevia }>> {
  try {
    const auth = await autorizarCalculoUso()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const id = String(edificacionId ?? '').trim()
    if (!id) return { estado: 'error', mensaje: 'La edificación es obligatoria.' }

    // Re-validación server-side (AC2): el cliente nunca dicta el intervalo.
    const intervalo = intervaloSchema.safeParse({ desde, hasta })
    if (!intervalo.success) {
      return {
        estado: 'error',
        mensaje: intervalo.error.issues[0]?.message ?? 'Intervalo inválido.',
      }
    }

    const edificacion = await prisma.edificacion.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!edificacion) return { estado: 'error', mensaje: 'La edificación indicada no existe.' }

    // Una sola pasada de lecturas; las facturas SOLO alimentan la columna de
    // referencia «Con factura» (R3/AC3): nunca clasifican ni gatean periodos.
    const [clasificados, facturas] = await Promise.all([
      clasificarIntervalo(id, desde, hasta),
      prisma.facturaEnergia.groupBy({
        by: ['periodo'],
        where: { edificacionId: id },
        _count: { _all: true },
      }),
    ])
    const conFactura = new Set(facturas.map((f) => f.periodo))

    const periodos: PeriodoVistaPrevia[] = clasificados.map((f) => ({
      clave: f.clave,
      estado: f.estado,
      clasificacion: f.clasificacion,
      equiposEsperados: f.equiposEsperados,
      equiposCalculados: f.equiposCalculados,
      conFactura: conFactura.has(f.clave),
      advertencias: f.advertencias,
    }))

    // `pendientes` = periodos que el modo por defecto escribirá (mismo
    // conjunto que `seEscribiran`); fallidos/revisar son subconjuntos.
    const conteos = { existentes: 0, pendientes: 0, fallidos: 0, revisar: 0, conFactura: 0 }
    for (const f of periodos) {
      if (f.clasificacion === 'existente-intacto') conteos.existentes += 1
      else conteos.pendientes += 1
      if (f.clasificacion === 'fallido') conteos.fallidos += 1
      if (f.clasificacion === 'revisar') conteos.revisar += 1
      if (f.conFactura) conteos.conFactura += 1
    }

    // AC5.3: el modo por defecto solo escribe lo que NO está intacto;
    // los intactos se conservan (nunca aparecen aquí).
    const seEscribiran = periodos
      .filter((f) => f.clasificacion !== 'existente-intacto')
      .map((f) => f.clave)

    return {
      estado: 'ok',
      vistaPrevia: {
        intervalo: { desde, hasta, cantidadMeses: clasificados.length },
        periodos,
        conteos,
        seEscribiran,
      },
    }
  } catch (error) {
    console.error('Error en prepararCalculoMasivo:', error)
    return { estado: 'error', mensaje: MSJ_VISTA_FALLA }
  }
}

/** Etiqueta compuesta de un equipo, con el id como respaldo histórico. */
type DetalleConNombre = DetalleEquipo & { nombreEquipo: string }
type FilaPorFechaConNombre = {
  equipoId: string
  nombreEquipo: string
  fecha: string
  horas: number
}
type TrazabilidadConNombre = ResultadoPeriodo['trazabilidad'][number] & {
  nombreEquipo: string
}

/** Cálculo individual de un periodo (AC1/AC14). */
export async function calcularUsoIndividual(
  edificacionId: string,
  mes: number,
  ano: number,
  opts?: { recalculo?: boolean }
): Promise<
  Exito<{
    detalle: DetalleConNombre[]
    porFecha: FilaPorFechaConNombre[]
    consolidaciones: ResultadoPeriodo['consolidaciones']
    advertencias: string[]
    trazabilidad: TrazabilidadConNombre[]
    periodo: { estado: string }
    conservado?: boolean
  }>
> {
  // Fuera del try: el catch de FALLIDO necesita el id normalizado.
  const id = String(edificacionId ?? '').trim()
  try {
    const auth = await autorizarCalculoUso()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    if (!id) return { estado: 'error', mensaje: 'La edificación es obligatoria.' }

    // Re-validación server-side (AC2): mes/año nunca llegan sin validar.
    if (!periodoSchema.safeParse({ mes, ano }).success) {
      return { estado: 'error', mensaje: 'Periodo inválido (mes 1-12, año válido).' }
    }

    // 3. Contexto operativo completo (BR5: no inventar horarios/calendario).
    const carga = await cargarContextoPeriodo(id, mes, ano)
    if (!carga.ok) return { estado: 'error', mensaje: carga.mensaje }

    // 4. Integridad (AC5/BR4): intact && !recalculo ⇒ conservar sin escribir
    // (design §5.2); «desactualizado» y demás estados recalculan por completo.
    const previo = await cargarPeriodoAlmacenado(id, mes, ano)
    const clasificacion = clasificarPeriodos(previo, carga.contexto.equipos.length)
    if (previo && clasificacion === 'existente-intacto' && opts?.recalculo !== true) {
      return {
        estado: 'ok',
        detalle: [],
        porFecha: [],
        consolidaciones: {
          espacios: [],
          bloques: [],
          edificacion: { equipos: 0, horasUsoDia: 0, diasUsoMes: 0 },
        },
        advertencias: previo.advertencias,
        trazabilidad: [],
        periodo: { estado: previo.estado },
        conservado: true,
      }
    }

    // 5. Cálculo puro (AC7: la ruta de cálculo no escribe). Sin
    // `incluirHorarioDeEquipo`: la jerarquía resuelve con equipoId siempre
    // (design §2.1/§2.3, spec R1); el origen del valor lo decide el flag
    // `usarHorariosXe` del contexto.
    const resultado = calcularPeriodo({ edificacionId: id, mes, ano, contexto: carga.contexto })

    // 6. Persistencia idempotente (claim → rewrite → cierre) design §3.3.
    const persistencia = await persistirPeriodo({ edificacionId: id, mes, ano }, resultado, {
      origen: 'INDIVIDUAL',
      calculadoPor: auth.userId,
      loteId: null,
    })

    // 7. Auditoría del cálculo (AC14; la persistencia usa la misma traza).
    const calculados = resultado.detalle.filter((d) => d.estado === 'CALCULADO').length
    await auditarAccion({
      action: 'uso.calcular',
      targetId: id,
      detail: `Periodo ${clavePeriodo({ mes, ano })}: ${calculados} calculados, ${persistencia.equiposRevisar} en revisión.`,
    })

    // Etiquetas de equipo (T6, decisión de binding): las tablas muestran
    // «TIPO · Espacio» como texto principal y el id solo como respaldo.
    const etiqueta = (equipoId: string): string =>
      carga.equipoEtiquetas.get(equipoId) ?? equipoId

    return {
      estado: 'ok',
      detalle: resultado.detalle.map((d) => ({ ...d, nombreEquipo: etiqueta(d.equipoId) })),
      porFecha: resultado.detalle.flatMap((d) =>
        d.porFecha.map((f) => ({
          equipoId: d.equipoId,
          nombreEquipo: etiqueta(d.equipoId),
          fecha: f.fecha,
          horas: f.horas,
        }))
      ),
      consolidaciones: resultado.consolidaciones,
      advertencias: resultado.advertencias,
      trazabilidad: resultado.trazabilidad.map((fila) => ({
        ...fila,
        nombreEquipo: etiqueta(fila.equipoId),
      })),
      periodo: { estado: persistencia.estado },
    }
  } catch (error) {
    // Reclamo denegado: no es un fallo de este cálculo ⇒ sin FALLIDO ni auditoría.
    if (error instanceof ReclamoDenegado) return { estado: 'error', mensaje: MSJ_CLAIM }
    console.error('Error en calcularUsoIndividual:', error)
    // AC6/AC7: el periodo queda FALLIDO trazable, salvo que ya esté CALCULADO.
    try {
      await marcarFallido({ edificacionId: id, mes, ano }, MSJ_FALLA)
    } catch (falloMarcado) {
      console.error('No fue posible marcar el periodo como FALLIDO:', falloMarcado)
    }
    return { estado: 'error', mensaje: MSJ_FALLA }
  }
}

// ============================================================
// T6 — ejecución masiva por lotes (design §5.3)
// AC3 · AC6 · AC7 · AC8 · AC10 · AC11 · AC12 · AC14
// ============================================================

/** Desenlace de un periodo dentro del lote (design §5.3). */
export type DesenlacePeriodo = 'calculado' | 'revisar' | 'fallido' | 'conservado'

/** Periodo atendido (o conservado) en una invocación del lote. */
export interface ProcesadoLote {
  clave: string
  resultado: DesenlacePeriodo
  mensaje?: string
}

/** Respuesta de una invocación de `ejecutarCalculoMasivo` (design §5.3). */
export interface EjecucionLote {
  loteId: string
  procesados: ProcesadoLote[]
  restantes: number
  continuar: boolean
  resumenParcial: ResumenEjecucion
}

/** Entrada de la action; el esquema de validación es `ejecutarSchema` (models). */
export interface EntradaEjecucion {
  edificacionId: string
  desde: PeriodoRef
  hasta: PeriodoRef
  loteId?: string
}

/** Lote por defecto cuando el cliente no manda uno (retomada = re-derivar). */
function generarLoteId(): string {
  return crypto.randomUUID()
}

/**
 * Contadores del intervalo tras la llamada (AC8): partición EXCLUSIVA de todos
 * los periodos, distinguiendo lo que escribió ESTE lote de lo conservado.
 */
async function resumirEjecucion(
  edificacionId: string,
  desde: PeriodoRef,
  hasta: PeriodoRef,
  lote: string
): Promise<ResumenEjecucion> {
  const clasificados = await clasificarIntervalo(edificacionId, desde, hasta)
  const resumen: ResumenEjecucion = {
    calculados: 0,
    conservados: 0,
    fallidos: 0,
    revisar: 0,
    pendientes: 0,
  }
  for (const f of clasificados) {
    const intentadoPorEsteLote =
      f.fila?.loteId === lote &&
      f.fila.estado !== 'PENDIENTE' &&
      f.fila.estado !== 'CALCULANDO'
    if (intentadoPorEsteLote) {
      if (f.estado === 'CALCULADO') resumen.calculados += 1
      else if (f.estado === 'REVISAR') resumen.revisar += 1
      else resumen.fallidos += 1
    } else if (f.clasificacion === 'existente-intacto') resumen.conservados += 1
    else if (f.clasificacion === 'fallido') resumen.fallidos += 1
    else if (f.clasificacion === 'revisar') resumen.revisar += 1
    else resumen.pendientes += 1
  }
  return resumen
}

/**
 * Ejecuta el cálculo masivo por INVOCACIONES acotadas (AC11): a lo sumo
 * `MAX_PERIODOS_POR_LLAMADA` periodos y dentro de `PRESUPUESTO_MS`, y devuelve
 * `continuar` con los restantes para que el cliente itere. Idempotente (AC10):
 * cada llamada re-deriva el pendiente en el servidor; lo intacto se conserva
 * y lo ya intentado por ESTE lote no se repite (≤1 reintento por periodo por
 * ejecución, design §4). Sin parámetro de recálculo (AC9): el recálculo es
 * SOLO `recalcularPeriodos`. Las facturas nunca se leen aquí (AC3).
 */
export async function ejecutarCalculoMasivo(
  entrada: EntradaEjecucion
): Promise<Exito<{ ejecucion: EjecucionLote }>> {
  try {
    const auth = await autorizarCalculoUso()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    // Re-validación server-side (AC2): el cliente nunca dicta el intervalo.
    const valido = ejecutarSchema.safeParse(entrada)
    if (!valido.success) {
      return {
        estado: 'error',
        mensaje: valido.error.issues[0]?.message ?? 'Datos de ejecución inválidos.',
      }
    }
    const { edificacionId, desde, hasta } = valido.data
    const lote = valido.data.loteId ?? generarLoteId()

    const edificacion = await prisma.edificacion.findUnique({
      where: { id: edificacionId },
      select: { id: true },
    })
    if (!edificacion) return { estado: 'error', mensaje: 'La edificación indicada no existe.' }

    // Pendientes del servidor (AC5/AC10): nada intacto, nada ya intentado por
    // ESTE lote (su FALLIDO/REVISAR es trazabilidad, no un pendiente nuevo).
    const clasificados = await clasificarIntervalo(edificacionId, desde, hasta)
    const pendientes = clasificados.filter((f) => {
      if (f.clasificacion === 'existente-intacto') return false
      if (
        f.fila?.loteId === lote &&
        f.fila.estado !== 'PENDIENTE' &&
        f.fila.estado !== 'CALCULANDO'
      ) {
        return false
      }
      return true
    })

    await auditarAccion({
      action: 'uso.calcular_masivo.inicio',
      targetId: edificacionId,
      detail: `Lote ${lote}: ${clavePeriodo(desde)}–${clavePeriodo(hasta)}, ${pendientes.length} periodo(s) pendiente(s).`,
    })

    // Paso 0 (design §4): placeholder PENDIENTE de cada seleccionado no
    // intacto, para que una ejecución interrumpida deje filas visibles. Nunca
    // sobre un reclamo CALCULANDO vigente de OTRA ejecución (AC7).
    for (const p of pendientes) {
      const reclamoVigente =
        p.fila?.estado === 'CALCULANDO' &&
        p.fila.calculandoEn !== null &&
        Date.now() - p.fila.calculandoEn.getTime() < CLAIM_TTL_MS
      if (reclamoVigente) continue
      await prisma.usoPeriodo.upsert({
        where: { edificacionId_mes_ano: { edificacionId, mes: p.mes, ano: p.ano } },
        update: { estado: 'PENDIENTE', loteId: lote },
        create: {
          edificacionId,
          mes: p.mes,
          ano: p.ano,
          estado: 'PENDIENTE',
          origen: 'MASIVO',
          loteId: lote,
        },
      })
    }

    // Intactos: reportados como conservados (o calculados si ya los escribió
    // ESTE lote en una llamada anterior de la misma ejecución).
    const procesados: ProcesadoLote[] = []
    for (const f of clasificados) {
      if (f.clasificacion !== 'existente-intacto') continue
      procesados.push({
        clave: f.clave,
        resultado: f.fila?.loteId === lote ? 'calculado' : 'conservado',
      })
    }

    // Bucle de periodos: tope de N por llamada + presupuesto de Vercel (AC11).
    const inicio = Date.now()
    let intentados = 0
    for (const p of pendientes) {
      if (intentados >= MAX_PERIODOS_POR_LLAMADA) break
      if (presupuestoRestante(Date.now(), inicio) <= 0) break
      intentados += 1
      try {
        // 1–3. Contexto del periodo + núcleo puro (una pasada por mes).
        const carga = await cargarContextoPeriodo(edificacionId, p.mes, p.ano)
        if (!carga.ok) throw new ErrorDeCarga(carga.mensaje)
        const resultado = calcularPeriodo({
          edificacionId,
          mes: p.mes,
          ano: p.ano,
          contexto: carga.contexto,
        })
        // 4. Persistencia con reclamo: UNA transacción por periodo (design §3.3).
        const persistencia = await persistirPeriodo(
          { edificacionId, mes: p.mes, ano: p.ano },
          resultado,
          { origen: 'MASIVO', calculadoPor: auth.userId, loteId: lote }
        )
        procesados.push({
          clave: p.clave,
          resultado: persistencia.estado === 'REVISAR' ? 'revisar' : 'calculado',
        })
      } catch (error) {
        // 5. Un fallo NUNCA detiene el lote ni degrada lo comprometido (AC6/AC7).
        if (error instanceof ReclamoDenegado) {
          // Reclamo ajeno vigente: se reporta, pero ni FALLIDO ni escritura.
          procesados.push({ clave: p.clave, resultado: 'fallido', mensaje: MSJ_CLAIM })
          continue
        }
        const mensaje = error instanceof ErrorDeCarga ? error.message : MSJ_FALLA
        if (!(error instanceof ErrorDeCarga)) {
          console.error(`Error en el periodo ${p.clave} del lote ${lote}:`, error)
        }
        try {
          await marcarFallido({ edificacionId, mes: p.mes, ano: p.ano }, mensaje, {
            origen: 'MASIVO',
            loteId: lote,
            calculadoPor: auth.userId,
          })
        } catch (falloMarcado) {
          console.error('No fue posible marcar el periodo como FALLIDO:', falloMarcado)
        }
        procesados.push({ clave: p.clave, resultado: 'fallido', mensaje })
      }
    }

    const resumenParcial = await resumirEjecucion(edificacionId, desde, hasta, lote)
    const restantes = pendientes.length - intentados

    await auditarAccion({
      action: 'uso.calcular_masivo.fin',
      targetId: edificacionId,
      detail:
        `Lote ${lote}: ${resumenParcial.calculados} calculado(s), ` +
        `${resumenParcial.conservados} conservado(s), ${resumenParcial.fallidos} fallido(s), ` +
        `${resumenParcial.revisar} en revisión, ${resumenParcial.pendientes} pendiente(s).`,
    })

    return {
      estado: 'ok',
      ejecucion: {
        loteId: lote,
        procesados,
        restantes,
        continuar: restantes > 0,
        resumenParcial,
      },
    }
  } catch (error) {
    console.error('Error en ejecutarCalculoMasivo:', error)
    return { estado: 'error', mensaje: MSJ_FALLA }
  }
}

// ============================================================
// T7 — recálculo explícito y confirmado (design §5.4) — AC9 · AC14
// ============================================================

/** Desenlace de un periodo recalculado (design §5.4). */
export type DesenlaceRecalculo = 'calculado' | 'revisar' | 'fallido'

/** Periodo recalculado con sus contadores antes/después (AC9, auditoría). */
export interface PeriodoRecalculado {
  clave: string
  resultado: DesenlaceRecalculo
  antes: { equiposCalculados: number }
  despues: { equiposCalculados: number }
}

const MSJ_RECALCULO_FALLA = 'No fue posible recalcular los periodos. Intente de nuevo.'

/**
 * Recálculo EXPLÍCITO y confirmado de periodos existentes (AC9). Es la ÚNICA
 * ruta que sobrescribe resultados —incluso intactos— que el modo por defecto
 * conservaría; `ejecutarCalculoMasivo` y `calcularUsoIndividual` jamás aceptan
 * un parámetro de recálculo. Exige `confirmado: true` (literal Zod), valida
 * que cada periodo pedido EXISTA (el recálculo solo reemplaza resultados
 * existentes, nunca inventa periodos), lo recalcula por periodo con origen
 * `RECALCULO` y audita antes/después (AC14).
 */
export async function recalcularPeriodos(
  entrada: RecalcularPeriodosInput
): Promise<Exito<{ recalculados: PeriodoRecalculado[]; mensaje: string }>> {
  try {
    const auth = await autorizarCalculoUso()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const valido = recalcularSchema.safeParse(entrada)
    if (!valido.success) {
      return {
        estado: 'error',
        mensaje: valido.error.issues[0]?.message ?? 'Datos de recálculo inválidos.',
      }
    }
    const { edificacionId, periodos } = valido.data

    const edificacion = await prisma.edificacion.findUnique({
      where: { id: edificacionId },
      select: { id: true },
    })
    if (!edificacion) return { estado: 'error', mensaje: 'La edificación indicada no existe.' }

    // Snapshot previo (design §5.4): cada periodo pedido DEBE existir; el
    // recálculo reemplaza resultados existentes, nunca los crea desde cero.
    const previas = await prisma.usoPeriodo.findMany({
      where: { edificacionId, mes: { in: periodos.map((p) => p.mes) } },
    })
    const porClave = new Map(previas.map((f) => [clavePeriodo(f), f] as const))
    const faltantes = periodos.filter((p) => !porClave.has(clavePeriodo(p)))
    if (faltantes.length > 0) {
      return {
        estado: 'error',
        mensaje:
          `No existen resultados de uso para el/los periodo(s) ${faltantes
            .map(clavePeriodo)
            .join(', ')}. Calcúlelos antes de recalcular.`,
      }
    }

    const recalculados: PeriodoRecalculado[] = []
    for (const p of periodos) {
      const clave = clavePeriodo(p)
      const previa = porClave.get(clave)
      const antes = { equiposCalculados: previa?.equiposCalculados ?? 0 }
      try {
        // Contexto → núcleo puro → persistencia con reclamo (una tx por periodo).
        const carga = await cargarContextoPeriodo(edificacionId, p.mes, p.ano)
        if (!carga.ok) throw new ErrorDeCarga(carga.mensaje)
        const resultado = calcularPeriodo({
          edificacionId,
          mes: p.mes,
          ano: p.ano,
          contexto: carga.contexto,
        })
        const persistencia = await persistirPeriodo(
          { edificacionId, mes: p.mes, ano: p.ano },
          resultado,
          { origen: 'RECALCULO', calculadoPor: auth.userId, loteId: null }
        )
        recalculados.push({
          clave,
          resultado: persistencia.estado === 'REVISAR' ? 'revisar' : 'calculado',
          antes,
          despues: { equiposCalculados: persistencia.equiposCalculados },
        })
      } catch (error) {
        // Reclamo ajeno fresco: no se recalcula este periodo; se reporta intacto.
        if (error instanceof ReclamoDenegado) {
          recalculados.push({ clave, resultado: 'fallido', antes, despues: antes })
          continue
        }
        console.error(`Error al recalcular el periodo ${clave}:`, error)
        try {
          await marcarFallido({ edificacionId, mes: p.mes, ano: p.ano }, MSJ_RECALCULO_FALLA)
        } catch (falloMarcado) {
          console.error('No fue posible marcar el periodo como FALLIDO:', falloMarcado)
        }
        recalculados.push({ clave, resultado: 'fallido', antes, despues: antes })
      }
    }

    // Auditoría (AC14): quién recalculó qué, con antes→después por periodo.
    await auditarAccion({
      action: 'uso.recalcular',
      targetId: edificacionId,
      detail:
        `Periodos ${recalculados.map((r) => r.clave).join(', ')}: ` +
        recalculados
          .map((r) => `${r.clave} ${r.antes.equiposCalculados}→${r.despues.equiposCalculados} equipos`)
          .join('; '),
    })

    return {
      estado: 'ok',
      recalculados,
      mensaje: `Se recalcularon ${recalculados.length} periodo(s).`,
    }
  } catch (error) {
    console.error('Error en recalcularPeriodos:', error)
    return { estado: 'error', mensaje: MSJ_RECALCULO_FALLA }
  }
}
