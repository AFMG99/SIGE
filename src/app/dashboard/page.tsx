import { getSession } from '@/shared/models/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/shared/models/prisma'
import { canWithOverrides, getEffectiveExtraModules } from '@/shared/models/authz'
import { DashboardHome, type EnergySummary } from '@/shared/views/DashboardHome'

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
    const [facturas, ultimaFactura, edificaciones, bloques] = await Promise.all([
      prisma.facturaEnergia.count(),
      prisma.facturaEnergia.findFirst({
        orderBy: { periodo: 'desc' },
        select: { periodo: true },
      }),
      prisma.edificacion.count(),
      prisma.bloque.count(),
    ])

    energy = {
      facturas,
      ultimoPeriodo: ultimaFactura?.periodo ?? null,
      edificaciones,
      bloques,
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
