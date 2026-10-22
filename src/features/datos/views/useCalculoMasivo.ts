'use client'

/**
 * Estado del flujo «Cálculo de uso» (spec §6, T5/T6).
 *
 * Un solo hook para la sección: selectores de edificación/periodo, carga de
 * la vista previa (`prepararCalculoMasivo`, solo lectura), ejecución del
 * cálculo individual (`calcularUsoIndividual`) y el loop de ejecución masiva
 * por lotes (`ejecutarCalculoMasivo`, design §5.3): invocaciones acotadas
 * encadenadas vía `continuar`, con progreso observable y «Detener» seguro
 * (la cancelación corta DESPUÉS de la llamada en vuelo; lo ya persistido se
 * conserva).
 *
 * Toda la escritura pasa por las server actions (revalidan permiso y datos
 * en el servidor); el cliente solo maneja estado de UI y errores vía toast.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  calcularUsoIndividual,
  ejecutarCalculoMasivo,
  prepararCalculoMasivo,
} from '@/features/datos/controllers/calculoUso'
import type { ProcesadoLote } from '@/features/datos/controllers/calculoUso'
import type {
  Clasificacion,
  PeriodoRef,
  ResumenEjecucion,
  VistaPrevia,
} from '@/features/datos/models/calculoUso'
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

/** Años ofrecidos por los selectores de intervalo: actual −2 … +1. */
export const ANOS_UI = [ANO_ACTUAL - 2, ANO_ACTUAL - 1, ANO_ACTUAL, ANO_ACTUAL + 1]

/** Etiquetas en español de la clasificación BR4 (spec §6.2, columna «Estado»). */
const ETIQUETAS_CLASIFICACION: Record<Clasificacion, string> = {
  'existente-intacto': 'Existente',
  pendiente: 'Pendiente',
  desactualizado: 'Desactualizado',
  fallido: 'Fallido',
  revisar: 'Revisar',
  nuevo: 'Nuevo',
}

/** Traduce una clasificación BR4 a su etiqueta visible (fija en el test unitario). */
export function etiquetaClasificacion(clasificacion: Clasificacion): string {
  return ETIQUETAS_CLASIFICACION[clasificacion] ?? clasificacion
}

/**
 * Fusiona el acumulado de periodos atendidos con la respuesta de una nueva
 * invocación del lote (AC8/AC11): el servidor reenvía los intactos en CADA
 * llamada, así que la fusión deduplica por clave —el orden de aparición se
 * conserva y la última respuesta manda— para que el progreso nunca inflado
 * conteos ni duplique filas.
 */
export function mezclarProcesados(
  previos: ProcesadoLote[],
  nuevos: ProcesadoLote[]
): ProcesadoLote[] {
  const porClave = new Map<string, ProcesadoLote>()
  for (const p of previos) porClave.set(p.clave, p)
  for (const p of nuevos) porClave.set(p.clave, p)
  return Array.from(porClave.values())
}

/**
 * Primer periodo de la vista previa aún sin procesar, que alimenta el
 * indicador «Procesando X… (n de t)»; `null` cuando el lote terminó.
 */
export function periodoEnCurso(
  seEscribiran: string[],
  procesados: ProcesadoLote[]
): string | null {
  const atendidas = new Set(procesados.map((p) => p.clave))
  return seEscribiran.find((clave) => !atendidas.has(clave)) ?? null
}

/** Payload con `estado: 'ok'` de `calcularUsoIndividual`, inferido de la action. */
type ResultadoIndividual = Extract<
  Awaited<ReturnType<typeof calcularUsoIndividual>>,
  { estado: 'ok' }
>

export function useCalculoMasivo() {
  const { showToast } = useToast()

  // Selectores (spec §6.1): edificación siempre; individual y de intervalo
  // se habilitan al elegirla.
  const [edificacionId, setEdificacionIdCrudo] = useState('')
  const [mes, setMes] = useState(() => new Date().getMonth() + 1)
  const [ano, setAno] = useState(ANO_ACTUAL)
  const [mesInicial, setMesInicial] = useState(() => new Date().getMonth() + 1)
  const [anoInicial, setAnoInicial] = useState(ANO_ACTUAL)
  const [mesFinal, setMesFinal] = useState(() => new Date().getMonth() + 1)
  const [anoFinal, setAnoFinal] = useState(ANO_ACTUAL)

  // Resultados en pantalla.
  const [vistaPrevia, setVistaPrevia] = useState<VistaPrevia | null>(null)
  const [previaCargando, setPreviaCargando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoIndividual | null>(null)
  const [calculando, setCalculando] = useState(false)

  // Ejecución masiva (T6): lote en curso, acumulado fusionado y resumen.
  const [ejecutando, setEjecutando] = useState(false)
  const [procesados, setProcesados] = useState<ProcesadoLote[]>([])
  const [resumen, setResumen] = useState<ResumenEjecucion | null>(null)
  /** Cancelación pedida por «Detener»: corta tras la llamada en vuelo. */
  const canceladoRef = useRef(false)
  /** Guarda síncrona contra doble click antes del siguiente render. */
  const enCursoRef = useRef(false)

  // Al desmontar (cambio de sección/ruta) se cancela el lote: la petición en
  // vuelo se fusiona, pero NO se dispara ninguna siguiente invocación. Sin
  // esto, desmontar a mitad de lote seguiría escribiendo en el servidor.
  useEffect(() => {
    return () => {
      canceladoRef.current = true
    }
  }, [])

  /** Al cambiar de edificación, los resultados en pantalla ya no le pertenecen. */
  const cambiarEdificacion = useCallback((id: string) => {
    canceladoRef.current = true
    setEdificacionIdCrudo(id)
    setVistaPrevia(null)
    setResultado(null)
    setProcesados([])
    setResumen(null)
  }, [])

  /** Vista previa del intervalo (spec §6.2) — la action es de solo lectura. */
  const previsualizar = useCallback(async () => {
    if (!edificacionId) return
    // Un nuevo preview reconstruye el alcance: el lote en curso ya no aplica.
    canceladoRef.current = true
    setProcesados([])
    setResumen(null)
    setPreviaCargando(true)
    setVistaPrevia(null)
    try {
      const desde: PeriodoRef = { mes: mesInicial, ano: anoInicial }
      const hasta: PeriodoRef = { mes: mesFinal, ano: anoFinal }
      const respuesta = await prepararCalculoMasivo(edificacionId, desde, hasta)
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
  }, [edificacionId, mesInicial, anoInicial, mesFinal, anoFinal, showToast])

  /** Cálculo individual del periodo elegido (spec §5 «Cálculo individual»). */
  const calcular = useCallback(async () => {
    if (!edificacionId) return
    setCalculando(true)
    setResultado(null)
    const clave = `${ano}-${String(mes).padStart(2, '0')}`
    try {
      const respuesta = await calcularUsoIndividual(edificacionId, mes, ano)
      if (respuesta.estado === 'error') {
        showToast(respuesta.mensaje, 'error')
        return
      }
      setResultado(respuesta)
      showToast(
        respuesta.conservado
          ? `El periodo ${clave} ya estaba calculado y se conservó sin cambios.`
          : `Periodo ${clave} calculado: ${respuesta.detalle.length} equipo(s).`,
        'success'
      )
    } catch {
      showToast('No fue posible calcular las horas de uso. Intente de nuevo.', 'error')
    } finally {
      setCalculando(false)
    }
  }, [edificacionId, mes, ano, showToast])

  /**
   * Ejecución masiva por lotes (AC6/AC8/AC11): encadena invocaciones
   * acotadas de `ejecutarCalculoMasivo` mientras el servidor devuelva
   * `continuar`, fusionando cada respuesta en el acumulado. «Detener» es
   * seguro: solo corta entre llamadas, nunca a media escritura, y lo ya
   * persistido se conserva (la retomada la decide el servidor).
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
    let acumulados: ProcesadoLote[] = []
    let ultimoResumen: ResumenEjecucion | null = null
    let falloLocal = false

    try {
      for (;;) {
        if (canceladoRef.current) break
        const respuesta = await ejecutarCalculoMasivo({ edificacionId, desde, hasta, loteId })
        if (respuesta.estado === 'error') {
          falloLocal = true
          showToast(respuesta.mensaje, 'error')
          break
        }
        // La llamada en vuelo ya escribió: su resultado se fusiona SIEMPRE,
        // incluso si pidieron detener mientras estaba en curso.
        acumulados = mezclarProcesados(acumulados, respuesta.ejecucion.procesados)
        ultimoResumen = respuesta.ejecucion.resumenParcial
        setProcesados(acumulados)
        setResumen(ultimoResumen)
        if (canceladoRef.current) break
        if (!respuesta.ejecucion.continuar) break
      }
    } catch {
      falloLocal = true
      showToast('No fue posible calcular las horas de uso. Intente de nuevo.', 'error')
    } finally {
      enCursoRef.current = false
      setEjecutando(false)
    }

    if (falloLocal) return
    if (canceladoRef.current) {
      showToast(
        'Ejecución detenida: los periodos ya calculados se conservan; vuelva a ejecutar para retomarlos.',
        'info'
      )
      return
    }
    if (ultimoResumen) {
      showToast(
        `Cálculo masivo finalizado: ${ultimoResumen.calculados} calculado(s), ` +
          `${ultimoResumen.conservados} conservado(s), ${ultimoResumen.fallidos} fallido(s), ` +
          `${ultimoResumen.revisar} en revisión.`,
        ultimoResumen.fallidos > 0 ? 'error' : 'success'
      )
    }
  }, [edificacionId, vistaPrevia, showToast])

  /** Pide detener el lote: corta después de la invocación en vuelo. */
  const detener = useCallback(() => {
    canceladoRef.current = true
  }, [])

  return {
    edificacionId,
    cambiarEdificacion,
    mes,
    setMes,
    ano,
    setAno,
    mesInicial,
    setMesInicial,
    anoInicial,
    setAnoInicial,
    mesFinal,
    setMesFinal,
    anoFinal,
    setAnoFinal,
    vistaPrevia,
    previaCargando,
    previsualizar,
    resultado,
    calculando,
    calcular,
    ejecutando,
    procesados,
    resumen,
    ejecutar,
    detener,
  }
}
