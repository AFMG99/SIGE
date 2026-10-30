/**
 * Doble determinista de la server action del módulo de análisis para
 * Storybook y tests responsivos: la action real importa Prisma y
 * spawnea el motor Python (irrepetibles fuera de Next).
 *
 * El alias en `.storybook/main.ts` apunta
 * `@/features/analisis/controllers/analisis` a este módulo.
 *
 * Respuesta por edificación (permite ejercitar distintos estados):
 *  - `edi-demo-campus`     → análisis con 2 períodos inusuales
 *  - `edi-demo-variacion`  → golden del Anexo 1 (ahorro §8.1 no nulo)
 *  - `edi-demo-sin-modelos`→ motor antiguo sin la sección `modelos`
 *  - cualquier otra        → análisis sin períodos inusuales
 */

import type { RespuestaAnalisis, SolicitudAnalisis } from '../../models/analisis'
import type { RespuestaContextoXm, RespuestaSerieXm } from '../../models/xm'
import {
  analisisDemo,
  analisisSinAtipicosDemo,
  analisisSinModelosDemo,
  analisisVariacionDemo,
  contextoDemo,
  edificacionesAnalisisDemo,
  serieMercadoDemo,
  serieSistemaDemo,
} from '../__fixtures__/analisis'

export async function ejecutarAnalisis(
  solicitud: SolicitudAnalisis
): Promise<RespuestaAnalisis> {
  const edificacion = edificacionesAnalisisDemo.find((e) => e.id === solicitud.edificacionId)
  const base =
    solicitud.edificacionId === edificacionesAnalisisDemo[0].id
      ? analisisDemo
      : solicitud.edificacionId === 'edi-demo-variacion'
        ? analisisVariacionDemo
        : solicitud.edificacionId === 'edi-demo-sin-modelos'
          ? analisisSinModelosDemo
          : analisisSinAtipicosDemo
  return {
    ok: true,
    analisis: {
      ...base,
      nombreEdificacion: edificacion?.nombre ?? base.nombreEdificacion,
    },
  }
}

// ── Benchmark XM (alias `@/features/analisis/controllers/xm`) ──

const MENSAJE_FALLO_XM =
  'La API de XM no está disponible en este momento. Intente de nuevo más tarde; el análisis no se ve afectado.'

let falloXm: 'ninguno' | 'xm' = 'ninguno'

/**
 * Interruptor para que las stories ejerciten la degradación de XM
 * (el callout de error sin romper el análisis). Siempre restablecer.
 */
export function __setearFalloXm(fallo: 'ninguno' | 'xm'): void {
  falloXm = fallo
}

export async function cargarSerieSistemaXm(): Promise<RespuestaSerieXm> {
  if (falloXm === 'xm') return { estado: 'error', mensaje: MENSAJE_FALLO_XM }
  return serieSistemaDemo
}

export async function cargarSerieMercadoXm(): Promise<RespuestaSerieXm> {
  if (falloXm === 'xm') return { estado: 'error', mensaje: MENSAJE_FALLO_XM }
  return serieMercadoDemo
}

export async function cargarContextoXm(): Promise<RespuestaContextoXm> {
  // El contexto (interna SIGE + catálogo) no depende de la API de XM.
  return contextoDemo
}
