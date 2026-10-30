'use server'

// Server actions del módulo 4 — Alertas de consumo inusual (HU-08).
//
// La bandeja es una caché derivada: `generarAlertas` recalcula por completo el
// conjunto vigente (upsert + borrado de las que dejaron de cumplir) y es el
// ÚNICO lugar que muta filas de alerta. El recálculo es MANUAL (a petición del
// usuario): el motor estadístico tarda segundos y la vista debe decir con
// claridad que está mostrando datos desactualizados.

import { ejecutarAnalisis } from '@/features/analisis/controllers/analisis'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import { canWithOverrides, getCurrentUser } from '@/shared/models/authz'
import { prisma } from '@/shared/models/prisma'
import {
  CONFIG_ALERTA_POR_DEFECTO,
  cambiarEstadoAlertaSchema,
  evaluarAlertas,
  generarAlertasSchema,
  guardarConfigAlertaSchema,
  type CambiarEstadoAlerta,
  type ConfigAlerta,
  type GuardarConfigAlerta,
} from '../models/alertas'
import { leerEstadoEvaluacion } from './evaluacion'

export type ResultadoGenerarAlertas =
  | {
      estado: 'ok'
      mensaje: string
      creadas: number
      actualizadas: number
      eliminadas: number
      periodosEvaluables: number
      noEvaluables: number
      evaluadoEn: string
    }
  | { estado: 'error'; mensaje: string }

export type ResultadoCambioEstado =
  | { estado: 'ok'; mensaje: string }
  | { estado: 'error'; mensaje: string }

export type ResultadoConfigAlerta =
  | { estado: 'ok'; mensaje: string; config: ConfigAlerta }
  | { estado: 'error'; mensaje: string }

/**
 * Recalcula la bandeja de una edificación contra su umbral vigente.
 *
 * ACLARACIÓN DE PERMISOS: evaluar alertas ejecuta el MISMO motor estadístico
 * que el módulo de Análisis, cuya server action exige `consumption:analyze`.
 * Se respeta ese gate en vez de duplicar el cálculo (fuente única de verdad);
 * por eso en la matriz solo el Gestor Energético tiene `alerts:evaluate`.
 *
 * CONFIGURACIÓN DESACTIVADA: `activo: false` no crea ni borra nada. Apagar la
 * generación no debe vaciar la bandeja existente.
 */
export async function generarAlertas(solicitud: {
  edificacionId: string
}): Promise<ResultadoGenerarAlertas> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { estado: 'error', mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
    }
    if (!(await canWithOverrides(user, 'alerts', 'evaluate'))) {
      return {
        estado: 'error',
        mensaje:
          'Su rol no tiene permiso para evaluar alertas. Evaluar exige el mismo permiso que ejecutar un análisis de consumo.',
      }
    }

    const parse = generarAlertasSchema.safeParse(solicitud)
    if (!parse.success) {
      return { estado: 'error', mensaje: parse.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const { edificacionId } = parse.data

    const analisis = await ejecutarAnalisis({ edificacionId })
    if (!analisis.ok) {
      return { estado: 'error', mensaje: analisis.error }
    }

    const estado = await leerEstadoEvaluacion(edificacionId)
    const config: ConfigAlerta = estado?.config ?? { ...CONFIG_ALERTA_POR_DEFECTO }

    if (!config.activo) {
      return {
        estado: 'ok',
        mensaje:
          'La generación de alertas está desactivada para esta edificación: no se modificó la bandeja.',
        creadas: 0,
        actualizadas: 0,
        eliminadas: 0,
        periodosEvaluables: estado?.evaluacion?.periodosEvaluables ?? 0,
        noEvaluables: estado?.evaluacion?.noEvaluables ?? 0,
        evaluadoEn: (estado?.evaluacion?.evaluadoEn ?? new Date()).toISOString(),
      }
    }

    const evaluacion = evaluarAlertas(analisis.analisis.salida, {
      pct: config.pct,
      k: config.k,
    })
    const firmas = {
      firma: estado?.firmaActual ?? '',
      config,
    }

    const periodosVigentes = new Set(evaluacion.alertas.map((alerta) => alerta.periodo))
    let creadas = 0
    let actualizadas = 0
    let eliminadas = 0

    await prisma.$transaction(async (tx) => {
      const previas = await tx.alertaConsumo.findMany({
        where: { edificacionId },
        select: { id: true, periodo: true },
      })
      const idPorPeriodo = new Map(previas.map((fila) => [fila.periodo, fila.id]))

      for (const alerta of evaluacion.alertas) {
        // Parte DERIVADA de la fila: el recálculo la reescribe siempre…
        const derivada = {
          mes: alerta.mes,
          ano: alerta.ano,
          consumoKwh: alerta.consumoKwh,
          bandaInf: alerta.bandaInf,
          bandaSup: alerta.bandaSup,
          desviacionPct: alerta.desviacionPct,
          direccion: alerta.direccion,
          severidad: alerta.severidad,
          umbralPct: evaluacion.config.pct,
          umbralK: evaluacion.config.k,
        }
        const existenteId = idPorPeriodo.get(alerta.periodo)
        if (existenteId) {
          // …y la disposición del usuario (estado, nota, leída) NUNCA se toca:
          // una alerta descartada no revive mientras su período siga siendo
          // inusual con el mismo umbral.
          await tx.alertaConsumo.update({ where: { id: existenteId }, data: derivada })
          actualizadas += 1
        } else {
          await tx.alertaConsumo.create({
            data: { ...derivada, edificacionId, periodo: alerta.periodo },
          })
          creadas += 1
        }
      }

      const retiradas = previas
        .filter((fila) => !periodosVigentes.has(fila.periodo))
        .map((fila) => fila.id)
      if (retiradas.length > 0) {
        const borrado = await tx.alertaConsumo.deleteMany({ where: { id: { in: retiradas } } })
        eliminadas = borrado.count
      }

      const noEvaluables = evaluacion.mesesNoEvaluables.length
      await tx.evaluacionAlerta.upsert({
        where: { edificacionId },
        create: {
          edificacionId,
          firma: firmas.firma,
          periodosEvaluables: evaluacion.periodosEvaluables,
          noEvaluables,
          evaluadoPorId: user.id,
        },
        update: {
          firma: firmas.firma,
          periodosEvaluables: evaluacion.periodosEvaluables,
          noEvaluables,
          evaluadoEn: new Date(),
          evaluadoPorId: user.id,
        },
      })
    })

    await auditarAccion({
      action: 'alerta.generate',
      targetId: edificacionId,
      detail:
        `Alertas recalculadas: ${creadas} creadas, ${actualizadas} actualizadas, ` +
        `${eliminadas} retiradas. Umbral ${firmas.config.pct}% / ${firmas.config.k}σ.`,
    })

    const resumen =
      creadas + actualizadas === 0
        ? 'Ningún período supera el umbral: la bandeja quedó vacía.'
        : `La bandeja quedó con ${creadas + actualizadas} ${creadas + actualizadas === 1 ? 'alerta' : 'alertas'}.`
    const retiradasTxt =
      eliminadas > 0 ? ` Se retiraron ${eliminadas} que ya no superan el umbral.` : ''

    return {
      estado: 'ok',
      mensaje: resumen + retiradasTxt,
      creadas,
      actualizadas,
      eliminadas,
      periodosEvaluables: evaluacion.periodosEvaluables,
      noEvaluables: evaluacion.mesesNoEvaluables.length,
      evaluadoEn: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error en generarAlertas:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible evaluar las alertas. Intente de nuevo.',
    }
  }
}

/**
 * Marca una alerta como leída, descartada o nueva (triage del usuario).
 * Requiere el permiso de lectura del módulo: es una anotación sobre lo que el
 * rol ya puede ver, no una modificación de los datos de consumo.
 */
export async function cambiarEstadoAlerta(
  datos: CambiarEstadoAlerta
): Promise<ResultadoCambioEstado> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { estado: 'error', mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
    }
    if (!(await canWithOverrides(user, 'alerts', 'read'))) {
      return { estado: 'error', mensaje: 'Su rol no tiene permiso para gestionar alertas.' }
    }

    const parse = cambiarEstadoAlertaSchema.safeParse(datos)
    if (!parse.success) {
      return { estado: 'error', mensaje: parse.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const { id, estado, nota } = parse.data

    const alerta = await prisma.alertaConsumo.findUnique({
      where: { id },
      select: { id: true, periodo: true, estado: true },
    })
    if (!alerta) {
      return { estado: 'error', mensaje: 'La alerta ya no existe: vuelva a recalcular la bandeja.' }
    }

    const leida = estado === 'leida'
    await prisma.alertaConsumo.update({
      where: { id },
      data: {
        estado,
        // La nota solo se pisa si viene en la petición (no se borra sola).
        ...(nota !== undefined ? { nota } : {}),
        leidaPorId: leida ? user.id : null,
        leidaAt: leida ? new Date() : null,
      },
    })

    const accion =
      estado === 'descartada' ? 'alerta.discard' : leida ? 'alerta.read' : 'alerta.restore'
    await auditarAccion({
      action: accion,
      targetId: id,
      detail:
        estado === 'descartada'
          ? `Alerta del período ${alerta.periodo} descartada.`
          : leida
            ? `Alerta del período ${alerta.periodo} marcada como leída.`
            : `Alerta del período ${alerta.periodo} devuelta a «nueva».`,
    })

    const etiquetas: Record<string, string> = {
      nueva: 'devuelta a «nueva»',
      leida: 'marcada como leída',
      descartada: 'descartada',
    }
    return { estado: 'ok', mensaje: `Alerta ${etiquetas[estado]}.` }
  } catch (error) {
    console.error('Error en cambiarEstadoAlerta:', error)
    return { estado: 'error', mensaje: 'No fue posible actualizar la alerta. Intente de nuevo.' }
  }
}

/**
 * Guarda el umbral de una edificación.
 *
 * NO recalcula: el cambio de criterio marca la bandeja como desactualizada (la
 * configuración forma parte de la firma) y el usuario decide cuándo volver a
 * evaluar. Las alertas existentes conservan su snapshot de umbral, así que
 * nunca se reetiquetan en silencio.
 */
export async function guardarConfigAlerta(
  datos: GuardarConfigAlerta
): Promise<ResultadoConfigAlerta> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { estado: 'error', mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
    }
    if (!(await canWithOverrides(user, 'alerts', 'config'))) {
      return {
        estado: 'error',
        mensaje: 'Su rol no tiene permiso para configurar el umbral de alertas.',
      }
    }

    const parse = guardarConfigAlertaSchema.safeParse(datos)
    if (!parse.success) {
      return { estado: 'error', mensaje: parse.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const { edificacionId, pct, k, activo } = parse.data

    const edificacion = await prisma.edificacion.findUnique({
      where: { id: edificacionId },
      select: { id: true, nombre: true },
    })
    if (!edificacion) {
      return { estado: 'error', mensaje: 'La edificación indicada no existe.' }
    }

    const previa = await prisma.configUmbralAlerta.findUnique({ where: { edificacionId } })
    const config = await prisma.configUmbralAlerta.upsert({
      where: { edificacionId },
      create: { edificacionId, pct, k, activo },
      update: { pct, k, activo },
    })

    const generacion = activo ? 'activa' : 'desactivada'
    await auditarAccion({
      action: 'alerta.config',
      targetId: edificacionId,
      detail: previa
        ? `Umbral de "${edificacion.nombre}": ${previa.pct}% → ${pct}%, ` +
          `${previa.k}σ → ${k}σ, generación ${generacion}.`
        : `Umbral de "${edificacion.nombre}": ${pct}% / ${k}σ, generación ${generacion}.`,
    })

    return {
      estado: 'ok',
      mensaje:
        'Umbral guardado. La bandeja quedó desactualizada: recalcúlela para aplicar el nuevo criterio.',
      config: { pct: config.pct, k: config.k, activo: config.activo },
    }
  } catch (error) {
    console.error('Error en guardarConfigAlerta:', error)
    return { estado: 'error', mensaje: 'No fue posible guardar el umbral. Intente de nuevo.' }
  }
}
