'use server'

// Server Action de importación de Variables Operativas (SIGE-TdeA).
// Toda fila recibida se vuelve a validar en el servidor: nunca se confía
// en la validación hecha en el navegador.

import { prisma } from '@/shared/models/prisma'
import { canWithOverrides, getCurrentUser } from '@/shared/models/authz'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import { autorizarCarga } from '@/features/datos/controllers/edificaciones'
import { obtenerTempsHorarias } from '@/features/datos/controllers/clima'
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
import {
  diasOperativosDelMes,
  mapaXeDelMes,
  calcularGde,
  type ConfigCalendario,
  type PoliticaOperatividad,
  type RangoFechas,
  type TempDia,
} from '@/features/datos/models/calendario'

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

// ============================================================
// Cálculo masivo de Variables Operativas (días lectivos/laborales + GDE)
// ============================================================

/** Modo de aplicación de un cálculo. */
export type ModoCalculo = 'solo-vacios' | 'reemplazar'

/** Qué calcular en el lote. */
export interface QueCalcular {
  diasLaborales: boolean
  gde: boolean
}

/** Opciones por tipo de cálculo. */
export interface OpcionesCalculoVariables {
  modoDias: ModoCalculo
  modoGde: ModoCalculo
}

/** Entrada para la vista previa del cálculo masivo de variables. */
export interface PrepararCalculoVariablesInput {
  edificacionId: string
  desde: { mes: number; ano: number }
  hasta: { mes: number; ano: number }
  queCalcular: QueCalcular
  opciones: OpcionesCalculoVariables
}

/** Resultado de un periodo en la vista previa. */
export interface PeriodoVariableVistaPrevia {
  clave: string
  bloqueId: string
  bloqueCodigo: string
  mes: number
  ano: number
  tieneVariable: boolean
  diasLaborales: {
    actual: number | null
    calculado: number | null
    seEscribe: boolean
  }
  gde: {
    actual: number | null
    calculado: number | null
    seEscribe: boolean
  }
  advertencias: string[]
}

/** Vista previa completa del cálculo masivo de variables. */
export interface VistaPreviaVariables {
  intervalo: { desde: { mes: number; ano: number }; hasta: { mes: number; ano: number }; cantidadMeses: number }
  periodos: PeriodoVariableVistaPrevia[]
  conteos: {
    totalPeriodos: number
    seEscribenDias: number
    seEscribenGde: number
    sinVariable: number
  }
}

/** Entrada para la ejecución del cálculo masivo. */
export interface EjecutarCalculoVariablesInput {
  edificacionId: string
  desde: { mes: number; ano: number }
  hasta: { mes: number; ano: number }
  queCalcular: QueCalcular
  opciones: OpcionesCalculoVariables
  loteId?: string
}

/** Respuesta de una invocación del lote. */
export interface EjecucionLoteVariables {
  loteId: string
  procesados: { clave: string; diasLaborales?: 'calculado' | 'conservado' | 'fallido'; gde?: 'calculado' | 'conservado' | 'fallido'; mensaje?: string }[]
  restantes: number
  continuar: boolean
  resumenParcial: {
    calculadosDias: number
    conservadosDias: number
    fallidosDias: number
    calculadosGde: number
    conservadosGde: number
    fallidosGde: number
  }
}

const MAX_PERIODOS_POR_LLAMADA_VARIABLES = 10
const PRESUPUESTO_MS_VARIABLES = 30_000

function generarLoteIdVariables(): string {
  return crypto.randomUUID()
}

function clavePeriodoVariables(mes: number, ano: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`
}

function expandirIntervaloVariables(desde: { mes: number; ano: number }, hasta: { mes: number; ano: number }): { mes: number; ano: number }[] {
  const total = (hasta.ano - desde.ano) * 12 + (hasta.mes - desde.mes)
  const base = desde.ano * 12 + (desde.mes - 1)
  const periodos: { mes: number; ano: number }[] = []
  for (let i = 0; i <= total; i++) {
    const indice = base + i
    periodos.push({ ano: Math.floor(indice / 12), mes: (indice % 12) + 1 })
  }
  return periodos
}

async function autorizarCalculoVariables(): Promise<{ ok: true; userId: string } | { ok: false; mensaje: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { ok: false, mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
    if (!(await canWithOverrides(user, 'consumption', 'upload'))) {
      return { ok: false, mensaje: 'Su rol no tiene permiso para calcular variables operativas.' }
    }
    return { ok: true, userId: user.id }
  } catch {
    return { ok: false, mensaje: 'No fue posible autorizar el cálculo.' }
  }
}

async function cargarContextoVariables(edificacionId: string, mes: number, ano: number) {
  const edificacion = await prisma.edificacion.findUnique({
    where: { id: edificacionId },
    select: { id: true, nombre: true, lat: true, lon: true, calendario: true },
  })
  if (!edificacion) return { ok: false as const, mensaje: 'La edificación indicada no existe.' }
  if (!edificacion.calendario) {
    return { ok: false as const, mensaje: 'Esta edificación no tiene configuración operativa.' }
  }

  const [rangos, bloquesResult, variablesExistentes, horarios] = await Promise.all([
    prisma.rangoCalendario.findMany({
      where: { calendario: { edificacionId } },
      orderBy: { fechaInicio: 'asc' },
      select: { fechaInicio: true, fechaFin: true, tipoDia: true },
    }),
    prisma.bloque.findMany({
      where: { edificacionId },
      select: { id: true, codigo: true },
    }),
    prisma.variableOperativa.findMany({
      where: { bloqueId: { in: (await prisma.bloque.findMany({ where: { edificacionId }, select: { id: true } })).map(b => b.id) }, mes, ano },
      select: { bloqueId: true, diasLectivosLaborales: true, gradesDiaEnfriamiento: true },
    }),
    prisma.horarioEquipo.findMany({
      where: { edificacionId },
      select: { diasSemana: true, horaInicio: true, horaFin: true, desde: true, hasta: true, bloqueId: true, espacioId: true, equipoId: true },
    }),
  ])
  const bloques = bloquesResult

  const rangosIso = rangos.map(r => ({
    fechaInicio: r.fechaInicio.toISOString().slice(0, 10),
    fechaFin: r.fechaFin.toISOString().slice(0, 10),
    tipoDia: r.tipoDia,
  }))

  const politica: PoliticaOperatividad = {
    domingosOperativos: edificacion.calendario.domingosOperativos ?? true,
    festivosOperativos: edificacion.calendario.festivosOperativos ?? true,
  }

  const config: ConfigCalendario = {
    horaInicioOperacion: edificacion.calendario.horaInicioOperacion,
    horasOperacionDia: edificacion.calendario.horasOperacionDia,
    temperaturaBase: edificacion.calendario.temperaturaBase,
  }

  let horasUsoPorFecha: Map<string, number> | null = null
  if (edificacion.calendario.usarHorariosXe) {
    horasUsoPorFecha = mapaXeDelMes({
      rangos: rangosIso,
      config,
      horarios: horarios.map(h => ({
        diasSemana: h.diasSemana,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        desde: h.desde ? h.desde.toISOString().slice(0, 10) : null,
        hasta: h.hasta ? h.hasta.toISOString().slice(0, 10) : null,
      })),
      usarHorariosXe: true,
      mes,
      ano,
      politica,
    })
  }

  let tempsHorarias: TempDia[] | null = null
  if (edificacion.lat != null && edificacion.lon != null) {
    try {
      tempsHorarias = await obtenerTempsHorarias(edificacion.lat, edificacion.lon, mes, ano)
    } catch {
      tempsHorarias = null
    }
  }

  const variablesPorBloque = new Map(variablesExistentes.map(v => [v.bloqueId, v]))

  return {
    ok: true as const,
    edificacion,
    rangos: rangosIso,
    bloques,
    config,
    politica,
    horasUsoPorFecha,
    tempsHorarias,
    variablesPorBloque,
  }
}

/**
 * Vista previa del cálculo masivo de variables operativas (SOLO LECTURA).
 * Calcula qué se escribiría en cada periodo/bloque según el modo elegido.
 */
export async function prepararCalculoVariablesMasivo(
  input: PrepararCalculoVariablesInput
): Promise<({ estado: 'ok' } & { vistaPrevia: VistaPreviaVariables }) | { estado: 'error'; mensaje: string }> {
  try {
    const auth = await autorizarCalculoVariables()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const { edificacionId, desde, hasta, queCalcular, opciones } = input

    const id = String(edificacionId ?? '').trim()
    if (!id) return { estado: 'error', mensaje: 'La edificación es obligatoria.' }

    // Validar intervalo
    if (desde.ano > hasta.ano || (desde.ano === hasta.ano && desde.mes > hasta.mes)) {
      return { estado: 'error', mensaje: 'El mes final debe ser posterior o igual al inicial.' }
    }
    const mesesTotal = (hasta.ano - desde.ano) * 12 + (hasta.mes - desde.mes) + 1
    if (mesesTotal > 120) {
      return { estado: 'error', mensaje: 'El intervalo supera los 120 meses permitidos.' }
    }

    const periodos = expandirIntervaloVariables(desde, hasta)
    const primerPeriodo = periodos[0]
    const contexto = await cargarContextoVariables(id, primerPeriodo.mes, primerPeriodo.ano)
    if (!contexto.ok) return { estado: 'error', mensaje: contexto.mensaje }

    const { bloques, config, politica, rangos, horasUsoPorFecha, tempsHorarias, variablesPorBloque } = contexto

    const periodosVista: PeriodoVariableVistaPrevia[] = []
    let seEscribenDias = 0
    let seEscribenGde = 0
    let sinVariable = 0

    for (const p of periodos) {
      // Recalcular días operativos y GDE para cada mes (pueden variar por rangos)
      const diasOp = diasOperativosDelMes(rangos, p.mes, p.ano, politica)

      let gdeCalculado: number | null = null
      if (queCalcular.gde && tempsHorarias) {
        const resGde = calcularGde({
          rangos,
          config,
          tempsHorarias,
          mes: p.mes,
          ano: p.ano,
          horasUsoPorFecha,
          politica,
        })
        gdeCalculado = resGde.gde
      }

      for (const bloque of bloques) {
        const variable = variablesPorBloque.get(bloque.id)
        const tieneVariable = variable !== undefined

        if (!tieneVariable) sinVariable++

        const diasActual = variable?.diasLectivosLaborales ?? null
        const gdeActual = variable?.gradesDiaEnfriamiento ?? null

        const diasCalculado = queCalcular.diasLaborales && diasOp > 0 ? diasOp : null
        const gdeCalculadoBloque = queCalcular.gde ? gdeCalculado : null

        let seEscribeDias = false
        let seEscribeGde = false

        if (queCalcular.diasLaborales && diasCalculado !== null) {
          if (opciones.modoDias === 'reemplazar' || (opciones.modoDias === 'solo-vacios' && (diasActual === null || diasActual === 0))) {
            seEscribeDias = true
            seEscribenDias++
          }
        }

        if (queCalcular.gde && gdeCalculadoBloque !== null) {
          if (opciones.modoGde === 'reemplazar' || (opciones.modoGde === 'solo-vacios' && (gdeActual === null || gdeActual === 0))) {
            seEscribeGde = true
            seEscribenGde++
          }
        }

        const advertencias: string[] = []
        if (queCalcular.diasLaborales && diasOp === 0) advertencias.push('Sin días operativos en el mes')
        if (queCalcular.gde && !tempsHorarias) advertencias.push('Sin datos climáticos para el mes')
        if (queCalcular.gde && horasUsoPorFecha && gdeCalculado !== null && gdeCalculado === 0) advertencias.push('GDE calculada en 0 (revisar horarios Xe)')

        periodosVista.push({
          clave: `${bloque.id}|${clavePeriodoVariables(p.mes, p.ano)}`,
          bloqueId: bloque.id,
          bloqueCodigo: bloque.codigo,
          mes: p.mes,
          ano: p.ano,
          tieneVariable,
          diasLaborales: { actual: diasActual, calculado: diasCalculado, seEscribe: seEscribeDias },
          gde: { actual: gdeActual, calculado: gdeCalculadoBloque, seEscribe: seEscribeGde },
          advertencias,
        })
      }
    }

    return {
      estado: 'ok',
      vistaPrevia: {
        intervalo: { desde, hasta, cantidadMeses: periodos.length },
        periodos: periodosVista,
        conteos: {
          totalPeriodos: periodosVista.length,
          seEscribenDias,
          seEscribenGde,
          sinVariable,
        },
      },
    }
  } catch (error) {
    console.error('Error en prepararCalculoVariablesMasivo:', error)
    return { estado: 'error', mensaje: 'No fue posible generar la vista previa. Intente de nuevo.' }
  }
}

/**
 * Ejecuta el cálculo masivo de variables por lotes acotados.
 * Escribe directamente en BD (upsert por bloque+mes+ano).
 */
export async function ejecutarCalculoVariablesMasivo(
  input: EjecutarCalculoVariablesInput
): Promise<({ estado: 'ok' } & { ejecucion: EjecucionLoteVariables }) | { estado: 'error'; mensaje: string }> {
  try {
    const auth = await autorizarCalculoVariables()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const { edificacionId, desde, hasta, queCalcular, opciones, loteId } = input
    const id = String(edificacionId ?? '').trim()
    if (!id) return { estado: 'error', mensaje: 'La edificación es obligatoria.' }

    const lote = loteId ?? generarLoteIdVariables()
    const periodos = expandirIntervaloVariables(desde, hasta)

    await auditarAccion({
      action: 'variables.calcular_masivo.inicio',
      targetId: id,
      detail: `Lote ${lote}: ${clavePeriodoVariables(desde.mes, desde.ano)}–${clavePeriodoVariables(hasta.mes, hasta.ano)}, ${periodos.length} mes(es).`,
    })

    const primerPeriodo = periodos[0]
    const contexto = await cargarContextoVariables(id, primerPeriodo.mes, primerPeriodo.ano)
    if (!contexto.ok) return { estado: 'error', mensaje: contexto.mensaje }

    const { bloques, config, politica, rangos, horasUsoPorFecha, tempsHorarias, variablesPorBloque } = contexto

    // Pendientes: cruzar bloques x periodos y filtrar según modo
    const pendientes: { bloqueId: string; mes: number; ano: number; calcularDias: boolean; calcularGde: boolean }[] = []
    for (const p of periodos) {
      const diasOp = diasOperativosDelMes(rangos, p.mes, p.ano, politica)
      let gdeCalc: number | null = null
      if (queCalcular.gde && tempsHorarias) {
        const resGde = calcularGde({ rangos, config, tempsHorarias, mes: p.mes, ano: p.ano, horasUsoPorFecha, politica })
        gdeCalc = resGde.gde
      }
      for (const bloque of bloques) {
        const variable = variablesPorBloque.get(bloque.id)
        const diasActual = variable?.diasLectivosLaborales ?? null
        const gdeActual = variable?.gradesDiaEnfriamiento ?? null
        const diasCalculado = queCalcular.diasLaborales && diasOp > 0 ? diasOp : null
        const gdeCalculado = queCalcular.gde ? gdeCalc : null

        let calcularDias = false
        let calcularGde = false
        if (queCalcular.diasLaborales && diasCalculado !== null) {
          if (opciones.modoDias === 'reemplazar' || (opciones.modoDias === 'solo-vacios' && (diasActual === null || diasActual === 0))) {
            calcularDias = true
          }
        }
        if (queCalcular.gde && gdeCalculado !== null) {
          if (opciones.modoGde === 'reemplazar' || (opciones.modoGde === 'solo-vacios' && (gdeActual === null || gdeActual === 0))) {
            calcularGde = true
          }
        }
        if (calcularDias || calcularGde) {
          pendientes.push({ bloqueId: bloque.id, mes: p.mes, ano: p.ano, calcularDias, calcularGde })
        }
      }
    }

    const inicio = Date.now()
    let intentados = 0
    const procesados: EjecucionLoteVariables['procesados'] = []
    const resumenParcial = {
      calculadosDias: 0,
      conservadosDias: 0,
      fallidosDias: 0,
      calculadosGde: 0,
      conservadosGde: 0,
      fallidosGde: 0,
    }

    for (const p of pendientes) {
      if (intentados >= MAX_PERIODOS_POR_LLAMADA_VARIABLES) break
      if (Date.now() - inicio > PRESUPUESTO_MS_VARIABLES) break
      intentados++

      const clave = `${p.bloqueId}|${clavePeriodoVariables(p.mes, p.ano)}`
      try {
        const variable = await prisma.variableOperativa.findUnique({
          where: { bloqueId_mes_ano: { bloqueId: p.bloqueId, mes: p.mes, ano: p.ano } },
        })

        let nuevoDias: number | undefined
        let nuevoGde: number | undefined

        if (p.calcularDias) {
          const diasOp = diasOperativosDelMes(rangos, p.mes, p.ano, politica)
          nuevoDias = diasOp
        }
        if (p.calcularGde && tempsHorarias) {
          const resGde = calcularGde({ rangos, config, tempsHorarias, mes: p.mes, ano: p.ano, horasUsoPorFecha, politica })
          nuevoGde = resGde.gde
        }

        if (variable) {
          await prisma.variableOperativa.update({
            where: { bloqueId_mes_ano: { bloqueId: p.bloqueId, mes: p.mes, ano: p.ano } },
            data: {
              ...(nuevoDias !== undefined && { diasLectivosLaborales: nuevoDias }),
              ...(nuevoGde !== undefined && { gradesDiaEnfriamiento: nuevoGde }),
            },
          })
          if (nuevoDias !== undefined) resumenParcial.calculadosDias++
          if (nuevoGde !== undefined) resumenParcial.calculadosGde++
        } else {
          // No hay variable existente: no creamos filas parciales desde aquí
          // (el importador es responsable de crear la fila completa)
          if (nuevoDias !== undefined) resumenParcial.fallidosDias++
          if (nuevoGde !== undefined) resumenParcial.fallidosGde++
        }

        procesados.push({
          clave,
          diasLaborales: nuevoDias !== undefined ? 'calculado' : undefined,
          gde: nuevoGde !== undefined ? 'calculado' : undefined,
        })
      } catch (error) {
        console.error(`Error en periodo ${clave} del lote ${lote}:`, error)
        if (p.calcularDias) resumenParcial.fallidosDias++
        if (p.calcularGde) resumenParcial.fallidosGde++
        procesados.push({ clave, mensaje: 'Error al calcular' })
      }
    }

    const restantes = pendientes.length - intentados

    await auditarAccion({
      action: 'variables.calcular_masivo.fin',
      targetId: id,
      detail: `Lote ${lote}: ${resumenParcial.calculadosDias} días calculados, ${resumenParcial.calculadosGde} GDE calculadas, ${restantes} pendientes.`,
    })

    return {
      estado: 'ok',
      ejecucion: {
        loteId: lote,
        procesados,
        restantes,
        continuar: restantes > 0,
        resumenParcial,
      },
    }
  } catch (error) {
    console.error('Error en ejecutarCalculoVariablesMasivo:', error)
    return { estado: 'error', mensaje: 'No fue posible ejecutar el cálculo. Intente de nuevo.' }
  }
}
