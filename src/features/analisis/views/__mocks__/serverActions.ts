/**
 * Doble determinista de la server action del módulo de análisis para
 * Storybook y tests responsivos: la action real importa Prisma y
 * spawnea el motor Python (irrepetibles fuera de Next).
 *
 * El alias en `.storybook/main.ts` apunta
 * `@/features/analisis/controllers/analisis` a este módulo.
 *
 * Respuesta por edificación (permite ejercitar distintos estados):
 *  - `edi-demo-campus` → análisis con 2 períodos inusuales
 *  - cualquier otra    → análisis sin períodos inusuales
 */

import type { RespuestaAnalisis, SolicitudAnalisis } from '../../models/analisis'
import {
  analisisDemo,
  analisisSinAtipicosDemo,
  edificacionesAnalisisDemo,
} from '../__fixtures__/analisis'

export async function ejecutarAnalisis(
  solicitud: SolicitudAnalisis
): Promise<RespuestaAnalisis> {
  const edificacion = edificacionesAnalisisDemo.find((e) => e.id === solicitud.edificacionId)
  const base =
    solicitud.edificacionId === edificacionesAnalisisDemo[0].id
      ? analisisDemo
      : analisisSinAtipicosDemo
  return {
    ok: true,
    analisis: {
      ...base,
      nombreEdificacion: edificacion?.nombre ?? base.nombreEdificacion,
    },
  }
}
