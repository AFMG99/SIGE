'use server'

// Server Actions de los horarios de funcionamiento de equipos por edificación
// (Resolución UPME 0016/2024, §7.1/§7.3: horarios de operación). El dominio
// (catálogo de días y validación) vive en `models/horarios.ts`.

import { prisma } from '@/shared/models/prisma'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import { autorizarCarga } from '@/features/datos/controllers/edificaciones'
import { horarioEquipoSchema } from '@/features/datos/models/horarios'

export type Exito<T> = ({ estado: 'ok' } & T) | { estado: 'error'; mensaje: string }

export async function crearHorarioEquipo(
  edificacionId: string,
  datos: { nombre: string; diasSemana: string[]; horaInicio: number; horaFin: number }
): Promise<Exito<{ mensaje: string }>> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const id = String(edificacionId ?? '').trim()
    if (!id) return { estado: 'error', mensaje: 'Debe indicar la edificación.' }

    const parseo = horarioEquipoSchema.safeParse(datos)
    if (!parseo.success) {
      return {
        estado: 'error',
        mensaje: parseo.error.issues[0]?.message ?? 'Horario inválido.',
      }
    }

    const edificacion = await prisma.edificacion.findUnique({
      where: { id },
      select: { id: true, nombre: true },
    })
    if (!edificacion) {
      return { estado: 'error', mensaje: 'La edificación indicada no existe.' }
    }

    await prisma.horarioEquipo.create({
      data: {
        edificacionId: id,
        nombre: parseo.data.nombre,
        diasSemana: parseo.data.diasSemana,
        horaInicio: parseo.data.horaInicio,
        horaFin: parseo.data.horaFin,
      },
    })

    await auditarAccion({
      action: 'horario.create',
      targetId: id,
      detail: `Horario "${parseo.data.nombre}" creado en "${edificacion.nombre}" (${parseo.data.diasSemana.join('/')}, ${parseo.data.horaInicio}:00–${parseo.data.horaFin}:00).`,
    })

    return { estado: 'ok', mensaje: 'Horario agregado.' }
  } catch (error) {
    console.error('Error en crearHorarioEquipo:', error)
    return { estado: 'error', mensaje: 'No fue posible crear el horario. Intente de nuevo.' }
  }
}

export async function eliminarHorarioEquipo(id: string): Promise<Exito<{ mensaje: string }>> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const horario = await prisma.horarioEquipo.findUnique({
      where: { id: String(id ?? '').trim() },
      select: { id: true, edificacionId: true, nombre: true },
    })
    if (!horario) {
      return { estado: 'error', mensaje: 'El horario indicado ya no existe.' }
    }

    await prisma.horarioEquipo.delete({ where: { id: horario.id } })

    await auditarAccion({
      action: 'horario.delete',
      targetId: horario.edificacionId,
      detail: `Horario "${horario.nombre}" eliminado.`,
    })

    return { estado: 'ok', mensaje: 'Horario eliminado.' }
  } catch (error) {
    console.error('Error en eliminarHorarioEquipo:', error)
    return { estado: 'error', mensaje: 'No fue posible eliminar el horario. Intente de nuevo.' }
  }
}
