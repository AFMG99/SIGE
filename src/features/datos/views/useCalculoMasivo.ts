'use client'

/**
 * Estado del flujo «Cálculo de uso» (spec §6, T5).
 *
 * Un solo hook para la sección: selectores de edificación/periodo, carga de
 * la vista previa (`prepararCalculoMasivo`, solo lectura) y ejecución del
 * cálculo individual (`calcularUsoIndividual`) con su estado de progreso.
 * El loop de ejecución masiva y el recálculo explícito llegan en las tareas
 * posteriores (T6/T7); aquí solo viven los caminos que las actions de T4 ya
 * exponen.
 *
 * Toda la escritura pasa por las server actions (revalidan permiso y datos
 * en el servidor); el cliente solo maneja estado de UI y errores vía toast.
 */

import { useCallback, useState } from 'react'

import {
  calcularUsoIndividual,
  prepararCalculoMasivo,
} from '@/features/datos/controllers/calculoUso'
import type { Clasificacion, PeriodoRef, VistaPrevia } from '@/features/datos/models/calculoUso'
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

  /** Al cambiar de edificación, los resultados en pantalla ya no le pertenecen. */
  const cambiarEdificacion = useCallback((id: string) => {
    setEdificacionIdCrudo(id)
    setVistaPrevia(null)
    setResultado(null)
  }, [])

  /** Vista previa del intervalo (spec §6.2) — la action es de solo lectura. */
  const previsualizar = useCallback(async () => {
    if (!edificacionId) return
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
  }
}
