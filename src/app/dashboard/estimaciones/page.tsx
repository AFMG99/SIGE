import { redirect } from 'next/navigation'
import { canWithOverrides, requireModuleAccess } from '@/shared/models/authz'
import { prisma } from '@/shared/models/prisma'
import { EstimacionesView } from '@/features/estimaciones/views/EstimacionesView'

export default async function EstimacionesPage() {
  const user = await requireModuleAccess('estimates')
  if (!user) {
    redirect('/dashboard')
  }

  const [edificaciones, bloques, permisos] = await Promise.all([
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
    Promise.all([
      Promise.all(
        (['create', 'evaluate', 'read', 'view_impact'] as const).map((accion) =>
          canWithOverrides(user, 'estimates', accion)
        )
      ).then((acciones) => acciones.some(Boolean)),
      canWithOverrides(user, 'estimates', 'create'),
      Promise.all(
        (['create', 'evaluate'] as const).map((accion) =>
          canWithOverrides(user, 'estimates', accion)
        )
      ).then((acciones) => acciones.some(Boolean)),
    ]),
  ])

  return (
    <EstimacionesView
      edificaciones={edificaciones}
      bloques={bloques}
      puedeEjecutar={permisos[0]}
      puedeCrearOrden={permisos[1]}
      puedeDiagnosticar={permisos[2]}
    />
  )
}