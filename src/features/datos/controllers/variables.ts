'use server'

// Server Action de importación de Variables Operativas (SIGE-TdeA).
// Toda fila recibida se vuelve a validar en el servidor: nunca se confía
// en la validación hecha en el navegador.

import { prisma } from '@/shared/models/prisma'
import { canWithOverrides, getCurrentUser } from '@/shared/models/authz'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import {
  edicionVariableSchema,
  filaVariableOperativaschema,
} from '@/features/datos/models/validations'
import type {
  EdicionVariable,
  FilaEnvioVariables,
  ConflictoVariable,
  ResultadoGestion,
  ResultadoImportacionVariables,
} from '@/features/datos/models/validations'

/** Límite de filas por importación para proteger la transacción. */
const MAX_FILAS_POR_IMPORTACION = 5000

type FilaValida = {
  fila: number
  bloqueId: string
  mes: number
  ano: number
  poblacionFija: number
  poblacionFlotante: number
  diasLectivosLaborales: number
  gradesDiaEnfriamiento: number
}

/**
 * Importa (upsert) filas de Variables Operativas.
 *
 * Flujo:
 *  1. Exige sesión + permiso `upload` sobre el módulo `consumption`.
 *  2. Carga la edificación seleccionada (segmentación del importador).
 *  3. Re-valida cada fila con Zod y detecta duplicados internos
 *     (clave: bloque + mes + año).
 *  4. Valida que los bloques existan y pertenezcan a la edificación.
 *  5. Busca variables ya guardadas con la misma clave.
 *  6. Si hay existentes y `sobrescribir` es false → pide confirmación.
 *  7. Si no hay conflicto (o se autorizó sobrescribir) → upsert en transacción.
 */
export async function importarFilasVariables(
  edificacionId: string,
  filas: FilaEnvioVariables[],
  sobrescribir: boolean
): Promise<ResultadoImportacionVariables> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { estado: 'error', mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
    }
    if (!(await canWithOverrides(user, 'consumption', 'upload'))) {
      return {
        estado: 'error',
        mensaje: 'Su rol no tiene permiso para cargar variables operativas.',
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
      select: { id: true, nombre: true },
    })
    if (!edificacion) {
      return { estado: 'error', mensaje: 'La edificación indicada no existe.' }
    }

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

      if (!String(fila?.bloqueId ?? '').trim()) {
        errores.push({
          fila: numeroFila,
          razon: 'La columna "bloque" es obligatoria (código o ID de bloque)',
        })
        return
      }

      const resultado = filaVariableOperativaschema.safeParse({
        ...fila,
        bloqueId: String(fila.bloqueId).trim(),
      })

      if (!resultado.success) {
        const mensajes = resultado.error.issues.map((i) => i.message).join(', ')
        errores.push({ fila: numeroFila, razon: mensajes })
        return
      }

      const datos = resultado.data
      const clave = `${datos.bloqueId}|${datos.mes}|${datos.ano}`
      const filaPrevia = clavesVistas.get(clave)
      if (filaPrevia !== undefined) {
        errores.push({
          fila: numeroFila,
          razon: `Duplicado: el periodo ${datos.mes}/${datos.ano} ya aparece en la fila ${filaPrevia}`,
        })
        return
      }
      clavesVistas.set(clave, numeroFila)
      validas.push({ fila: numeroFila, ...datos })
    })

    const sinValidas = (): ResultadoImportacionVariables => ({
      estado: 'completado',
      insertadas: 0,
      actualizadas: 0,
      rechazadas: errores.length,
      errores,
      mensaje: 'Ninguna fila válida para importar. Corrija los errores reportados.',
    })

    if (validas.length === 0) return sinValidas()

    // Los bloques deben existir y pertenecer a la edificación seleccionada
    const idsBloque = Array.from(new Set(validas.map((v) => v.bloqueId)))
    const bloques = await prisma.bloque.findMany({
      where: { id: { in: idsBloque } },
      select: { id: true, edificacionId: true },
    })
    const duenos = new Map(bloques.map((b) => [b.id, b.edificacionId]))

    const confirmadas: FilaValida[] = []
    for (const v of validas) {
      const dueno = duenos.get(v.bloqueId)
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

    if (confirmadas.length === 0) return sinValidas()

    // Variables ya guardadas para la misma clave (bloque + mes + año)
    const existentes = await prisma.variableOperativa.findMany({
      where: {
        OR: confirmadas.map((v) => ({
          bloqueId: v.bloqueId,
          mes: v.mes,
          ano: v.ano,
        })),
      },
      select: { bloqueId: true, mes: true, ano: true },
    })
    const clavesExistentes = new Set(
      existentes.map((e) => `${e.bloqueId}|${e.mes}|${e.ano}`)
    )

    const conflictos: ConflictoVariable[] = confirmadas
      .filter((v) => clavesExistentes.has(`${v.bloqueId}|${v.mes}|${v.ano}`))
      .map((v) => ({ fila: v.fila, bloqueId: v.bloqueId, mes: v.mes, ano: v.ano }))

    if (conflictos.length > 0 && !sobrescribir) {
      return {
        estado: 'confirmacion_requerida',
        conflictos,
        validas: confirmadas.length,
        rechazadas: errores.length,
        errores,
        mensaje:
          `${conflictos.length} de ${confirmadas.length} filas coinciden con variables ya guardadas ` +
          '(mismo bloque, mes y año). Confirme para reemplazarlas.',
      }
    }

    // Importación atómica: o entran todas, o ninguna
    await prisma.$transaction(
      confirmadas.map((v) =>
        prisma.variableOperativa.upsert({
          where: { bloqueId_mes_ano: { bloqueId: v.bloqueId, mes: v.mes, ano: v.ano } },
          update: {
            poblacionFija: v.poblacionFija,
            poblacionFlotante: v.poblacionFlotante,
            diasLectivosLaborales: v.diasLectivosLaborales,
            gradesDiaEnfriamiento: v.gradesDiaEnfriamiento,
          },
          create: {
            bloqueId: v.bloqueId,
            mes: v.mes,
            ano: v.ano,
            poblacionFija: v.poblacionFija,
            poblacionFlotante: v.poblacionFlotante,
            diasLectivosLaborales: v.diasLectivosLaborales,
            gradesDiaEnfriamiento: v.gradesDiaEnfriamiento,
          },
        })
      )
    )

    let insertadas = 0
    let actualizadas = 0
    for (const v of confirmadas) {
      if (clavesExistentes.has(`${v.bloqueId}|${v.mes}|${v.ano}`)) actualizadas++
      else insertadas++
    }

    const partes: string[] = []
    if (insertadas > 0) partes.push(`${insertadas} nuevas`)
    if (actualizadas > 0) partes.push(`${actualizadas} actualizadas`)
    if (errores.length > 0) partes.push(`${errores.length} rechazadas`)

    await auditarAccion({
      action: 'variable.import',
      targetId: idEdificacion,
      detail: `Importación de variables: ${partes.join(', ')}.`,
    })

    return {
      estado: 'completado',
      insertadas,
      actualizadas,
      rechazadas: errores.length,
      errores,
      mensaje: `Importación finalizada: ${partes.join(', ')}.`,
    }
  } catch (error) {
    console.error('Error en importarFilasVariables:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible importar las variables operativas. Intente de nuevo.',
    }
  }
}

// ---------------------------------------------------------------------------
// Gestión de variables guardadas (pestaña "Gestión"): editar / eliminar / vaciar.
// Mismo gate que la carga: sesión + permiso `upload` sobre `consumption`.
// ---------------------------------------------------------------------------

/** Sesión + permiso para gestionar variables; `null` si está autorizado. */
async function rechazoGestionVariables(): Promise<ResultadoGestion | null> {
  const user = await getCurrentUser()
  if (!user) {
    return { estado: 'error', mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
  }
  if (!(await canWithOverrides(user, 'consumption', 'upload'))) {
    return {
      estado: 'error',
      mensaje: 'Su rol no tiene permiso para gestionar variables operativas en este módulo.',
    }
  }
  return null
}

/**
 * Actualiza los campos editables de una variable guardada.
 * La identidad (bloque + mes + año) es inmutable: cambiarla movería el
 * registro de periodo, que es la clave única en BD.
 */
export async function actualizarVariable(
  id: string,
  datos: EdicionVariable
): Promise<ResultadoGestion> {
  try {
    const rechazo = await rechazoGestionVariables()
    if (rechazo) return rechazo

    const idVariable = String(id ?? '').trim()
    if (!idVariable) {
      return { estado: 'error', mensaje: 'Variable inválida.' }
    }

    const resultado = edicionVariableSchema.safeParse(datos)
    if (!resultado.success) {
      const mensajes = resultado.error.issues.map((i) => i.message).join(', ')
      return { estado: 'error', mensaje: mensajes }
    }

    const variable = await prisma.variableOperativa.findUnique({
      where: { id: idVariable },
      select: { mes: true, ano: true },
    })
    if (!variable) {
      return { estado: 'error', mensaje: 'La variable ya no existe.' }
    }

    await prisma.variableOperativa.update({
      where: { id: idVariable },
      data: resultado.data,
    })

    await auditarAccion({
      action: 'variable.update',
      targetId: idVariable,
      detail: `Variable ${variable.mes}/${variable.ano} actualizada.`,
    })

    return {
      estado: 'completado',
      eliminadas: 0,
      lineasBaseEliminadas: 0,
      mensaje: `Variable ${variable.mes}/${variable.ano} actualizada.`,
    }
  } catch (error) {
    console.error('Error en actualizarVariable:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible actualizar la variable. Intente de nuevo.',
    }
  }
}

/** Elimina una variable operativa guardada por su id. */
export async function eliminarVariable(id: string): Promise<ResultadoGestion> {
  try {
    const rechazo = await rechazoGestionVariables()
    if (rechazo) return rechazo

    const idVariable = String(id ?? '').trim()
    if (!idVariable) {
      return { estado: 'error', mensaje: 'Variable inválida.' }
    }

    const { count } = await prisma.variableOperativa.deleteMany({
      where: { id: idVariable },
    })
    if (count === 0) {
      return { estado: 'error', mensaje: 'La variable ya no existe.' }
    }

    await auditarAccion({
      action: 'variable.delete',
      targetId: idVariable,
      detail: `Variable ${idVariable} eliminada.`,
    })

    return {
      estado: 'completado',
      eliminadas: count,
      lineasBaseEliminadas: 0,
      mensaje: 'Variable eliminada de la base de datos.',
    }
  } catch (error) {
    console.error('Error en eliminarVariable:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible eliminar la variable. Intente de nuevo.',
    }
  }
}

/**
 * Vacía la base de variables operativas para empezar desde cero: elimina
 * todas las variables. Las facturas y las Líneas Base guardadas se conservan
 * (son snapshots de resultados), y el catálogo de bloques no se toca.
 */
export async function vaciarVariables(): Promise<ResultadoGestion> {
  try {
    const rechazo = await rechazoGestionVariables()
    if (rechazo) return rechazo

    const variables = await prisma.variableOperativa.deleteMany()

    await auditarAccion({
      action: 'variables.truncate',
      targetId: 'global',
      detail: `Se eliminaron ${variables.count} variables operativas.`,
    })

    return {
      estado: 'completado',
      eliminadas: variables.count,
      lineasBaseEliminadas: 0,
      mensaje: `Se eliminaron ${variables.count} variables operativas. Facturas y líneas base se conservan.`,
    }
  } catch (error) {
    console.error('Error en vaciarVariables:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible vaciar las variables operativas. Intente de nuevo.',
    }
  }
}
