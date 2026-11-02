import { redirect } from 'next/navigation'
import { canWithOverrides, requireModuleAccess } from '@/shared/models/authz'
import { prisma } from '@/shared/models/prisma'
import { DatosContent } from '@/features/datos/views/DatosContent'
import type {
  AjustesExistentes,
  EquiposExistentes,
  FacturasExistentes,
  LineaBaseExistente,
  VariablesExistentes,
} from '@/features/datos/views/existencias'
import type { EventoInfo } from '@/features/datos/models/eventos'

export default async function DatosPage() {
  const user = await requireModuleAccess('consumption')
  if (!user) {
    redirect('/dashboard')
  }

  const [
    facturasAgg,
    facturasRecientes,
    equiposAgg,
    potenciaAgg,
    equiposRecientes,
    bloquesConInventario,
    variablesAgg,
    variablesRecientes,
    lineasBase,
    edificaciones,
    bloques,
    espacios,
    calendarios,
    rangosCalendario,
    horariosEquipo,
    eventosCalendario,
    ajustesAgg,
    ajustesRecientes,
    bloquesConAjustes,
    ajustesPorTipo,
    lineasBaseRecientes,
  ] = await Promise.all([
    prisma.facturaEnergia.aggregate({
      _count: true,
      _sum: { consumoKwh: true, costoCop: true },
    }),
    prisma.facturaEnergia.findMany({
      orderBy: { periodo: 'desc' },
      take: 50,
      select: {
        id: true,
        periodo: true,
        diasFacturados: true,
        consumoKwh: true,
        costoCop: true,
        edificacion: { select: { nombre: true } },
      },
    }),
    prisma.equipoElectrico.aggregate({ _count: true }),
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM("potenciaNominal" * cantidad), 0) AS total
      FROM equipos_electricos
    `,
    prisma.equipoElectrico.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        bloqueId: true,
        espacioId: true,
        tipo: true,
        cantidad: true,
        potenciaNominal: true,
        bloque: {
          select: {
            codigo: true,
            nombre: true,
            edificacion: { select: { id: true, nombre: true } },
          },
        },
        espacio: { select: { nombre: true, piso: true } },
      },
    }),
    prisma.equipoElectrico.groupBy({ by: ['bloqueId'] }),
    prisma.variableOperativa.aggregate({
      _count: true,
      _avg: {
        poblacionFlotante: true,
        gradesDiaEnfriamiento: true,
      },
    }),
    prisma.variableOperativa.findMany({
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
      take: 50,
      select: {
        id: true,
        mes: true,
        ano: true,
        poblacionFija: true,
        poblacionFlotante: true,
        diasLectivosLaborales: true,
        gradesDiaEnfriamiento: true,
        bloque: { select: { codigo: true, nombre: true } },
      },
    }),
    prisma.lineaBaseEnergia.count(),
    prisma.edificacion.findMany({
      select: {
        id: true,
        nombre: true,
        tipo: true,
        area: true,
        lat: true,
        lon: true,
        ubicacionNombre: true,
      },
      orderBy: { nombre: 'asc' },
    }),
    prisma.bloque.findMany({
      select: {
        id: true,
        codigo: true,
        nombre: true,
        edificacionId: true,
        areaUtil: true,
        factorInfraestructura: true,
        largoM: true,
        anchoM: true,
        altoM: true,
        areaHuellaM2: true,
      },
      orderBy: { codigo: 'asc' },
    }),
    prisma.espacio.findMany({
      select: {
        id: true,
        bloqueId: true,
        nombre: true,
        piso: true,
        largoM: true,
        anchoM: true,
        altoM: true,
        areaCalculadaM2: true,
      },
      orderBy: [{ piso: 'asc' }, { nombre: 'asc' }],
    }),
    prisma.calendarioOperativo.findMany({
      select: {
        id: true,
        edificacionId: true,
        horaInicioOperacion: true,
        horasOperacionDia: true,
        temperaturaBase: true,
        usarHorariosXe: true,
        domingosOperativos: true,
        festivosOperativos: true,
      },
    }),
    prisma.rangoCalendario.findMany({
      orderBy: { fechaInicio: 'asc' },
      select: {
        id: true,
        calendarioId: true,
        fechaInicio: true,
        fechaFin: true,
        tipoDia: true,
        nombre: true,
      },
    }),
    prisma.horarioEquipo.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        edificacionId: true,
        bloqueId: true,
        espacioId: true,
        equipoId: true,
        nombre: true,
        diasSemana: true,
        horaInicio: true,
        horaFin: true,
        desde: true,
        hasta: true,
      },
    }),
    prisma.evento.findMany({
      orderBy: [{ fechaInicio: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        edificacionId: true,
        tipo: true,
        nombre: true,
        descripcion: true,
        fechaInicio: true,
        fechaFin: true,
        bloqueId: true,
        espacioId: true,
        equipoId: true,
        bloque: { select: { codigo: true, nombre: true } },
        espacio: { select: { nombre: true } },
        equipo: {
          select: {
            tipo: true,
            espacio: { select: { nombre: true } },
          },
        },
      },
    }),
    prisma.ajusteEnergetico.aggregate({
      _count: true,
      _avg: { valorAjuste: true },
    }),
    prisma.ajusteEnergetico.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        tipo: true,
        periodoInicio: true,
        periodoFin: true,
        valorAjuste: true,
        observaciones: true,
        bloque: {
          select: {
            codigo: true,
            nombre: true,
            edificacion: { select: { nombre: true } },
          },
        },
      },
    }),
    prisma.ajusteEnergetico.groupBy({ by: ['bloqueId'] }),
    prisma.ajusteEnergetico.groupBy({ by: ['tipo'], _count: { _all: true } }),
    prisma.lineaBaseEnergia.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        tipo: true,
        r2: true,
        createdAt: true,
        bloque: { select: { codigo: true, nombre: true } },
        edificacion: { select: { nombre: true } },
      },
    }),
  ])

  const facturasExistentes: FacturasExistentes = {
    total: facturasAgg._count,
    consumoTotalKwh: facturasAgg._sum.consumoKwh ?? 0,
    costoTotalCop: facturasAgg._sum.costoCop ?? 0,
    ultimoPeriodo: facturasRecientes[0]?.periodo ?? null,
    filas: facturasRecientes.map((f) => ({ ...f, edificacion: f.edificacion.nombre })),
  }

  const bloquesConIds = new Set(bloquesConInventario.map((b) => b.bloqueId))
  const edificacionesConInventario = new Set(
    bloques.filter((b) => bloquesConIds.has(b.id)).map((b) => b.edificacionId)
  )

  const equiposExistentes: EquiposExistentes = {
    total: equiposAgg._count,
    potenciaTotalKw: potenciaAgg[0]?.total ?? 0,
    edificacionesConInventario: edificacionesConInventario.size,
    bloquesConInventario: bloquesConIds.size,
    filas: equiposRecientes.map((r) => ({
      id: r.id,
      edificacionId: r.bloque.edificacion.id,
      bloqueId: r.bloqueId,
      espacioId: r.espacioId,
      edificacion: r.bloque.edificacion.nombre,
      bloqueCodigo: r.bloque.codigo,
      bloqueNombre: r.bloque.nombre,
      espacio: `${r.espacio.nombre} · piso ${r.espacio.piso}`,
      tipo: r.tipo,
      cantidad: r.cantidad,
      potenciaNominal: r.potenciaNominal,
    })),
  }

  const variablesExistentes: VariablesExistentes = {
    total: variablesAgg._count,
    ultimoPeriodo:
      variablesRecientes.length > 0
        ? `${variablesRecientes[0].ano}-${String(variablesRecientes[0].mes).padStart(2, '0')}`
        : null,
    poblacionFlotantePromedio: variablesAgg._avg.poblacionFlotante ?? 0,
    gradesDiaEnfriamientoPromedio: variablesAgg._avg.gradesDiaEnfriamiento ?? 0,
    filas: variablesRecientes.map((v) => ({
      id: v.id,
      periodo: `${v.ano}-${String(v.mes).padStart(2, '0')}`,
      bloqueCodigo: v.bloque.codigo,
      bloqueNombre: v.bloque.nombre,
      poblacionFija: v.poblacionFija,
      poblacionFlotante: v.poblacionFlotante,
      diasLectivosLaborales: v.diasLectivosLaborales,
      gradesDiaEnfriamiento: v.gradesDiaEnfriamiento,
    })),
  }

  const fechaCorta = (fecha: Date): string => fecha.toISOString().slice(0, 10)

  const ajustesExistentes: AjustesExistentes = {
    total: ajustesAgg._count,
    bloquesConAjustes: bloquesConAjustes.length,
    valorAjustePromedio: ajustesAgg._avg.valorAjuste ?? 0,
    rutinarios: ajustesPorTipo.find((t) => t.tipo === 'RUTINARIO')?._count._all ?? 0,
    noRutinarios: ajustesPorTipo.find((t) => t.tipo === 'NO_RUTINARIO')?._count._all ?? 0,
    filas: ajustesRecientes.map((a) => ({
      id: a.id,
      bloqueCodigo: a.bloque.codigo,
      bloqueNombre: a.bloque.nombre,
      edificacion: a.bloque.edificacion.nombre,
      tipo: a.tipo,
      periodo: `${fechaCorta(a.periodoInicio)} → ${fechaCorta(a.periodoFin)}`,
      valorAjuste: a.valorAjuste,
      observaciones: a.observaciones,
    })),
  }

  const lineasBaseFilas: LineaBaseExistente[] = lineasBaseRecientes.map((lb) => ({
    id: lb.id,
    bloqueCodigo: lb.bloque?.codigo ?? null,
    bloqueNombre: lb.bloque?.nombre ?? null,
    edificacionNombre: lb.edificacion?.nombre ?? null,
    tipo: lb.tipo,
    r2: lb.r2,
    guardadaEn: fechaCorta(lb.createdAt),
  }))

  return (
    <DatosContent
      role={user.role}
      puedeCargar={await canWithOverrides(user, 'consumption', 'upload')}
      puedeCalcular={await canWithOverrides(user, 'consumption', 'analyze')}
      stats={{
        facturas: facturasExistentes.total,
        equipos: equiposExistentes.total,
        variables: variablesExistentes.total,
        lineasBase,
      }}
      edificaciones={edificaciones}
      bloques={bloques}
      espacios={espacios}
      calendarios={calendarios}
      rangos={rangosCalendario.map((r) => ({
        id: r.id,
        calendarioId: r.calendarioId,
        fechaInicio: r.fechaInicio.toISOString().slice(0, 10),
        fechaFin: r.fechaFin.toISOString().slice(0, 10),
        tipoDia: r.tipoDia,
        nombre: r.nombre,
      }))}
      horarios={horariosEquipo.map((h) => ({
        id: h.id,
        edificacionId: h.edificacionId,
        bloqueId: h.bloqueId,
        espacioId: h.espacioId,
        equipoId: h.equipoId,
        nombre: h.nombre,
        diasSemana: h.diasSemana,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        desde: h.desde ? h.desde.toISOString().slice(0, 10) : null,
        hasta: h.hasta ? h.hasta.toISOString().slice(0, 10) : null,
      }))}
      eventos={eventosCalendario.map(
        (ev): EventoInfo => ({
          id: ev.id,
          edificacionId: ev.edificacionId,
          tipo: ev.tipo,
          nombre: ev.nombre,
          descripcion: ev.descripcion,
          fechaInicio: ev.fechaInicio.toISOString().slice(0, 10),
          fechaFin: ev.fechaFin ? ev.fechaFin.toISOString().slice(0, 10) : null,
          bloqueId: ev.bloqueId,
          espacioId: ev.espacioId,
          equipoId: ev.equipoId,
          bloqueCodigo: ev.bloque?.codigo,
          bloqueNombre: ev.bloque?.nombre,
          espacioNombre: ev.espacio?.nombre,
          equipoTipo: ev.equipo?.tipo ?? undefined,
          equipoEspacioNombre: ev.equipo?.espacio?.nombre,
        })
      )}
      facturasExistentes={facturasExistentes}
      equiposExistentes={equiposExistentes}
      variablesExistentes={variablesExistentes}
      ajustesExistentes={ajustesExistentes}
      lineasBaseFilas={lineasBaseFilas}
    />
  )
}
