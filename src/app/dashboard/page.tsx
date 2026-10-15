import { getSession } from '@/shared/models/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/shared/models/prisma'
import { canWithOverrides, getEffectiveExtraModules } from '@/shared/models/authz'
import { DashboardHome } from '@/shared/views/DashboardHome'
import {
  FACTURAS_MAX,
  SERIE_MAX,
  type CoeficientesLben,
  type EnergySummary,
} from '@/shared/views/dashboardModel'

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  // Validar que session.userId existe y es string
  if (session.userId == null || typeof session.userId !== 'string') {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  })

  if (!user) {
    redirect('/login')
  }

  const extraModules = await getEffectiveExtraModules(user.id)

  // SECURITY GATE: energy aggregates are only computed for users that can
  // access the `consumption` module (static matrix first, then active
  // temporary overrides via `canWithOverrides`). The check runs BEFORE any
  // query, so a role without access neither fetches nor sees a single number.
  let energy: EnergySummary | null = null
  if (await canWithOverrides(user, 'consumption')) {
    const [
      facturas,
      ultimaFactura,
      edificaciones,
      bloques,
      serieBruta,
      ultimasFacturas,
      lineasBase,
      nombresEdificaciones,
    ] = await Promise.all([
      prisma.facturaEnergia.count(),
      prisma.facturaEnergia.findFirst({
        orderBy: { periodo: 'desc' },
        select: { periodo: true },
      }),
      prisma.edificacion.count(),
      prisma.bloque.findMany({ select: { id: true, edificacionId: true } }),
      prisma.facturaEnergia.groupBy({
        by: ['periodo'],
        _sum: { consumoNormalizado: true, costoCop: true },
        orderBy: { periodo: 'desc' },
        take: SERIE_MAX,
      }),
      prisma.facturaEnergia.findMany({
        orderBy: [{ periodo: 'desc' }, { creadoAt: 'desc' }],
        take: FACTURAS_MAX,
        select: {
          id: true,
          periodo: true,
          consumoKwh: true,
          consumoNormalizado: true,
          costoCop: true,
          diasFacturados: true,
          edificacion: { select: { id: true, nombre: true } },
        },
      }),
      prisma.lineaBaseEnergia.findMany({
        select: {
          r2: true,
          tipo: true,
          coeficientes: true,
          bloqueId: true,
          edificacionId: true,
          bloque: { select: { edificacionId: true } },
        },
      }),
      prisma.edificacion.findMany({ select: { id: true, nombre: true } }),
    ])

    const nombrePorId = new Map(nombresEdificaciones.map((e) => [e.id, e.nombre]))

    // Consumo/costo por edificación de un período (para distribución, deltas
    // y ranking); null cuando el período no existe.
    const porEdificacion = async (
      periodo: string | undefined
    ): Promise<EnergySummary['periodoActual']> => {
      if (!periodo) return null
      const filas = await prisma.facturaEnergia.groupBy({
        by: ['edificacionId'],
        where: { periodo },
        _sum: { consumoNormalizado: true, costoCop: true },
      })
      return filas.map((f) => ({
        edificacionId: f.edificacionId,
        nombre: nombrePorId.get(f.edificacionId) ?? 'Edificación',
        consumoNormalizado: f._sum.consumoNormalizado ?? 0,
        costoCop: f._sum.costoCop ?? 0,
      }))
    }

    const periodoActual = await porEdificacion(serieBruta[0]?.periodo)
    const periodoPrevio = await porEdificacion(serieBruta[1]?.periodo)

    energy = {
      facturas,
      ultimoPeriodo: ultimaFactura?.periodo ?? null,
      edificaciones,
      bloques,
      serie: serieBruta.map((p) => ({
        periodo: p.periodo,
        consumoNormalizado: p._sum.consumoNormalizado ?? 0,
        costoCop: p._sum.costoCop ?? 0,
      })),
      ultimasFacturas: ultimasFacturas.map((f) => ({
        id: f.id,
        periodo: f.periodo,
        edificacionId: f.edificacion.id,
        edificacionNombre: f.edificacion.nombre,
        consumoKwh: f.consumoKwh,
        consumoNormalizado: f.consumoNormalizado,
        costoCop: f.costoCop,
        diasFacturados: f.diasFacturados,
      })),
      lineasBase: lineasBase.map((lb) => ({
        bloqueId: lb.bloqueId,
        edificacionId: lb.edificacionId ?? lb.bloque?.edificacionId ?? '',
        modelos: [
          {
            tipo: lb.tipo,
            r2: lb.r2,
            coeficientes: (lb.coeficientes ?? {}) as CoeficientesLben,
          },
        ],
      })),
      periodoActual,
      periodoPrevio,
    }
  }

  return (
    <DashboardHome
      account={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      }}
      extraModules={extraModules}
      energy={energy}
    />
  )
}
