import React from 'react'
import {
  formatoKwh,
  formatoNumero,
  formatoPct,
  type ModeloLBEn,
  type Periodicidad,
  type ResumenAnalisis,
  type SalidaAnalisis,
} from '../../models/analisis'
import { AnalisisChart } from '../AnalisisChart'
import { ATRIBUTOS_ICONO, ChipIcon, SeccionTitulo } from './comunes'

/**
 * Submódulo Resumen: 4 tarjetas KPI globales, avisos de cobertura de la
 * serie y la gráfica de la serie histórica (con el overlay LBEn del modelo
 * elegido en el submódulo Ahorros y el modo anual de la misma periodicidad).
 */
export interface ResumenPanelProps {
  resumen: ResumenAnalisis
  salida: SalidaAnalisis
  /** Modelo de LBEn seleccionado en Ahorros (overlay punteado de la gráfica). */
  modeloActual: ModeloLBEn | null
  /** Periodicidad elegida en Ahorros: la gráfica la hereda. */
  periodicidad: Periodicidad
}

export function ResumenPanel({ resumen, salida, modeloActual, periodicidad }: ResumenPanelProps) {
  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="ui-card-stat h-full">
          <div className="flex items-center gap-2">
            <ChipIcon>
              <svg {...ATRIBUTOS_ICONO}>
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <path d="M8 2v4M16 2v4M3 10h18" />
              </svg>
            </ChipIcon>
            <p className="ui-muted text-xs">Períodos analizados</p>
          </div>
          <p className="ui-title mt-2 text-2xl tabular-nums">
            {formatoNumero(resumen.periodos, 0)}
          </p>
        </div>
        <div className="ui-card-stat h-full">
          <div className="flex items-center gap-2">
            <ChipIcon amber>
              <svg {...ATRIBUTOS_ICONO}>
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </ChipIcon>
            <p className="ui-muted text-xs">Períodos inusuales</p>
          </div>
          <p
            className={`mt-2 text-2xl font-semibold tabular-nums ${
              resumen.atipicos > 0
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {formatoNumero(resumen.atipicos, 0)}
          </p>
        </div>
        <div className="ui-card-stat h-full">
          <div className="flex items-center gap-2">
            <ChipIcon>
              <svg {...ATRIBUTOS_ICONO}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </ChipIcon>
            <p className="ui-muted text-xs">Evaluados con banda</p>
          </div>
          <p className="ui-title mt-2 text-2xl tabular-nums">
            {resumen.periodos > 0
              ? `${formatoNumero((resumen.periodos_con_banda / resumen.periodos) * 100, 0)} %`
              : '—'}
          </p>
        </div>
        <div className="ui-card-stat h-full">
          <div className="flex items-center gap-2">
            <ChipIcon>
              <svg {...ATRIBUTOS_ICONO}>
                <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
                <path d="M16 7h6v6" />
              </svg>
            </ChipIcon>
            <p className="ui-muted text-xs">Tendencia anual</p>
          </div>
          <p className="ui-title mt-2 text-2xl tabular-nums">
            {typeof salida.tendencia.variacion_pct_anual === 'number'
              ? formatoPct(salida.tendencia.variacion_pct_anual)
              : '—'}
          </p>
        </div>
      </div>

      {/* Avisos de cobertura */}
      {(salida.meses_insuficientes.length > 0 ||
        resumen.sin_calendario > 0 ||
        resumen.ajustes > 0) && (
        <div className="space-y-3">
          {salida.meses_insuficientes.length > 0 && (
            <p className="ui-callout ui-callout-warn">
              {salida.meses_insuficientes.length}{' '}
              {salida.meses_insuficientes.length === 1
                ? 'mes sin banda evaluable'
                : 'meses sin banda evaluable'}
              {' (se requieren '}
              {salida.min_valores_por_mes} facturas del mismo mes calendario): sus
              períodos aparecen como «sin banda» y no se pudieron evaluar.
            </p>
          )}
          {resumen.sin_calendario > 0 && (
            <p className="ui-callout ui-callout-info">
              {resumen.sin_calendario}{' '}
              {resumen.sin_calendario === 1
                ? 'período no tiene'
                : 'períodos no tienen'}{' '}
              datos de días lectivos. Registre las variables operativas de los bloques
              para ver el overlay del calendario académico.
            </p>
          )}
          {resumen.ajustes > 0 && (
            <p className="ui-callout ui-callout-info">
              Se aplicaron {resumen.ajustes}{' '}
              {resumen.ajustes === 1 ? 'ajuste no rutinario' : 'ajustes no rutinarios'}{' '}
              del Anexo 4 antes del análisis (períodos ya justificados por el gestor no
              se reportan como inusuales).
            </p>
          )}
        </div>
      )}

      {/* Gráfica */}
      <div className="space-y-3">
        <SeccionTitulo
          titulo="Serie histórica de consumo"
          meta={
            <span className="tabular-nums">
              kWh normalizados a 30 días · media de la serie:{' '}
              {typeof salida.estadisticos.media === 'number'
                ? formatoKwh(salida.estadisticos.media)
                : '—'}
              {modeloActual?.estado === 'disponible' && ` · LBEn: ${modeloActual.etiqueta}`}
              {periodicidad === 'ano' && ' · serie anual'}
            </span>
          }
        />
        <div className="ui-card p-5 sm:p-6">
          <AnalisisChart
            periodos={salida.periodos}
            media={salida.estadisticos.media}
            lben={modeloActual?.estado === 'disponible' ? modeloActual.lben_mensual : null}
            periodicidad={periodicidad === 'ano' ? 'ano' : 'mes'}
          />
        </div>
      </div>
    </div>
  )
}
