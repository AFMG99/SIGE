'use server'

// Server Action de importación de facturas de energía (SIGE-TdeA).
// Toda fila recibida se vuelve a validar en el servidor: nunca se confía
// en la validación hecha en el navegador.

import { prisma } from '@/shared/models/prisma'
import { canWithOverrides, getCurrentUser } from '@/shared/models/authz'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import {
  edicionFacturaSchema,
  filaFacturaEpmschema,
  calcularConsumoNormalizado,
  extraerAnomesPeriodo,
} from '@/features/datos/models/validations'
import type {
  EdicionFactura,
  FilaEnvioImportacion,
  ConflictoFactura,
  ResultadoGestion,
  ResultadoImportacionFacturas,
} from '@/features/datos/models/validations'

/** Límite de filas por importación para proteger la transacción. */
const MAX_FILAS_POR_IMPORTACION = 5000

/**
 * Importa (upsert) filas de facturas de energía ya revisadas en el cliente.
 *
 * Flujo:
 *  1. Exige sesión + permiso `upload` sobre el módulo `consumption`.
 *  2. Valida la edificación destino (`edificacionId` es requerido en BD).
 *  3. Re-valida cada fila con Zod y detecta duplicados internos.
 *  4. Consulta BD por periodos existentes.
 *  5. Si hay existentes y `sobrescribir` es false → pide confirmación.
 *  6. Si no hay conflicto (o se autorizó sobrescribir) → upsert en transacción
 *     (al sobrescribir, la factura queda reasignada a la edificación elegida).
 */
export async function importarFilasFacturas(
  filas: FilaEnvioImportacion[],
  sobrescribir: boolean,
  edificacionId: string
): Promise<ResultadoImportacionFacturas> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { estado: 'error', mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
    }
    if (!(await canWithOverrides(user, 'consumption', 'upload'))) {
      return {
        estado: 'error',
        mensaje: 'Su rol no tiene permiso para cargar facturas en este módulo.',
      }
    }

    const idEdificacion = String(edificacionId ?? '').trim()
    if (!idEdificacion) {
      return { estado: 'error', mensaje: 'Debe indicar la edificación de las facturas.' }
    }
    const edificacion = await prisma.edificacion.findUnique({
      where: { id: idEdificacion },
      select: { id: true },
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
    const validas: { fila: number; periodo: string; diasFacturados: number; consumoKwh: number; costoCop: number }[] = []
    const periodosVistos = new Map<string, number>()

    filas.forEach((fila, posicion) => {
      const numeroFila = Number.isInteger(fila?.fila) ? fila.fila : posicion + 1
      const resultado = filaFacturaEpmschema.safeParse(fila)

      if (!resultado.success) {
        const mensajes = resultado.error.issues.map((i) => i.message).join(', ')
        errores.push({ fila: numeroFila, razon: mensajes })
        return
      }

      const datos = resultado.data
      const filaPrevia = periodosVistos.get(datos.periodo)
      if (filaPrevia !== undefined) {
        errores.push({
          fila: numeroFila,
          razon: `Duplicado: el periodo ${datos.periodo} ya aparece en la fila ${filaPrevia}`,
        })
        return
      }
      periodosVistos.set(datos.periodo, numeroFila)
      validas.push({ fila: numeroFila, ...datos })
    })

    if (validas.length === 0) {
      return {
        estado: 'completado',
        insertadas: 0,
        actualizadas: 0,
        rechazadas: errores.length,
        errores,
        mensaje: 'Ninguna fila válida para importar. Corrija los errores reportados.',
      }
    }

    // Registros que ya existen para el mismo periodo EN LA EDIFICACIÓN
    // destino (identidad del registro: periodo + edificacionId)
    const existentes = await prisma.facturaEnergia.findMany({
      where: {
        periodo: { in: validas.map((v) => v.periodo) },
        edificacionId: idEdificacion,
      },
      select: { periodo: true, edificacion: { select: { nombre: true } } },
    })
    const edificacionPorPeriodo = new Map(
      existentes.map((e) => [e.periodo, e.edificacion.nombre])
    )
    const periodosExistentes = new Set(existentes.map((e) => e.periodo))

    const conflictos: ConflictoFactura[] = validas
      .filter((v) => periodosExistentes.has(v.periodo))
      .map((v) => ({
        fila: v.fila,
        periodo: v.periodo,
        edificacion: edificacionPorPeriodo.get(v.periodo),
      }))

    if (conflictos.length > 0 && !sobrescribir) {
      return {
        estado: 'confirmacion_requerida',
        conflictos,
        validas: validas.length,
        rechazadas: errores.length,
        errores,
        mensaje:
          `${conflictos.length} de ${validas.length} filas coinciden con facturas ya guardadas ` +
          '(mismo periodo en esta edificación). Confirme para reemplazarlas.',
      }
    }

    // Importación atómica: o entran todas, o ninguna
    await prisma.$transaction(
      validas.map((v) => {
        const { ano, mes } = extraerAnomesPeriodo(v.periodo)
        const diasDelMes = new Date(ano, mes, 0).getDate()
        const consumoNormalizado = calcularConsumoNormalizado(v.consumoKwh, diasDelMes)

        return prisma.facturaEnergia.upsert({
          where: {
            periodo_edificacionId: {
              periodo: v.periodo,
              edificacionId: idEdificacion,
            },
          },
          update: {
            diasFacturados: v.diasFacturados,
            consumoKwh: v.consumoKwh,
            consumoNormalizado,
            costoCop: v.costoCop,
            edificacionId: idEdificacion,
          },
          create: {
            periodo: v.periodo,
            diasFacturados: v.diasFacturados,
            consumoKwh: v.consumoKwh,
            consumoNormalizado,
            costoCop: v.costoCop,
            edificacionId: idEdificacion,
          },
        })
      })
    )

    let insertadas = 0
    let actualizadas = 0
    for (const v of validas) {
      if (periodosExistentes.has(v.periodo)) actualizadas++
      else insertadas++
    }

    const partes: string[] = []
    if (insertadas > 0) partes.push(`${insertadas} nuevas`)
    if (actualizadas > 0) partes.push(`${actualizadas} actualizadas`)
    if (errores.length > 0) partes.push(`${errores.length} rechazadas`)

    await auditarAccion({
      action: 'factura.import',
      targetId: idEdificacion,
      detail: `Importación de facturas: ${partes.join(', ')}.`,
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
    console.error('Error en importarFilasFacturas:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible importar las facturas. Intente de nuevo.',
    }
  }
}

// ---------------------------------------------------------------------------
// Gestión de facturas guardadas (pestaña "Gestión"): editar / eliminar / vaciar.
// Mismo gate que la carga: sesión + permiso `upload` sobre `consumption`.
// ---------------------------------------------------------------------------

/** Sesión + permiso para gestionar facturas; `null` si está autorizado. */
async function rechazoGestionFacturas(): Promise<ResultadoGestion | null> {
  const user = await getCurrentUser()
  if (!user) {
    return { estado: 'error', mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
  }
  if (!(await canWithOverrides(user, 'consumption', 'upload'))) {
    return {
      estado: 'error',
      mensaje: 'Su rol no tiene permiso para gestionar facturas en este módulo.',
    }
  }
  return null
}

/**
 * Actualiza los campos editables de una factura guardada.
 * El periodo y la edificación son inmutables (identidad del registro) y el
 * consumo normalizado se recalcula con los días reales del mes del periodo.
 */
export async function actualizarFactura(
  id: string,
  datos: EdicionFactura
): Promise<ResultadoGestion> {
  try {
    const rechazo = await rechazoGestionFacturas()
    if (rechazo) return rechazo

    const idFactura = String(id ?? '').trim()
    if (!idFactura) {
      return { estado: 'error', mensaje: 'Factura inválida.' }
    }

    const resultado = edicionFacturaSchema.safeParse(datos)
    if (!resultado.success) {
      const mensajes = resultado.error.issues.map((i) => i.message).join(', ')
      return { estado: 'error', mensaje: mensajes }
    }

    const factura = await prisma.facturaEnergia.findUnique({
      where: { id: idFactura },
      select: { periodo: true },
    })
    if (!factura) {
      return { estado: 'error', mensaje: 'La factura ya no existe.' }
    }

    const { ano, mes } = extraerAnomesPeriodo(factura.periodo)
    const diasDelMes = new Date(ano, mes, 0).getDate()
    const consumoNormalizado = calcularConsumoNormalizado(
      resultado.data.consumoKwh,
      diasDelMes
    )

    await prisma.facturaEnergia.update({
      where: { id: idFactura },
      data: {
        diasFacturados: resultado.data.diasFacturados,
        consumoKwh: resultado.data.consumoKwh,
        consumoNormalizado,
        costoCop: resultado.data.costoCop,
      },
    })

    await auditarAccion({
      action: 'factura.update',
      targetId: idFactura,
      detail: `Factura ${factura.periodo} actualizada.`,
    })

    return {
      estado: 'completado',
      eliminadas: 0,
      lineasBaseEliminadas: 0,
      mensaje: `Factura ${factura.periodo} actualizada.`,
    }
  } catch (error) {
    console.error('Error en actualizarFactura:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible actualizar la factura. Intente de nuevo.',
    }
  }
}

/** Elimina una factura guardada por su id. */
export async function eliminarFactura(id: string): Promise<ResultadoGestion> {
  try {
    const rechazo = await rechazoGestionFacturas()
    if (rechazo) return rechazo

    const idFactura = String(id ?? '').trim()
    if (!idFactura) {
      return { estado: 'error', mensaje: 'Factura inválida.' }
    }

    const { count } = await prisma.facturaEnergia.deleteMany({
      where: { id: idFactura },
    })
    if (count === 0) {
      return { estado: 'error', mensaje: 'La factura ya no existe.' }
    }

    await auditarAccion({
      action: 'factura.delete',
      targetId: idFactura,
      detail: `Factura ${idFactura} eliminada.`,
    })

    return {
      estado: 'completado',
      eliminadas: count,
      lineasBaseEliminadas: 0,
      mensaje: 'Factura eliminada de la base de datos.',
    }
  } catch (error) {
    console.error('Error en eliminarFactura:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible eliminar la factura. Intente de nuevo.',
    }
  }
}

/**
 * Vacía la base de facturas para empezar desde cero: elimina todas las
 * facturas y, en la misma transacción, las Líneas Base guardadas que se
 * calculan a partir de ellas. Las variables operativas se conservan.
 */
export async function vaciarFacturas(): Promise<ResultadoGestion> {
  try {
    const rechazo = await rechazoGestionFacturas()
    if (rechazo) return rechazo

    const [lineasBase, facturas] = await prisma.$transaction([
      prisma.lineaBaseEnergia.deleteMany(),
      prisma.facturaEnergia.deleteMany(),
    ])

    await auditarAccion({
      action: 'facturas.truncate',
      targetId: 'global',
      detail: `Se eliminaron ${facturas.count} facturas y ${lineasBase.count} líneas base.`,
    })

    return {
      estado: 'completado',
      eliminadas: facturas.count,
      lineasBaseEliminadas: lineasBase.count,
      mensaje: `Se eliminaron ${facturas.count} facturas y ${lineasBase.count} líneas base guardadas.`,
    }
  } catch (error) {
    console.error('Error en vaciarFacturas:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible vaciar la base de facturas. Intente de nuevo.',
    }
  }
}
