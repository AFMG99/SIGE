'use server'

import { spawn } from 'node:child_process'
import type { Prisma } from '@prisma/client'
import path from 'node:path'
import { prisma } from '@/shared/models/prisma'
import { canWithOverrides, getCurrentUser } from '@/shared/models/authz'
import { crearCriterioShares } from '@/features/datos/models/shares'
import {
  proyeccionMotorSchema,
  solicitudProyeccionSchema,
  type ProyeccionExitosa,
  type RespuestaProyeccion,
  type SolicitudProyeccion,
  type ResultadoProyeccion,
} from '../models/forecast'

const TIMEOUT_CLI_MS = 45000
const TIMEOUT_HTTP_MS = 45000
const ACCIONES_EJECUCION = ['create', 'evaluate', 'read', 'view_impact'] as const
const ACCIONES_DIAGNOSTICO = ['create', 'evaluate'] as const

type RegistroMotor = {
  periodo: string
  consumo_kwh: number
  dias_facturados: number
}

type PayloadMotor = {
  registros: RegistroMotor[]
  horizonte: number
  modelo: 'AUTO' | 'MA' | 'SES'
  ventana?: number
  alpha?: number
  ajustes: {
    periodo_inicio: string
    periodo_fin: string
    proporcion: number
    direccion: string
    descripcion: string
  }[]
  incluir_diagnosticos: boolean
  orden?: [number, number, number]
}

function parsearSalida(texto: string): { salida?: ProyeccionExitosa; error?: string } {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return { error: 'El motor de proyección devolvió JSON inválido.' }
  }
  const parse = proyeccionMotorSchema.safeParse(bruto)
  if (!parse.success) {
    return { error: 'El motor devolvió una salida que no cumple el contrato de proyección.' }
  }
  if (!parse.data.ok) return { error: parse.data.error }
  return { salida: parse.data }
}

function invocarMotorCli(payload: PayloadMotor): Promise<{ salida?: ProyeccionExitosa; error?: string }> {
  return new Promise((resolve) => {
    const proceso = spawn('python', ['-m', 'lben.forecast'], {
      cwd: path.join(process.cwd(), 'python'),
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    let resuelto = false
    const terminar = (resultado: { salida?: ProyeccionExitosa; error?: string }) => {
      if (resuelto) return
      resuelto = true
      resolve(resultado)
    }
    const timeout = setTimeout(() => {
      proceso.kill()
      terminar({
        error: 'La proyección tardó más de lo esperado (timeout). Intente nuevamente.',
      })
    }, TIMEOUT_CLI_MS)

    proceso.on('error', () => {
      clearTimeout(timeout)
      terminar({
        error: 'No se encontró Python en el servidor. Instale Python 3.10+ con statsmodels.',
      })
    })
    proceso.stdout.on('data', (dato: Buffer) => {
      stdout += dato.toString('utf8')
    })
    proceso.stderr.on('data', (dato: Buffer) => {
      stderr += dato.toString('utf8')
    })
    proceso.on('close', (codigo) => {
      clearTimeout(timeout)
      if (codigo !== 0) {
        const detalle = stderr.split('\n').filter(Boolean).slice(-3).join(' · ')
        terminar({
          error: `El motor de proyección terminó con error (código ${codigo})${detalle ? `: ${detalle}` : ''}.`,
        })
        return
      }
      terminar(parsearSalida(stdout))
    })
    proceso.stdin.write(JSON.stringify(payload))
    proceso.stdin.end()
  })
}

async function invocarMotorHttp(
  payload: PayloadMotor
): Promise<{ salida?: ProyeccionExitosa; error?: string }> {
  const secreto = process.env.LBEN_SECRET
  if (!secreto) {
    return { error: 'Falta LBEN_SECRET: configure la variable de entorno del motor.' }
  }
  const base = process.env.LBEN_URL
  if (!base) {
    return {
      error: 'Falta LBEN_URL: el binding del servicio engine no está inyectado (vercel.json).',
    }
  }

  let respuesta: Response
  try {
    respuesta = await fetch(new URL('/api/forecast', base), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-lben-key': secreto },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_HTTP_MS),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return { error: 'La proyección tardó más de lo esperado (timeout). Intente nuevamente.' }
    }
    return { error: 'No se pudo contactar al motor de proyección. Intente nuevamente.' }
  }
  if (!respuesta.ok) {
    return { error: `El motor respondió con error HTTP ${respuesta.status}. Intente nuevamente.` }
  }
  return parsearSalida(await respuesta.text())
}

function ejecutarMotor(
  payload: PayloadMotor
): Promise<{ salida?: ProyeccionExitosa; error?: string }> {
  return process.env.VERCEL ? invocarMotorHttp(payload) : invocarMotorCli(payload)
}

function leerLbenMensual(valor: unknown): (number | null)[] | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null
  const mensual = (valor as Record<string, unknown>).lben_mensual
  if (!Array.isArray(mensual) || mensual.length !== 12) return null
  return mensual.map((dato) =>
    typeof dato === 'number' && Number.isFinite(dato) && dato > 0 ? dato : null
  )
}

export async function ejecutarProyeccion(
  solicitud: SolicitudProyeccion
): Promise<RespuestaProyeccion> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { ok: false, error: 'Sesión expirada. Inicie sesión nuevamente.' }
    }
    const [puedeEjecutar, puedeCrear, puedeEvaluar] = await Promise.all([
      Promise.all(
        ACCIONES_EJECUCION.map((accion) =>
          canWithOverrides(user, 'estimates', accion)
        )
      ).then((permisos) => permisos.some(Boolean)),
      canWithOverrides(user, 'estimates', 'create'),
      canWithOverrides(user, 'estimates', 'evaluate'),
    ])
    if (!puedeEjecutar) {
      return { ok: false, error: 'Su rol no tiene permiso para ejecutar proyecciones.' }
    }
    const puedeDiagnosticar = puedeCrear || puedeEvaluar

    const parse = solicitudProyeccionSchema.safeParse(solicitud)
    if (!parse.success) {
      return { ok: false, error: parse.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const entrada = parse.data
    if (entrada.orden && !puedeCrear) {
      return {
        ok: false,
        error: 'Solo los perfiles con permiso de creación pueden ajustar el orden ARIMA.',
      }
    }

    const edificacion = await prisma.edificacion.findUnique({
      where: { id: entrada.edificacionId },
      select: { id: true, nombre: true },
    })
    if (!edificacion) {
      return { ok: false, error: 'La edificación seleccionada ya no existe.' }
    }

    const [facturas, bloques, espacios] = await Promise.all([
      prisma.facturaEnergia.findMany({
        where: { edificacionId: edificacion.id },
        orderBy: { periodo: 'asc' },
        select: { periodo: true, consumoNormalizado: true },
      }),
      prisma.bloque.findMany({
        where: { edificacionId: edificacion.id },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          areaUtil: true,
          factorInfraestructura: true,
        },
      }),
      prisma.espacio.findMany({
        where: { bloque: { edificacionId: edificacion.id } },
        select: {
          id: true,
          bloqueId: true,
          equipos: {
            select: {
              cantidad: true,
              potenciaNominal: true,
              horasUsoDia: true,
              diasUsoMes: true,
            },
          },
        },
      }),
    ])
    if (facturas.length === 0) {
      return {
        ok: false,
        error: 'La edificación no tiene facturas de energía cargadas. Importe el histórico en Datos.',
      }
    }
    if (facturas.some((factura) => !(factura.consumoNormalizado > 0))) {
      return {
        ok: false,
        error: 'Hay facturas sin consumo normalizado válido; revise el histórico antes de proyectar.',
      }
    }

    const mediaNormalizado =
      facturas.reduce((suma, factura) => suma + factura.consumoNormalizado, 0) /
      facturas.length
    const criterio = crearCriterioShares({
      bloques,
      espacios,
      mediaNormalizado,
    })

    const bloqueId = entrada.bloqueId || null
    const bloque = bloqueId ? bloques.find((item) => item.id === bloqueId) : null
    if (bloqueId && !bloque) {
      return {
        ok: false,
        error: 'El bloque seleccionado no pertenece a la edificación elegida.',
      }
    }

    let share = 1
    if (bloque) {
      if (criterio.origen === 'modelo_ingenieria') {
        const carga = criterio.cargaDeBloque(bloque.id)
        if (!(carga > 0)) {
          return {
            ok: false,
            error: `El bloque "${bloque.codigo} — ${bloque.nombre}" no tiene equipos con consumo ni área útil para estimar su participación.`,
          }
        }
        share = criterio.shareDeBloque(bloque.id)
        if (!(share > 0) || share >= 1) {
          return {
            ok: false,
            error: `El share estimado del bloque "${bloque.codigo} — ${bloque.nombre}" no es válido frente al consumo de la edificación.`,
          }
        }
      } else {
        share = criterio.shareDeBloque(bloque.id)
      }
    }

    const ajustes = await prisma.ajusteEnergetico.findMany({
      where: {
        tipo: 'NO_RUTINARIO',
        ...(bloque
          ? { bloqueId: bloque.id }
          : { bloque: { edificacionId: edificacion.id } }),
      },
      select: {
        periodoInicio: true,
        periodoFin: true,
        valorAjuste: true,
        direccion: true,
        descripcion: true,
      },
    })
    const payload: PayloadMotor = {
      registros: facturas.map((factura) => ({
        periodo: factura.periodo,
        consumo_kwh: Math.round(factura.consumoNormalizado * share * 100) / 100,
        dias_facturados: 30,
      })),
      horizonte: entrada.horizonte,
      modelo: entrada.modelo,
      ...(entrada.modelo === 'MA' ? { ventana: entrada.ventana ?? 3 } : {}),
      ...(entrada.modelo === 'SES' ? { alpha: entrada.alpha ?? 0.3 } : {}),
      ajustes: ajustes.map((ajuste) => ({
        periodo_inicio: ajuste.periodoInicio.toISOString().slice(0, 7),
        periodo_fin: ajuste.periodoFin.toISOString().slice(0, 7),
        proporcion: ajuste.valorAjuste / 100,
        direccion: ajuste.direccion === 'incremento' ? 'incremento' : 'reduccion',
        descripcion: ajuste.descripcion,
      })),
      incluir_diagnosticos: puedeDiagnosticar,
      ...(entrada.orden ? { orden: entrada.orden } : {}),
    }
    const { salida, error } = await ejecutarMotor(payload)
    if (error || !salida) return { ok: false, error: error ?? 'No se recibió una proyección válida.' }

    const lineasBase = await prisma.lineaBaseEnergia.findMany({
      where: {
        tipo: 'VALOR_ABSOLUTO',
        OR: [
          ...(bloque ? [{ bloqueId: bloque.id }] : []),
          { edificacionId: edificacion.id },
        ],
      },
      select: {
        bloqueId: true,
        edificacionId: true,
        coeficientes: true,
      },
    })
    const lineaBloque = bloque
      ? lineasBase.find((linea) => linea.bloqueId === bloque.id)
      : undefined
    const lineaEdificacion = lineasBase.find(
      (linea) => linea.edificacionId === edificacion.id
    )
    const linea = lineaBloque ?? lineaEdificacion

    return {
      ok: true,
      resultado: {
        proyeccion: salida,
        edificacionNombre: edificacion.nombre,
        bloqueNombre: bloque?.nombre ?? null,
        lineaBase: {
          origen: lineaBloque ? 'bloque' : lineaEdificacion ? 'edificacion' : null,
          nombre: lineaBloque
            ? bloque?.nombre ?? null
            : lineaEdificacion
              ? edificacion.nombre
              : null,
          lbenMensual: linea ? leerLbenMensual(linea.coeficientes) : null,
        },
      },
    }
  } catch (error) {
    console.error('Error ejecutando proyección ARIMA:', error)
    return {
      ok: false,
      error: 'No fue posible ejecutar la proyección. Intente nuevamente.',
    }
  }
}


const ACCIONES_HISTORIAL = ['create', 'evaluate', 'read', 'view_impact'] as const

async function puedeConsultarHistorial(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const permisos = await Promise.all(
    ACCIONES_HISTORIAL.map((accion) => canWithOverrides(user, 'estimates', accion))
  )
  return permisos.some(Boolean)
}

export interface EstimacionHistorialItem {
  id: string
  edificacionId: string
  edificacionNombre: string
  bloqueNombre: string | null
  modelo: string
  horizonte: number
  periodoBase: string
  mesesHistorico: number
  mesesDepurados: number
  advertencias: string | null
  createdAt: string
}

export async function guardarEstimacion(input: {
  edificacionId: string
  bloqueId: string | null
  resultado: ResultadoProyeccion
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser()
    if (!user || !(await canWithOverrides(user, 'estimates', 'create'))) {
      return { ok: false, error: 'No tiene permisos para guardar estimaciones.' }
    }
    if (!input || typeof input.edificacionId !== 'string' || !input.edificacionId) {
      return { ok: false, error: 'La edificación de la estimación no es válida.' }
    }
    const parsed = proyeccionMotorSchema.safeParse(input.resultado?.proyeccion)
    if (!parsed.success || !parsed.data.ok) {
      return { ok: false, error: 'Los resultados no cumplen el contrato de proyección.' }
    }
    const proyeccion = parsed.data
    const lb = input.resultado.lineaBase
    if (
      !lb ||
      ![null, 'bloque', 'edificacion'].includes(lb.origen) ||
      (lb.lbenMensual !== null &&
        (!Array.isArray(lb.lbenMensual) || lb.lbenMensual.length !== 12 ||
          lb.lbenMensual.some((v) => v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v <= 0))))
    ) {
      return { ok: false, error: 'La información de LBEn asociada a la estimación no es válida.' }
    }
    const periodoBase = proyeccion.serie.at(-1)?.periodo
    if (!periodoBase) return { ok: false, error: 'La proyección no contiene un período base.' }

    const edificacion = await prisma.edificacion.findUnique({
      where: { id: input.edificacionId }, select: { id: true, nombre: true },
    })
    if (!edificacion) return { ok: false, error: 'La edificación ya no existe.' }

    let bloqueNombre: string | null = null
    if (input.bloqueId) {
      const bloque = await prisma.bloque.findFirst({
        where: { id: input.bloqueId, edificacionId: edificacion.id },
        select: { id: true, nombre: true },
      })
      if (!bloque) return { ok: false, error: 'El bloque no pertenece a la edificación seleccionada.' }
      bloqueNombre = bloque.nombre
    }

    const snapshot = {
      proyeccion,
      lineaBase: lb,
      edificacionNombre: edificacion.nombre,
      bloqueNombre,
    }
    const guardada = await prisma.estimacionConsumo.create({
      data: {
        edificacionId: edificacion.id,
        bloqueId: input.bloqueId,
        createdById: user.id,
        edificacionNombre: edificacion.nombre,
        bloqueNombre,
        modelo: proyeccion.modelo,
        parametros: {
          modelo: proyeccion.modelo,
          parametrosModelo: proyeccion.parametros_modelo ?? null,
          orden: proyeccion.orden,
          ordenEstacional: proyeccion.orden_estacional,
          criterioDepuracion: proyeccion.criterio_depuracion,
          ajustesAplicados: proyeccion.ajustes_aplicados,
        } as Prisma.InputJsonValue,
        horizonte: proyeccion.pronostico.length,
        periodoBase,
        mesesHistorico: proyeccion.originales,
        mesesDepurados: proyeccion.depurados,
        resultados: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
        ...(proyeccion.diagnosticos
          ? { diagnosticos: proyeccion.diagnosticos as unknown as Prisma.InputJsonValue }
          : {}),
        advertencias: proyeccion.advertencia ?? null,
      },
      select: { id: true },
    })
    return { ok: true, id: guardada.id }
  } catch (error) {
    console.error('Error guardando estimación:', error)
    return { ok: false, error: 'No fue posible guardar la estimación. Verifique la base de datos y vuelva a intentar.' }
  }
}

export async function listarHistorialEstimaciones(
  edificacionId?: string
): Promise<{ ok: true; items: EstimacionHistorialItem[] } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser()
    if (!user || !(await puedeConsultarHistorial(user))) {
      return { ok: false, error: 'No tiene permisos para consultar el historial de estimaciones.' }
    }
    const items = await prisma.estimacionConsumo.findMany({
      where: edificacionId ? { edificacionId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, edificacionId: true, edificacionNombre: true, bloqueNombre: true,
        modelo: true, horizonte: true, periodoBase: true, mesesHistorico: true,
        mesesDepurados: true, advertencias: true, createdAt: true,
      },
    })
    return { ok: true, items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })) }
  } catch (error) {
    console.error('Error consultando historial:', error)
    return { ok: false, error: 'No fue posible consultar el historial de estimaciones.' }
  }
}

export async function obtenerEstimacionGuardada(
  id: string
): Promise<{ ok: true; resultado: ResultadoProyeccion } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser()
    if (!user || !(await puedeConsultarHistorial(user))) {
      return { ok: false, error: 'No tiene permisos para consultar estimaciones guardadas.' }
    }
    if (typeof id !== 'string' || !id) return { ok: false, error: 'Identificador inválido.' }
    const estimacion = await prisma.estimacionConsumo.findUnique({
      where: { id }, select: { resultados: true },
    })
    if (!estimacion) return { ok: false, error: 'La estimación solicitada no existe.' }
    return { ok: true, resultado: estimacion.resultados as unknown as ResultadoProyeccion }
  } catch (error) {
    console.error('Error recuperando estimación:', error)
    return { ok: false, error: 'No fue posible recuperar la estimación guardada.' }
  }
}
