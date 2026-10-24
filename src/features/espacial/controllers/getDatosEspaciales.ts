import { prisma } from '@/shared/models/prisma'
import { Edificacion3DScene } from '../models/espacial.types'
import { generateCampus3DLayout } from '../models/layoutGenerator'

export async function getDatosEspaciales(): Promise<Edificacion3DScene[]> {
  const edificaciones = await prisma.edificacion.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      bloques: {
        orderBy: { codigo: 'asc' },
        include: {
          espacios: {
            orderBy: { nombre: 'asc' },
            include: {
              equipos: {
                orderBy: { tipo: 'asc' },
              },
            },
          },
        },
      },
    },
  })

  return edificaciones.map((ed) => {
    const bloques3D = generateCampus3DLayout(ed.bloques)

    let potenciaTotalW = 0
    let areaTotalM2 = 0
    let cantidadEquipos = 0

    for (const b of bloques3D) {
      potenciaTotalW += b.metricas.potenciaTotalW
      areaTotalM2 += b.areaUtil
      cantidadEquipos += b.metricas.cantidadEquipos
    }

    const densidadPromedioWm2 =
      areaTotalM2 > 0 ? Number((potenciaTotalW / areaTotalM2).toFixed(2)) : 0

    return {
      id: ed.id,
      nombre: ed.nombre,
      tipo: ed.tipo,
      area: ed.area,
      ubicacionNombre: ed.ubicacionNombre,
      bloques: bloques3D,
      totales: {
        potenciaTotalW,
        areaTotalM2,
        cantidadEquipos,
        densidadPromedioWm2,
      },
    }
  })
}
