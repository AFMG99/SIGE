/**
 * Lectura de las ENTRADAS de una evaluación de alertas y de su firma.
 *
 * No es una server action (no lleva `'use server'`): es el helper de servidor
 * que comparten la página (para decidir si la bandeja está desactualizada) y la
 * server action `generarAlertas`. Mismo patrón que
 * `features/datos/controllers/auditoria.ts`.
 *
 * La firma se calcula con 4 consultas agregadas (…batch) en vez de una por
 * edificación: la página evalúa todas las edificaciones visibles de una vez.
 */

import { VERSION_MOTOR_ANALISIS } from '@/features/analisis/models/analisis'
import { prisma } from '@/shared/models/prisma'
import {
  CONFIG_ALERTA_POR_DEFECTO,
  firmaDeEntradas,
  type ConfigAlerta,
  type EntradasFirmaEvaluacion,
} from '../models/alertas'

export interface EvaluacionPersistida {
  firma: string
  periodosEvaluables: number
  noEvaluables: number
  evaluadoEn: Date
  evaluadoPorId: string | null
}

export interface EstadoEvaluacion {
  config: ConfigAlerta
  /** Firma de las entradas tal como están AHORA en la base de datos. */
  firmaActual: string
  evaluacion: EvaluacionPersistida | null
  /** Nunca evaluada, o los datos cambiaron desde la última evaluación. */
  desactualizada: boolean
}

export type EstadosEvaluacion = Record<string, EstadoEvaluacion>

type Acumulado = {
  facTotal: number
  facUltima: Date | null
  facConsumo: number
  varTotal: number
  varUltima: Date | null
  ajuTotal: number
  ajuValor: number
}

function inicial(): Acumulado {
  return {
    facTotal: 0,
    facUltima: null,
    facConsumo: 0,
    varTotal: 0,
    varUltima: null,
    ajuTotal: 0,
    ajuValor: 0,
  }
}

function masReciente(actual: Date | null, candidata: Date | null): Date | null {
  if (!candidata) return actual
  if (!actual) return candidata
  return candidata > actual ? candidata : actual
}

/**
 * Estado de evaluación de varias edificaciones. Consultas:
 *  1. Facturas agrupadas por edificación (conteo, última actualización, suma).
 *  2. Bloques de esas edificaciones (para mapear bloque → edificación).
 *  3. Configuraciones de umbral guardadas.
 *  4. Evaluaciones persistidas.
 *  5. Variables operativas agrupadas por bloque.
 *  6. Ajustes no rutinarios agrupados por bloque (los mismos que consume el
 *     motor: `ejecutarAnalisis` filtra por `tipo: 'NO_RUTINARIO'`).
 */
export async function leerEstadosEvaluacion(
  edificacionIds: readonly string[]
): Promise<EstadosEvaluacion> {
  const ids = Array.from(new Set(edificacionIds.filter((id) => Boolean(id))))
  if (ids.length === 0) return {}

  const [facturas, bloques, configs, evaluaciones] = await Promise.all([
    prisma.facturaEnergia.groupBy({
      by: ['edificacionId'],
      where: { edificacionId: { in: ids } },
      _count: { _all: true },
      _max: { actualizadoAt: true },
      _sum: { consumoKwh: true },
    }),
    prisma.bloque.findMany({
      where: { edificacionId: { in: ids } },
      select: { id: true, edificacionId: true },
    }),
    prisma.configUmbralAlerta.findMany({ where: { edificacionId: { in: ids } } }),
    prisma.evaluacionAlerta.findMany({ where: { edificacionId: { in: ids } } }),
  ])

  const bloqueAEdificacion = new Map(bloques.map((bloque) => [bloque.id, bloque.edificacionId]))
  const bloqueIds = bloques.map((bloque) => bloque.id)

  const [variables, ajustes] = await Promise.all([
    prisma.variableOperativa.groupBy({
      by: ['bloqueId'],
      where: { bloqueId: { in: bloqueIds } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.ajusteEnergetico.groupBy({
      by: ['bloqueId'],
      where: { bloqueId: { in: bloqueIds }, tipo: 'NO_RUTINARIO' },
      _count: { _all: true },
      _sum: { valorAjuste: true },
    }),
  ])

  const acumulado = new Map<string, Acumulado>()
  for (const id of ids) acumulado.set(id, inicial())

  for (const fila of facturas) {
    const acc = acumulado.get(fila.edificacionId)
    if (!acc) continue
    acc.facTotal = fila._count._all
    acc.facUltima = fila._max.actualizadoAt ?? null
    acc.facConsumo = fila._sum.consumoKwh ?? 0
  }

  for (const fila of variables) {
    const edificacionId = bloqueAEdificacion.get(fila.bloqueId)
    const acc = edificacionId ? acumulado.get(edificacionId) : undefined
    if (!acc) continue
    acc.varTotal += fila._count._all
    acc.varUltima = masReciente(acc.varUltima, fila._max.createdAt ?? null)
  }

  for (const fila of ajustes) {
    const edificacionId = bloqueAEdificacion.get(fila.bloqueId)
    const acc = edificacionId ? acumulado.get(edificacionId) : undefined
    if (!acc) continue
    acc.ajuTotal += fila._count._all
    acc.ajuValor += fila._sum.valorAjuste ?? 0
  }

  const configPorEdificacion = new Map(configs.map((config) => [config.edificacionId, config]))
  const evaluacionPorEdificacion = new Map(
    evaluaciones.map((evaluacion) => [evaluacion.edificacionId, evaluacion])
  )

  const resultado: EstadosEvaluacion = {}
  for (const id of ids) {
    const acc = acumulado.get(id) ?? inicial()
    const guardada = configPorEdificacion.get(id)
    const config: ConfigAlerta = guardada
      ? { pct: guardada.pct, k: guardada.k, activo: guardada.activo }
      : { ...CONFIG_ALERTA_POR_DEFECTO }

    const entradas: EntradasFirmaEvaluacion = {
      edificacionId: id,
      config,
      facturas: {
        total: acc.facTotal,
        ultimaActualizacion: acc.facUltima ? acc.facUltima.toISOString() : null,
        consumoTotal: acc.facConsumo,
      },
      variables: {
        total: acc.varTotal,
        ultimaCreacion: acc.varUltima ? acc.varUltima.toISOString() : null,
      },
      ajustes: { total: acc.ajuTotal, valorTotal: acc.ajuValor },
      versionMotor: VERSION_MOTOR_ANALISIS,
    }

    const firmaActual = firmaDeEntradas(entradas)
    const persistida = evaluacionPorEdificacion.get(id)
    const evaluacion: EvaluacionPersistida | null = persistida
      ? {
          firma: persistida.firma,
          periodosEvaluables: persistida.periodosEvaluables,
          noEvaluables: persistida.noEvaluables,
          evaluadoEn: persistida.evaluadoEn,
          evaluadoPorId: persistida.evaluadoPorId,
        }
      : null

    resultado[id] = {
      config,
      firmaActual,
      evaluacion,
      desactualizada: !evaluacion || evaluacion.firma !== firmaActual,
    }
  }

  return resultado
}

/** Estado de evaluación de una sola edificación. */
export async function leerEstadoEvaluacion(edificacionId: string): Promise<EstadoEvaluacion | null> {
  const estados = await leerEstadosEvaluacion([edificacionId])
  return estados[edificacionId] ?? null
}
