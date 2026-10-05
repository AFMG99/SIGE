'use server'

// Server Action de cálculo de Línea Base Energética (SIGE-TdeA).
//
// El cálculo real vive en Python: python/lben/cli.py envuelve
// el paquete lben (Resolución UPME 0016 de 2024) y habla JSON por
// stdin/stdout. Aquí se arma la serie según la jerarquía de consumo
// (facturas globales × share del bloque × share de carga de equipos del
// espacio), se invoca el CLI con timeout y se tipa la salida junto con
// las tablas de preparación y segmentación.
//
// El share del bloque sale de dos criterios posibles (ver `OrigenShare`):
// reparto por área con cobertura completa, o estimación por carga
// nominal ÷ factura media global mientras falte área.

import { spawn } from 'node:child_process'
import path from 'node:path'
import { prisma } from '@/shared/models/prisma'
import { canWithOverrides, getCurrentUser } from '@/shared/models/authz'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import {
  MODELOS_LBEN,
  TIPO_LBEN_DB,
  UPME_K_INTERVALO,
  UPME_MIN_MESES,
  UPME_MIN_VALORES_MES,
  UPME_RANGO_CONFIANZA,
} from '@/features/datos/models/lineasBase'
import type {
  Alcance,
  AlcanceSolicitud,
  CalculoLineaBase,
  DepuracionBandas,
  EstadoModelo,
  FilaPreparacion,
  ModeloLbenId,
  NodoJerarquia,
  OrigenShare,
  PuntoSerie,
  RespuestaCalculo,
  RespuestaGuardar,
} from '@/features/datos/models/lineasBase'
import type { ResultadoGestion } from '@/features/datos/models/validations'

/** Timeout del proceso Python (statsmodels tarda ~3 s; margen generoso). */
const TIMEOUT_CLI_MS = 15000

type RegistroCli = {
  mes: number
  ano: number
  consumo_kwh: number
  dias_facturados: number
  poblacion_fija: number
  poblacion_flotante: number
  gde: number
  temperatura_promedio: number
}

type SalidaCli = {
  ok: boolean
  error?: string
  originales?: number
  depurados?: number
  min_meses?: number
  min_valores_por_mes?: number
  criterio_depuracion?: string // banda_10_pct (default) | ic_2sigma (rescate)
  desv_est?: number | null // DesvEst poblacional (ec. 5) del rescate; null en ec. 3
  k_intervalo?: number | null // k de la ec. 4; null si criterio banda_10_pct
  min_datos_ic?: number // N ≥ 10: guardia del rescate ec. 4-5
  bandas?: {
    mes: number
    n: number
    media: number | null
    limite_inferior: number | null
    limite_superior: number | null
    descartados: number
    estimado: boolean
  }[]
  meses_insuficientes?: number[]
  variables_regresion_usadas?: string[]
  ajustes_aplicados?: { ano: number; mes: number; proporcion: number; direccion: string; descripcion: string }[]
  resultados?: Record<
    string,
    { ok: boolean; resultado?: Record<string, unknown>; error?: string }
  >
  serie?: CalculoLineaBase['serie']
}

/**
 * `json.dump(..., allow_nan=True)` (el default) emite literales no
 * estándar — `NaN`, `Infinity`, `-Infinity` — que `JSON.parse` rechaza.
 * Eso era la causa raíz del mensaje ciego "Salida ilegible del motor
 * Python". Los reemplazamos por `null` (JSON válido) antes de parsear:
 * el motor ya devuelve `null` en otros campos opcionales, así que la UI
 * y `guardarLineaBase` toleran el caso.
 */
function normalizarJsonNoEstandar(texto: string): string {
  return texto.replace(/(?<=[:,[]\s*)-?(?:NaN|Infinity)/g, 'null')
}

/** Ejecuta el CLI de Python y devuelve su JSON (o un error tipado). */
function ejecutarCli(
  bloqueId: string,
  registros: RegistroCli[],
  ajustes?: { periodo_inicio: string; periodo_fin: string; proporcion: number; direccion: string; descripcion: string }[]
): Promise<{ salida?: SalidaCli; error?: string }> {
  return new Promise((resolve) => {
    const proceso = spawn('python', ['-m', 'lben.cli'], {
      cwd: path.join(process.cwd(), 'python'),
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let resuelto = false
    const terminar = (resultado: { salida?: SalidaCli; error?: string }) => {
      if (resuelto) return
      resuelto = true
      resolve(resultado)
    }

    const timeout = setTimeout(() => {
      proceso.kill()
      terminar({
        error:
          'El cálculo tardó más de lo esperado (timeout). Intente nuevamente.',
      })
    }, TIMEOUT_CLI_MS)

    proceso.on('error', () => {
      clearTimeout(timeout)
      terminar({
        error:
          'No se encontró Python en el servidor. Instale Python 3.10+ con pandas y statsmodels para calcular líneas base.',
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
      try {
        const salida = JSON.parse(normalizarJsonNoEstandar(stdout)) as SalidaCli
        if (!salida.ok) {
          terminar({ error: salida.error ?? 'El motor no devolvió resultados.' })
          return
        }
        terminar({ salida })
      } catch {
        const fragmento = stdout.replace(/\s+/g, ' ').trim().slice(0, 160)
        terminar({
          error: `El motor Python devolvió JSON inválido${
            fragmento ? `: "${fragmento}${stdout.length > 160 ? '…' : ''}"` : ' (sin salida).'
          }`,
        })
      }
    })

    proceso.stdin.write(
      JSON.stringify({ bloque_id: bloqueId, registros, ajustes: ajustes ?? [] })
    )
    proceso.stdin.end()
  })
}

/**
 * Calcula los 4 modelos de LBEn para un alcance de la jerarquía de
 * consumo (facturas globales → bloque → espacio del bloque) con los
 * datos reales de BD, y devuelve además las tablas de preparación y
 * segmentación que documentan cada paso del reparto.
 *
 * No escribe en BD: el guardado es explícito vía `guardarLineaBase`.
 * Requiere permiso `analyze` sobre el módulo `consumption`.
 */
export async function calcularModelosLineaBase(
  solicitud: AlcanceSolicitud
): Promise<RespuestaCalculo> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { ok: false, error: 'Sesión expirada. Inicie sesión nuevamente.' }
    }
    if (!(await canWithOverrides(user, 'consumption', 'analyze'))) {
      return {
        ok: false,
        error: 'Su rol no tiene permiso para calcular líneas base en este módulo.',
      }
    }

    const tipo = solicitud?.tipo
    if (tipo !== 'global' && tipo !== 'bloque' && tipo !== 'espacio') {
      return { ok: false, error: 'Alcance inválido.' }
    }
    if (
      tipo !== 'global' &&
      (typeof solicitud.id !== 'string' || solicitud.id.length === 0)
    ) {
      return { ok: false, error: 'Debe seleccionar un bloque o un espacio.' }
    }
    const idAlcance =
      typeof solicitud.id === 'string' && solicitud.id ? solicitud.id : null

    // Edificación opcional: null/ausente = todas (alcance global histórico)
    const edificacionId =
      typeof solicitud.edificacionId === 'string' && solicitud.edificacionId
        ? solicitud.edificacionId
        : null

    // El bloque/espacio elegido debe pertenecer a la edificación filtrada
    if (edificacionId && idAlcance) {
      if (tipo === 'bloque') {
        const propio = await prisma.bloque.findFirst({
          where: { id: idAlcance, edificacionId },
          select: { id: true },
        })
        if (!propio) {
          return {
            ok: false,
            error: 'El bloque seleccionado no pertenece a la edificación elegida.',
          }
        }
      } else if (tipo === 'espacio') {
        const propio = await prisma.espacio.findFirst({
          where: { id: idAlcance, bloque: { edificacionId } },
          select: { id: true },
        })
        if (!propio) {
          return {
            ok: false,
            error: 'El espacio seleccionado no pertenece a la edificación elegida.',
          }
        }
      }
    }

    const [facturas, bloques, espacios, variables, edificaciones] =
      await Promise.all([
        prisma.facturaEnergia.findMany({
          where: edificacionId ? { edificacionId } : undefined,
          orderBy: { periodo: 'asc' },
          select: {
            periodo: true,
            consumoKwh: true,
            diasFacturados: true,
            costoCop: true,
            consumoNormalizado: true,
          },
        }),
        prisma.bloque.findMany({
          where: edificacionId ? { edificacionId } : undefined,
          select: {
            id: true,
            codigo: true,
            nombre: true,
            areaUtil: true,
            factorInfraestructura: true,
          },
        }),
        prisma.espacio.findMany({
          where: edificacionId ? { bloque: { edificacionId } } : undefined,
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
        prisma.variableOperativa.findMany({
          where: edificacionId ? { bloque: { edificacionId } } : undefined,
          select: {
            bloqueId: true,
            mes: true,
            ano: true,
            poblacionFija: true,
            poblacionFlotante: true,
            gradesDiaEnfriamiento: true,
          },
        }),
        prisma.edificacion.findMany({
          where: edificacionId ? { id: edificacionId } : undefined,
          select: { nombre: true },
        }),
      ])

    if (edificacionId && edificaciones.length === 0) {
      return { ok: false, error: 'La edificación seleccionada ya no existe.' }
    }

    if (facturas.length === 0) {
      return {
        ok: false,
        error: edificacionId
          ? 'No hay facturas de energía para la edificación seleccionada: importe facturas antes de calcular.'
          : 'No hay facturas de energía en la BD: importe facturas antes de calcular.',
      }
    }

    type EspacioConCarga = (typeof espacios)[number]
    const cargaEspacio = (e: EspacioConCarga) =>
      e.equipos.reduce(
        (suma, eq) =>
          suma + eq.cantidad * eq.potenciaNominal * eq.horasUsoDia * eq.diasUsoMes,
        0
      )
    const pesoDe = (b: (typeof bloques)[number]) =>
      b.areaUtil * b.factorInfraestructura
    const pesoTotalBloques = bloques.reduce((suma, b) => suma + pesoDe(b), 0)
    const mediaNormalizado =
      facturas.reduce((suma, f) => suma + f.consumoNormalizado, 0) /
      facturas.length

    const cargaDeBloque = (b: (typeof bloques)[number]) => {
      const hermanos = espacios.filter((e) => e.bloqueId === b.id)
      return hermanos.reduce((suma, e) => suma + cargaEspacio(e), 0)
    }

    // ── Guardas de la serie ────────────────────────────────────────────
    // G3: si la serie no aporta energía, `depurar_datos` deja el frame
    // vacío y los modelos devuelven NaN → JSON inválido. Cortamos antes.
    if (!(mediaNormalizado > 0)) {
      return {
        ok: false,
        error: edificacionId
          ? 'La factura media normalizada de la edificación es 0: no hay serie de consumo que modelar. Revise las facturas importadas.'
          : 'La factura media normalizada global es 0: no hay serie de consumo que modelar. Revise las facturas importadas.',
      }
    }

    // ── Criterio de share ──────────────────────────────────────────────
    // El reparto por área normaliza contra Σ de lo que haya cargado: con un
    // subconjunto de bloques repartiría el 100 % entre ellos. Solo es
    // válido con cobertura completa. Mientras falte área, se normaliza
    // contra la factura media global (dataset completo): nunca infla.
    const bloquesSinArea = bloques.filter((b) => !(b.areaUtil > 0))
    const coberturaArea =
      bloques.length > 0 &&
      bloquesSinArea.length === 0 &&
      pesoTotalBloques > 0
    const origen: OrigenShare = coberturaArea
      ? 'facturas_area'
      : 'modelo_ingenieria'

    const avisoPartes: string[] = []
    if (!coberturaArea) {
      avisoPartes.push(
        bloquesSinArea.length === bloques.length
          ? `Ninguno de los ${bloques.length} bloques registrados tiene área útil;`
          : `${bloquesSinArea.length} de ${bloques.length} bloques sin área útil;`
      )
      avisoPartes.push(
        `share estimado por modelo de ingeniería (carga nominal de equipos ÷ ${
          edificacionId ? 'factura media de la edificación' : 'factura media global'
        }), no por área.`
      )
    }
    if (variables.length === 0) {
      avisoPartes.push(
        'No hay variables operativas: los modelos de cociente y regresión se evaluarán sin referencia poblacional.'
      )
    }
    const aviso = avisoPartes.length > 0 ? avisoPartes.join(' ') : undefined

    const shareDeBloque = (b: (typeof bloques)[number]): number =>
      origen === 'facturas_area'
        ? pesoDe(b) / pesoTotalBloques
        : cargaDeBloque(b) / mediaNormalizado

    /** Valida el share de un bloque antes de usarlo como alcance. */
    const errorShareDeBloque = (
      b: (typeof bloques)[number]
    ): string | null => {
      if (origen === 'facturas_area') return null
      const carga = cargaDeBloque(b)
      if (!(carga > 0)) {
        return `El bloque "${b.codigo} — ${b.nombre}" no tiene inventario de equipos con consumo: no puede estimarse su share. Importe equipos para este bloque o registre su área útil.`
      }
      const k = carga / mediaNormalizado
      if (k >= 1) {
        const denominador = edificacionId
          ? 'la factura media de la edificación'
          : 'la factura media global'
        return `El share estimado del bloque "${b.codigo} — ${b.nombre}" es ${Math.round(
          k * 100
        )} %: su carga teórica (${Math.round(
          carga
        )} kWh/mes) iguala o supera ${denominador} (${Math.round(
          mediaNormalizado
        )} kWh/mes). Revise la potencia nominal de sus equipos.`
      }
      return null
    }

    // ── Resolución del alcance: cadena de shares global → bloque → espacio ──
    let alcance: Alcance
    if (tipo === 'global') {
      alcance = {
        tipo: 'global',
        id: null,
        nombre:
          edificaciones.length === 1
            ? edificaciones[0].nombre
            : 'Todas las edificaciones',
        codigo: 'GLOBAL',
        bloqueId: null,
        share: 1,
        origen,
      }
    } else if (tipo === 'bloque') {
      const bloque = bloques.find((b) => b.id === solicitud.id)
      if (!bloque) {
        return { ok: false, error: 'El bloque seleccionado ya no existe.' }
      }
      const err = errorShareDeBloque(bloque)
      if (err) return { ok: false, error: err }
      alcance = {
        tipo: 'bloque',
        id: bloque.id,
        nombre: bloque.nombre,
        codigo: bloque.codigo,
        bloqueId: bloque.id,
        share: shareDeBloque(bloque),
        origen,
      }
    } else {
      const espacio = espacios.find((e) => e.id === solicitud.id)
      if (!espacio) {
        return { ok: false, error: 'El espacio seleccionado ya no existe.' }
      }
      const bloque = bloques.find((b) => b.id === espacio.bloqueId)
      if (!bloque) {
        return {
          ok: false,
          error: 'El espacio no pertenece a un bloque válido.',
        }
      }
      const err = errorShareDeBloque(bloque)
      if (err) return { ok: false, error: err }
      const hermanos = espacios.filter((e) => e.bloqueId === bloque.id)
      const cargaTotal = hermanos.reduce((s, e) => s + cargaEspacio(e), 0)
      const shareEspacio =
        cargaTotal > 0
          ? cargaEspacio(espacio) / cargaTotal
          : 1 / (hermanos.length || 1)
      alcance = {
        tipo: 'espacio',
        id: espacio.id,
        nombre: espacio.nombre,
        codigo: `${bloque.codigo} › ${espacio.nombre}`,
        bloqueId: bloque.id,
        share: shareDeBloque(bloque) * shareEspacio,
        origen,
      }
    }

    // ── Obtener ajustes no rutinarios del bloque/edificación (Anexo 4) ────
    const ajustes = await prisma.ajusteEnergetico.findMany({
      where: {
        bloqueId: alcance.bloqueId ?? undefined,
        tipo: 'NO_RUTINARIO',
      },
      select: {
        periodoInicio: true,
        periodoFin: true,
        valorAjuste: true,
        descripcion: true,
        observaciones: true,
      },
    })
    const ajustesCli = ajustes.map((a) => {
      const dir = (a as any).direccion ?? a.observaciones?.includes('incremento')
        ? 'incremento'
        : 'reduccion'
      return {
        periodo_inicio: a.periodoInicio.toISOString().slice(0, 7),
        periodo_fin: a.periodoFin.toISOString().slice(0, 7),
        proporcion: a.valorAjuste / 100,
        direccion: dir,
        descripcion: a.descripcion ?? '',
      }
    })

    // ── Variables operativas del alcance (suma global o del bloque dueño) ──
    const idxVariables = new Map<
      string,
      { poblacion_fija: number; poblacion_flotante: number; gde: number }
    >()
    if (alcance.bloqueId) {
      for (const v of variables) {
        if (v.bloqueId !== alcance.bloqueId) continue
        idxVariables.set(`${v.mes}|${v.ano}`, {
          poblacion_fija: v.poblacionFija,
          poblacion_flotante: v.poblacionFlotante,
          gde: v.gradesDiaEnfriamiento,
        })
      }
    } else {
      const acumulado = new Map<
        string,
        { fija: number; flot: number; gde: number; n: number }
      >()
      for (const v of variables) {
        const clave = `${v.mes}|${v.ano}`
        const fija = v.poblacionFija
        const flot = v.poblacionFlotante
        const prev = acumulado.get(clave)
        if (prev) {
          prev.fija += fija
          prev.flot += flot
          prev.gde += v.gradesDiaEnfriamiento
          prev.n += 1
        } else {
          acumulado.set(clave, {
            fija,
            flot,
            gde: v.gradesDiaEnfriamiento,
            n: 1,
          })
        }
      }
      acumulado.forEach((a, clave) => {
        idxVariables.set(clave, {
          poblacion_fija: a.fija,
          poblacion_flotante: a.flot,
          gde: a.gde / a.n,
        })
      })
    }

    // Serie de entrada: factura normalizada × share acumulado del alcance.
    const registros: RegistroCli[] = facturas.map((f) => {
      const [ano, mes] = f.periodo.split('-').map(Number)
      const v = idxVariables.get(`${mes}|${ano}`)
      return {
        mes,
        ano,
        consumo_kwh:
          Math.round(f.consumoNormalizado * alcance.share * 100) / 100,
        dias_facturados: 30,
        poblacion_fija: v?.poblacion_fija ?? 0,
        poblacion_flotante: v?.poblacion_flotante ?? 0,
        gde: v?.gde ?? 0,
        temperatura_promedio: 25.0,
      }
    })

    // ── Tabla de jerarquía: global → bloques → espacios ──
    const criterioBloque =
      origen === 'facturas_area'
        ? 'Área útil × factor de infraestructura (m²)'
        : 'Carga nominal ÷ factura media (kWh/mes, estimado)'
    const jerarquia: NodoJerarquia[] = [
      {
        nivel: 'global',
        id: null,
        nombre:
          alcance.tipo === 'global'
            ? alcance.nombre
            : edificacionId
              ? edificaciones[0].nombre
              : 'Total global',
        codigo: 'GLOBAL',
        padreId: null,
        criterio: edificacionId
          ? 'Facturas de energía (de la edificación, kWh/mes)'
          : 'Facturas de energía (todas las edificaciones, kWh/mes)',
        // Denominador real contra el que se normalizan los shares.
        peso: origen === 'facturas_area' ? pesoTotalBloques : mediaNormalizado,
        share: 1,
        consumoPromedio: mediaNormalizado,
      },
    ]
    for (const b of bloques) {
      const shareBloque = shareDeBloque(b)
      jerarquia.push({
        nivel: 'bloque',
        id: b.id,
        nombre: b.nombre,
        codigo: b.codigo,
        padreId: null,
        criterio: criterioBloque,
        peso: origen === 'facturas_area' ? pesoDe(b) : cargaDeBloque(b),
        share: shareBloque,
        consumoPromedio: mediaNormalizado * shareBloque,
      })
      const hermanos = espacios.filter((e) => e.bloqueId === b.id)
      if (hermanos.length === 0) continue
      const cargas = hermanos.map((e) => ({ e, carga: cargaEspacio(e) }))
      const cargaTotal = cargas.reduce((s, c) => s + c.carga, 0)
      for (const { e, carga } of cargas) {
        const shareEspacio =
          cargaTotal > 0
            ? carga / cargaTotal
            : 1 / hermanos.length
        jerarquia.push({
          nivel: 'espacio',
          id: e.id,
          nombre: e.nombre,
          codigo: e.nombre,
          padreId: b.id,
          criterio:
            cargaTotal > 0
              ? 'Carga nominal de equipos (kWh/mes)'
              : 'Reparto igualitario (sin equipos)',
          peso: cargaTotal > 0 ? carga : 1,
          share: shareBloque * shareEspacio,
          consumoPromedio: mediaNormalizado * shareBloque * shareEspacio,
        })
      }
    }

    const { salida, error } = await ejecutarCli(
      alcance.id ?? 'global',
      registros,
      ajustesCli
    )
    if (error || !salida) {
      return { ok: false, error: error ?? 'No fue posible calcular la línea base.' }
    }

    const resultados = {} as Record<ModeloLbenId, EstadoModelo>
    for (const id of MODELOS_LBEN) {
      const r = salida.resultados?.[id]
      if (r?.ok && r.resultado) {
        resultados[id] = { estado: 'ok', resultado: r.resultado as never }
      } else {
        resultados[id] = {
          estado: 'error',
          mensaje: r?.error ?? 'El modelo no produjo resultados.',
        }
      }
    }

    // ── Tabla de preparación: factura cruda → normalizada → asignada ──
    const idxSerie = new Map<string, PuntoSerie>()
    for (const p of salida.serie ?? []) {
      idxSerie.set(`${p.mes}|${p.ano}`, p)
    }
    const preparacion: FilaPreparacion[] = facturas.map((f) => {
      const [ano, mes] = f.periodo.split('-').map(Number)
      const asignado =
        Math.round(f.consumoNormalizado * alcance.share * 100) / 100
      const descartado = idxSerie.get(`${mes}|${ano}`)?.descartado ?? false
      return {
        periodo: f.periodo,
        consumoKwh: f.consumoKwh,
        diasFacturados: f.diasFacturados,
        costoCop: f.costoCop,
        consumoNormalizado: f.consumoNormalizado,
        share: alcance.share,
        consumoAsignado: asignado,
        descartado,
        motivoDescarte: descartado
          ? asignado <= 0
            ? 'cero'
            : 'banda'
          : null,
      }
    })

    const bandas: DepuracionBandas[] = (salida.bandas ?? []).map((b) => ({
      mes: b.mes,
      n: b.n,
      media: b.media ?? null,
      limiteInferior: b.limite_inferior ?? null,
      limiteSuperior: b.limite_superior ?? null,
      descartados: b.descartados ?? 0,
      estimado: b.estimado ?? false,
    }))

    const calculo: CalculoLineaBase = {
      alcance,
      origen,
      ...(aviso ? { aviso } : {}),
      originales: salida.originales ?? registros.length,
      depurados: salida.depurados ?? 0,
      minMeses: salida.min_meses ?? UPME_MIN_MESES,
      criterioDepuracion:
        salida.criterio_depuracion === 'banda_10_pct'
          ? 'banda_10_pct'
          : 'ic_2sigma',
      desvEst: salida.desv_est ?? null,
      kIntervalo:
        salida.criterio_depuracion === 'banda_10_pct'
          ? null
          : (salida.k_intervalo ?? UPME_K_INTERVALO),
      bandas,
      mesesInsuficientes: salida.meses_insuficientes ?? [],
      minValoresMes: salida.min_valores_por_mes ?? UPME_MIN_VALORES_MES,
      variablesRegresion: salida.variables_regresion_usadas ?? [],
      ajustesAplicados: salida.ajustes_aplicados ?? [],
      resultados,
      serie: salida.serie ?? [],
      preparacion,
      jerarquia,
      calculadoEn: new Date().toISOString(),
    }

    return { ok: true, calculo }
  } catch (e) {
    console.error('Error en calcularModelosLineaBase:', e)
    return {
      ok: false,
      error: 'No fue posible calcular la línea base. Intente de nuevo.',
    }
  }
}

/**
 * Persiste el resultado de un modelo en `LineaBaseEnergia` (upsert
 * bloqueId+tipo). Requiere permiso `upload` sobre el módulo `consumption`.
 *
 * El cálculo es libre (sirve para diagnóstico aunque falten meses), pero
 * aquí corre el gate de conformidad UPME: se exigen `UPME_MIN_MESES` meses
 * depurados **y** los 12 meses con al menos `UPME_MIN_VALORES_MES` valores
 * (3×12, estilo §7.5.1) antes de persistir una línea base oficial. Además
 * inyecta `origen` dentro de `coeficientes` para que una LB estimada sea
 * distinguible de una medida sin tocar `schema.prisma`.
 */
export async function guardarLineaBase(input: {
  bloqueId: string
  modelo: ModeloLbenId
  resultado: Record<string, unknown>
  /** Meses sobrevivientes a la depuración (±10 % default, rescate IC ec. 4-5; gate UPME). */
  depurados?: number
  /** Meses con menos de 3 valores (salen `estimado`; gate 3×12). */
  mesesInsuficientes?: number[]
  /** Criterio con el que se derivó el share del cálculo. */
  origen?: OrigenShare
}): Promise<RespuestaGuardar> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { ok: false, error: 'Sesión expirada. Inicie sesión nuevamente.' }
    }
    if (!(await canWithOverrides(user, 'consumption', 'upload'))) {
      return {
        ok: false,
        error: 'Su rol no tiene permiso para guardar líneas base en este módulo.',
      }
    }

    const { bloqueId, modelo, resultado } = input ?? {}
    if (typeof bloqueId !== 'string' || !bloqueId) {
      return { ok: false, error: 'Bloque inválido.' }
    }
    if (!MODELOS_LBEN.includes(modelo)) {
      return { ok: false, error: 'Modelo inválido.' }
    }
    if (!resultado || typeof resultado !== 'object') {
      return { ok: false, error: 'Resultado inválido: recalcule la línea base.' }
    }

    // ── Gate de conformidad UPME ──────────────────────────────────────
    // 1) Con menos de 36 meses depurados o 2) algún mes con menos de 3
    // valores (3×12), el cálculo sigue siendo válido para diagnóstico, pero
    // no puede volverse una línea base oficial.
    const mesesFacturados = await prisma.facturaEnergia.count()
    const depurados =
      typeof input.depurados === 'number' ? input.depurados : mesesFacturados
    const mesesInsuficientes = Array.isArray(input.mesesInsuficientes)
      ? input.mesesInsuficientes.filter(
          (m) => Number.isInteger(m) && m >= 1 && m <= 12
        )
      : []
    if (
      mesesFacturados < UPME_MIN_MESES ||
      depurados < UPME_MIN_MESES ||
      mesesInsuficientes.length > 0
    ) {
      const detalleMeses =
        mesesInsuficientes.length > 0
          ? ` y faltan ${UPME_MIN_VALORES_MES} valores en el(los) mes(es) ${mesesInsuficientes.join(', ')} (3×12)`
          : ''
      return {
        ok: false,
        error: `Se requieren al menos ${UPME_MIN_MESES} meses depurados para persistir una línea base conforme a la UPME: hay ${depurados} de ${mesesFacturados} facturas${detalleMeses}. El cálculo queda disponible para diagnóstico, pero no puede guardarse oficialmente.`,
      }
    }

    const origen: OrigenShare =
      input.origen === 'modelo_ingenieria' ? 'modelo_ingenieria' : 'facturas_area'

    const r = resultado as Record<string, unknown>
    const r2 = typeof r.r2 === 'number' ? r.r2 : null
    // pValue: la peor significancia entre las variables usadas (todas ≤ 0.05).
    const pValues =
      r.p_values && typeof r.p_values === 'object'
        ? Object.values(r.p_values as Record<string, number>)
        : []
    const pValue = pValues.length > 0 ? Math.max(...pValues) : null

    // `coeficientes` es `Json` en schema: el origen viaja aquí para no
    // alterar el modelo de datos y seguir siendo auditable.
    const coeficientes = { ...r, origen } as never

    const tipo = TIPO_LBEN_DB[modelo]
    await prisma.lineaBaseEnergia.upsert({
      where: { bloqueId_tipo: { bloqueId, tipo } },
      update: { coeficientes, r2, pValue },
      create: {
        bloqueId,
        tipo,
        coeficientes,
        r2,
        pValue,
        rangosConfianza: UPME_RANGO_CONFIANZA,
      },
    })

    await auditarAccion({
      action: 'linea_base.save',
      targetId: bloqueId,
      detail: `Línea base ${modelo} guardada para el bloque ${bloqueId}.`,
    })

    return { ok: true, mensaje: 'Línea base guardada.' }
  } catch (e) {
    console.error('Error en guardarLineaBase:', e)
    return {
      ok: false,
      error: 'No fue posible guardar la línea base. Intente de nuevo.',
    }
  }
}

/** Gate compartido por las acciones de gestión de líneas base. */
async function autorizarGestionLineasBase(): Promise<
  { ok: true } | { ok: false; mensaje: string }
> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
  if (!(await canWithOverrides(user, 'consumption', 'upload'))) {
    return {
      ok: false,
      mensaje: 'Su rol no tiene permiso para eliminar líneas base en este módulo.',
    }
  }
  return { ok: true }
}

/**
 * Elimina una línea base guardada (bloque + modelo). Requiere `upload`.
 * A diferencia de `vaciarFacturas`, no toca el histórico de facturas:
 * sirve para liberar un bloque o recalcular su modelo desde cero.
 */
export async function eliminarLineaBase(id: string): Promise<ResultadoGestion> {
  try {
    const auth = await autorizarGestionLineasBase()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const idLineaBase = String(id ?? '').trim()
    if (!idLineaBase) {
      return { estado: 'error', mensaje: 'Debe indicar la línea base a eliminar.' }
    }

    const lineaBase = await prisma.lineaBaseEnergia.findUnique({
      where: { id: idLineaBase },
      select: {
        id: true,
        tipo: true,
        bloque: { select: { codigo: true, nombre: true } },
      },
    })
    if (!lineaBase) {
      return { estado: 'error', mensaje: 'La línea base indicada ya no existe.' }
    }

    await prisma.lineaBaseEnergia.delete({ where: { id: lineaBase.id } })

    await auditarAccion({
      action: 'linea_base.delete',
      targetId: lineaBase.id,
      detail: `Línea base ${lineaBase.tipo} eliminada del bloque "${lineaBase.bloque.codigo} — ${lineaBase.bloque.nombre}".`,
    })

    return {
      estado: 'completado',
      eliminadas: 1,
      lineasBaseEliminadas: 1,
      mensaje: `Se eliminó la línea base ${lineaBase.tipo} del bloque "${lineaBase.bloque.codigo} — ${lineaBase.bloque.nombre}".`,
    }
  } catch (error) {
    console.error('Error en eliminarLineaBase:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible eliminar la línea base. Intente de nuevo.',
    }
  }
}

/**
 * Vacía todas las líneas base guardadas. Facturas, variables, equipos y
 * el catálogo se conservan: son el único camino para reiniciar los modelos
 * LBEn sin perder el histórico de consumo.
 */
export async function vaciarLineasBase(): Promise<ResultadoGestion> {
  try {
    const auth = await autorizarGestionLineasBase()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const lineasBase = await prisma.lineaBaseEnergia.deleteMany()

    await auditarAccion({
      action: 'lineas_base.truncate',
      targetId: 'global',
      detail: `Se eliminaron ${lineasBase.count} líneas base.`,
    })

    return {
      estado: 'completado',
      eliminadas: 0,
      lineasBaseEliminadas: lineasBase.count,
      mensaje: `Se eliminaron ${lineasBase.count} líneas base guardadas. Facturas y variables se conservan.`,
    }
  } catch (error) {
    console.error('Error en vaciarLineasBase:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible vaciar las líneas base. Intente de nuevo.',
    }
  }
}
