'use server'

// Server Actions de los eventos del calendario por edificación (S7/S8 —
// Fase 6, slice 6c). El dominio (catálogo de tipos, validación y herencia)
// vive en `models/eventos.ts`. CRUD por paridad con rangos/horarios: crear +
// eliminar, sin editar (pin L8).

import { prisma } from '@/shared/models/prisma'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import { autorizarCarga } from '@/features/datos/controllers/edificaciones'
import { eventoSchema, type EventoInfo } from '@/features/datos/models/eventos'

export type Exito<T> = ({ estado: 'ok' } & T) | { estado: 'error'; mensaje: string }

export async function crearEvento(
  edificacionId: string,
  datos: {
    tipo: string
    nombre: string
    descripcion?: string | null
    /** `YYYY-MM-DD` (requerida). */
    fechaInicio: string
    /** `YYYY-MM-DD`; null/vacía = día único. */
    fechaFin?: string | null
    /** Ámbito jerárquico (S12/S8): vacío = edificación completa. */
    ambito?: { bloqueId?: string | null; espacioId?: string | null; equipoId?: string | null }
  }
): Promise<Exito<{ mensaje: string; evento: EventoInfo }>> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const id = String(edificacionId ?? '').trim()
    if (!id) return { estado: 'error', mensaje: 'Debe indicar la edificación.' }

    const parseo = eventoSchema.safeParse(datos)
    if (!parseo.success) {
      return {
        estado: 'error',
        mensaje: parseo.error.issues[0]?.message ?? 'Evento inválido.',
      }
    }

    const edificacion = await prisma.edificacion.findUnique({
      where: { id },
      select: { id: true, nombre: true },
    })
    if (!edificacion) {
      return { estado: 'error', mensaje: 'La edificación indicada no existe.' }
    }

    const { ambito, fechaInicio, fechaFin } = parseo.data

    // Resolver y validar la cascada jerárquica contra la BD (server-side),
    // igual que `crearHorarioEquipo`: el evento siempre pertenece al árbol de
    // su edificación (S8: la herencia nunca cruza de edificación).
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

    const creado = await prisma.evento.create({
      data: {
        edificacionId: id,
        tipo: parseo.data.tipo,
        nombre: parseo.data.nombre,
        descripcion: parseo.data.descripcion,
        // Mismo almacenamiento que los rangos del calendario (@db.Date).
        fechaInicio: new Date(`${fechaInicio}T00:00:00Z`),
        fechaFin: fechaFin ? new Date(`${fechaFin}T00:00:00Z`) : null,
        bloqueId,
        espacioId,
        equipoId,
      },
    })

    await auditarAccion({
      action: 'evento.create',
      targetId: id,
      detail: `Evento "${creado.nombre}" (${creado.tipo}) creado en "${edificacion.nombre}" sobre ${etiquetaAmbito}, ${fechaInicio}${fechaFin ? ` → ${fechaFin}` : ' (día único)'}.`,
    })

    return {
      estado: 'ok',
      mensaje: 'Evento creado.',
      evento: {
        id: creado.id,
        edificacionId: creado.edificacionId,
        tipo: creado.tipo,
        nombre: creado.nombre,
        descripcion: creado.descripcion,
        fechaInicio: creado.fechaInicio.toISOString().slice(0, 10),
        fechaFin: creado.fechaFin ? creado.fechaFin.toISOString().slice(0, 10) : null,
        bloqueId: creado.bloqueId,
        espacioId: creado.espacioId,
        equipoId: creado.equipoId,
      },
    }
  } catch (error) {
    console.error('Error en crearEvento:', error)
    return { estado: 'error', mensaje: 'No fue posible crear el evento. Intente de nuevo.' }
  }
}

export async function eliminarEvento(id: string): Promise<Exito<{ mensaje: string }>> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const evento = await prisma.evento.findUnique({
      where: { id: String(id ?? '').trim() },
      select: { id: true, edificacionId: true, nombre: true },
    })
    if (!evento) {
      return { estado: 'error', mensaje: 'El evento indicado ya no existe.' }
    }

    await prisma.evento.delete({ where: { id: evento.id } })

    await auditarAccion({
      action: 'evento.delete',
      targetId: evento.edificacionId,
      detail: `Evento "${evento.nombre}" eliminado del calendario.`,
    })

    return { estado: 'ok', mensaje: 'Evento eliminado del calendario.' }
  } catch (error) {
    console.error('Error en eliminarEvento:', error)
    return { estado: 'error', mensaje: 'No fue posible eliminar el evento. Intente de nuevo.' }
  }
}
