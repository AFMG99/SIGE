/**
 * Fixtures deterministas del Módulo 4 — Alertas de consumo inusual.
 *
 * Cubren los estados que la vista debe saber pintar: alertas nuevas de las tres
 * severidades, una leída, una descartada con nota, una edificación nunca
 * evaluada y una bandeja desactualizada (datos cambiados tras la evaluación).
 */

import type {
  AlertaVista,
  ConfigAlerta,
  EvaluacionVista,
} from '../../models/alertas'
import type { EdificacionOpcion } from '../AlertasView'

export const edificacionesAlertasDemo: EdificacionOpcion[] = [
  { id: 'edi-demo-campus', nombre: 'Campus Robledo' },
  { id: 'edi-demo-oficina', nombre: 'Oficina Central' },
  { id: 'edi-demo-nueva', nombre: 'Bloque de Aulas 12' },
]

function alerta(
  id: string,
  edificacionId: string,
  edificacionNombre: string,
  periodo: string,
  consumoKwh: number,
  bandaInf: number,
  bandaSup: number,
  desviacionPct: number,
  severidad: AlertaVista['severidad'],
  estado: AlertaVista['estado'],
  nota: string | null = null
): AlertaVista {
  const [ano, mes] = periodo.split('-').map(Number)
  return {
    id,
    edificacionId,
    edificacionNombre,
    periodo,
    mes,
    ano,
    consumoKwh,
    bandaInf,
    bandaSup,
    desviacionPct,
    direccion: 'alza',
    severidad,
    umbralPct: 10,
    umbralK: 2,
    estado,
    nota,
    actualizadoAt: '2026-01-05T15:04:00.000Z',
  }
}

export const alertasDemo: AlertaVista[] = [
  // Campus Robledo — un atípico por semestre lectivo.
  alerta('alerta-1', 'edi-demo-campus', 'Campus Robledo', '2026-03', 14820.5, 10500, 12100, 23.4, 'alta', 'nueva'),
  alerta('alerta-2', 'edi-demo-campus', 'Campus Robledo', '2026-02', 13010, 10200, 11800, 12.6, 'media', 'nueva'),
  alerta('alerta-3', 'edi-demo-campus', 'Campus Robledo', '2025-11', 11960, 9800, 11400, 7.3, 'baja', 'leida'),
  alerta(
    'alerta-4',
    'edi-demo-campus',
    'Campus Robledo',
    '2025-05',
    16740,
    10100,
    11700,
    32.1,
    'alta',
    'descartada',
    'Coincide con el montaje del laboratorio de refrigeración.'
  ),
  // Oficina Central — un solo período.
  alerta('alerta-5', 'edi-demo-oficina', 'Oficina Central', '2026-01', 4820, 3100, 3700, 18.9, 'alta', 'nueva'),
]

export const configsAlertasDemo: Record<string, ConfigAlerta> = {
  'edi-demo-campus': { pct: 10, k: 2, activo: true },
  'edi-demo-oficina': { pct: 15, k: 1.5, activo: true },
  // Bloque de Aulas 12 nunca se ha evaluado: sin fila de configuración.
}

export const evaluacionesAlertasDemo: Record<string, EvaluacionVista> = {
  'edi-demo-campus': {
    firma: 'edi=edi-demo-campus|cfg=10/2/1|fac=36/2026-01-05T15:00:00.000Z/369000|var=36/2026-01-05T15:00:00.000Z|aju=2/1500|mot=1',
    periodosEvaluables: 36,
    noEvaluables: 3,
    evaluadoEn: '2026-01-05T15:04:00.000Z',
    desactualizada: false,
  },
  'edi-demo-oficina': {
    firma: 'edi=edi-demo-oficina|cfg=15/1.5/1|fac=24/2026-01-04T09:00:00.000Z/120000|var=0/-|aju=0/0|mot=1',
    periodosEvaluables: 24,
    noEvaluables: 0,
    evaluadoEn: '2026-01-04T09:12:00.000Z',
    desactualizada: true,
  },
  'edi-demo-nueva': {
    firma: '',
    periodosEvaluables: 0,
    noEvaluables: 0,
    evaluadoEn: null,
    desactualizada: true,
  },
}
