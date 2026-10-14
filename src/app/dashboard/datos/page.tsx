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
        tipo: true,
        cantidad: true,
        potenciaNominal: true,
        bloque: {
          select: {
            codigo: true,
            nombre: true,
            edificacion: { select: { nombre: true } },
          },
        },
        espacio: { select: { nombre: true } },
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
      select: { id: true, nombre: true, tipo: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.bloque.findMany({
      select: { id: true, codigo: true, nombre: true, edificacionId: true },
      orderBy: { codigo: 'asc' },
    }),
    prisma.espacio.findMany({
      select: { id: true, bloqueId: true, nombre: true },
      orderBy: { nombre: 'asc' },
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
      edificacion: r.bloque.edificacion.nombre,
      bloqueCodigo: r.bloque.codigo,
      bloqueNombre: r.bloque.nombre,
      espacio: r.espacio.nombre,
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
    bloqueCodigo: lb.bloque.codigo,
    bloqueNombre: lb.bloque.nombre,
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
      facturasExistentes={facturasExistentes}
      equiposExistentes={equiposExistentes}
      variablesExistentes={variablesExistentes}
      ajustesExistentes={ajustesExistentes}
      lineasBaseFilas={lineasBaseFilas}
    />
  )
}
