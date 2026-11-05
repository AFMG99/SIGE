'use server'

import { prisma } from '@/shared/models/prisma'
import { getCurrentUser, canWithOverrides } from '@/shared/models/authz'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import {
  filtroReporteSchema,
  agruparFacturasPorPeriodicidad,
  MEDIDAS_EFICIENCIA_UPME_DEFECTO,
  type DatosReporteUPME,
  type FilaHistoricoReporte,
  type CategoriaEquipoResumen,
  type ItemAjusteUPME,
} from '../models/reportes'

const TIPO_POR_MODELO: Record<string, string> = {
  valor_absoluto: 'VALOR_ABSOLUTO',
  cociente: 'COCIENTE',
  regresion: 'REGRESSION_ESTADISTICA',
  confort: 'CONFORT_THERMAL',
}

function registroJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function numeroJson(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function arregloNumericoJson(
  record: Record<string, unknown> | null,
  key: string
): number[] | null {
  const value = record?.[key]
  if (!Array.isArray(value) || value.length !== 12) return null
  const numeros = value.map((item) =>
    typeof item === 'number' && Number.isFinite(item) ? item : null
  )
  return numeros.every((item): item is number => item !== null) ? numeros : null
}

function rangoJson(record: Record<string, unknown> | null): [number, number] | null {
  const value = record?.rango_confianza_10_pct
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== 'number' ||
    typeof value[1] !== 'number' ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1])
  ) {
    return null
  }
  return [value[0], value[1]]
}

function promedio(valores: number[]): number | null {
  if (valores.length === 0) return null
  return valores.reduce((total, valor) => total + valor, 0) / valores.length
}

export type RespuestaDatosReporte =
  | { estado: 'ok'; datos: DatosReporteUPME }
  | { estado: 'error'; mensaje: string }

export async function obtenerDatosReporte(input: unknown): Promise<RespuestaDatosReporte> {
  const user = await getCurrentUser()
  if (!user) {
    return { estado: 'error', mensaje: 'No autenticado' }
  }

  // Verificación de permisos según matriz y overrides de 'reports'
  const tieneAcceso = await Promise.all([
    canWithOverrides(user, 'reports', 'read'),
    canWithOverrides(user, 'reports', 'generate'),
    canWithOverrides(user, 'reports', 'download_reports'),
  ]).then((acts) => acts.some(Boolean))

  if (!tieneAcceso) {
    return { estado: 'error', mensaje: 'No tiene permisos para generar reportes' }
  }

  const validacion = filtroReporteSchema.safeParse(input)
  if (!validacion.success) {
    return {
      estado: 'error',
      mensaje: validacion.error.errors.map((e) => e.message).join(', '),
    }
  }

  const {
    edificacionId,
    bloqueId,
    periodicidad,
    periodoInicio,
    periodoFin,
    modeloClave,
  } = validacion.data

  try {
    // 1. Obtener edificación y bloques
    const edificacion = await prisma.edificacion.findUnique({
      where: { id: edificacionId },
      include: {
        bloques: {
          include: {
            espacios: {
              include: {
                equipos: true,
              },
            },
          },
        },
      },
    })

    if (!edificacion) {
      return { estado: 'error', mensaje: 'Edificación no encontrada' }
    }

    const bloqueSeleccionado = bloqueId
      ? edificacion.bloques.find((b) => b.id === bloqueId) ?? null
      : null

    // 2. Facturas de energía
    const facturas = await prisma.facturaEnergia.findMany({
      where: {
        edificacionId,
        ...(periodoInicio && periodoFin
          ? { periodo: { gte: periodoInicio, lte: periodoFin } }
          : periodoInicio
          ? { periodo: { gte: periodoInicio } }
          : periodoFin
          ? { periodo: { lte: periodoFin } }
          : {}),
      },
      orderBy: { periodo: 'asc' },
    })

    // 3. Variables operativas
    const variables = await prisma.variableOperativa.findMany({
      where: {
        bloqueId: bloqueId ? bloqueId : { in: edificacion.bloques.map((b) => b.id) },
      },
      orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
    })

    // 4. Líneas base guardadas
    const lineasBase = await prisma.lineaBaseEnergia.findMany({
      where: {
        OR: [
          ...(bloqueId ? [{ bloqueId }] : []),
          { edificacionId },
          { bloqueId: { in: edificacion.bloques.map((b) => b.id) } },
        ],
      },
    })

    // 5. Ajustes energéticos
    const ajustes = await prisma.ajusteEnergetico.findMany({
      where: {
        bloqueId: bloqueId ? bloqueId : { in: edificacion.bloques.map((b) => b.id) },
      },
      orderBy: { periodoInicio: 'asc' },
    })

    // 6. Inventario de equipos
    const bloquesParaInventario = bloqueSeleccionado
      ? [bloqueSeleccionado]
      : edificacion.bloques

    const equipos = bloquesParaInventario.flatMap((b) =>
      b.espacios.flatMap((esp) => esp.equipos)
    )

    // Agregación de equipos por tipo/categoría
    const catMap = new Map<string, { cantidad: number; potenciaKw: number }>()
    let potenciaTotal = 0

    for (const eq of equipos) {
      const potKw = (eq.potenciaNominal ?? 0) * (eq.cantidad ?? 1)
      potenciaTotal += potKw
      const categoria = eq.tipo || 'GENERAL'
      const actual = catMap.get(categoria) ?? { cantidad: 0, potenciaKw: 0 }
      catMap.set(categoria, {
        cantidad: actual.cantidad + (eq.cantidad ?? 1),
        potenciaKw: actual.potenciaKw + potKw,
      })
    }

    const categoriasResumen: CategoriaEquipoResumen[] = Array.from(catMap.entries()).map(
      ([categoria, datos]) => ({
        categoria,
        cantidad: datos.cantidad,
        potenciaTotalKw: Number(datos.potenciaKw.toFixed(2)),
        participacionPct:
          potenciaTotal > 0
            ? Number(((datos.potenciaKw / potenciaTotal) * 100).toFixed(1))
            : 0,
      })
    )

    // 7. Generalidades y Ocupación
    const variablesActualesPorBloque = new Map<
      string,
      (typeof variables)[number]
    >()
    for (const variable of variables) {
      variablesActualesPorBloque.set(variable.bloqueId, variable)
    }
    const variablesActuales = Array.from(variablesActualesPorBloque.values())
    const pobFija =
      variablesActuales.length > 0
        ? variablesActuales.reduce((total, variable) => total + variable.poblacionFija, 0)
        : null
    const pobFlotante =
      variablesActuales.length > 0
        ? variablesActuales.reduce((total, variable) => total + variable.poblacionFlotante, 0)
        : null

    // 8. Seleccionar solo una LBEn compatible con el alcance del informe.
    const nombresModelos: Record<string, string> = {
      VALOR_ABSOLUTO: 'Modelo de Valor Absoluto de Energía (UPME §8.5.2)',
      COCIENTE: 'Modelo de Cociente / Relación Simple (UPME §8.5.3)',
      REGRESSION_ESTADISTICA: 'Modelo Estadístico Multivariable (UPME §8.5.4)',
      CONFORT_THERMAL: 'Modelo de Confort Térmico (ASHRAE 90.1 / UPME §8.5.5)',
    }
    const ambitoLben = bloqueId
      ? lineasBase.filter((linea) => linea.bloqueId === bloqueId)
      : lineasBase.filter((linea) => linea.edificacionId === edificacionId)
    const ambitoConRespaldo =
      bloqueId && ambitoLben.length === 0
        ? lineasBase.filter((linea) => linea.edificacionId === edificacionId)
        : ambitoLben
    const tipoSolicitado = TIPO_POR_MODELO[modeloClave]
    const prioridadModelos = [
      'VALOR_ABSOLUTO',
      'COCIENTE',
      'REGRESSION_ESTADISTICA',
      'CONFORT_THERMAL',
    ]
    const lbenElegida =
      (tipoSolicitado
        ? ambitoConRespaldo.find((linea) => linea.tipo === tipoSolicitado)
        : prioridadModelos
            .map((tipo) => ambitoConRespaldo.find((linea) => linea.tipo === tipo))
            .find((linea) => linea !== undefined)) ?? null
    const coeficientes = registroJson(lbenElegida?.coeficientes)
    const lbenMensual = arregloNumericoJson(coeficientes, 'lben_mensual')
    const rangoLben = rangoJson(coeficientes)
    const consumoBaseKwh = promedio(lbenMensual ?? [])
    const desviacionLben = numeroJson(coeficientes, 'desvio_estandar')
    const mape = numeroJson(coeficientes, 'mape')

    // 9. Clasificar facturas solo cuando existe la banda mensual guardada.
    const consumos = facturas.map((f) => f.consumoNormalizado)
    const n = consumos.length
    const media = n > 0 ? consumos.reduce((a, b) => a + b, 0) / n : 0
    const varianza =
      n > 1
        ? consumos.reduce((acc, val) => acc + Math.pow(val - media, 2), 0) / (n - 1)
        : 0
    const desviacion = n > 1 ? Math.sqrt(varianza) : null

    const filasMensuales: FilaHistoricoReporte[] = facturas.map((factura) => {
      const mes = Number(factura.periodo.slice(5, 7))
      const referenciaMensual = lbenMensual?.[mes - 1]
      const esAtipico =
        typeof referenciaMensual === 'number' && referenciaMensual > 0
          ? factura.consumoNormalizado < referenciaMensual * 0.9 ||
            factura.consumoNormalizado > referenciaMensual * 1.1
          : null
      return {
        periodo: factura.periodo,
        consumoKwh: factura.consumoKwh,
        consumoNormalizado: Math.round(factura.consumoNormalizado),
        diasFacturados: factura.diasFacturados,
        costoCop: Math.round(factura.costoCop),
        esAtipico,
        motivoAtipico:
          esAtipico === true
            ? 'Fuera de ±10% de la LBEn mensual guardada'
            : undefined,
      }
    })
    const facturasAtipicas =
      lbenMensual && filasMensuales.every((fila) => fila.esAtipico !== null)
        ? filasMensuales.filter((fila) => fila.esAtipico === true).length
        : null
    const facturasDentroBanda =
      facturasAtipicas === null ? null : n - facturasAtipicas
    const filasHistorico = agruparFacturasPorPeriodicidad(
      filasMensuales,
      periodicidad
    )
    const areaUtilM2 =
      bloqueSeleccionado?.areaUtil ??
      edificacion.area ??
      (edificacion.bloques.length > 0
        ? edificacion.bloques.reduce((total, bloque) => total + bloque.areaUtil, 0)
        : null)
    const alcanzaMinimo36Facturas = n >= 36

    // 10. Ajustes energéticos
    const itemsAjuste: ItemAjusteUPME[] = ajustes.map((aj) => ({
      id: aj.id,
      tipo: aj.tipo,
      descripcion: aj.descripcion,
      periodo: `${aj.periodoInicio.toISOString().slice(0, 7)} a ${aj.periodoFin
        .toISOString()
        .slice(0, 7)}`,
      valorAjustePct: aj.valorAjuste,
      observaciones: aj.observaciones,
    }))

    // 12. Consolidar estructura final
    const datosReporte: DatosReporteUPME = {
      generalidades: {
        institucion: 'Tecnológico de Antioquia - Institución Universitaria',
        nit: '890.980.136-6',
        sede: edificacion.ubicacionNombre ?? 'No registrada en SIGE',
        edificacionNombre: edificacion.nombre,
        bloqueCodigo: bloqueSeleccionado?.codigo ?? null,
        bloqueNombre: bloqueSeleccionado?.nombre ?? null,
        areaUtilM2,
        fuentesEnergia: ['Red de Energía Eléctrica Comercial - EPM (13.2 kV / 220V)'],
        ocupantes: {
          poblacionFija: pobFija,
          poblacionFlotante: pobFlotante,
          total: pobFija === null || pobFlotante === null ? null : pobFija + pobFlotante,
        },
        actividades: `Tipo de edificación registrado: ${edificacion.tipo}`,
        fechaGeneracion: new Date().toLocaleDateString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        responsableNombre: user.name ?? user.email,
        responsableRol: user.role,
      },
      inventario: {
        totalEquipos: equipos.length,
        potenciaTotalKw: Number(potenciaTotal.toFixed(2)),
        categorias: categoriasResumen,
      },
      historico: {
        totalFacturas: n,
        facturasDentroBanda,
        facturasAtipicas,
        consumoTotalKwh: Math.round(
          facturas.reduce((total, factura) => total + factura.consumoKwh, 0)
        ),
        costoTotalCop: Math.round(
          facturas.reduce((total, factura) => total + factura.costoCop, 0)
        ),
        consumoPromedioMensualKwh: n > 0 ? Math.round(media) : null,
        desviacionEstandarKwh:
          desviacion === null ? null : Math.round(desviacion),
        rangoPeriodos:
          facturas.length > 0
            ? `${facturas[0].periodo} — ${facturas[facturas.length - 1].periodo}`
            : 'Sin registros',
        filas: filasHistorico,
      },
      lineaBase: {
        modeloSeleccionado: lbenElegida
          ? nombresModelos[lbenElegida.tipo] ?? lbenElegida.tipo
          : 'No hay una LBEn guardada para este alcance',
        modeloClave: lbenElegida?.tipo ?? 'SIN_LBEN',
        periodoBase: lbenElegida
          ? 'El período de cálculo no está disponible en el registro guardado'
          : 'No disponible: sin LBEn guardada',
        consumoBaseMensualKwh:
          consumoBaseKwh === null ? null : Math.round(consumoBaseKwh),
        desviacionEstandarKwh:
          desviacionLben === null ? null : Math.round(desviacionLben),
        bandaInferiorKwh:
          rangoLben === null ? null : Math.round(rangoLben[0]),
        bandaSuperiorKwh:
          rangoLben === null ? null : Math.round(rangoLben[1]),
        estadisticos: {
          r2: lbenElegida?.r2 ?? null,
          pValor: lbenElegida?.pValue ?? null,
          mape,
          ecuacion: null,
          variables: [],
        },
        criterioAprobacion: !lbenElegida
          ? 'No se puede verificar: no hay una LBEn guardada para el alcance seleccionado.'
          : facturasAtipicas === null
          ? 'La LBEn guardada no incluye bandas mensuales; no se clasifican anomalías.'
          : !alcanzaMinimo36Facturas
          ? `El reporte contiene ${n} facturas; no alcanza 36 meses de histórico y no verifica la depuración regulatoria.`
          : 'El reporte contiene al menos 36 facturas; no verifica por sí solo la depuración ni certifica el cumplimiento regulatorio.',
        alcanzaMinimo36Facturas,
      },
      ahorros: {
        metaAhorroAnualKwh: null,
        metaAhorroAnualPct: null,
        ahorrosMensuales: [],
        medidasEficiencia: MEDIDAS_EFICIENCIA_UPME_DEFECTO,
      },
      ajustes: {
        totalAjustes: itemsAjuste.length,
        items: itemsAjuste,
      },
    }

    // Registro de auditoría
    await auditarAccion({
      targetId: edificacion.id,
      action: 'reporte.consultado',
      detail: `Consulta de reporte UPME para edificación ${edificacion.nombre}${
        bloqueSeleccionado ? ` - Bloque ${bloqueSeleccionado.codigo}` : ''
      }`,
    })

    return { estado: 'ok', datos: datosReporte }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error inesperado'
    return { estado: 'error', mensaje: `Error al procesar datos del reporte: ${errorMsg}` }
  }
}
