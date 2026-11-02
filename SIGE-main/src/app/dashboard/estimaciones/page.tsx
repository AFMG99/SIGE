import { redirect } from 'next/navigation'
import { requireModuleAccess } from '@/shared/models/authz'
import { prisma } from '@/shared/models/prisma'
import { EstimacionesContent } from '@/features/estimaciones/views/EstimacionesContent'
import type { EstimacionGuardada, ModeloEstimacion } from '@/features/estimaciones/models/estimaciones'

export default async function EstimacionesPage() {
  const user = await requireModuleAccess('estimates')
  if (!user) { redirect('/dashboard') }

  const [edificaciones, estimacionesRaw] = await Promise.all([
    prisma.edificacion.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.estimacionConsumo.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, edificacionId: true, modelo: true, horizonte: true,
        periodoBase: true, mesesHistorico: true, mape: true, advertencias: true,
        resultados: true, createdAt: true,
        edificacion: { select: { nombre: true } },
      },
    }),
  ])

  const historial: EstimacionGuardada[] = estimacionesRaw.map((e) => ({
    id: e.id,
    edificacionId: e.edificacionId,
    edificacionNombre: e.edificacion.nombre,
    modelo: e.modelo as ModeloEstimacion,
    horizonte: e.horizonte,
    periodoBase: e.periodoBase,
    mesesHistorico: e.mesesHistorico,
    mape: e.mape,
    advertencias: e.advertencias,
    resultados: e.resultados as EstimacionGuardada['resultados'],
    creadoEn: e.createdAt.toISOString(),
  }))

  return <EstimacionesContent edificaciones={edificaciones} historial={historial} />
}