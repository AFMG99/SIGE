import React from 'react'
import {
  etiquetaPeriodo,
  formatoKwh,
  formatoNumero,
  formatoPct,
  PRECISION_TEXTO,
  TEXTO_DIRECCION,
  type NivelGestion,
  type ResumenAnalisis,
  type SalidaAnalisis,
} from '../../models/analisis'
import { ATRIBUTOS_ICONO, BadgeCalendario, ChipIcon, CLASE_BADGE, SeccionTitulo } from './comunes'

/**
 * Submódulo Patrones de consumo: indicadores de gestión por nivel
 * (KPIs ahorro/elevado/inusuales del nivel elegido en «Configuración
 * del análisis») y la tabla de períodos inusuales organizada para la
 * interpretación (issue #79): fecha, consumo, banda, desviación,
 * señal y contexto académico, con resaltado discreto —el ámbar se
 * concentra en la señal y la desviación, no en la fila entera— y la
 * explicación normativa en una fila expandible por período.
 */
export interface PatronesPanelProps {
  resumen: ResumenAnalisis
  salida: SalidaAnalisis
  nivel: NivelGestion | null
}

export function PatronesPanel({ resumen, salida, nivel }: PatronesPanelProps) {
  // Período con la explicación expandida (null = ninguna).
  const [explicacionDe, setExplicacionDe] = React.useState<string | null>(null)
  const inusuales = salida.periodos.filter((p) => p.es_atipico)

  return (
    <div className="space-y-6">
      {/* Indicadores de gestión por nivel (KPIs ahorro/elevado/inusuales) */}
      {nivel && (
        <div className="ui-card space-y-4 p-5 sm:p-6">
          <SeccionTitulo
            titulo="Ahorro y consumo elevado"
            meta={
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {nivel.nombre}
                </span>
                <span
                  className={
                    nivel.precision === 'exacto'
                      ? `${CLASE_BADGE} border-emerald-600/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300`
                      : `${CLASE_BADGE} border-sky-600/40 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300`
                  }
                >
                  {PRECISION_TEXTO[nivel.tipo]}
                </span>
              </span>
            }
          />

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Ahorro frente a la línea base guardada */}
            <div className="ui-card-stat">
              <div className="flex items-center gap-2">
                <ChipIcon>
                  <svg {...ATRIBUTOS_ICONO}>
                    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                  </svg>
                </ChipIcon>
                <p className="ui-muted text-xs">Ahorro vs línea base</p>
              </div>
              {nivel.ahorro.ahorroPct !== null ? (
                <>
                  <p
                    className={`mt-2 text-2xl font-semibold tabular-nums ${
                      nivel.ahorro.ahorroPct < 0
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {formatoPct(nivel.ahorro.ahorroPct)}
                  </p>
                  <p className="ui-muted mt-1 text-xs tabular-nums">
                    {formatoNumero(nivel.ahorro.ahorroKwh ?? 0, 0)} kWh/mes vs{' '}
                    {formatoNumero(nivel.ahorro.lbKwh ?? 0, 0)} · {nivel.ahorro.lbModelo}
                  </p>
                  {nivel.ahorro.lbCobertura && (
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                      {nivel.ahorro.lbCobertura}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                  {nivel.ahorro.nota ?? 'Sin línea base para comparar.'}
                </p>
              )}
            </div>

            {/* Consumo elevado: por encima de la banda superior del mes */}
            <div className="ui-card-stat">
              <div className="flex items-center gap-2">
                <ChipIcon amber={nivel.elevado.meses > 0}>
                  <svg {...ATRIBUTOS_ICONO}>
                    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </ChipIcon>
                <p className="ui-muted text-xs">Consumo elevado</p>
              </div>
              <p
                className={`mt-2 text-2xl font-semibold tabular-nums ${
                  nivel.elevado.meses > 0
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {formatoNumero(nivel.elevado.meses, 0)}
              </p>
              <p className="ui-muted mt-1 text-xs">
                {nivel.elevado.meses === 1
                  ? 'mes por encima de la banda superior'
                  : 'meses por encima de la banda superior'}
              </p>
              {nivel.elevado.maximoPeriodo && nivel.elevado.maximoKwh !== null && (
                <p className="mt-1 text-xs tabular-nums text-gray-600 dark:text-gray-300">
                  Máximo:{' '}
                  {etiquetaPeriodo(
                    Number(nivel.elevado.maximoPeriodo.slice(5, 7)),
                    Number(nivel.elevado.maximoPeriodo.slice(0, 4))
                  )}{' '}
                  · {formatoKwh(nivel.elevado.maximoKwh)}
                </p>
              )}
            </div>

            {/* Períodos inusuales ya escala al nivel seleccionado */}
            <div className="ui-card-stat">
              <div className="flex items-center gap-2">
                <ChipIcon amber={nivel.inusuales.cantidad > 0}>
                  <svg {...ATRIBUTOS_ICONO}>
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                </ChipIcon>
                <p className="ui-muted text-xs">Períodos inusuales del nivel</p>
              </div>
              <p
                className={`mt-2 text-2xl font-semibold tabular-nums ${
                  nivel.inusuales.cantidad > 0
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {formatoNumero(nivel.inusuales.cantidad, 0)}
              </p>
              <p className="ui-muted mt-1 text-xs tabular-nums">
                {formatoKwh(nivel.inusuales.kwh)} en el período
              </p>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                El conteo es igual en todos los niveles: la detección es por mes
                calendario, invariante a la escala.
              </p>
            </div>
          </div>

          <p className="ui-muted text-xs tabular-nums">
            Consumo promedio del nivel: {formatoKwh(nivel.consumoPromedioKwh)}/mes (30 d)
            {nivel.share !== null && ` · share ${formatoNumero(nivel.share * 100, 1)} %`}
            {nivel.elevado.variacionPctAnual !== null &&
              ` · tendencia ${formatoPct(nivel.elevado.variacionPctAnual)}`}
          </p>
        </div>
      )}

      {/* Períodos inusuales */}
      <div className="space-y-3">
        <SeccionTitulo
          titulo="Períodos inusuales"
          meta={
            <>
              {resumen.atipicos_alza} en alza · {resumen.atipicos_caida} en caída ·{' '}
              {resumen.en_lectivo} en período lectivo · {resumen.en_vacaciones} en
              vacaciones
            </>
          }
        />

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
                  <th scope="col">Contexto académico</th>
                  <th scope="col">Explicación</th>
                </tr>
              </thead>
              <tbody>
                {inusuales.map((p) => {
                  const clave = `${p.ano}-${p.mes}`
                  const etiqueta = etiquetaPeriodo(p.mes, p.ano)
                  const abierta = explicacionDe === clave
                  return (
                    <React.Fragment key={clave}>
                      {/* Resaltado discreto: el acento vive en la celda
                          inicial y en la señal, no en la fila entera. */}
                      <tr>
                        <td className="whitespace-nowrap border-l-4 border-amber-500/70 pl-3 font-medium dark:border-amber-400/70">
                          {etiqueta}
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
                        <td>
                          <button
                            type="button"
                            aria-expanded={abierta}
                            aria-controls={`explicacion-${clave}`}
                            aria-label={`${abierta ? 'Ocultar' : 'Ver'} explicación de ${etiqueta}`}
                            onClick={() => setExplicacionDe(abierta ? null : clave)}
                            className="ui-btn ui-btn-ghost ui-btn-sm focus-ring whitespace-nowrap"
                          >
                            {abierta ? 'Ocultar' : 'Ver explicación'}
                          </button>
                        </td>
                      </tr>
                      {abierta && p.explicacion && (
                        <tr
                          id={`explicacion-${clave}`}
                          className="bg-gray-50 dark:bg-slate-900/40"
                        >
                          <td colSpan={7} className="text-xs leading-relaxed">
                            <span className="font-medium">Explicación estadística:</span>{' '}
                            {p.explicacion}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
