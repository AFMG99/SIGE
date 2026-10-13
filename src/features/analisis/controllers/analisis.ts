'use server'

// Server Action del Módulo 3 — Análisis estadístico y detección de
// patrones (HU-07 escenario 2, HU-04 escenario 2).
//
// El núcleo estadístico vive en Python (python/lben/analisis.py) y
// reutiliza la MISMA depuración normativa de LBEn (§7.5.1: ±10 % ec. 3,
// ec. 4-5 por mes con n ≥ 10). Aquí se arma la serie REAL de la
// edificación (facturas, sin shares: la detección de atípicos por mes es
// invariante a la escala, así que analizar la factura medida es tan
// representativo como repartirla) y se le adjunta:
//   - los días lectivos del calendario académico (promedio de los bloques
//     de la edificación en VariableOperativa), y
//   - los ajustes no rutinarios del Anexo 4 ya documentados por el
//     gestor (se aplican ANTES del análisis para no reportar como
//     inusual un período ya justificado).
//
// Bajo demanda y SIN persistir: el análisis no escribe en BD. La
// invocación sigue el patrón dual del módulo de datos: CLI local
// (`python -m lben.analisis`) fuera de Vercel y el servicio `engine`
// (POST /api/analisis con `x-lben-key`) en serverless.
//
// Nota de mantenimiento: los helpers de invocación (spawn/fetch/parse)
// son un espejo deliberado de features/datos/controllers/lineasBase.ts.
// No se comparten con LBEn para no tocar el flujo de cálculo ya
// validado; los contratos JSON además son distintos (otro módulo CLI y
// otra ruta HTTP).

import { spawn } from 'node:child_process'
import path from 'node:path'
import { prisma } from '@/shared/models/prisma'
import { canWithOverrides, getCurrentUser } from '@/shared/models/authz'
import { crearCriterioShares } from '@/features/datos/models/shares'
import {
  construirGestion,
  mejorLineaBaseGuardada,
  notaSinLineaBase,
  salidaAnalisisSchema,
  solicitudAnalisisSchema,
  type EntradaNivelGestion,
  type RespuestaAnalisis,
  type SalidaAnalisis,
  type SolicitudAnalisis,
} from '../models/analisis'

const TIMEOUT_CLI_MS = 15000
const TIMEOUT_HTTP_MS = 30000

type RegistroCli = {
  mes: number
  ano: number
  consumo_kwh: number
  dias_facturados: number
  dias_lectivos: number | null
}

type AjusteCli = {
  periodo_inicio: string
  periodo_fin: string
  proporcion: number
  direccion: string
  descripcion: string
}

type PayloadCli = {
  bloque_id: string
  registros: RegistroCli[]
  ajustes: AjusteCli[]
}

/**
 * NaN/Infinity literales rompen `JSON.parse` y el `allow_nan=False` de
 * Starlette: se normalizan a null antes de parsear (mismo guard que LBEn).
 */
function normalizarJsonNoEstandar(texto: string): string {
  return texto.replace(/(?<=[:,[]\s*)-?(?:NaN|Infinity)/g, 'null')
}

/** Salida cruda del motor: o un error tipado, o el contrato a validar. */
function parsearSalida(texto: string): { salida?: SalidaAnalisis; error?: string } {
  let bruto: unknown
  try {
    bruto = JSON.parse(normalizarJsonNoEstandar(texto))
  } catch {
    const fragmento = texto.replace(/\s+/g, ' ').trim().slice(0, 160)
    return {
      error: `El motor Python devolvió JSON inválido${
        fragmento ? `: "${fragmento}${texto.length > 160 ? '…' : ''}"` : ' (sin salida).'
      }`,
    }
  }
  if (
    typeof bruto === 'object' &&
    bruto !== null &&
    'ok' in bruto &&
    (bruto as { ok?: boolean }).ok === false
  ) {
    const mensaje = (bruto as { error?: string }).error
    return { error: mensaje ?? 'El motor no devolvió resultados.' }
  }
  const parse = salidaAnalisisSchema.safeParse(bruto)
  if (!parse.success) {
    return { error: 'El motor devolvió una salida que no cumple el contrato del análisis.' }
  }
  return { salida: parse.data }
}

/** Ruta local: spawnea `python -m lben.analisis` (JSON por stdin/stdout). */
function invocarMotorCli(
  payload: PayloadCli
): Promise<{ salida?: SalidaAnalisis; error?: string }> {
  return new Promise((resolve) => {
    const proceso = spawn('python', ['-m', 'lben.analisis'], {
      cwd: path.join(process.cwd(), 'python'),
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let resuelto = false
    const terminar = (resultado: { salida?: SalidaAnalisis; error?: string }) => {
      if (resuelto) return
      resuelto = true
      resolve(resultado)
    }

    const timeout = setTimeout(() => {
      proceso.kill()
      terminar({
        error: 'El análisis tardó más de lo esperado (timeout). Intente nuevamente.',
      })
    }, TIMEOUT_CLI_MS)

    proceso.on('error', () => {
      clearTimeout(timeout)
      terminar({
        error:
          'No se encontró Python en el servidor. Instale Python 3.10+ con pandas y numpy para ejecutar análisis de consumo.',
      })
    })

    proceso.stdout.on('data', (d: Buffer) => {
      stdout += d.toString('utf8')
    })
    proceso.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf8')
    })

    proceso.on('close', (codigo) => {
      clearTimeout(timeout)
      if (codigo !== 0) {
        const detalle = stderr.split('\n').filter(Boolean).slice(-3).join(' · ')
        terminar({
          error: `El motor Python terminó con error (código ${codigo})${detalle ? `: ${detalle}` : ''}.`,
        })
        return
      }
      terminar(parsearSalida(stdout))
    })

    proceso.stdin.write(JSON.stringify(payload))
    proceso.stdin.end()
  })
}

/** Ruta serverless: POST al servicio engine (binding LBEN_URL) con LBEN_SECRET. */
async function invocarMotorHttp(
  payload: PayloadCli
): Promise<{ salida?: SalidaAnalisis; error?: string }> {
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
    respuesta = await fetch(new URL('/api/analisis', base), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-lben-key': secreto },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_HTTP_MS),
    })
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      return { error: 'El análisis tardó más de lo esperado (timeout). Intente nuevamente.' }
    }
    return { error: 'No se pudo contactar al motor de análisis. Intente nuevamente.' }
  }

  if (!respuesta.ok) {
    return {
      error: `El motor respondió con error HTTP ${respuesta.status}. Intente nuevamente.`,
    }
  }

  const texto = await respuesta.text()
  return parsearSalida(texto)
}

function ejecutarMotor(
  payload: PayloadCli
): Promise<{ salida?: SalidaAnalisis; error?: string }> {
  if (process.env.VERCEL) {
    return invocarMotorHttp(payload)
  }
  return invocarMotorCli(payload)
}

/**
 * Ejecuta el análisis estadístico del histórico de facturas de una
 * edificación y devuelve los períodos atípicos con su explicación y su
 * contexto en el calendario académico.
 *
 * Requiere permiso `analyze` sobre el módulo `consumption` (server-side,
 * con overrides); no escribe en BD.
 */
export async function ejecutarAnalisis(
  solicitud: SolicitudAnalisis
): Promise<RespuestaAnalisis> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { ok: false, error: 'Sesión expirada. Inicie sesión nuevamente.' }
    }
    if (!(await canWithOverrides(user, 'consumption', 'analyze'))) {
      return {
        ok: false,
        error: 'Su rol no tiene permiso para ejecutar análisis de consumo.',
      }
    }

    const parse = solicitudAnalisisSchema.safeParse(solicitud)
    if (!parse.success) {
      return {
        ok: false,
        error: parse.error.issues[0]?.message ?? 'Datos inválidos.',
      }
    }
    const { edificacionId } = parse.data

    const edificacion = await prisma.edificacion.findUnique({
      where: { id: edificacionId },
      select: { id: true, nombre: true },
    })
    if (!edificacion) {
      return { ok: false, error: 'La edificación seleccionada ya no existe.' }
    }

    const [facturas, variables, ajustes, bloques, espacios, lineasBase] =
      await Promise.all([
        prisma.facturaEnergia.findMany({
          where: { edificacionId },
          orderBy: { periodo: 'asc' },
          select: {
            periodo: true,
            consumoNormalizado: true,
          },
        }),
        prisma.variableOperativa.findMany({
          where: { bloque: { edificacionId } },
          select: { mes: true, ano: true, diasLectivosLaborales: true },
        }),
        prisma.ajusteEnergetico.findMany({
          where: { bloque: { edificacionId }, tipo: 'NO_RUTINARIO' },
          select: {
            periodoInicio: true,
            periodoFin: true,
            valorAjuste: true,
            direccion: true,
            descripcion: true,
          },
        }),
        // ── KPIs de gestión por nivel (issue #75) ─────────────────────
        prisma.bloque.findMany({
          where: { edificacionId },
          select: {
            id: true,
            codigo: true,
            nombre: true,
            areaUtil: true,
            factorInfraestructura: true,
          },
        }),
        prisma.espacio.findMany({
          where: { bloque: { edificacionId } },
          select: {
            id: true,
            nombre: true,
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
        prisma.lineaBaseEnergia.findMany({
          where: { bloque: { edificacionId } },
          select: { bloqueId: true, tipo: true, coeficientes: true },
        }),
      ])

    if (facturas.length === 0) {
      return {
        ok: false,
        error:
          'La edificación no tiene facturas de energía cargadas. Cargue el histórico en el módulo de Datos.',
      }
    }

    // ── Calendario académico: promedio de días lectivos de los bloques ──
    // (VariableOperativa es por bloque; todos comparten el calendario del
    // TdeA, el promedio es estable y redondeable).
    const diasPorPeriodo = new Map<string, { suma: number; n: number }>()
    for (const v of variables) {
      const clave = `${v.ano}-${v.mes}`
      const acumulado = diasPorPeriodo.get(clave)
      if (acumulado) {
        acumulado.suma += v.diasLectivosLaborales
        acumulado.n += 1
      } else {
        diasPorPeriodo.set(clave, { suma: v.diasLectivosLaborales, n: 1 })
      }
    }

    // ── Serie: facturas reales normalizadas (ec. 1 ya aplicada en carga) ─
    const registros: RegistroCli[] = []
    const periodos: string[] = []
    for (const f of facturas) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(f.periodo)) continue
      const [ano, mes] = f.periodo.split('-').map(Number)
      const dias = diasPorPeriodo.get(`${ano}-${mes}`)
      registros.push({
        mes,
        ano,
        consumo_kwh: f.consumoNormalizado,
        dias_facturados: 30,
        dias_lectivos: dias ? Math.round(dias.suma / dias.n) : null,
      })
      periodos.push(f.periodo)
    }
    if (registros.length === 0) {
      return {
        ok: false,
        error: 'Las facturas de la edificación no tienen períodos válidos (YYYY-MM).',
      }
    }

    // ── Ajustes no rutinarios ya documentados (Anexo 4) ─────────────────
    const ajustesCli: AjusteCli[] = ajustes.map((a) => ({
      periodo_inicio: a.periodoInicio.toISOString().slice(0, 7),
      periodo_fin: a.periodoFin.toISOString().slice(0, 7),
      proporcion: a.valorAjuste / 100,
      direccion: a.direccion === 'incremento' ? 'incremento' : 'reduccion',
      descripcion: a.descripcion ?? '',
    }))

    const { salida, error } = await ejecutarMotor({
      bloque_id: edificacion.id,
      registros,
      ajustes: ajustesCli,
    })
    if (!salida) {
      return { ok: false, error: error ?? 'El motor no devolvió resultados.' }
    }

    // ── KPIs de gestión por nivel (issue #75) ──────────────────────────
    // Edificación = exacto (facturas); bloques y espacios = el MISMO
    // criterio de share que LBEn (models/shares.ts). Cada línea base
    // guardada es de su bloque (el guardado oficial es por bloque), así
    // que la LB de la edificación es la Σ de las de sus bloques y solo
    // se habilita con cobertura completa (comparar una LB parcial contra
    // el consumo total subestimaría el ahorro).
    const mediaNormalizado =
      facturas.reduce((suma, f) => suma + f.consumoNormalizado, 0) / facturas.length
    const criterio = crearCriterioShares({ bloques, espacios, mediaNormalizado })

    const filasPorBloque = new Map<string, { tipo: string; coeficientes: unknown }[]>()
    for (const lb of lineasBase) {
      const previas = filasPorBloque.get(lb.bloqueId) ?? []
      previas.push({ tipo: lb.tipo, coeficientes: lb.coeficientes })
      filasPorBloque.set(lb.bloqueId, previas)
    }

    const entradas: EntradaNivelGestion[] = []
    const lbsBloques = bloques.map((b) =>
      mejorLineaBaseGuardada(filasPorBloque.get(b.id) ?? [])
    )
    const conLb = lbsBloques.filter((lb) => lb !== null).length
    const lbCompleta = bloques.length > 0 && conLb === bloques.length
    const lbTotal = lbsBloques.reduce((suma, lb) => suma + (lb?.kwh ?? 0), 0)
    const modelosUsados = Array.from(
      new Set(lbsBloques.flatMap((lb) => (lb ? [lb.modelo] : [])))
    )
    entradas.push({
      tipo: 'edificacion',
      clave: 'edi',
      nombre: edificacion.nombre,
      precision: 'exacto',
      share: null,
      lb: {
        kwh: lbCompleta ? lbTotal : null,
        modelo:
          lbCompleta && modelosUsados.length > 0
            ? modelosUsados.length === 1
              ? modelosUsados[0]
              : 'Varios modelos'
            : null,
        cobertura:
          bloques.length > 1 ? `${conLb} de ${bloques.length} bloques con línea base` : null,
        nota: lbCompleta
          ? null
          : conLb === 0
            ? notaSinLineaBase(lineasBase)
            : `Cobertura parcial: solo ${conLb} de ${bloques.length} bloques tienen línea base utilizable; guarde las líneas base restantes para habilitar el ahorro de la edificación.`,
      },
    })

    for (const b of bloques) {
      const filas = filasPorBloque.get(b.id) ?? []
      const lbBloque = mejorLineaBaseGuardada(filas)
      entradas.push({
        tipo: 'bloque',
        clave: `b:${b.id}`,
        nombre: `${b.codigo} — ${b.nombre}`,
        precision: 'estimado',
        share: criterio.shareDeBloque(b.id),
        lb: {
          kwh: lbBloque ? lbBloque.kwh : null,
          modelo: lbBloque ? lbBloque.modelo : null,
          cobertura: null,
          nota: lbBloque ? null : notaSinLineaBase(filas),
        },
      })
      for (const e of espacios) {
        if (e.bloqueId !== b.id) continue
        const shareEspacio = criterio.shareDeEspacio(b.id, e.id)
        entradas.push({
          tipo: 'espacio',
          clave: `e:${e.id}`,
          nombre: `${b.codigo} › ${e.nombre}`,
          precision: 'estimado',
          share: criterio.shareDeBloque(b.id) * shareEspacio,
          lb: {
            kwh: lbBloque ? lbBloque.kwh * shareEspacio : null,
            modelo: lbBloque ? lbBloque.modelo : null,
            cobertura: null,
            nota: lbBloque ? null : notaSinLineaBase(filas),
          },
        })
      }
    }

    return {
      ok: true,
      analisis: {
        nombreEdificacion: edificacion.nombre,
        desde: periodos[0],
        hasta: periodos[periodos.length - 1],
        calculadoEn: new Date().toISOString(),
        salida,
        gestion: construirGestion(entradas, salida),
      },
    }
  } catch (e) {
    console.error('Error ejecutando análisis de consumo:', e)
    return {
      ok: false,
      error: 'No se pudo ejecutar el análisis. Intente nuevamente.',
    }
  }
}
