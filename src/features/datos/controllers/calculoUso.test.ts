import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================
// Dobles backend para las server actions de cálculo de uso (T4).
// - Prisma en memoria: cada método mutante registra su nombre en
//   `escrituras`, de modo que «cero escrituras» (AC4/AC14) se afirma
//   sin spies adicionales.
// - authz controlable (`permitido` / `sinSesion`) para AC14.
// - `auditoria` spy para las aserciones de auditoría (AC14).
// ============================================================

const t = vi.hoisted(() => {
  type FilaPeriodo = {
    id: string
    edificacionId: string
    mes: number
    ano: number
    estado: string
    equiposEsperados: number
    equiposCalculados: number
    equiposRevisar: number
    advertencias: string | null
    error: string | null
    origen: string
    loteId: string | null
    calculadoEn: Date | null
    calculadoPor: string | null
    calculandoEn: Date | null
  }

  type FilaDetalle = {
    id: string
    equipoId: string
    mes: number
    ano: number
    horasUsoDia: number
    diasUsoMes: number
    estado: string
    horarioGanador: string | null
    motivoRevision: string | null
    calculadoEn: Date
  }

  const estado = {
    sinSesion: false,
    permitido: true,
    usuario: {
      id: 'usr-test',
      email: 'gestor@tecnologicoantioquia.edu.co',
      name: 'Gestor Energético',
      role: 'GESTOR_ENERGETICO',
      avatarUrl: null as string | null,
    },
    edificaciones: new Map<string, { id: string; calendario: Record<string, unknown> | null }>(),
    bloques: new Map<string, string>(),
    equipos: [] as {
      id: string
      bloqueId: string
      espacioId: string
      tipo: string
      espacioNombre: string
    }[],
    rangos: [] as { calendarioId: string; fechaInicio: Date; fechaFin: Date; tipoDia: string }[],
    horarios: [] as Record<string, unknown>[],
    facturas: [] as { edificacionId: string; periodo: string }[],
    usoPeriodos: [] as FilaPeriodo[],
    usoEquipos: [] as FilaDetalle[],
    escrituras: [] as string[],
    lecturas: { facturas: 0 },
    auditorias: [] as { action: string; targetId: string; detail: string }[],
    fallos: { rangos: false, createMany: new Set<number>() },
    seq: 0,
  }

  const nid = (prefijo: string): string => `${prefijo}-${String(++estado.seq).padStart(4, '0')}`

  const equiposDe = (edificacionId: string): {
    id: string
    bloqueId: string
    espacioId: string | null
    tipo: string
    espacioNombre: string
  }[] => {
    const bloques = new Set(
      Array.from(estado.bloques.entries())
        .filter(([, edif]) => edif === edificacionId)
        .map(([bloqueId]) => bloqueId)
    )
    return estado.equipos.filter((eq) => bloques.has(eq.bloqueId))
  }

  const coincideAno = (anoFila: number, filtro: unknown): boolean => {
    if (typeof filtro === 'number') return anoFila === filtro
    const rango = filtro as { gte: number; lte: number } | undefined
    if (!rango) return true
    return anoFila >= rango.gte && anoFila <= rango.lte
  }

  const enEdificacion = (equipoId: string, edificacionId: string | undefined): boolean => {
    if (!edificacionId) return true
    const eq = estado.equipos.find((e) => e.id === equipoId)
    return !!eq && estado.bloques.get(eq.bloqueId) === edificacionId
  }

  const defaultsPeriodo = {
    equiposEsperados: 0,
    equiposCalculados: 0,
    equiposRevisar: 0,
    advertencias: null,
    error: null,
    loteId: null,
    calculadoEn: null,
    calculadoPor: null,
    calculandoEn: null,
  }

  const prisma: Record<string, unknown> = {
    edificacion: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        estado.edificaciones.get(where.id) ?? null,
    },
    equipoElectrico: {
      findMany: async ({ where }: { where: { bloque: { edificacionId: string } } }) =>
        equiposDe(where.bloque.edificacionId).map((e) => ({
          id: e.id,
          bloqueId: e.bloqueId,
          espacioId: e.espacioId,
          tipo: e.tipo,
          espacio: { nombre: e.espacioNombre },
        })),
      count: async ({ where }: { where: { bloque: { edificacionId: string } } }) =>
        equiposDe(where.bloque.edificacionId).length,
    },
    rangoCalendario: {
      findMany: async ({ where }: { where: { calendario: { edificacionId: string } } }) => {
        if (estado.fallos.rangos) throw new Error('No fue posible conectar con la base de datos.')
        const edif = estado.edificaciones.get(where.calendario.edificacionId)
        const calendarioId = (edif?.calendario as { id?: string } | null)?.id ?? null
        return estado.rangos
          .filter((r) => r.calendarioId === calendarioId)
          .map((r) => ({ ...r }))
      },
    },
    horarioEquipo: {
      findMany: async ({ where }: { where: { edificacionId: string } }) =>
        estado.horarios
          .filter((h) => h.edificacionId === where.edificacionId)
          .map((h) => ({ ...h })),
    },
    facturaEnergia: {
      groupBy: async ({ where }: { where: { edificacionId: string } }) => {
        estado.lecturas.facturas += 1
        const porPeriodo = new Map<string, number>()
        for (const f of estado.facturas) {
          if (f.edificacionId !== where.edificacionId) continue
          porPeriodo.set(f.periodo, (porPeriodo.get(f.periodo) ?? 0) + 1)
        }
        return Array.from(porPeriodo, ([periodo, n]) => ({ periodo, _count: { _all: n } }))
      },
    },
    usoPeriodo: {
      findUnique: async ({
        where,
      }: {
        where: { edificacionId_mes_ano: { edificacionId: string; mes: number; ano: number } }
      }) => {
        const k = where.edificacionId_mes_ano
        return (
          estado.usoPeriodos.find(
            (f) => f.edificacionId === k.edificacionId && f.mes === k.mes && f.ano === k.ano
          ) ?? null
        )
      },
      findMany: async ({ where }: { where: { edificacionId: string; ano?: { gte: number; lte: number } } }) =>
        estado.usoPeriodos
          .filter((f) => f.edificacionId === where.edificacionId && coincideAno(f.ano, where.ano))
          .map((f) => ({ ...f })),
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { edificacionId_mes_ano: { edificacionId: string; mes: number; ano: number } }
        update: Partial<FilaPeriodo>
        create: Partial<FilaPeriodo> & { edificacionId: string; mes: number; ano: number }
      }) => {
        estado.escrituras.push('usoPeriodo.upsert')
        const k = where.edificacionId_mes_ano
        const existe = estado.usoPeriodos.find(
          (f) => f.edificacionId === k.edificacionId && f.mes === k.mes && f.ano === k.ano
        )
        if (existe) {
          Object.assign(existe, update)
          return { ...existe }
        }
        const nueva: FilaPeriodo = {
          id: nid('up'),
          ...defaultsPeriodo,
          estado: 'PENDIENTE',
          origen: 'INDIVIDUAL',
          ...create,
        }
        estado.usoPeriodos.push(nueva)
        return { ...nueva }
      },
    },
    usoEquipoPeriodo: {
      findMany: async (args: {
        where: { mes?: number; ano?: number | { gte: number; lte: number }; equipo?: { bloque: { edificacionId: string } } }
      }) => {
        const { where } = args
        return estado.usoEquipos
          .filter((f) => {
            if (typeof where.mes === 'number' && f.mes !== where.mes) return false
            if (!coincideAno(f.ano, where.ano)) return false
            if (!enEdificacion(f.equipoId, where.equipo?.bloque?.edificacionId)) return false
            return true
          })
          .map((f) => ({ ...f }))
      },
      deleteMany: async (args: {
        where: { mes: number; ano: number; equipo: { bloque: { edificacionId: string } } }
      }) => {
        estado.escrituras.push('usoEquipoPeriodo.deleteMany')
        const { where } = args
        const antes = estado.usoEquipos.length
        estado.usoEquipos = estado.usoEquipos.filter(
          (f) =>
            !(
              f.mes === where.mes &&
              f.ano === where.ano &&
              enEdificacion(f.equipoId, where.equipo.bloque.edificacionId)
            )
        )
        return { count: antes - estado.usoEquipos.length }
      },
      createMany: async ({ data }: { data: Omit<FilaDetalle, 'id' | 'calculadoEn'>[] }) => {
        estado.escrituras.push('usoEquipoPeriodo.createMany')
        // Fallo inyectado por mes (AC6): simula un fallo de BD en la
        // persistencia de UN periodo para probar la continuación del lote.
        if (data.length > 0 && estado.fallos.createMany.has(data[0].mes)) {
          throw new Error('Fallo inyectado en la persistencia del periodo.')
        }
        for (const d of data) {
          const duplicada = estado.usoEquipos.some(
            (f) => f.equipoId === d.equipoId && f.mes === d.mes && f.ano === d.ano
          )
          if (duplicada) {
            throw Object.assign(new Error('Unique constraint failed on (equipoId, mes, ano)'), {
              code: 'P2002',
            })
          }
          estado.usoEquipos.push({ id: nid('ue'), calculadoEn: new Date(), ...d })
        }
        return { count: data.length }
      },
    },
    $transaction: async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const respaldoPeriodos = structuredClone(estado.usoPeriodos)
      const respaldoDetalles = structuredClone(estado.usoEquipos)
      try {
        return await fn(prisma)
      } catch (error) {
        estado.usoPeriodos.splice(0, estado.usoPeriodos.length, ...respaldoPeriodos)
        estado.usoEquipos.splice(0, estado.usoEquipos.length, ...respaldoDetalles)
        throw error
      }
    },
  }

  return { estado, prisma }
})

vi.mock('@/shared/models/prisma', () => ({ prisma: t.prisma }))
vi.mock('@/shared/models/authz', () => ({
  getCurrentUser: async () => (t.estado.sinSesion ? null : t.estado.usuario),
  canWithOverrides: async () => t.estado.permitido,
}))
vi.mock('@/features/datos/controllers/auditoria', () => ({
  auditarAccion: async (p: { action: string; targetId: string; detail: string }) => {
    t.estado.auditorias.push(p)
  },
}))

import {
  calcularUsoIndividual,
  ejecutarCalculoMasivo,
  prepararCalculoMasivo,
} from '@/features/datos/controllers/calculoUso'
import { PRESUPUESTO_MS } from '@/features/datos/models/calculoUso'

// ============================================================
// Fixtures deterministas
// ============================================================

const MSJ_SESION = 'Sesión expirada. Inicie sesión nuevamente.'
const MSJ_PERMISO = 'Su rol no tiene permiso para calcular horas de uso.'

function reiniciar(): void {
  const e = t.estado
  e.sinSesion = false
  e.permitido = true
  e.edificaciones.clear()
  e.bloques.clear()
  e.equipos = []
  e.rangos = []
  e.horarios = []
  e.facturas = []
  e.usoPeriodos = []
  e.usoEquipos = []
  e.escrituras = []
  e.auditorias = []
  e.lecturas.facturas = 0
  e.fallos = { rangos: false, createMany: new Set<number>() }
  e.seq = 0
}

interface OpcionesEdificacion {
  usarHorariosXe?: boolean
  conCalendario?: boolean
  horasOperacionDia?: number
}

function nuevaEdificacion(opciones: OpcionesEdificacion = {}): {
  id: string
  calendarioId: string
} {
  const n = t.estado.edificaciones.size + 1
  const id = `edif-${n}`
  const calendarioId = `cal-${n}`
  t.estado.edificaciones.set(id, {
    id,
    calendario:
      opciones.conCalendario === false
        ? null
        : {
            id: calendarioId,
            edificacionId: id,
            horaInicioOperacion: 6,
            horasOperacionDia: opciones.horasOperacionDia ?? 8,
            temperaturaBase: 21,
            usarHorariosXe: opciones.usarHorariosXe ?? false,
            domingosOperativos: true,
            festivosOperativos: true,
          },
  })
  return { id, calendarioId }
}

function nuevoBloque(edificacionId: string, codigo: string): string {
  const id = `bloque-${codigo}-${edificacionId}`
  t.estado.bloques.set(id, edificacionId)
  return id
}

function nuevoEquipo(
  bloqueId: string,
  clave: string,
  tipo = 'HVAC',
  espacioNombre?: string
): string {
  const id = `eq-${clave}-${bloqueId}`
  t.estado.equipos.push({
    id,
    bloqueId,
    espacioId: `esp-${bloqueId}`,
    tipo,
    espacioNombre: espacioNombre ?? `Espacio ${clave}`,
  })
  return id
}

function rangoAnual(calendarioId: string, ano: number): void {
  t.estado.rangos.push({
    calendarioId,
    fechaInicio: new Date(Date.UTC(ano, 0, 1)),
    fechaFin: new Date(Date.UTC(ano, 11, 31)),
    tipoDia: 'LECTIVO',
  })
}

interface OpcionesHorario {
  edificacionId: string
  nombre?: string
  bloqueId?: string | null
  equipoId?: string | null
  horaInicio?: number
  horaFin?: number
  diasSemana?: string[]
  desde?: Date | null
  hasta?: Date | null
}

function nuevoHorario(opciones: OpcionesHorario): void {
  t.estado.horarios.push({
    id: nidHorario(),
    edificacionId: opciones.edificacionId,
    bloqueId: opciones.bloqueId ?? null,
    espacioId: null,
    equipoId: opciones.equipoId ?? null,
    nombre: opciones.nombre ?? 'Turno mañana',
    diasSemana: opciones.diasSemana ?? ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'],
    horaInicio: opciones.horaInicio ?? 6,
    horaFin: opciones.horaFin ?? 14,
    desde: opciones.desde ?? null,
    hasta: opciones.hasta ?? null,
  })
}

let contadorHorarios = 0
function nidHorario(): string {
  contadorHorarios += 1
  return `hor-${contadorHorarios}`
}

beforeEach(() => {
  reiniciar()
  contadorHorarios = 0
})

// ============================================================
// AC14 — gates de autorización en TODA action
// ============================================================

describe('autorización de las acciones (AC14)', () => {
  it('permiso denegado ⇒ error en vista previa e individual, sin escrituras ni auditoría', async () => {
    t.estado.permitido = false

    const vista = await prepararCalculoMasivo('edif-1', { mes: 1, ano: 2024 }, { mes: 2, ano: 2024 })
    expect(vista).toMatchObject({ estado: 'error', mensaje: MSJ_PERMISO })

    const individual = await calcularUsoIndividual('edif-1', 3, 2024)
    expect(individual).toMatchObject({ estado: 'error', mensaje: MSJ_PERMISO })

    expect(t.estado.escrituras).toEqual([])
    expect(t.estado.auditorias).toEqual([])
  })

  it('sin sesión ⇒ «Sesión expirada» en ambas acciones, sin escrituras', async () => {
    t.estado.sinSesion = true

    const vista = await prepararCalculoMasivo('edif-1', { mes: 1, ano: 2024 }, { mes: 2, ano: 2024 })
    expect(vista).toMatchObject({ estado: 'error', mensaje: MSJ_SESION })

    const individual = await calcularUsoIndividual('edif-1', 3, 2024)
    expect(individual).toMatchObject({ estado: 'error', mensaje: MSJ_SESION })

    expect(t.estado.escrituras).toEqual([])
  })
})

// ============================================================
// AC4 — prepararCalculoMasivo es SOLO LECTURA
// ============================================================

describe('prepararCalculoMasivo — vista previa solo lectura (AC4)', () => {
  it('reporta intervalo, existentes y pendientes con facturas de referencia, sin escribir nada', async () => {
    const { id, calendarioId } = nuevaEdificacion()
    rangoAnual(calendarioId, 2024)
    const bloque = nuevoBloque(id, 'A')
    const eq1 = nuevoEquipo(bloque, '1')
    const eq2 = nuevoEquipo(bloque, '2')
    nuevoHorario({ edificacionId: id })

    // 2024-03: resultado intacto (previo) + factura de referencia.
    t.estado.usoPeriodos.push({
      id: 'up-seed-1',
      edificacionId: id,
      mes: 3,
      ano: 2024,
      estado: 'CALCULADO',
      equiposEsperados: 2,
      equiposCalculados: 2,
      equiposRevisar: 0,
      advertencias: '[]',
      error: null,
      origen: 'MASIVO',
      loteId: 'lote-previo',
      calculadoEn: new Date('2024-04-01T00:00:00Z'),
      calculadoPor: 'usr-previo',
      calculandoEn: null,
    })
    for (const equipoId of [eq1, eq2]) {
      t.estado.usoEquipos.push({
        id: `seed-${equipoId}`,
        equipoId,
        mes: 3,
        ano: 2024,
        horasUsoDia: 8,
        diasUsoMes: 31,
        estado: 'CALCULADO',
        horarioGanador: 'EDIFICACION/Turno mañana',
        motivoRevision: null,
        calculadoEn: new Date('2024-04-01T00:00:00Z'),
      })
    }
    t.estado.facturas.push({ edificacionId: id, periodo: '2024-03' })

    const res = await prepararCalculoMasivo(id, { mes: 3, ano: 2024 }, { mes: 4, ano: 2024 })
    expect(res.estado).toBe('ok')
    if (res.estado !== 'ok') return

    expect(res.vistaPrevia.intervalo).toEqual({
      desde: { mes: 3, ano: 2024 },
      hasta: { mes: 4, ano: 2024 },
      cantidadMeses: 2,
    })
    expect(res.vistaPrevia.periodos).toHaveLength(2)
    expect(res.vistaPrevia.periodos[0]).toMatchObject({
      clave: '2024-03',
      estado: 'CALCULADO',
      clasificacion: 'existente-intacto',
      equiposEsperados: 2,
      equiposCalculados: 2,
      conFactura: true,
      advertencias: [],
    })
    expect(res.vistaPrevia.periodos[1]).toMatchObject({
      clave: '2024-04',
      estado: null,
      clasificacion: 'nuevo',
      equiposEsperados: 2,
      equiposCalculados: 0,
      conFactura: false,
    })
    expect(res.vistaPrevia.conteos).toEqual({
      existentes: 1,
      pendientes: 1,
      fallidos: 0,
      revisar: 0,
      conFactura: 1,
    })
    // Cero escrituras: ni upserts, ni deleteMany/createMany, ni transacciones.
    expect(t.estado.escrituras).toEqual([])
    expect(t.estado.auditorias).toEqual([])
  })

  it('seEscribiran revela exactamente los periodos que el modo por defecto escribirá (AC5.3)', async () => {
    const { id, calendarioId } = nuevaEdificacion()
    rangoAnual(calendarioId, 2024)
    const bloque = nuevoBloque(id, 'A')
    const eq1 = nuevoEquipo(bloque, '1')
    const eq2 = nuevoEquipo(bloque, '2')
    nuevoHorario({ edificacionId: id })

    const calculadoEn = new Date('2024-04-01T00:00:00Z')
    const sembrarPeriodo = (
      mes: number,
      parcial: {
        estado: string
        equiposEsperados: number
        equiposCalculados: number
        error?: string | null
        calculadoPor?: string | null
      }
    ): void => {
      t.estado.usoPeriodos.push({
        id: `up-${mes}`,
        edificacionId: id,
        mes,
        ano: 2024,
        estado: parcial.estado,
        equiposEsperados: parcial.equiposEsperados,
        equiposCalculados: parcial.equiposCalculados,
        equiposRevisar: 0,
        advertencias: '[]',
        error: parcial.error ?? null,
        origen: 'MASIVO',
        loteId: null,
        calculadoEn,
        calculadoPor: parcial.calculadoPor ?? 'usr-previo',
        calculandoEn: null,
      })
    }

    // Marzo: intacto ⇒ se conserva. Abril: fallido ⇒ se escribe.
    sembrarPeriodo(3, { estado: 'CALCULADO', equiposEsperados: 2, equiposCalculados: 2 })
    sembrarPeriodo(4, { estado: 'FALLIDO', equiposEsperados: 0, equiposCalculados: 0, error: 'boom' })
    // Mayo: calculado con filas faltantes ⇒ pendiente. Junio: inventario cambió ⇒ desactualizado.
    sembrarPeriodo(5, { estado: 'CALCULADO', equiposEsperados: 2, equiposCalculados: 1 })
    sembrarPeriodo(6, { estado: 'CALCULADO', equiposEsperados: 1, equiposCalculados: 1 })

    const fila = (equipoId: string, mes: number): void => {
      t.estado.usoEquipos.push({
        id: `det-${mes}-${equipoId}`,
        equipoId,
        mes,
        ano: 2024,
        horasUsoDia: 8,
        diasUsoMes: 31,
        estado: 'CALCULADO',
        horarioGanador: 'EDIFICACION/Turno mañana',
        motivoRevision: null,
        calculadoEn,
      })
    }
    fila(eq1, 3)
    fila(eq2, 3)
    fila(eq1, 5)
    fila(eq1, 6)

    const res = await prepararCalculoMasivo(id, { mes: 3, ano: 2024 }, { mes: 6, ano: 2024 })
    expect(res.estado).toBe('ok')
    if (res.estado !== 'ok') return

    const porClave = new Map(res.vistaPrevia.periodos.map((p) => [p.clave, p]))
    expect(porClave.get('2024-03')?.clasificacion).toBe('existente-intacto')
    expect(porClave.get('2024-04')?.clasificacion).toBe('fallido')
    expect(porClave.get('2024-05')?.clasificacion).toBe('pendiente')
    expect(porClave.get('2024-06')?.clasificacion).toBe('desactualizado')

    expect(res.vistaPrevia.seEscribiran).toEqual(['2024-04', '2024-05', '2024-06'])
    expect(res.vistaPrevia.conteos).toEqual({
      existentes: 1,
      pendientes: 3,
      fallidos: 1,
      revisar: 0,
      conFactura: 0,
    })
    expect(t.estado.escrituras).toEqual([])
  })
})

// ============================================================
// AC2 — re-validación en el servidor (el cliente nunca dicta)
// ============================================================

describe('re-validación server-side (AC2)', () => {
  it('rechaza intervalos y periodos inválidos sin escribir nada', async () => {
    // Vista previa: mes fuera de rango, invertido y tope de 120 meses.
    const rango = await prepararCalculoMasivo('edif-x', { mes: 13, ano: 2024 }, { mes: 2, ano: 2024 })
    expect(rango).toMatchObject({ estado: 'error', mensaje: 'El mes debe estar entre 1 y 12' })

    const invertido = await prepararCalculoMasivo('edif-x', { mes: 6, ano: 2024 }, { mes: 1, ano: 2024 })
    expect(invertido).toMatchObject({
      estado: 'error',
      mensaje: 'El mes final debe ser posterior o igual al inicial',
    })

    const largo = await prepararCalculoMasivo('edif-x', { mes: 1, ano: 2000 }, { mes: 2, ano: 2100 })
    expect(largo.estado).toBe('error')
    expect(largo.estado === 'error' && largo.mensaje).toContain('120 meses')

    // Individual: periodo inválido y edificación vacía.
    const mesInvalido = await calcularUsoIndividual('edif-x', 13, 2024)
    expect(mesInvalido).toMatchObject({
      estado: 'error',
      mensaje: 'Periodo inválido (mes 1-12, año válido).',
    })

    const anoInvalido = await calcularUsoIndividual('edif-x', 1, 1999)
    expect(anoInvalido).toMatchObject({
      estado: 'error',
      mensaje: 'Periodo inválido (mes 1-12, año válido).',
    })

    const sinEdificacion = await calcularUsoIndividual('  ', 3, 2024)
    expect(sinEdificacion).toMatchObject({ estado: 'error', mensaje: 'La edificación es obligatoria.' })

    expect(t.estado.escrituras).toEqual([])
    expect(t.estado.auditorias).toEqual([])
  })
})

// ============================================================
// AC1/AC14 — calcularUsoIndividual: contexto → núcleo → persistencia → auditoría
// ============================================================

describe('calcularUsoIndividual — pipeline individual (AC1/AC14)', () => {
  it('carga el contexto, calcula, persiste en transacción con reclamo y audita', async () => {
    const { id, calendarioId } = nuevaEdificacion()
    rangoAnual(calendarioId, 2024)
    const bloque = nuevoBloque(id, 'A')
    const eq1 = nuevoEquipo(bloque, '1')
    const eq2 = nuevoEquipo(bloque, '2')
    nuevoHorario({ edificacionId: id })

    const res = await calcularUsoIndividual(id, 3, 2024)
    expect(res.estado).toBe('ok')
    if (res.estado !== 'ok') return

    // Resultado del núcleo puro (AC1)
    expect(res.detalle).toHaveLength(2)
    expect(res.detalle.map((d) => d.equipoId).sort()).toEqual([eq1, eq2].sort())
    for (const d of res.detalle) {
      expect(d.horasUsoDia).toBe(8)
      expect(d.diasUsoMes).toBe(31)
      expect(d.estado).toBe('CALCULADO')
      expect(d.horarioGanador).toMatch(/^EDIFICACION\//)
      expect(d.porFecha).toHaveLength(31)
    }
    expect(res.porFecha).toHaveLength(62) // 2 equipos × 31 días (desglose aplanado)
    expect(res.advertencias).toEqual([])
    expect(res.trazabilidad).toHaveLength(2)
    expect(res.consolidaciones.edificacion).toEqual({ equipos: 2, horasUsoDia: 16, diasUsoMes: 62 })
    expect(res.periodo.estado).toBe('CALCULADO')
    expect(res.conservado).toBeUndefined()

    // Persistencia: periodo + filas idempotentes, contadores y metadatos
    expect(t.estado.usoPeriodos).toHaveLength(1)
    expect(t.estado.usoPeriodos[0]).toMatchObject({
      edificacionId: id,
      mes: 3,
      ano: 2024,
      estado: 'CALCULADO',
      equiposEsperados: 2,
      equiposCalculados: 2,
      equiposRevisar: 0,
      calculadoPor: 'usr-test',
      origen: 'INDIVIDUAL',
      loteId: null,
      error: null,
      calculandoEn: null,
    })
    expect(t.estado.usoPeriodos[0].calculadoEn).toBeInstanceOf(Date)
    expect(t.estado.usoPeriodos[0].advertencias).toBe('[]')
    expect(t.estado.usoEquipos).toHaveLength(2)
    expect(t.estado.usoEquipos.every((f) => f.estado === 'CALCULADO')).toBe(true)

    // Mecánica de la transacción (design §3.3): claim → rewrite → final.
    expect(t.estado.escrituras).toEqual([
      'usoPeriodo.upsert',
      'usoEquipoPeriodo.deleteMany',
      'usoEquipoPeriodo.createMany',
      'usoPeriodo.upsert',
    ])

    // Auditoría (AC14)
    expect(t.estado.auditorias).toHaveLength(1)
    expect(t.estado.auditorias[0]).toMatchObject({ action: 'uso.calcular', targetId: id })
    expect(t.estado.auditorias[0].detail).toContain('2024-03')
    expect(t.estado.auditorias[0].detail).toContain('2 calculados')
  })

  it('edificación inexistente ⇒ error sin tocar la base', async () => {
    const res = await calcularUsoIndividual('edif-que-no-existe', 3, 2024)
    expect(res).toMatchObject({ estado: 'error', mensaje: 'La edificación indicada no existe.' })
    expect(t.estado.escrituras).toEqual([])
    expect(t.estado.auditorias).toEqual([])
  })

  it('usarHorariosXe=false (default) ⇒ horas = H fijo; la jerarquía sigue resolviendo el ganador con NIVEL/Nombre', async () => {
    const { id, calendarioId } = nuevaEdificacion()
    rangoAnual(calendarioId, 2024)
    const bloque = nuevoBloque(id, 'A')
    const eq1 = nuevoEquipo(bloque, '1')
    nuevoHorario({ edificacionId: id, nombre: 'General 8h' })
    nuevoHorario({ edificacionId: id, bloqueId: bloque, equipoId: eq1, nombre: 'Equipo 4h', horaFin: 10 })

    const res = await calcularUsoIndividual(id, 3, 2024)
    expect(res.estado).toBe('ok')
    if (res.estado !== 'ok') return

    const eq = res.detalle.find((d) => d.equipoId === eq1)
    // Xe OFF ⇒ valor = H del calendario (6–14 ⇒ 8 h), bit a bit con el importador.
    expect(eq?.horasUsoDia).toBe(8)
    // La jerarquía (R1) sí resuelve el ganador: EQUIPO es el más específico.
    expect(eq?.horarioGanador).toBe('EQUIPO/Equipo 4h')
  })

  it('usarHorariosXe=true ⇒ el horario por equipo gana la jerarquía con nombre exacto', async () => {
    const { id, calendarioId } = nuevaEdificacion({ usarHorariosXe: true })
    rangoAnual(calendarioId, 2024)
    const bloque = nuevoBloque(id, 'A')
    const eq1 = nuevoEquipo(bloque, '1')
    nuevoHorario({ edificacionId: id, nombre: 'General 8h' })
    nuevoHorario({ edificacionId: id, bloqueId: bloque, equipoId: eq1, nombre: 'Equipo 4h', horaFin: 10 })

    const res = await calcularUsoIndividual(id, 3, 2024)
    expect(res.estado).toBe('ok')
    if (res.estado !== 'ok') return

    const eq = res.detalle.find((d) => d.equipoId === eq1)
    expect(eq?.horasUsoDia).toBe(4) // 6–10 ⇒ 4 h/día, nivel EQUIPO
    expect(eq?.horarioGanador).toBe('EQUIPO/Equipo 4h')
  })

  it('reclamo CALCULANDO fresco ⇒ error sin escrituras; stale ⇒ se reclama y calcula', async () => {
    const { id, calendarioId } = nuevaEdificacion()
    rangoAnual(calendarioId, 2024)
    const bloque = nuevoBloque(id, 'A')
    nuevoEquipo(bloque, '1')
    nuevoHorario({ edificacionId: id })

    // Otro proceso está calculando este periodo (reclamo fresco < TTL).
    t.estado.usoPeriodos.push({
      id: 'up-clash',
      edificacionId: id,
      mes: 3,
      ano: 2024,
      estado: 'CALCULANDO',
      equiposEsperados: 0,
      equiposCalculados: 0,
      equiposRevisar: 0,
      advertencias: null,
      error: null,
      origen: 'MASIVO',
      loteId: 'lote-ajeno',
      calculadoEn: null,
      calculadoPor: 'usr-otro',
      calculandoEn: new Date(),
    })

    const denegado = await calcularUsoIndividual(id, 3, 2024)
    expect(denegado.estado).toBe('error')
    expect(denegado.estado === 'error' && denegado.mensaje).toContain('en curso')
    expect(t.estado.escrituras).toEqual([]) // ni claim ni FALLIDO (AC7: no marcar ajeno)
    expect(t.estado.auditorias).toEqual([])
    expect(t.estado.usoPeriodos[0].estado).toBe('CALCULANDO') // intacto

    // Reclamo vencido (6 min > CLAIM_TTL_MS = 5 min): se recupera y calcula.
    t.estado.usoPeriodos[0].calculandoEn = new Date(Date.now() - 6 * 60_000)
    const recuperado = await calcularUsoIndividual(id, 3, 2024)
    expect(recuperado.estado).toBe('ok')
    expect(t.estado.usoPeriodos[0].estado).toBe('CALCULADO')
    expect(t.estado.usoPeriodos[0].calculadoPor).toBe('usr-test')
  })

  it('BR5 mixto: equipo sin horario (Xe ON) ⇒ sin fila en ceros, motivo en advertencias y periodo REVISAR', async () => {
    const { id, calendarioId } = nuevaEdificacion({ usarHorariosXe: true })
    rangoAnual(calendarioId, 2024)
    const bloqueA = nuevoBloque(id, 'A')
    const bloqueB = nuevoBloque(id, 'B')
    const eq1 = nuevoEquipo(bloqueA, '1')
    nuevoEquipo(bloqueB, '2') // sin horario en su ámbito
    nuevoHorario({ edificacionId: id, bloqueId: bloqueA, nombre: 'Bloque A 8h' })

    const res = await calcularUsoIndividual(id, 3, 2024)
    expect(res.estado).toBe('ok')
    if (res.estado !== 'ok') return

    // Solo eq1 genera fila; eq2 NUNCA se rellena con ceros (BR5). Con Xe OFF
    // el H fijo del calendario computaría igual (legado); Xe ON es el único
    // camino donde «Sin horario vigente» puede ocurrir.
    expect(res.detalle).toHaveLength(1)
    expect(res.detalle[0]).toMatchObject({ equipoId: eq1, horasUsoDia: 8, diasUsoMes: 31 })
    expect(res.advertencias).toContain('Sin horario vigente')

    // Periodo REVISAR con contadores que exponen el faltante.
    expect(res.periodo.estado).toBe('REVISAR')
    expect(t.estado.usoPeriodos[0]).toMatchObject({
      estado: 'REVISAR',
      equiposEsperados: 2,
      equiposCalculados: 1,
      equiposRevisar: 1,
    })
    expect(t.estado.usoPeriodos[0].advertencias).toBe(JSON.stringify(['Sin horario vigente']))
    expect(t.estado.usoEquipos).toHaveLength(1) // sin fila fantasma del equipo no computable

    // Auditoría refleja el balance real.
    expect(t.estado.auditorias[0].detail).toContain('1 calculados, 1 en revisión')
  })

  it('periodo intacto ⇒ segunda corrida conserva sin escribir; inventario cambia ⇒ reescribe sin duplicados', async () => {
    const { id, calendarioId } = nuevaEdificacion()
    rangoAnual(calendarioId, 2024)
    const bloque = nuevoBloque(id, 'A')
    nuevoEquipo(bloque, '1')
    nuevoHorario({ edificacionId: id })

    const primera = await calcularUsoIndividual(id, 3, 2024)
    expect(primera.estado).toBe('ok')
    const calculadoEn = t.estado.usoPeriodos[0].calculadoEn

    // Segunda corrida sin cambios: intact && !recalculo ⇒ conservado, CERO escrituras.
    const escriturasTrasPrimera = t.estado.escrituras.length
    const segunda = await calcularUsoIndividual(id, 3, 2024)
    expect(segunda.estado).toBe('ok')
    if (segunda.estado === 'ok') expect(segunda.conservado).toBe(true)
    expect(t.estado.escrituras.length).toBe(escriturasTrasPrimera)
    expect(t.estado.usoPeriodos[0].calculadoEn).toBe(calculadoEn)

    // Inventario crece ⇒ «desactualizado» ⇒ reescritura completa sin P2002.
    nuevoEquipo(bloque, '2')
    const tercera = await calcularUsoIndividual(id, 3, 2024)
    expect(tercera.estado).toBe('ok')
    if (tercera.estado === 'ok') expect(tercera.conservado).toBeUndefined()
    expect(t.estado.usoPeriodos[0]).toMatchObject({
      estado: 'CALCULADO',
      equiposEsperados: 2,
      equiposCalculados: 2,
      equiposRevisar: 0,
    })
    expect(t.estado.usoEquipos).toHaveLength(2)
    expect(t.estado.usoEquipos.map((f) => f.equipoId).sort()).toEqual(
      t.estado.equipos.map((e) => e.id).sort()
    )
  })

  it('fallo inyectado en la carga ⇒ periodo FALLIDO con mensaje; un CALCULADO jamás se degrada', async () => {
    const { id, calendarioId } = nuevaEdificacion()
    rangoAnual(calendarioId, 2024)
    const bloque = nuevoBloque(id, 'A')
    nuevoEquipo(bloque, '1')
    nuevoHorario({ edificacionId: id })

    // Fallo de BD durante la carga: el periodo nuevo queda FALLIDO trazable.
    t.estado.fallos.rangos = true
    const fallo = await calcularUsoIndividual(id, 3, 2024)
    expect(fallo.estado).toBe('error')
    expect(fallo.estado === 'error' && fallo.mensaje).toBe(
      'No fue posible calcular las horas de uso. Intente de nuevo.'
    )
    expect(t.estado.usoPeriodos).toHaveLength(1)
    expect(t.estado.usoPeriodos[0]).toMatchObject({
      estado: 'FALLIDO',
      error: 'No fue posible calcular las horas de uso. Intente de nuevo.',
      equiposCalculados: 0,
      calculandoEn: null,
    })

    // Se recuperó la BD ⇒ reintentar con éxito lo saca de FALLIDO.
    t.estado.fallos.rangos = false
    const ok = await calcularUsoIndividual(id, 3, 2024)
    expect(ok.estado).toBe('ok')
    expect(t.estado.usoPeriodos[0].estado).toBe('CALCULADO')

    // AC7: un fallo posterior no degrada el resultado ya comprometido.
    t.estado.fallos.rangos = true
    const fallo2 = await calcularUsoIndividual(id, 3, 2024)
    expect(fallo2.estado).toBe('error')
    expect(t.estado.usoPeriodos[0].estado).toBe('CALCULADO') // intacto
    expect(t.estado.usoPeriodos[0].error).toBeNull()
  })
})

// ============================================================
// T6 — ejecutarCalculoMasivo: lote masivo por llamadas acotadas
// (AC3 · AC6 · AC7 · AC8 · AC9 · AC10 · AC11 · AC12 · AC14)
// ============================================================

const MSJ_FALLA = 'No fue posible calcular las horas de uso. Intente de nuevo.'

/** Campus determinista: calendario 2024 + bloque A + N equipos + horario 8h. */
function campusBasico(
  opciones: { equipos?: number; usarHorariosXe?: boolean; horarioHasta?: Date } = {}
): {
  id: string
  equipos: string[]
} {
  const { id, calendarioId } = nuevaEdificacion({ usarHorariosXe: opciones.usarHorariosXe })
  rangoAnual(calendarioId, 2024)
  const bloque = nuevoBloque(id, 'A')
  const equipos: string[] = []
  for (let i = 1; i <= (opciones.equipos ?? 1); i++) {
    equipos.push(nuevoEquipo(bloque, String(i)))
  }
  nuevoHorario({ edificacionId: id, hasta: opciones.horarioHasta ?? null })
  return { id, equipos }
}

/** Periodo intacto sembrado a mano (lote ajeno), como si otra corrida lo dejó. */
function sembrarIntacto(id: string, equipos: string[], mes: number, ano: number): Date {
  const calculadoEn = new Date('2024-04-01T00:00:00Z')
  t.estado.usoPeriodos.push({
    id: `up-seed-${mes}`,
    edificacionId: id,
    mes,
    ano,
    estado: 'CALCULADO',
    equiposEsperados: equipos.length,
    equiposCalculados: equipos.length,
    equiposRevisar: 0,
    advertencias: '[]',
    error: null,
    origen: 'MASIVO',
    loteId: 'lote-previo',
    calculadoEn,
    calculadoPor: 'usr-previo',
    calculandoEn: null,
  })
  for (const equipoId of equipos) {
    t.estado.usoEquipos.push({
      id: `det-seed-${mes}-${equipoId}`,
      equipoId,
      mes,
      ano,
      horasUsoDia: 8,
      diasUsoMes: 31,
      estado: 'CALCULADO',
      horarioGanador: 'EDIFICACION/Turno mañana',
      motivoRevision: null,
      calculadoEn,
    })
  }
  return calculadoEn
}

describe('ejecutarCalculoMasivo — lote masivo (T6)', () => {
  it('AC14/AC2: sin permiso, sin sesión o con intervalo inválido ⇒ error sin escrituras ni auditoría', async () => {
    const { id } = campusBasico()
    const desde = { mes: 1, ano: 2024 }
    const hasta = { mes: 2, ano: 2024 }

    t.estado.permitido = false
    const denegado = await ejecutarCalculoMasivo({ edificacionId: id, desde, hasta })
    expect(denegado).toMatchObject({ estado: 'error', mensaje: MSJ_PERMISO })

    t.estado.permitido = true
    t.estado.sinSesion = true
    const sinSesion = await ejecutarCalculoMasivo({ edificacionId: id, desde, hasta })
    expect(sinSesion).toMatchObject({ estado: 'error', mensaje: MSJ_SESION })

    t.estado.sinSesion = false
    const invertido = await ejecutarCalculoMasivo({
      edificacionId: id,
      desde: { mes: 6, ano: 2024 },
      hasta: { mes: 1, ano: 2024 },
    })
    expect(invertido.estado).toBe('error')

    const inexistente = await ejecutarCalculoMasivo({
      edificacionId: 'edif-que-no-existe',
      desde,
      hasta,
    })
    expect(inexistente).toMatchObject({ estado: 'error', mensaje: 'La edificación indicada no existe.' })

    expect(t.estado.escrituras).toEqual([])
    expect(t.estado.auditorias).toEqual([])
  })

  it('AC3: procesa meses sin factura sin consultar facturas; audita inicio/fin y propaga el lote', async () => {
    const { id } = campusBasico()
    // 2024-01 NO tiene factura; 2024-02 sí (solo referencia, R3/AC3).
    t.estado.facturas.push({ edificacionId: id, periodo: '2024-02' })

    const res = await ejecutarCalculoMasivo({
      edificacionId: id,
      desde: { mes: 1, ano: 2024 },
      hasta: { mes: 2, ano: 2024 },
      loteId: 'lote-cliente',
    })
    expect(res.estado).toBe('ok')
    if (res.estado !== 'ok') return

    expect(res.ejecucion.loteId).toBe('lote-cliente')
    expect(res.ejecucion.procesados.map((p) => p.clave)).toEqual(['2024-01', '2024-02'])
    expect(res.ejecucion.procesados.every((p) => p.resultado === 'calculado')).toBe(true)
    expect(res.ejecucion.restantes).toBe(0)
    expect(res.ejecucion.continuar).toBe(false)

    // El mes sin factura quedó CALCULADO con la misma forma que el con factura.
    const enero = t.estado.usoPeriodos.find((f) => f.mes === 1)
    const febrero = t.estado.usoPeriodos.find((f) => f.mes === 2)
    expect(enero).toMatchObject({ estado: 'CALCULADO', loteId: 'lote-cliente', origen: 'MASIVO' })
    expect(febrero).toMatchObject({ estado: 'CALCULADO', equiposCalculados: 1 })
    expect(t.estado.usoEquipos.filter((f) => f.mes === 1)).toHaveLength(1)

    // AC3: el executor NUNCA lee facturas (la referencia vive solo en la vista previa).
    expect(t.estado.lecturas.facturas).toBe(0)

    // Trazabilidad del lote (AC14): auditoría de inicio y de fin.
    expect(t.estado.auditorias.map((a) => a.action)).toEqual([
      'uso.calcular_masivo.inicio',
      'uso.calcular_masivo.fin',
    ])
    expect(t.estado.auditorias[0].detail).toContain('lote-cliente')
    expect(t.estado.auditorias[1].detail).toContain('lote-cliente')
  })

  it('AC11: cada llamada procesa a lo sumo 3 periodos y continúa con un lote nuevo por corrida', async () => {
    const { id } = campusBasico({ equipos: 2 })
    const desde = { mes: 1, ano: 2024 }
    const hasta = { mes: 6, ano: 2024 }

    const primera = await ejecutarCalculoMasivo({ edificacionId: id, desde, hasta })
    expect(primera.estado).toBe('ok')
    if (primera.estado !== 'ok') return
    expect(primera.ejecucion.procesados.map((p) => p.clave)).toEqual([
      '2024-01',
      '2024-02',
      '2024-03',
    ])
    expect(primera.ejecucion.restantes).toBe(3)
    expect(primera.ejecucion.continuar).toBe(true)
    expect(t.estado.usoPeriodos.filter((f) => f.estado === 'CALCULADO')).toHaveLength(3)

    const segunda = await ejecutarCalculoMasivo({ edificacionId: id, desde, hasta })
    expect(segunda.estado).toBe('ok')
    if (segunda.estado !== 'ok') return
    // Lote generado por el servidor cuando el cliente no manda uno.
    expect(primera.ejecucion.loteId).toBeTruthy()
    expect(segunda.ejecucion.loteId).toBeTruthy()
    expect(segunda.ejecucion.loteId).not.toBe(primera.ejecucion.loteId)
    // Los tres ya escritos por la corrida se reportan como conservados de esta
    // llamada; los tres nuevos se calculan (AC11: retomar desde el pendiente).
    expect(
      segunda.ejecucion.procesados.filter((p) => p.resultado === 'calculado').map((p) => p.clave)
    ).toEqual(['2024-04', '2024-05', '2024-06'])
    expect(
      segunda.ejecucion.procesados.filter((p) => p.resultado === 'conservado').map((p) => p.clave)
    ).toEqual(['2024-01', '2024-02', '2024-03'])
    expect(segunda.ejecucion.restantes).toBe(0)
    expect(segunda.ejecucion.continuar).toBe(false)
    expect(t.estado.usoPeriodos.filter((f) => f.estado === 'CALCULADO')).toHaveLength(6)

    // El periodo escrito por la primera llamada quedó con SU lote.
    expect(t.estado.usoPeriodos.find((f) => f.mes === 3)?.loteId).toBe(primera.ejecucion.loteId)
  })

  it('AC11: con el presupuesto agotado se detiene con continuar=true y restantes>0', async () => {
    const { id } = campusBasico()
    const base = 1_700_000_000_000
    const reloj = vi.spyOn(Date, 'now')
    reloj
      .mockReturnValueOnce(base) // instante de inicio del lote
      .mockReturnValueOnce(base + 1_000) // 1ª comprobación: aún hay presupuesto
      .mockReturnValue(base + PRESUPUESTO_MS + 1) // todo lo demás: agotado

    try {
      const res = await ejecutarCalculoMasivo({
        edificacionId: id,
        desde: { mes: 1, ano: 2024 },
        hasta: { mes: 6, ano: 2024 },
      })
      expect(res.estado).toBe('ok')
      if (res.estado !== 'ok') return
      expect(res.ejecucion.procesados.map((p) => p.clave)).toEqual(['2024-01'])
      expect(res.ejecucion.restantes).toBe(5)
      expect(res.ejecucion.continuar).toBe(true)
      expect(t.estado.usoPeriodos.filter((f) => f.estado === 'CALCULADO')).toHaveLength(1)
    } finally {
      reloj.mockRestore()
    }
  })

  it('AC6: el fallo de N lo deja FALLIDO con su mensaje y el lote continúa con N+1', async () => {
    const { id } = campusBasico()
    t.estado.fallos.createMany.add(2) // la persistencia de 2024-02 revienta

    const res = await ejecutarCalculoMasivo({
      edificacionId: id,
      desde: { mes: 1, ano: 2024 },
      hasta: { mes: 3, ano: 2024 },
      loteId: 'lote-ac6',
    })
    expect(res.estado).toBe('ok')
    if (res.estado !== 'ok') return

    expect(res.ejecucion.procesados).toEqual([
      { clave: '2024-01', resultado: 'calculado' },
      { clave: '2024-02', resultado: 'fallido', mensaje: MSJ_FALLA },
      { clave: '2024-03', resultado: 'calculado' },
    ])
    expect(res.ejecucion.restantes).toBe(0)
    expect(res.ejecucion.continuar).toBe(false)
    expect(res.ejecucion.resumenParcial).toEqual({
      calculados: 2,
      conservados: 0,
      fallidos: 1,
      revisar: 0,
      pendientes: 0,
    })

    // El periodo fallido queda trazable (mensaje + lote) y N+1 CALCULADO.
    expect(t.estado.usoPeriodos.find((f) => f.mes === 2)).toMatchObject({
      estado: 'FALLIDO',
      error: MSJ_FALLA,
      loteId: 'lote-ac6',
      origen: 'MASIVO',
      calculandoEn: null,
    })
    expect(t.estado.usoPeriodos.find((f) => f.mes === 3)?.estado).toBe('CALCULADO')
    expect(t.estado.usoEquipos.some((f) => f.mes === 2)).toBe(false)
  })

  it('AC7: un fallo jamás toca los periodos intactos (fila y detalle byte a byte)', async () => {
    const { id, equipos } = campusBasico({ equipos: 2 })
    const calculadoEn = sembrarIntacto(id, equipos, 1, 2024)
    const antes = structuredClone({
      periodos: t.estado.usoPeriodos,
      detalles: t.estado.usoEquipos,
      escrituras: t.estado.escrituras.length,
    })

    t.estado.fallos.createMany.add(2)
    const res = await ejecutarCalculoMasivo({
      edificacionId: id,
      desde: { mes: 1, ano: 2024 },
      hasta: { mes: 2, ano: 2024 },
    })
    expect(res.estado).toBe('ok')
    if (res.estado !== 'ok') return

    // 2024-01 intacto: conservado SIN placeholder ni reescritura alguna.
    expect(t.estado.usoPeriodos.find((f) => f.mes === 1)).toEqual(antes.periodos[0])
    // Igualdad de valor (no de identidad): el respaldo del $transaction del
    // falso prisma restaura clonas estructurales, así que el Date cambia de
    // instancia pero NUNCA de instante — que es lo que exige AC7.
    expect(t.estado.usoPeriodos.find((f) => f.mes === 1)?.calculadoEn).toEqual(calculadoEn)
    expect(t.estado.usoEquipos.filter((f) => f.mes === 1)).toEqual(
      antes.detalles.filter((f) => f.mes === 1)
    )
    expect(res.ejecucion.procesados).toEqual([
      { clave: '2024-01', resultado: 'conservado' },
      { clave: '2024-02', resultado: 'fallido', mensaje: MSJ_FALLA },
    ])
    // Solo la transacción del periodo fallido escribió.
    expect(t.estado.usoPeriodos.find((f) => f.mes === 2)?.estado).toBe('FALLIDO')
  })

  it('AC10: segunda corrida sobre el mismo intervalo ⇒ 0 calculados, N conservados, cero escrituras', async () => {
    const { id } = campusBasico({ equipos: 2 })
    const desde = { mes: 1, ano: 2024 }
    const hasta = { mes: 3, ano: 2024 }

    const primera = await ejecutarCalculoMasivo({ edificacionId: id, desde, hasta })
    expect(primera.estado).toBe('ok')
    const escriturasTrasPrimera = t.estado.escrituras.length
    const calculadoEn = t.estado.usoPeriodos.map((f) => f.calculadoEn)
    const detalleTrasPrimera = structuredClone(t.estado.usoEquipos)

    const segunda = await ejecutarCalculoMasivo({ edificacionId: id, desde, hasta })
    expect(segunda.estado).toBe('ok')
    if (segunda.estado !== 'ok') return

    expect(segunda.ejecucion.procesados).toEqual([
      { clave: '2024-01', resultado: 'conservado' },
      { clave: '2024-02', resultado: 'conservado' },
      { clave: '2024-03', resultado: 'conservado' },
    ])
    expect(segunda.ejecucion.restantes).toBe(0)
    expect(segunda.ejecucion.continuar).toBe(false)
    expect(segunda.ejecucion.resumenParcial).toEqual({
      calculados: 0,
      conservados: 3,
      fallidos: 0,
      revisar: 0,
      pendientes: 0,
    })
    // Ni una sola escritura nueva: filas, timestamps y detalle intactos.
    expect(t.estado.escrituras.length).toBe(escriturasTrasPrimera)
    expect(t.estado.usoPeriodos.map((f) => f.calculadoEn)).toEqual(calculadoEn)
    expect(t.estado.usoEquipos).toEqual(detalleTrasPrimera)
    expect(t.estado.usoEquipos).toHaveLength(6) // 2 equipos × 3 meses, sin duplicados
  })

  it('AC8: el resumen parcial particiona el intervalo (calculados/conservados/fallidos/revisar/pendientes)', async () => {
    // Xe ON + horario vigente SOLO hasta marzo ⇒ en abril ningún equipo tiene
    // horario ganador ⇒ sin filas ⇒ periodo REVISAR (BR5).
    const { id, equipos } = campusBasico({
      equipos: 2,
      usarHorariosXe: true,
      horarioHasta: new Date(Date.UTC(2024, 2, 31)),
    })
    sembrarIntacto(id, equipos, 1, 2024)
    t.estado.fallos.createMany.add(3) // 2024-03 falla en la persistencia

    const res = await ejecutarCalculoMasivo({
      edificacionId: id,
      desde: { mes: 1, ano: 2024 },
      hasta: { mes: 5, ano: 2024 },
    })
    expect(res.estado).toBe('ok')
    if (res.estado !== 'ok') return

    expect(res.ejecucion.procesados).toEqual([
      { clave: '2024-01', resultado: 'conservado' },
      { clave: '2024-02', resultado: 'calculado' },
      { clave: '2024-03', resultado: 'fallido', mensaje: MSJ_FALLA },
      { clave: '2024-04', resultado: 'revisar' },
    ])
    expect(res.ejecucion.restantes).toBe(1) // 2024-05 aún sin procesar
    expect(res.ejecucion.continuar).toBe(true)
    // Los cinco buckets particionan el intervalo sin solaparse (AC8).
    expect(res.ejecucion.resumenParcial).toEqual({
      calculados: 1,
      conservados: 1,
      fallidos: 1,
      revisar: 1,
      pendientes: 1,
    })
    const suma = Object.values(res.ejecucion.resumenParcial).reduce((a, b) => a + b, 0)
    expect(suma).toBe(5)
  })

  it('AC9: sin parámetro de recálculo; un periodo intacto se conserva aunque el payload lo pida', async () => {
    const { id, equipos } = campusBasico({ equipos: 2 })
    const calculadoEn = sembrarIntacto(id, equipos, 1, 2024)
    const escrituras = t.estado.escrituras.length

    const payload = {
      edificacionId: id,
      desde: { mes: 1, ano: 2024 },
      hasta: { mes: 1, ano: 2024 },
      // El cliente podría mandar un parámetro de recálculo: la action lo ignora
      // (AC9: el recálculo es otra acción, jamás este executor).
      recalculo: true,
    }
    const res = await ejecutarCalculoMasivo(payload)
    expect(res.estado).toBe('ok')
    if (res.estado !== 'ok') return
    expect(res.ejecucion.procesados).toEqual([{ clave: '2024-01', resultado: 'conservado' }])
    expect(t.estado.escrituras.length).toBe(escrituras)
    expect(t.estado.usoPeriodos[0].calculadoEn).toBe(calculadoEn)
    expect(t.estado.usoPeriodos[0].loteId).toBe('lote-previo')
  })

  it('AC7: un reclamo ajeno fresco se reporta fallido sin escribir ni marcar FALLIDO', async () => {
    const { id } = campusBasico()
    t.estado.usoPeriodos.push({
      id: 'up-clash',
      edificacionId: id,
      mes: 1,
      ano: 2024,
      estado: 'CALCULANDO',
      equiposEsperados: 1,
      equiposCalculados: 0,
      equiposRevisar: 0,
      advertencias: null,
      error: null,
      origen: 'MASIVO',
      loteId: 'lote-ajeno',
      calculadoEn: null,
      calculadoPor: 'usr-otro',
      calculandoEn: new Date(),
    })

    const res = await ejecutarCalculoMasivo({
      edificacionId: id,
      desde: { mes: 1, ano: 2024 },
      hasta: { mes: 2, ano: 2024 },
    })
    expect(res.estado).toBe('ok')
    if (res.estado !== 'ok') return

    expect(res.ejecucion.procesados[0]).toEqual({
      clave: '2024-01',
      resultado: 'fallido',
      mensaje: 'Hay un cálculo de este periodo en curso. Intente de nuevo en unos minutos.',
    })
    expect(res.ejecucion.procesados[1]).toEqual({ clave: '2024-02', resultado: 'calculado' })
    // El reclamo ajeno sigue CALCULANDO con su lote: ni placeholder ni FALLIDO.
    expect(t.estado.usoPeriodos.find((f) => f.mes === 1)).toMatchObject({
      estado: 'CALCULANDO',
      loteId: 'lote-ajeno',
      error: null,
    })
  })

  it('AC12: la ruta masiva persiste los mismos campos que la individual', async () => {
    const { id } = campusBasico({ equipos: 2 })

    const individual = await calcularUsoIndividual(id, 3, 2024)
    expect(individual.estado).toBe('ok')
    const sinRuido = (fila: Record<string, unknown>) => {
      const { id: _id, calculadoEn: _en, calculadoPor: _por, ...resto } = fila
      return resto
    }
    const detalleIndividual = t.estado.usoEquipos.map(sinRuido)
    const periodoIndividual = sinRuido(t.estado.usoPeriodos[0] as unknown as Record<string, unknown>)

    // Se limpia el mundo para repetir el mismo periodo por la ruta masiva.
    t.estado.usoPeriodos = []
    t.estado.usoEquipos = []
    t.estado.escrituras = []

    const masiva = await ejecutarCalculoMasivo({
      edificacionId: id,
      desde: { mes: 3, ano: 2024 },
      hasta: { mes: 3, ano: 2024 },
    })
    expect(masiva.estado).toBe('ok')
    if (masiva.estado !== 'ok') return
    expect(masiva.ejecucion.procesados).toEqual([{ clave: '2024-03', resultado: 'calculado' }])

    const porEquipo = (a: Record<string, unknown>, b: Record<string, unknown>) =>
      String(a.equipoId).localeCompare(String(b.equipoId))
    expect(t.estado.usoEquipos.map(sinRuido).sort(porEquipo)).toEqual(
      detalleIndividual.slice().sort(porEquipo)
    )
    // UsoPeriodo: estado + contadores + advertencias idénticos (sin origen/lote).
    const { origen: _o, loteId: _l, ...periodoSinMetadatos } = periodoIndividual
    const periodoMasivo = sinRuido(t.estado.usoPeriodos[0] as unknown as Record<string, unknown>)
    const { origen: _o2, loteId: _l2, ...periodoMasivoSinMetadatos } = periodoMasivo
    expect(periodoMasivoSinMetadatos).toEqual(periodoSinMetadatos)
  })
})
