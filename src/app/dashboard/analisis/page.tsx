import { redirect } from 'next/navigation'
import { canWithOverrides, requireModuleAccess } from '@/shared/models/authz'
import { prisma } from '@/shared/models/prisma'
import { AnalisisView } from '@/features/analisis/views/AnalisisView'

/**
 * Módulo 3 — Análisis estadístico y detección de patrones.
 *
 * Guard de lectura: el análisis opera sobre facturas y variables del
 * módulo `consumption`, así que la página exige su visibilidad. La
 * EJECUCIÓN del análisis vuelve a chequear `analyze` server-side dentro
 * de la server action (aquí solo se decide si se muestra el control).
 */
export default async function AnalisisPage() {
  const user = await requireModuleAccess('consumption')
  if (!user) {
    redirect('/dashboard')
  }

  const [edificaciones, puedeAnalizar] = await Promise.all([
    prisma.edificacion.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
    canWithOverrides(user, 'consumption', 'analyze'),
  ])

  return (
    <AnalisisView edificaciones={edificaciones} puedeAnalizar={puedeAnalizar} />
  )
}
