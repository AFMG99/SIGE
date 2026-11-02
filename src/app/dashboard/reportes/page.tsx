import { redirect } from 'next/navigation'
import { canWithOverrides, requireModuleAccess } from '@/shared/models/authz'
import { prisma } from '@/shared/models/prisma'
import { ReportesView } from '@/features/reportes/views/ReportesView'
import { obtenerDatosReporte } from '@/features/reportes/controllers/reportesController'

export default async function ReportesPage() {
  const user = await requireModuleAccess('reports')
  if (!user) {
    redirect('/dashboard')
  }

  const [edificaciones, bloques, puedeGenerar, puedeDescargar] = await Promise.all([
    prisma.edificacion.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
    prisma.bloque.findMany({
      orderBy: [{ edificacion: { nombre: 'asc' } }, { codigo: 'asc' }],
      select: {
        id: true,
        edificacionId: true,
        codigo: true,
        nombre: true,
      },
    }),
    canWithOverrides(user, 'reports', 'generate'),
    Promise.all([
      canWithOverrides(user, 'reports', 'download_reports'),
      canWithOverrides(user, 'reports', 'generate'),
    ]).then((acts) => acts.some(Boolean)),
  ])

  // Carga inicial opcional con la primera edificación si existe
  let datosIniciales = null
  if (edificaciones.length > 0) {
    const resInicial = await obtenerDatosReporte({
      edificacionId: edificaciones[0].id,
      periodicidad: 'mes',
    })
    if (resInicial.estado === 'ok') {
      datosIniciales = resInicial.datos
    }
  }

  return (
    <ReportesView
      edificaciones={edificaciones}
      bloques={bloques}
      datosIniciales={datosIniciales}
      puedeGenerar={puedeGenerar}
      puedeDescargar={puedeDescargar}
    />
  )
}
