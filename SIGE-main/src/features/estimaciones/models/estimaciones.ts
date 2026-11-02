export type ModeloEstimacion = 'ARIMA' | 'MA' | 'SES'

export interface ParametrosArima { p?: number; d?: number; q?: number }
export interface ParametrosMa { ventana?: number }
export interface ParametrosSes { alpha?: number }

export interface ProyeccionPeriodo {
  periodo: string   // 'YYYY-MM'
  kwh: number
  lower: number
  upper: number
}

export interface ResultadoEstimacion {
  ok: boolean
  modelo: ModeloEstimacion
  parametros_usados: ParametrosArima | ParametrosMa | ParametrosSes
  horizonte: number
  meses_historico: number
  periodo_base: string
  advertencias: string | null
  mape: number | null
  proyecciones: ProyeccionPeriodo[]
}

export interface EstimacionGuardada {
  id: string
  edificacionId: string
  edificacionNombre: string
  modelo: ModeloEstimacion
  horizonte: number
  periodoBase: string
  mesesHistorico: number
  mape: number | null
  advertencias: string | null
  resultados: ProyeccionPeriodo[]
  creadoEn: string
}

export function validarHorizonte(h: unknown): h is number {
  return typeof h === 'number' && Number.isInteger(h) && h >= 1 && h <= 24
}

export const MODELO_LABELS: Record<ModeloEstimacion, string> = {
  ARIMA: 'ARIMA (AutoRegresivo)',
  MA: 'Medias Móviles',
  SES: 'Suavizamiento Exponencial',
}