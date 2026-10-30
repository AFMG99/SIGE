/**
 * Doble determinista de las server actions del módulo de alertas para
 * Storybook y los tests responsivos: las acciones reales importan Prisma y
 * ejecutan el motor estadístico en Python (irrepetibles fuera de Next).
 *
 * El alias de `.storybook/main.ts` apunta `@/features/alertas/controllers/alertas`
 * a este módulo.
 */

import type {
  CambiarEstadoAlerta,
  ConfigAlerta,
} from '../../models/alertas'
import type {
  ResultadoCambioEstado,
  ResultadoConfigAlerta,
  ResultadoGenerarAlertas,
} from '../../controllers/alertas'

let contador = 0

export async function generarAlertas(solicitud: {
  edificacionId: string
}): Promise<ResultadoGenerarAlertas> {
  contador += 1
  return {
    estado: 'ok',
    mensaje: `Bandeja recalculada (${contador}): 3 alertas vigentes, 1 retirada.`,
    creadas: 1,
    actualizadas: 2,
    eliminadas: 1,
    periodosEvaluables: 36,
    noEvaluables: 3,
    evaluadoEn: '2026-01-05T15:04:00.000Z',
  }
}

export async function cambiarEstadoAlerta(
  datos: CambiarEstadoAlerta
): Promise<ResultadoCambioEstado> {
  return { estado: 'ok', mensaje: `Alerta ${datos.id} → ${datos.estado} (simulado).` }
}

export async function guardarConfigAlerta(
  datos: ConfigAlerta & { edificacionId: string }
): Promise<ResultadoConfigAlerta> {
  return {
    estado: 'ok',
    mensaje: 'Umbral guardado (simulado).',
    config: { pct: datos.pct, k: datos.k, activo: datos.activo },
  }
}
