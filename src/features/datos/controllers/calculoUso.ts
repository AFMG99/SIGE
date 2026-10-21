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
  calcularPeriodo,
  clasificarPeriodos,
  clavePeriodo,
  expandirIntervalo,
  intervaloSchema,
  periodoSchema,
  type ContextoPeriodo,
  type DetalleAlmacenado,
  type PeriodoAlmacenado,
  type PeriodoRef,
  type PeriodoVistaPrevia,
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

type ResultadoCarga =
  | { ok: true; contexto: ContextoPeriodo }
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
      select: { id: true, bloqueId: true, espacioId: true },
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
 */
async function marcarFallido(
  periodo: { edificacionId: string; mes: number; ano: number },
  mensaje: string
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
      update: { estado: 'FALLIDO', error: mensaje, calculandoEn: null },
      create: {
        edificacionId: periodo.edificacionId,
        mes: periodo.mes,
        ano: periodo.ano,
        estado: 'FALLIDO',
        error: mensaje,
        origen: 'INDIVIDUAL',
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
    const [equiposActuales, periodosAlmacenados, detallesAlmacenados, facturas] =
      await Promise.all([
        prisma.equipoElectrico.count({ where: { bloque: { edificacionId: id } } }),
        prisma.usoPeriodo.findMany({
          where: { edificacionId: id, ano: { gte: desde.ano, lte: hasta.ano } },
        }),
        prisma.usoEquipoPeriodo.findMany({
          where: { ano: { gte: desde.ano, lte: hasta.ano }, equipo: { bloque: { edificacionId: id } } },
        }),
        prisma.facturaEnergia.groupBy({
          by: ['periodo'],
          where: { edificacionId: id },
          _count: { _all: true },
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
    const conFactura = new Set(facturas.map((f) => f.periodo))

    const filas: PeriodoVistaPrevia[] = periodos.map((p) => {
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
        estado: guardado?.estado ?? null,
        clasificacion: clasificarPeriodos(almacenado, equiposActuales),
        equiposEsperados: guardado?.equiposEsperados ?? equiposActuales,
        equiposCalculados: guardado?.equiposCalculados ?? 0,
        conFactura: conFactura.has(clave),
        advertencias: parsearAdvertencias(guardado?.advertencias ?? null),
      }
    })

    // `pendientes` = periodos que el modo por defecto escribirá (mismo
    // conjunto que `seEscribiran`); fallidos/revisar son subconjuntos.
    const conteos = { existentes: 0, pendientes: 0, fallidos: 0, revisar: 0, conFactura: 0 }
    for (const f of filas) {
      if (f.clasificacion === 'existente-intacto') conteos.existentes += 1
      else conteos.pendientes += 1
      if (f.clasificacion === 'fallido') conteos.fallidos += 1
      if (f.clasificacion === 'revisar') conteos.revisar += 1
      if (f.conFactura) conteos.conFactura += 1
    }

    // AC5.3: el modo por defecto solo escribe lo que NO está intacto;
    // los intactos se conservan (nunca aparecen aquí).
    const seEscribiran = filas
      .filter((f) => f.clasificacion !== 'existente-intacto')
      .map((f) => f.clave)

    return {
      estado: 'ok',
      vistaPrevia: {
        intervalo: { desde, hasta, cantidadMeses: periodos.length },
        periodos: filas,
        conteos,
        seEscribiran,
      },
    }
  } catch (error) {
    console.error('Error en prepararCalculoMasivo:', error)
    return { estado: 'error', mensaje: MSJ_VISTA_FALLA }
  }
}

/** Cálculo individual de un periodo (AC1/AC14). */
export async function calcularUsoIndividual(
  edificacionId: string,
  mes: number,
  ano: number,
  opts?: { recalculo?: boolean }
): Promise<
  Exito<{
    detalle: ResultadoPeriodo['detalle']
    porFecha: { equipoId: string; fecha: string; horas: number }[]
    consolidaciones: ResultadoPeriodo['consolidaciones']
    advertencias: string[]
    trazabilidad: ResultadoPeriodo['trazabilidad']
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

    return {
      estado: 'ok',
      detalle: resultado.detalle,
      porFecha: resultado.detalle.flatMap((d) =>
        d.porFecha.map((f) => ({ equipoId: d.equipoId, fecha: f.fecha, horas: f.horas }))
      ),
      consolidaciones: resultado.consolidaciones,
      advertencias: resultado.advertencias,
      trazabilidad: resultado.trazabilidad,
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
