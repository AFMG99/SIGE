'use server'

// Server Actions de los horarios de funcionamiento de equipos por edificación
// (Resolución UPME 0016/2024, §7.1/§7.3: horarios de operación). El dominio
// (catálogo de días y validación) vive en `models/horarios.ts`.

import { prisma } from '@/shared/models/prisma'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import { autorizarCarga } from '@/features/datos/controllers/edificaciones'
import {
  hayConflictoHorario,
  horarioEquipoSchema,
  type HorarioComparable,
} from '@/features/datos/models/horarios'

export type Exito<T> = ({ estado: 'ok' } & T) | { estado: 'error'; mensaje: string }

export async function crearHorarioEquipo(
  edificacionId: string,
  datos: {
    nombre: string
    diasSemana: string[]
    horaInicio: number
    horaFin: number
    /** Ámbito jerárquico (S12): vacío = edificación completa. */
    ambito?: { bloqueId?: string | null; espacioId?: string | null; equipoId?: string | null }
    /** Vigencia `YYYY-MM-DD`; `hasta` null = abierta. */
    desde?: string | null
    hasta?: string | null
  }
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

    const { ambito, desde, hasta } = parseo.data

    // Resolver y validar la cascada jerárquica contra la BD (server-side).
    let bloqueId: string | null = null
    let espacioId: string | null = null
    let equipoId: string | null = null
    let etiquetaAmbito = 'la edificación completa'

    if (ambito?.equipoId) {
      const equipo = await prisma.equipoElectrico.findUnique({
        where: { id: ambito.equipoId },
        select: {
          id: true,
          bloqueId: true,
          espacioId: true,
          tipo: true,
          espacio: { select: { nombre: true } },
        },
      })
      if (!equipo || equipo.bloqueId !== ambito.bloqueId || equipo.espacioId !== ambito.espacioId) {
        return {
          estado: 'error',
          mensaje: 'El equipo seleccionado no pertenece al bloque/espacio indicado.',
        }
      }
      const bloque = await prisma.bloque.findUnique({
        where: { id: equipo.bloqueId },
        select: { edificacionId: true },
      })
      if (!bloque || bloque.edificacionId !== id) {
        return {
          estado: 'error',
          mensaje: 'El bloque del equipo seleccionado no pertenece a la edificación.',
        }
      }
      bloqueId = equipo.bloqueId
      espacioId = equipo.espacioId
      equipoId = equipo.id
      etiquetaAmbito = `el equipo ${equipo.tipo} del espacio ${equipo.espacio.nombre}`
    } else if (ambito?.espacioId) {
      const espacio = await prisma.espacio.findUnique({
        where: { id: ambito.espacioId },
        select: { id: true, bloqueId: true, nombre: true, bloque: { select: { edificacionId: true } } },
      })
      if (!espacio || espacio.bloqueId !== ambito.bloqueId || espacio.bloque.edificacionId !== id) {
        return {
          estado: 'error',
          mensaje: 'El espacio seleccionado no pertenece al bloque/edificación indicado.',
        }
      }
      bloqueId = espacio.bloqueId
      espacioId = espacio.id
      etiquetaAmbito = `el espacio ${espacio.nombre}`
    } else if (ambito?.bloqueId) {
      const bloque = await prisma.bloque.findUnique({
        where: { id: ambito.bloqueId },
        select: { id: true, edificacionId: true, codigo: true },
      })
      if (!bloque || bloque.edificacionId !== id) {
        return {
          estado: 'error',
          mensaje: 'El bloque seleccionado no pertenece a la edificación.',
        }
      }
      bloqueId = bloque.id
      etiquetaAmbito = `el bloque ${bloque.codigo}`
    }

    // Conflictos (S12): mismo ámbito + días en común + franja + vigencia.
    const existentes = await prisma.horarioEquipo.findMany({ where: { edificacionId: id } })
    const candidato: HorarioComparable = {
      edificacionId: id,
      ambito: { bloqueId, espacioId, equipoId },
      diasSemana: parseo.data.diasSemana,
      horaInicio: parseo.data.horaInicio,
      horaFin: parseo.data.horaFin,
      desde: desde ?? null,
      hasta: hasta ?? null,
    }
    const choque = existentes.find((e) =>
      hayConflictoHorario(candidato, {
        edificacionId: e.edificacionId,
        ambito: { bloqueId: e.bloqueId, espacioId: e.espacioId, equipoId: e.equipoId },
        diasSemana: e.diasSemana,
        horaInicio: e.horaInicio,
        horaFin: e.horaFin,
        desde: e.desde ? e.desde.toISOString().slice(0, 10) : null,
        hasta: e.hasta ? e.hasta.toISOString().slice(0, 10) : null,
      })
    )
    if (choque) {
      return {
        estado: 'error',
        mensaje: `El horario choca con "${choque.nombre}": comparten ámbito, días y franja dentro de su vigencia.`,
      }
    }

    await prisma.horarioEquipo.create({
      data: {
        edificacionId: id,
        bloqueId,
        espacioId,
        equipoId,
        nombre: parseo.data.nombre,
        diasSemana: parseo.data.diasSemana,
        horaInicio: parseo.data.horaInicio,
        horaFin: parseo.data.horaFin,
        desde: desde ? new Date(`${desde}T00:00:00Z`) : null,
        hasta: hasta ? new Date(`${hasta}T00:00:00Z`) : null,
      },
    })

    await auditarAccion({
      action: 'horario.create',
      targetId: id,
      detail: `Horario "${parseo.data.nombre}" creado en "${edificacion.nombre}" sobre ${etiquetaAmbito} (${parseo.data.diasSemana.join('/')}, ${parseo.data.horaInicio}:00–${parseo.data.horaFin}:00${desde ? `, desde ${desde}` : ''}${hasta ? ` hasta ${hasta}` : ''}).`,
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
