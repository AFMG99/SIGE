import React from 'react'
import {
  etiquetaPeriodo,
  formatoNumero,
  formatoPct,
  UMBRAL_K_MAX,
  UMBRAL_K_MIN,
  UMBRAL_K_PASO,
  UMBRAL_PCT_MAX,
  UMBRAL_PCT_MIN,
  type EstadoSimulador,
  type SimulacionUmbral,
} from '../../models/analisis'
import { CLASE_BADGE, SeccionTitulo } from './comunes'

/**
 * Simulador de umbral (exploratorio, issue #79): deja mover los dos
 * umbrales de la §7.5.1 —porcentaje de la ec. 3 y múltiplo k de la
 * ec. 4-5— y proyecta cuántos períodos quedarían señalados, sin invocar
 * el motor ni alterar la detección normativa. La simulación es una capa
 * sobre la serie YA depurada: así se declara en el copy y con el
 * callout, porque el entregable regulatorio es el resultado normativo.
 */
export interface SimuladorUmbralProps {
  simulacion: SimulacionUmbral
  /** Conteo NORMATIVO del motor: la cifra oficial jamás se reemplaza. */
  atipicosNormativos: number
  /** Mínimo de muestras del mes para la ec. 4-5 (lo manda el motor). */
  minDatosIc: number
  sim: EstadoSimulador
  onSimChange: (parcial: Partial<EstadoSimulador>) => void
}

export function SimuladorUmbral({
  simulacion,
  atipicosNormativos,
  minDatosIc,
  sim,
  onSimChange,
}: SimuladorUmbralProps) {
  const { entrarian, saldrian } = simulacion
  const sinCambios = entrarian.length === 0 && saldrian.length === 0

  return (
    <section
      aria-labelledby="titulo-simulador-umbral"
      className="ui-card space-y-4 p-5 sm:p-6"
    >
      <SeccionTitulo
        id="titulo-simulador-umbral"
        titulo="Simulador de umbral"
        meta="Exploratorio — la detección normativa no cambia"
      />

      <p className="ui-muted max-w-3xl text-xs leading-relaxed">
        Mueva el umbral para proyectar cuántos períodos quedarían señalados con otro
        criterio. La detección normativa de la Resolución UPME 0016 —±10 % (ec. 3) y
        ±2·DesvEst (ec. 4-5)— sigue siendo la que reporta el análisis; esta simulación
        opera sobre la serie ya depurada y no vuelve a ejecutar la depuración.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="ui-field">
          <label htmlFor="sim-pct" className="ui-label flex items-center gap-2">
            Umbral porcentual (ec. 3)
            <code className="ui-chip">±{sim.pct} %</code>
          </label>
          <input
            id="sim-pct"
            type="range"
            min={UMBRAL_PCT_MIN}
            max={UMBRAL_PCT_MAX}
            step={1}
            value={sim.pct}
            aria-valuetext={`± ${sim.pct} por ciento`}
            onChange={(e) => onSimChange({ pct: Number(e.target.value) })}
            className="h-10 w-full max-w-xs accent-uv-forest focus-ring"
          />
          <p className="ui-muted mt-1 text-xs">
            Aplica a los meses con menos de {minDatosIc} muestras.
          </p>
        </div>
        <div className="ui-field">
          <label htmlFor="sim-k" className="ui-label flex items-center gap-2">
            Múltiplo de DesvEst (ec. 4-5)
            <code className="ui-chip">±{formatoNumero(sim.k, 1)} σ</code>
          </label>
          <input
            id="sim-k"
            type="range"
            min={UMBRAL_K_MIN}
            max={UMBRAL_K_MAX}
            step={UMBRAL_K_PASO}
            value={sim.k}
            aria-valuetext={`± ${formatoNumero(sim.k, 1)} desviaciones estándar`}
            onChange={(e) => onSimChange({ k: Number(e.target.value) })}
            className="h-10 w-full max-w-xs accent-uv-forest focus-ring"
          />
          <p className="ui-muted mt-1 text-xs">
            Aplica a los meses con {minDatosIc} o más muestras (el motor usa 2,0 σ).
          </p>
        </div>
      </div>

      <label className="inline-flex min-h-10 items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          id="sim-activo"
          type="checkbox"
          checked={sim.activo}
          onChange={(e) => onSimChange({ activo: e.target.checked })}
          className="size-4 accent-uv-forest focus-ring"
        />
        Superponer la banda simulada a la gráfica
      </label>

      {simulacion.evaluados === 0 ? (
        <div className="ui-empty py-6">
          <p className="ui-title text-sm">Sin meses con banda evaluable</p>
          <p className="max-w-md text-xs">
            Esta serie no tiene meses con media construible, así que no hay base sobre
            la cual proyectar el umbral simulado.
          </p>
        </div>
      ) : (
        <>
          <div className="ui-card-stat">
            <p className="ui-muted text-xs">Períodos señalados con el umbral simulado</p>
            <p
              className={`mt-2 text-2xl font-semibold tabular-nums ${
                simulacion.atipicosSim > 0
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              {formatoNumero(simulacion.atipicosSim, 0)}
            </p>
            <p className="ui-muted mt-1 text-xs tabular-nums">
              Normativo: {atipicosNormativos} · {simulacion.evaluados} períodos evaluados
              con banda
            </p>
          </div>

          {sinCambios ? (
            <p className="ui-muted text-xs">
              Sin cambios frente al análisis normativo con este umbral.
            </p>
          ) : (
            <div className="space-y-3">
              {entrarian.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                    Entrarían como inusuales (+{entrarian.length})
                  </p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {entrarian.map((p) => (
                      <li
                        key={`${p.ano}-${p.mes}`}
                        className={`${CLASE_BADGE} border-purple-600/40 bg-purple-50 text-purple-700 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-300`}
                      >
                        {etiquetaPeriodo(p.mes, p.ano)}
                        {typeof p.desviacion_pct === 'number'
                          ? ` · ${formatoPct(p.desviacion_pct)}`
                          : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {saldrian.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Dejarían de ser inusuales (−{saldrian.length})
                  </p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {saldrian.map((p) => (
                      <li
                        key={`${p.ano}-${p.mes}`}
                        className={`${CLASE_BADGE} border-gray-300 bg-gray-100 text-gray-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300`}
                      >
                        {etiquetaPeriodo(p.mes, p.ano)}
                        {typeof p.desviacion_pct === 'number'
                          ? ` · ${formatoPct(p.desviacion_pct)}`
                          : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <p className="ui-callout ui-callout-info">
        Simulación exploratoria sobre la serie ya depurada: sirve para dimensionar la
        sensibilidad de la detección, no para reemplazar el resultado normativo del
        análisis ni para recalcular la línea base.
      </p>
    </section>
  )
}
