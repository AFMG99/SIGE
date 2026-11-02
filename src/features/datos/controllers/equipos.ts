'use server'

// Server Action de importación del inventario de equipos eléctricos (SIGE-TdeA).
// Toda fila recibida se vuelve a validar en el servidor: nunca se confía
// en la validación hecha en el navegador.

import { prisma } from '@/shared/models/prisma'
import { canWithOverrides, getCurrentUser } from '@/shared/models/authz'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import {
  edicionEquipoSchema,
  filaEquipoElectricoschema,
  normalizarEspacio,
  tipoEdificacionPorCodigo,
} from '@/features/datos/models/validations'
import { PISO_SIN_ASIGNAR } from '@/features/datos/models/geometria'
import type {
  EdicionEquipo,
  FilaEnvioEquipos,
  ConflictoEquipo,
  ResultadoGestion,
  ResultadoImportacionEquipos,
} from '@/features/datos/models/validations'

/** Límite de filas por importación para proteger la transacción. */
const MAX_FILAS_POR_IMPORTACION = 5000

type FilaValida = {
  fila: number
  bloqueId?: string
  espacio: string
  piso?: string
  tipo: 'HVAC' | 'ILUMINACION' | 'OFICINA' | 'MOTORES'
  cantidad: number
  potenciaNominal: number
  horasUsoDia: number
  diasUsoMes: number
  usenIndicador: 'ACTIVO' | 'INACTIVO'
}

/**
 * Importa (upsert) filas del inventario de equipos eléctricos.
 *
 * Flujo:
 *  1. Exige sesión + permiso `upload` sobre el módulo `consumption`.
 *  2. Carga la edificación y determina, por su tipo del catálogo, si se
 *     requiere bloque.
 *  3. Re-valida cada fila con Zod y detecta duplicados internos
 *     (clave: bloque + espacio + tipo de equipo).
 *  4. Si se requiere bloque: valida existencia y pertenencia a la edificación.
 *     Si no: resuelve el bloque automático de la edificación.
 *  5. Resuelve los espacios por nombre (crea los que no existan) y busca
 *     equipos ya guardados con la misma clave.
 *  6. Si hay existentes y `sobrescribir` es false → pide confirmación.
 *  7. Si no hay conflicto (o se autorizó sobrescribir) → upsert en transacción.
 */
export async function importarFilasEquipos(
  edificacionId: string,
  filas: FilaEnvioEquipos[],
  sobrescribir: boolean
): Promise<ResultadoImportacionEquipos> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { estado: 'error', mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
    }
    if (!(await canWithOverrides(user, 'consumption', 'upload'))) {
      return {
        estado: 'error',
        mensaje: 'Su rol no tiene permiso para cargar el inventario de equipos.',
      }
    }

    const idEdificacion = String(edificacionId ?? '').trim()
    if (!idEdificacion) {
      return {
        estado: 'error',
        mensaje: 'Debe seleccionar una edificación antes de importar.',
      }
    }

    const edificacion = await prisma.edificacion.findUnique({
      where: { id: idEdificacion },
      select: { id: true, nombre: true, tipo: true },
    })
    if (!edificacion) {
      return { estado: 'error', mensaje: 'La edificación indicada no existe.' }
    }
    const info = tipoEdificacionPorCodigo(edificacion.tipo)
    const requiereBloque = info.requiereBloque

    if (!Array.isArray(filas) || filas.length === 0) {
      return { estado: 'error', mensaje: 'No hay filas para importar.' }
    }
    if (filas.length > MAX_FILAS_POR_IMPORTACION) {
      return {
        estado: 'error',
        mensaje: `Excede el máximo de ${MAX_FILAS_POR_IMPORTACION} filas por importación. Divida el archivo.`,
      }
    }

    const errores: { fila: number; razon: string }[] = []
    const validas: FilaValida[] = []
    const clavesVistas = new Map<string, number>()

    filas.forEach((fila, posicion) => {
      const numeroFila = Number.isInteger(fila?.fila) ? fila.fila : posicion + 1

      if (requiereBloque && !String(fila?.bloqueId ?? '').trim()) {
        errores.push({
          fila: numeroFila,
          razon: `La edificación "${edificacion.nombre}" requiere indicar el bloque`,
        })
        return
      }

      const resultado = filaEquipoElectricoschema.safeParse({
        ...fila,
        bloqueId: requiereBloque ? String(fila.bloqueId).trim() : undefined,
        espacio: normalizarEspacio(String(fila?.espacio ?? '')),
      })

      if (!resultado.success) {
        const mensajes = resultado.error.issues.map((i) => i.message).join(', ')
        errores.push({ fila: numeroFila, razon: mensajes })
        return
      }

      const datos = resultado.data
      const clave = `${datos.bloqueId ?? ''}|${datos.espacio}|${datos.piso ?? ''}|${datos.tipo}`
      const filaPrevia = clavesVistas.get(clave)
      if (filaPrevia !== undefined) {
        errores.push({
          fila: numeroFila,
          razon: `Duplicado: ${datos.tipo} en "${datos.espacio}" ya aparece en la fila ${filaPrevia}`,
        })
        return
      }
      clavesVistas.set(clave, numeroFila)
      validas.push({ fila: numeroFila, ...datos })
    })

    const sinValidas = (): ResultadoImportacionEquipos => ({
      estado: 'completado',
      insertadas: 0,
      actualizadas: 0,
      rechazadas: errores.length,
      espaciosCreados: 0,
      errores,
      mensaje: 'Ninguna fila válida para importar. Corrija los errores reportados.',
    })

    if (validas.length === 0) return sinValidas()

    // Bloques: deben existir y pertenecer a la edificación seleccionada
    const confirmadas: FilaValida[] = []

    if (requiereBloque) {
      const idsBloque = Array.from(new Set(validas.map((v) => v.bloqueId!)))
      const bloques = await prisma.bloque.findMany({
        where: { id: { in: idsBloque } },
        select: { id: true, edificacionId: true },
      })
      const porId = new Map(bloques.map((b) => [b.id, b.edificacionId]))

      for (const v of validas) {
        const dueno = porId.get(v.bloqueId!)
        if (dueno === undefined) {
          errores.push({ fila: v.fila, razon: 'El bloque indicado no existe' })
        } else if (dueno !== edificacion.id) {
          errores.push({
            fila: v.fila,
            razon: `El bloque no pertenece a la edificación "${edificacion.nombre}"`,
          })
        } else {
          confirmadas.push(v)
        }
      }
    } else {
      // Tipo sin bloque (residencial): todas las filas van al bloque automático
      const bloqueUnico = await prisma.bloque.findFirst({
        where: { edificacionId: edificacion.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (!bloqueUnico) {
        return {
          estado: 'error',
          mensaje: `La edificación "${edificacion.nombre}" no tiene bloque. Registre uno antes de importar.`,
        }
      }
      for (const v of validas) {
        confirmadas.push({ ...v, bloqueId: bloqueUnico.id })
      }
    }

    if (confirmadas.length === 0) return sinValidas()

    // Los espacios se resuelven por nombre y, cuando se informa, por piso.
    const pares: { bloqueId: string; nombre: string }[] = []
    const paresVistos = new Set<string>()
    for (const v of confirmadas) {
      const par = `${v.bloqueId}|${v.espacio}`
      if (!paresVistos.has(par)) {
        paresVistos.add(par)
        pares.push({ bloqueId: v.bloqueId!, nombre: v.espacio })
      }
    }

    const espacios = await prisma.espacio.findMany({
      where: { OR: pares },
      select: { id: true, bloqueId: true, nombre: true, piso: true },
    })
    const claveBaseEspacio = (bloqueId: string, nombre: string) => `${bloqueId}|${nombre}`
    const claveFilaEspacio = (fila: FilaValida) =>
      `${fila.bloqueId}|${fila.espacio}|${fila.piso ?? ''}`
    const porNombre = new Map<string, typeof espacios>()
    for (const espacio of espacios) {
      const clave = claveBaseEspacio(espacio.bloqueId, espacio.nombre)
      porNombre.set(clave, [...(porNombre.get(clave) ?? []), espacio])
    }

    const mapaEspacios = new Map<string, string>()
    const paresFaltantes = new Map<string, { bloqueId: string; nombre: string; piso: string }>()
    const confirmadasResueltas: FilaValida[] = []
    const clavesEquiposResueltas = new Set<string>()
    for (const fila of confirmadas) {
      const existentes = porNombre.get(claveBaseEspacio(fila.bloqueId!, fila.espacio)) ?? []
      const candidatos = fila.piso
        ? existentes.filter((espacio) => espacio.piso === fila.piso)
        : existentes
      if (!fila.piso && candidatos.length > 1) {
        errores.push({
          fila: fila.fila,
          razon: `El espacio "${fila.espacio}" existe en varios pisos; indique la columna opcional "piso" para identificarlo.`,
        })
        continue
      }

      const existente = candidatos[0]
      const idONuevoEspacio = existente
        ? existente.id
        : `${fila.bloqueId}|${fila.espacio}|${fila.piso ?? PISO_SIN_ASIGNAR}`
      const claveEquipo = `${fila.bloqueId}|${idONuevoEspacio}|${fila.tipo}`
      if (clavesEquiposResueltas.has(claveEquipo)) {
        errores.push({
          fila: fila.fila,
          razon: `Duplicado: ${fila.tipo} en "${fila.espacio}" ya está asignado al mismo piso.`,
        })
        continue
      }
      clavesEquiposResueltas.add(claveEquipo)
      if (existente) {
        mapaEspacios.set(claveFilaEspacio(fila), existente.id)
      } else {
        const piso = fila.piso ?? PISO_SIN_ASIGNAR
        paresFaltantes.set(
          `${fila.bloqueId}|${fila.espacio}|${piso}`,
          { bloqueId: fila.bloqueId!, nombre: fila.espacio, piso }
        )
      }
      confirmadasResueltas.push(fila)
    }

    const faltantes = Array.from(paresFaltantes.values())

    // Equipos ya guardados (solo filas cuyo espacio ya existe)
    const conEspacio = confirmadasResueltas.filter((v) => mapaEspacios.has(claveFilaEspacio(v)))
    const equiposExistentes =
      conEspacio.length > 0
        ? await prisma.equipoElectrico.findMany({
            where: {
              OR: conEspacio.map((v) => ({
                bloqueId: v.bloqueId!,
                espacioId: mapaEspacios.get(claveFilaEspacio(v))!,
                tipo: v.tipo,
              })),
            },
            select: { bloqueId: true, espacioId: true, tipo: true },
          })
        : []
    const conjuntoEquipos = new Set(
      equiposExistentes.map((e) => `${e.bloqueId}|${e.espacioId}|${e.tipo}`)
    )

    const conflictos: ConflictoEquipo[] = conEspacio
      .filter((v) =>
        conjuntoEquipos.has(
          `${v.bloqueId}|${mapaEspacios.get(claveFilaEspacio(v))!}|${v.tipo}`
        )
      )
      .map((v) => ({
        fila: v.fila,
        bloqueId: v.bloqueId!,
        espacio: v.espacio,
        piso: v.piso,
        tipo: v.tipo,
      }))

    if (conflictos.length > 0 && !sobrescribir) {
      return {
        estado: 'confirmacion_requerida',
        conflictos,
        validas: confirmadasResueltas.length,
        rechazadas: errores.length,
        errores,
        mensaje:
          `${conflictos.length} de ${confirmadasResueltas.length} filas coinciden con equipos ya guardados ` +
          '(mismo bloque, piso, espacio y tipo). Confirme para reemplazarlos.',
      }
    }

    // Importación atómica: se crean espacios faltantes y luego los equipos
    await prisma.$transaction(async (tx) => {
      for (const par of faltantes) {
        await tx.espacio.upsert({
          where: {
            bloqueId_piso_nombre: {
              bloqueId: par.bloqueId,
              piso: par.piso,
              nombre: par.nombre,
            },
          },
          update: {},
          create: { bloqueId: par.bloqueId, nombre: par.nombre, piso: par.piso },
        })
      }

      if (faltantes.length > 0) {
        const nuevos = await tx.espacio.findMany({
          where: { OR: faltantes },
          select: { id: true, bloqueId: true, nombre: true, piso: true },
        })
        for (const fila of confirmadasResueltas) {
          if (mapaEspacios.has(claveFilaEspacio(fila))) continue
          const piso = fila.piso ?? PISO_SIN_ASIGNAR
          const espacio = nuevos.find(
            (e) =>
              e.bloqueId === fila.bloqueId &&
              e.nombre === fila.espacio &&
              e.piso === piso
          )
          if (espacio) mapaEspacios.set(claveFilaEspacio(fila), espacio.id)
        }
      }

      for (const v of confirmadasResueltas) {
        const espacioId = mapaEspacios.get(claveFilaEspacio(v))!
        await tx.equipoElectrico.upsert({
          where: { bloqueId_espacioId_tipo: { bloqueId: v.bloqueId!, espacioId, tipo: v.tipo } },
          update: {
            cantidad: v.cantidad,
            potenciaNominal: v.potenciaNominal,
            horasUsoDia: v.horasUsoDia,
            diasUsoMes: v.diasUsoMes,
            usenIndicador: v.usenIndicador,
          },
          create: {
            bloqueId: v.bloqueId!,
            espacioId,
            tipo: v.tipo,
            cantidad: v.cantidad,
            potenciaNominal: v.potenciaNominal,
            horasUsoDia: v.horasUsoDia,
            diasUsoMes: v.diasUsoMes,
            usenIndicador: v.usenIndicador,
          },
        })
      }
    })

    let insertadas = 0
    let actualizadas = 0
    for (const v of confirmadasResueltas) {
      const espacioId = mapaEspacios.get(claveFilaEspacio(v))!
      if (conjuntoEquipos.has(`${v.bloqueId}|${espacioId}|${v.tipo}`)) actualizadas++
      else insertadas++
    }

    const partes: string[] = []
    if (insertadas > 0) partes.push(`${insertadas} nuevos`)
    if (actualizadas > 0) partes.push(`${actualizadas} actualizados`)
    if (faltantes.length > 0) partes.push(`${faltantes.length} espacios creados`)
    if (errores.length > 0) partes.push(`${errores.length} rechazadas`)

    await auditarAccion({
      action: 'equipo.import',
      targetId: idEdificacion,
      detail: `Importación de equipos: ${partes.join(', ')}.`,
    })

    return {
      estado: 'completado',
      insertadas,
      actualizadas,
      rechazadas: errores.length,
      espaciosCreados: faltantes.length,
      errores,
      mensaje: `Importación finalizada: ${partes.join(', ')}.`,
    }
  } catch (error) {
    console.error('Error en importarFilasEquipos:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible importar el inventario de equipos. Intente de nuevo.',
    }
  }
}

// ---------------------------------------------------------------------------
// Gestión del inventario guardado (pestaña "Gestión"): editar / eliminar / vaciar.
// Mismo gate que la carga: sesión + permiso `upload` sobre `consumption`.
// ---------------------------------------------------------------------------

/** Sesión + permiso para gestionar equipos; `null` si está autorizado. */
async function rechazoGestionEquipos(): Promise<ResultadoGestion | null> {
  const user = await getCurrentUser()
  if (!user) {
    return { estado: 'error', mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
  }
  if (!(await canWithOverrides(user, 'consumption', 'upload'))) {
    return {
      estado: 'error',
      mensaje: 'Su rol no tiene permiso para gestionar el inventario de equipos.',
    }
  }
  return null
}

/**
 * Actualiza tipo, cantidad y potencia nominal de un equipo guardado.
 * La ubicación (bloque/espacio) es inmutable: mover un equipo es otra
 * operación. Al cambiar el tipo se respeta la clave única
 * (bloque + espacio + tipo) verificando que no nazca un duplicado.
 */
export async function actualizarEquipo(
  id: string,
  datos: EdicionEquipo
): Promise<ResultadoGestion> {
  try {
    const rechazo = await rechazoGestionEquipos()
    if (rechazo) return rechazo

    const idEquipo = String(id ?? '').trim()
    if (!idEquipo) {
      return { estado: 'error', mensaje: 'Equipo inválido.' }
    }

    const resultado = edicionEquipoSchema.safeParse(datos)
    if (!resultado.success) {
      const mensajes = resultado.error.issues.map((i) => i.message).join(', ')
      return { estado: 'error', mensaje: mensajes }
    }

    const equipo = await prisma.equipoElectrico.findUnique({
      where: { id: idEquipo },
      select: { bloqueId: true, espacioId: true, tipo: true },
    })
    if (!equipo) {
      return { estado: 'error', mensaje: 'El equipo ya no existe.' }
    }

    const { tipo, cantidad, potenciaNominal } = resultado.data
    if (tipo !== equipo.tipo) {
      const duplicado = await prisma.equipoElectrico.findFirst({
        where: {
          bloqueId: equipo.bloqueId,
          espacioId: equipo.espacioId,
          tipo,
          NOT: { id: idEquipo },
        },
        select: { id: true },
      })
      if (duplicado) {
        return {
          estado: 'error',
          mensaje: `Ya existe un equipo de tipo "${tipo}" en el mismo espacio.`,
        }
      }
    }

    await prisma.equipoElectrico.update({
      where: { id: idEquipo },
      data: { tipo, cantidad, potenciaNominal },
    })

    await auditarAccion({
      action: 'equipo.update',
      targetId: idEquipo,
      detail: `Equipo actualizado: ${tipo}.`,
    })

    return {
      estado: 'completado',
      eliminadas: 0,
      lineasBaseEliminadas: 0,
      mensaje: `Equipo actualizado: ${tipo}.`,
    }
  } catch (error) {
    console.error('Error en actualizarEquipo:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible actualizar el equipo. Intente de nuevo.',
    }
  }
}

/** Elimina un equipo guardado por su id. */
export async function eliminarEquipo(id: string): Promise<ResultadoGestion> {
  try {
    const rechazo = await rechazoGestionEquipos()
    if (rechazo) return rechazo

    const idEquipo = String(id ?? '').trim()
    if (!idEquipo) {
      return { estado: 'error', mensaje: 'Equipo inválido.' }
    }

    const { count } = await prisma.equipoElectrico.deleteMany({
      where: { id: idEquipo },
    })
    if (count === 0) {
      return { estado: 'error', mensaje: 'El equipo ya no existe.' }
    }

    await auditarAccion({
      action: 'equipo.delete',
      targetId: idEquipo,
      detail: `Equipo ${idEquipo} eliminado.`,
    })

    return {
      estado: 'completado',
      eliminadas: count,
      lineasBaseEliminadas: 0,
      mensaje: 'Equipo eliminado del inventario.',
    }
  } catch (error) {
    console.error('Error en eliminarEquipo:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible eliminar el equipo. Intente de nuevo.',
    }
  }
}

/**
 * Vacía el inventario para empezar desde cero: elimina todos los equipos.
 * El catálogo (edificaciones, bloques y espacios) se conserva porque lo
 * comparten Variables Operativas y Líneas Base.
 */
export async function vaciarEquipos(): Promise<ResultadoGestion> {
  try {
    const rechazo = await rechazoGestionEquipos()
    if (rechazo) return rechazo

    const equipos = await prisma.equipoElectrico.deleteMany()

    await auditarAccion({
      action: 'equipos.truncate',
      targetId: 'global',
      detail: `Se eliminaron ${equipos.count} equipos eléctricos.`,
    })

    return {
      estado: 'completado',
      eliminadas: equipos.count,
      lineasBaseEliminadas: 0,
      mensaje: `Se eliminaron ${equipos.count} equipos eléctricos. Edificaciones, bloques y espacios se conservan.`,
    }
  } catch (error) {
    console.error('Error en vaciarEquipos:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible vaciar el inventario de equipos. Intente de nuevo.',
    }
  }
}
