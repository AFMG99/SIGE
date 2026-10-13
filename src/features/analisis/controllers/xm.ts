'use server'

/**
 * Server actions del benchmark XM del Módulo 3.
 *
 * Tres acciones independientes para que la vista las ejecute en paralelo
 * (cada una con su propio presupuesto de tiempo y su cache):
 *  - `cargarSerieSistemaXm`  — DemaSIN diario → mensual, 13 meses.
 *  - `cargarSerieMercadoXm`  — DemaComeNoReg horario → mensual, 13 meses.
 *  - `cargarContextoXm`      — comparación interna SIGE + catálogo oficial.
 *
 * Todas exigen `consumption/analyze` con overrides server-side. Si XM no
 * responde, devuelven `{ estado: 'error' }` sin cachear: la vista muestra
 * un callout y el análisis no se ve afectado (degradación elegante).
 */

import { z } from 'zod'

import { prisma } from '@/shared/models/prisma'
import { canWithOverrides, getCurrentUser } from '@/shared/models/authz'

import {
  agregarDiarioMensual,
  agregarHorarioMensual,
  CATALOGO_XM,
  conLimite,
  CONCURRENCIA_XM,
  construirSerie,
  MESES_BENCHMARK,
  MESES_COMPARACION_INTERNA,
  mesesCompletosRecientes,
  respuestaDiariaXmSchema,
  respuestaHorariaXmSchema,
  SERIE_MERCADO,
  SERIE_SISTEMA,
  TIMEOUT_XM_MS,
  TTL_CACHE_XM_MS,
  ventanaDelMes,
  type CatalogoMetricaXm,
  type ComparacionInterna,
  type ContextoXm,
  type FilaComparacionInterna,
  type MetaSerieXm,
  type RespuestaContextoXm,
  type RespuestaSerieXm,
} from '../models/xm'

type EntradaCache<T> = { ts: number; valor: T }

const cacheSeries = new Map<string, EntradaCache<RespuestaSerieXm>>()
const cacheContexto = new Map<string, EntradaCache<RespuestaContextoXm>>()

const MENSAJE_XM =
  'La API de XM no está disponible en este momento. Intente de nuevo más tarde; el análisis no se ve afectado.'

async function exigirPermisoAnalisis(): Promise<string | null> {
  const user = await getCurrentUser()
  if (!user) return 'Sesión expirada. Inicie sesión nuevamente.'
  if (!(await canWithOverrides(user, 'consumption', 'analyze'))) {
    return 'Su rol no tiene permiso para consultar el benchmark de XM.'
  }
  return null
}

async function consultarXm<T>(
  endpoint: 'daily' | 'hourly',
  cuerpo: unknown,
  esquema: z.ZodType<T, z.ZodTypeDef, unknown>
): Promise<T> {
  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), TIMEOUT_XM_MS)
  try {
    const respuesta = await fetch(`https://servapibi.xm.com.co/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: control.signal,
      cache: 'no-store',
    })
    if (!respuesta.ok) {
      throw new Error(`XM respondió ${respuesta.status}`)
    }
    const json: unknown = await respuesta.json()
    const parse = esquema.safeParse(json)
    if (!parse.success) {
      throw new Error('Respuesta de XM fuera del espejo Zod')
    }
    return parse.data
  } finally {
    clearTimeout(reloj)
  }
}

async function obtenerSerie(meta: MetaSerieXm): Promise<RespuestaSerieXm> {
  const idCache = `serie:${meta.clave}`
  const cache = cacheSeries.get(idCache)
  if (cache && Date.now() - cache.ts < TTL_CACHE_XM_MS) return cache.valor

  const periodos = mesesCompletosRecientes(MESES_BENCHMARK)
  const porMes = new Map<string, number>()
  const advertencias: string[] = []

  const tareas = periodos.map((periodo) => async () => {
    const { inicio, fin } = ventanaDelMes(periodo)
    const cuerpo = {
      MetricId: meta.metricId,
      StartDate: inicio,
      EndDate: fin,
      Entity: meta.cruce,
      Filter: [],
    }
    const fusionar = (agregado: Map<string, number>) => {
      agregado.forEach((kwh, mes) => {
        porMes.set(mes, (porMes.get(mes) ?? 0) + kwh)
      })
    }
    try {
      if (meta.endpoint === 'daily') {
        const json = await consultarXm(meta.endpoint, cuerpo, respuestaDiariaXmSchema)
        fusionar(agregarDiarioMensual(json.Items))
      } else {
        const json = await consultarXm(meta.endpoint, cuerpo, respuestaHorariaXmSchema)
        fusionar(agregarHorarioMensual(json.Items))
      }
    } catch {
      advertencias.push(`Sin datos de XM para ${periodo} (${meta.metricId}).`)
    }
  })
  await conLimite(tareas, CONCURRENCIA_XM)

  if (porMes.size === 0) return { estado: 'error', mensaje: MENSAJE_XM }

  const { serie, sinDatos } = construirSerie(meta.clave, meta.nombre, periodos, porMes)
  if (sinDatos.length > 0) {
    advertencias.push(
      `${sinDatos.length} ${sinDatos.length === 1 ? 'mes quedó' : 'meses quedaron'} sin datos de XM (${meta.metricId}); la serie se muestra con los meses disponibles.`
    )
  }

  const valor: RespuestaSerieXm = { estado: 'ok', serie, advertencias }
  cacheSeries.set(idCache, { ts: Date.now(), valor })
  return valor
}

/** Serie nacional DemaSIN (diaria → mensual) de los últimos 13 meses. */
export async function cargarSerieSistemaXm(): Promise<RespuestaSerieXm> {
  try {
    const denegado = await exigirPermisoAnalisis()
    if (denegado) return { estado: 'error', mensaje: denegado }
    return await obtenerSerie(SERIE_SISTEMA)
  } catch (e) {
    console.error('Error consultando la serie XM del Sistema:', e)
    return { estado: 'error', mensaje: MENSAJE_XM }
  }
}

/** Serie del mercado no regulado (horaria → mensual) de los últimos 13 meses. */
export async function cargarSerieMercadoXm(): Promise<RespuestaSerieXm> {
  try {
    const denegado = await exigirPermisoAnalisis()
    if (denegado) return { estado: 'error', mensaje: denegado }
    return await obtenerSerie(SERIE_MERCADO)
  } catch (e) {
    console.error('Error consultando la serie XM del mercado no regulado:', e)
    return { estado: 'error', mensaje: MENSAJE_XM }
  }
}

async function construirComparacionInterna(): Promise<ComparacionInterna> {
  const periodos = mesesCompletosRecientes(MESES_COMPARACION_INTERNA)
  const previos = periodos.slice(0, 12)
  const recientes = periodos.slice(12)
  const conjuntoPrevios = new Set(previos)
  const conjuntoRecientes = new Set(recientes)

  const facturas = await prisma.facturaEnergia.findMany({
    where: { periodo: { gte: periodos[0] } },
    select: {
      periodo: true,
      consumoNormalizado: true,
      edificacionId: true,
      edificacion: { select: { nombre: true } },
    },
    orderBy: { periodo: 'asc' },
  })

  type Acumulado = {
    nombre: string
    mesesPrevios: number
    sumaPrevios: number
    mesesRecientes: number
    sumaRecientes: number
  }
  const acumulados = new Map<string, Acumulado>()
  for (const factura of facturas) {
    const enPrevios = conjuntoPrevios.has(factura.periodo)
    const enRecientes = conjuntoRecientes.has(factura.periodo)
    if (!enPrevios && !enRecientes) continue
    let acumulado = acumulados.get(factura.edificacionId)
    if (!acumulado) {
      acumulado = {
        nombre: factura.edificacion.nombre,
        mesesPrevios: 0,
        sumaPrevios: 0,
        mesesRecientes: 0,
        sumaRecientes: 0,
      }
      acumulados.set(factura.edificacionId, acumulado)
    }
    if (enPrevios) {
      acumulado.mesesPrevios += 1
      acumulado.sumaPrevios += factura.consumoNormalizado
    } else {
      acumulado.mesesRecientes += 1
      acumulado.sumaRecientes += factura.consumoNormalizado
    }
  }

  const filas: FilaComparacionInterna[] = []
  acumulados.forEach((a, edificacionId) => {
    // Mínimo 6 facturas por ventana para comparar promedios con honestidad.
    const alcanza = a.mesesPrevios >= 6 && a.mesesRecientes >= 6 && a.sumaPrevios > 0
    const variacionPct = alcanza
      ? (a.sumaRecientes / a.mesesRecientes / (a.sumaPrevios / a.mesesPrevios) - 1) * 100
      : null
    filas.push({
      edificacionId,
      nombre: a.nombre,
      mesesConDatos: a.mesesPrevios + a.mesesRecientes,
      variacionPct,
      promedioKwh: alcanza ? a.sumaRecientes / a.mesesRecientes : null,
    })
  })
  filas.sort((x, y) => {
    if (x.variacionPct === null && y.variacionPct === null) return x.nombre.localeCompare(y.nombre)
    if (x.variacionPct === null) return 1
    if (y.variacionPct === null) return -1
    return y.variacionPct - x.variacionPct
  })

  return {
    ventanaReciente: `${recientes[0]} → ${recientes[recientes.length - 1]}`,
    ventanaPrevia: `${previos[0]} → ${previos[previos.length - 1]}`,
    filas,
  }
}

/**
 * Comparación interna entre edificaciones SIGE (últimos 12 meses vs los
 * 12 previos, promedio mensual normalizado) + catálogo oficial de las
 * métricas XM consultadas. No depende de XM: si la API cae, esto sigue.
 */
export async function cargarContextoXm(): Promise<RespuestaContextoXm> {
  try {
    const denegado = await exigirPermisoAnalisis()
    if (denegado) return { estado: 'error', mensaje: denegado }

    const cache = cacheContexto.get('contexto')
    if (cache && Date.now() - cache.ts < TTL_CACHE_XM_MS) return cache.valor

    const comparacionInterna = await construirComparacionInterna()
    const catalogo: CatalogoMetricaXm[] = CATALOGO_XM
    const valor: RespuestaContextoXm = {
      estado: 'ok',
      contexto: {
        fechaConsulta: new Date().toISOString(),
        comparacionInterna,
        catalogo,
      },
    }
    cacheContexto.set('contexto', { ts: Date.now(), valor })
    return valor
  } catch (e) {
    console.error('Error construyendo el contexto XM:', e)
    return {
      estado: 'error',
      mensaje: 'No se pudo cargar la comparación interna y el catálogo de XM.',
    }
  }
}
