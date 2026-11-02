'use server'

import { spawn } from 'node:child_process'
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
  horizonte: 1 | 2 | 3
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
