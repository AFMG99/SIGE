'use client'

/**
 * Estado del flujo «Cálculo masivo de Variables Operativas».
 *
 * Reutiliza el mismo patrón que `useCalculoMasivo`: selectores de periodo,
 * vista previa (solo lectura) y ejecución por lotes con progreso, «Detener»
 * y resumen. Los cálculos son independientes: días lectivos/laborales y GDE
 * se configuran con sus propios modos (solo-vacios / reemplazar).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  ejecutarCalculoVariablesMasivo,
  prepararCalculoVariablesMasivo,
} from '@/features/datos/controllers/variables'
import type {
  EjecucionLoteVariables,
  OpcionesCalculoVariables,
  PrepararCalculoVariablesInput,
  QueCalcular,
  VistaPreviaVariables,
} from '@/features/datos/controllers/variables'
import { useToast } from '@/shared/views/ui/ToastProvider'

/** Meses en minúscula para los selectores (mismo estilo que ImportadorEquipos). */
export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const ANO_ACTUAL = new Date().getFullYear()

/** Años ofrecidos por los selectores de intervalo: actual −1 … +2. */
export const ANOS_UI = [ANO_ACTUAL - 1, ANO_ACTUAL, ANO_ACTUAL + 1, ANO_ACTUAL + 2]

/** Fusiona el acumulado de periodos atendidos (deduplica por clave). */
export function mezclarProcesadosVariables(
  previos: EjecucionLoteVariables['procesados'],
  nuevos: EjecucionLoteVariables['procesados']
): EjecucionLoteVariables['procesados'] {
  const porClave = new Map<string, EjecucionLoteVariables['procesados'][0]>()
  for (const p of previos) porClave.set(p.clave, p)
  for (const p of nuevos) porClave.set(p.clave, p)
  return Array.from(porClave.values())
}

/** Primer periodo pendiente para el indicador «Procesando X… (n de t)». */
export function periodoEnCursoVariables(
  pendientes: string[],
  procesados: EjecucionLoteVariables['procesados']
): string | null {
  const atendidas = new Set(procesados.map((p) => p.clave))
  return pendientes.find((clave) => !atendidas.has(clave)) ?? null
}

export function useCalculoVariablesMasivo() {
  const { showToast } = useToast()

  // Selectores: edificación (fija por importación) + intervalo
  const [edificacionId, setEdificacionIdCrudo] = useState('')
  const [mesInicial, setMesInicial] = useState(() => new Date().getMonth() + 1)
  const [anoInicial, setAnoInicial] = useState(ANO_ACTUAL)
  const [mesFinal, setMesFinal] = useState(() => new Date().getMonth() + 1)
  const [anoFinal, setAnoFinal] = useState(ANO_ACTUAL)

  // Qué calcular y con qué modo
  const [queCalcular, setQueCalcular] = useState<QueCalcular>({
    diasLaborales: true,
    gde: true,
  })
  const [opciones, setOpciones] = useState<OpcionesCalculoVariables>({
    modoDias: 'solo-vacios',
    modoGde: 'solo-vacios',
  })

  // Resultados en pantalla
  const [vistaPrevia, setVistaPrevia] = useState<VistaPreviaVariables | null>(null)
  const [previaCargando, setPreviaCargando] = useState(false)

  // Ejecución masiva: lote en curso, acumulado fusionado y resumen
  const [ejecutando, setEjecutando] = useState(false)
  const [procesados, setProcesados] = useState<EjecucionLoteVariables['procesados']>([])
  const [resumen, setResumen] = useState<EjecucionLoteVariables['resumenParcial'] | null>(null)
  /** Cancelación pedida por «Detener»: corta tras la llamada en vuelo. */
  const canceladoRef = useRef(false)
  /** Guarda síncrona contra doble click antes del siguiente render. */
  const enCursoRef = useRef(false)

  // Al desmontar se cancela el lote
  useEffect(() => {
    return () => {
      canceladoRef.current = true
    }
  }, [])

  /** Al cambiar de edificación, limpiar resultados. */
  const cambiarEdificacion = useCallback((id: string) => {
    canceladoRef.current = true
    setEdificacionIdCrudo(id)
    setVistaPrevia(null)
    setProcesados([])
    setResumen(null)
  }, [])

  /** Vista previa del intervalo (SOLO LECTURA). */
  const previsualizar = useCallback(async () => {
    if (!edificacionId) return
    canceladoRef.current = true
    setProcesados([])
    setResumen(null)
    setPreviaCargando(true)
    setVistaPrevia(null)
    try {
      const input: PrepararCalculoVariablesInput = {
        edificacionId,
        desde: { mes: mesInicial, ano: anoInicial },
        hasta: { mes: mesFinal, ano: anoFinal },
        queCalcular,
        opciones,
      }
      const respuesta = await prepararCalculoVariablesMasivo(input)
      if (respuesta.estado === 'error') {
        showToast(respuesta.mensaje, 'error')
        return
      }
      setVistaPrevia(respuesta.vistaPrevia)
    } catch {
      showToast('No fue posible generar la vista previa. Intente de nuevo.', 'error')
    } finally {
      setPreviaCargando(false)
    }
  }, [edificacionId, mesInicial, anoInicial, mesFinal, anoFinal, queCalcular, opciones, showToast])

  /**
   * Ejecución masiva por lotes: encadena invocaciones acotadas mientras el
   * servidor devuelva `continuar`, fusionando cada respuesta en el acumulado.
   */
  const ejecutar = useCallback(async () => {
    if (!edificacionId || !vistaPrevia || enCursoRef.current) return
    enCursoRef.current = true
    canceladoRef.current = false
    setEjecutando(true)
    setProcesados([])
    setResumen(null)

    const { desde, hasta } = vistaPrevia.intervalo
    const loteId = crypto.randomUUID()
    let acumulados: EjecucionLoteVariables['procesados'] = []
    let ultimoResumen: EjecucionLoteVariables['resumenParcial'] | null = null
    let falloLocal = false

    try {
      for (;;) {
        if (canceladoRef.current) break
        const respuesta = await ejecutarCalculoVariablesMasivo({
          edificacionId,
          desde,
          hasta,
          queCalcular,
          opciones,
          loteId,
        })
        if (respuesta.estado === 'error') {
          falloLocal = true
          showToast(respuesta.mensaje, 'error')
          break
        }
        // La llamada en vuelo ya escribió: su resultado se fusiona SIEMPRE.
        acumulados = mezclarProcesadosVariables(acumulados, respuesta.ejecucion.procesados)
        ultimoResumen = respuesta.ejecucion.resumenParcial
        setProcesados(acumulados)
        setResumen(ultimoResumen)
        if (canceladoRef.current) break
        if (!respuesta.ejecucion.continuar) break
      }
    } catch {
      falloLocal = true
      showToast('No fue posible ejecutar el cálculo. Intente de nuevo.', 'error')
    } finally {
      enCursoRef.current = false
      setEjecutando(false)
    }

    if (falloLocal) return
    if (canceladoRef.current) {
      showToast(
        'Ejecución detenida: lo ya calculado se conserva; vuelva a ejecutar para retomar.',
        'info'
      )
      return
    }
    if (ultimoResumen) {
      showToast(
        `Cálculo finalizado: ${ultimoResumen.calculadosDias} días, ${ultimoResumen.calculadosGde} GDE calculados; ` +
          `${ultimoResumen.fallidosDias + ultimoResumen.fallidosGde} fallidos.`,
        (ultimoResumen.fallidosDias + ultimoResumen.fallidosGde) > 0 ? 'error' : 'success'
      )
    }
  }, [edificacionId, vistaPrevia, queCalcular, opciones, showToast])

  /** Pide detener el lote: corta después de la invocación en vuelo. */
  const detener = useCallback(() => {
    canceladoRef.current = true
  }, [])

  return {
    edificacionId,
    cambiarEdificacion,
    mesInicial,
    setMesInicial,
    anoInicial,
    setAnoInicial,
    mesFinal,
    setMesFinal,
    anoFinal,
    setAnoFinal,
    queCalcular,
    setQueCalcular,
    opciones,
    setOpciones,
    vistaPrevia,
    previaCargando,
    previsualizar,
    ejecutando,
    procesados,
    resumen,
    ejecutar,
    detener,
  }
}