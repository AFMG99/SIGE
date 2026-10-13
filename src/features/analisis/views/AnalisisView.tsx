'use client'

import React from 'react'
import { ListboxSelect, type ListboxOption } from '@/shared/views/ui/ListboxSelect'
import { ejecutarAnalisis } from '@/features/analisis/controllers/analisis'
import {
  etiquetaPeriodo,
  formatoKwh,
  formatoNumero,
  formatoPct,
  TEXTO_CALENDARIO,
  TEXTO_DIRECCION,
  type AnalisisResultado,
  type PeriodoAnalizado,
} from '../models/analisis'
import { AnalisisChart } from './AnalisisChart'

/**
 * Módulo 3 — Análisis estadístico y detección de patrones (HU-07 esc. 2,
 * HU-04 esc. 2).
 *
 * Todo dato entra por props; el análisis se ejecuta bajo demanda vía
 * server action (guard `consumption`/`analyze` en el servidor) y no se
 * persiste. El selector es por EDIFICACIÓN: la factura es el dato medido
 * (no un share estimado) y la detección por mes calendario es invariante
 * a la escala, así que el patrón temporal es el mismo que cualquier
 * reparto lineal del bloque produciría.
 */

const CLASE_BADGE =
  'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium'

function BadgeCalendario({ periodo }: { periodo: PeriodoAnalizado }) {
  const clases =
    periodo.calendario === 'lectivo'
      ? 'border-emerald-600/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
      : periodo.calendario === 'vacaciones'
        ? 'border-sky-600/40 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300'
        : 'border-gray-300 bg-gray-100 text-gray-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
  return (
    <span className={`${CLASE_BADGE} ${clases}`}>
      {TEXTO_CALENDARIO[periodo.calendario]}
      {typeof periodo.dias_lectivos === 'number' ? ` · ${periodo.dias_lectivos} d` : ''}
    </span>
  )
}

export interface AnalisisViewProps {
  edificaciones: { id: string; nombre: string }[]
  /** false = puede consultar la página pero no ejecutar el análisis. */
  puedeAnalizar: boolean
}

export function AnalisisView({ edificaciones, puedeAnalizar }: AnalisisViewProps) {
  const [edificacionId, setEdificacionId] = React.useState(
    edificaciones.length === 1 ? edificaciones[0].id : ''
  )
  const [resultado, setResultado] = React.useState<AnalisisResultado | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const opciones: ListboxOption[] = edificaciones.map((e) => ({
    value: e.id,
    label: e.nombre,
  }))

  const analizar = React.useCallback(async () => {
    if (!edificacionId) {
      setError('Seleccione una edificación para ejecutar el análisis.')
      return
    }
    setCargando(true)
    setError(null)
    try {
      const respuesta = await ejecutarAnalisis({ edificacionId })
      if (respuesta.ok) setResultado(respuesta.analisis)
      else {
        setResultado(null)
        setError(respuesta.error)
      }
    } catch {
      setResultado(null)
      setError('No se pudo ejecutar el análisis. Intente nuevamente.')
    } finally {
      setCargando(false)
    }
  }, [edificacionId])

  const salida = resultado?.salida
  const resumen = salida?.resumen

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ui-title text-2xl">Análisis estadístico y patrones</h1>
        <p className="ui-muted mt-1 max-w-3xl">
          Señala las épocas de consumo inusual del histórico completo de facturas y las
          relaciona con el calendario académico. Cada período se evalúa contra la banda de
          confianza de su mes (±10 %, ec. 3; ±2·DesvEst, ec. 4-5 cuando hay 10 o más
          muestras del mes) según la Resolución UPME 0016 de 2024.
        </p>
      </div>

      {/* Controles */}
      <div className="ui-card space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="ui-field min-w-0 flex-1">
            <label htmlFor="analisis-edificacion" className="ui-label">
              Edificación
            </label>
            <ListboxSelect
              id="analisis-edificacion"
              value={edificacionId}
              onChange={setEdificacionId}
              options={opciones}
              placeholder="— Seleccione una edificación —"
              disabled={!puedeAnalizar || cargando}
              className="ui-input min-h-10 w-full"
            />
          </div>
          <button
            type="button"
            className="ui-btn ui-btn-primary focus-ring w-full sm:w-auto"
            onClick={analizar}
            disabled={!puedeAnalizar || cargando || !edificacionId}
          >
            {cargando ? 'Analizando…' : 'Ejecutar análisis'}
          </button>
        </div>

        {!puedeAnalizar && (
          <p className="ui-callout ui-callout-info">
            Su rol puede consultar este módulo, pero ejecutar análisis requiere el permiso
            «Analizar consumo» (gestor energético o permiso personalizado).
          </p>
        )}
      </div>

      {error && (
        <p className="ui-callout ui-callout-danger" role="alert">
          {error}
        </p>
      )}

      {/* Estado inicial */}
      {!resultado && !error && (
        <div className="ui-empty py-12">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 3v18h18" />
            <path d="m7 15 4-6 4 3 5-8" />
          </svg>
          <p className="ui-title text-sm">Sin análisis ejecutado</p>
          <p className="max-w-md text-xs">
            Seleccione una edificación y ejecute el análisis para ver la serie histórica, los
            períodos inusuales y su relación con el calendario académico. No se guarda
            información: el análisis se calcula bajo demanda.
          </p>
        </div>
      )}

      {/* Resultado */}
      {salida && resumen && resultado && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="ui-title text-sm">{resultado.nombreEdificacion}</h2>
            <p className="ui-muted text-xs">
              {resultado.desde} → {resultado.hasta} · calculado el{' '}
              {new Date(resultado.calculadoEn).toLocaleString('es-CO', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'America/Bogota',
              })}
            </p>
          </div>

          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="ui-stat">
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {formatoNumero(resumen.periodos, 0)}
              </p>
              <p className="ui-muted mt-0.5 text-xs">Períodos analizados</p>
            </div>
            <div className="ui-stat">
              <p
                className={`text-xl font-semibold ${
                  resumen.atipicos > 0
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {formatoNumero(resumen.atipicos, 0)}
              </p>
              <p className="ui-muted mt-0.5 text-xs">Períodos inusuales</p>
            </div>
            <div className="ui-stat">
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {resumen.periodos > 0
                  ? `${formatoNumero((resumen.periodos_con_banda / resumen.periodos) * 100, 0)} %`
                  : '—'}
              </p>
              <p className="ui-muted mt-0.5 text-xs">Evaluados con banda</p>
            </div>
            <div className="ui-stat">
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {typeof salida.tendencia.variacion_pct_anual === 'number'
                  ? formatoPct(salida.tendencia.variacion_pct_anual)
                  : '—'}
              </p>
              <p className="ui-muted mt-0.5 text-xs">Tendencia anual</p>
            </div>
          </div>

          {/* Avisos de cobertura */}
          {salida.meses_insuficientes.length > 0 && (
            <p className="ui-callout ui-callout-warn">
              {salida.meses_insuficientes.length}{' '}
              {salida.meses_insuficientes.length === 1
                ? 'mes sin banda evaluable'
                : 'meses sin banda evaluable'}
              {' (se requieren '}
              {salida.min_valores_por_mes} facturas del mismo mes calendario): sus períodos
              aparecen como «sin banda» y no se pudieron evaluar.
            </p>
          )}
          {resumen.sin_calendario > 0 && (
            <p className="ui-callout ui-callout-info">
              {resumen.sin_calendario}{' '}
              {resumen.sin_calendario === 1
                ? 'período no tiene'
                : 'períodos no tienen'}{' '}
              datos de días lectivos. Registre las variables operativas de los bloques para
              ver el overlay del calendario académico.
            </p>
          )}
          {resumen.ajustes > 0 && (
            <p className="ui-callout ui-callout-info">
              Se aplicaron {resumen.ajustes}{' '}
              {resumen.ajustes === 1 ? 'ajuste no rutinario' : 'ajustes no rutinarios'} del
              Anexo 4 antes del análisis (períodos ya justificados por el gestor no se
              reportan como inusuales).
            </p>
          )}

          {/* Gráfica */}
          <div className="ui-card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="ui-title text-sm">Serie histórica de consumo</h3>
              <p className="ui-muted text-xs">
                kWh normalizados a 30 días · media de la serie:{' '}
                {typeof salida.estadisticos.media === 'number'
                  ? formatoKwh(salida.estadisticos.media)
                  : '—'}
              </p>
            </div>
            <AnalisisChart periodos={salida.periodos} media={salida.estadisticos.media} />
          </div>

          {/* Períodos inusuales */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="ui-title text-sm">Períodos inusuales</h3>
              <p className="ui-muted text-xs">
                {resumen.atipicos_alza} en alza · {resumen.atipicos_caida} en caída ·{' '}
                {resumen.en_lectivo} en período lectivo · {resumen.en_vacaciones} en
                vacaciones
              </p>
            </div>

            {resumen.atipicos === 0 ? (
              <div className="ui-empty py-10">
                <p className="ui-title text-sm">Sin períodos inusuales</p>
                <p className="max-w-md text-xs">
                  Todos los períodos con banda evaluada quedaron dentro del rango esperado de
                  su mes calendario.
                </p>
              </div>
            ) : (
              <div className="ui-table-shell">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th scope="col">Período</th>
                      <th scope="col">Consumo</th>
                      <th scope="col">Banda del mes</th>
                      <th scope="col">Desviación</th>
                      <th scope="col">Señal</th>
                      <th scope="col">Calendario</th>
                      <th scope="col">Explicación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salida.periodos
                      .filter((p) => p.es_atipico)
                      .map((p) => (
                        <tr
                          key={`${p.ano}-${p.mes}`}
                          className="bg-amber-50/70 dark:bg-amber-950/25"
                        >
                          <td className="whitespace-nowrap font-medium">
                            {etiquetaPeriodo(p.mes, p.ano)}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums">
                            {formatoKwh(p.consumo_kwh)}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums">
                            {p.banda_inf !== null && p.banda_sup !== null
                              ? `${formatoNumero(p.banda_inf, 0)} – ${formatoNumero(p.banda_sup, 0)} kWh`
                              : '—'}
                          </td>
                          <td className="whitespace-nowrap text-right font-medium tabular-nums text-amber-700 dark:text-amber-300">
                            {typeof p.desviacion_pct === 'number'
                              ? formatoPct(p.desviacion_pct)
                              : '—'}
                          </td>
                          <td className="whitespace-nowrap">
                            <span
                              className={`${CLASE_BADGE} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300`}
                            >
                              {p.direccion === 'alza' ? '↑' : '↓'}{' '}
                              {p.direccion ? TEXTO_DIRECCION[p.direccion] : ''}
                            </span>
                          </td>
                          <td>
                            <BadgeCalendario periodo={p} />
                          </td>
                          <td className="min-w-72 text-xs font-normal">
                            {p.explicacion}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
