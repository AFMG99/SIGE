import React from 'react'
import { formatoKwh, formatoPct } from '../../models/analisis'
import {
  URLS_XM,
  type RespuestaContextoXm,
  type RespuestaSerieXm,
} from '../../models/xm'
import { CLASE_BADGE, fechaCorta, SeccionTitulo, TarjetaSerieXm } from './comunes'

/**
 * Submódulo Comparativo con jerarquía revisada (issue #79): PRIMERO la
 * tendencia interna entre edificaciones SIGE —los datos propios son la
 * señal principal—, DESPUÉS la referencia externa XM en tarjetas
 * secundarias con su advertencia de alcance, y por último el catálogo
 * citable «Datos y documentos XM» colapsado en un `<details>` (los
 * enlaces de fuente quedan visibles siempre). Todo llega crudo por
 * props (el shell orquesta la carga en paralelo).
 */
export interface ComparativoPanelProps {
  serieSistema: RespuestaSerieXm | null
  serieMercado: RespuestaSerieXm | null
  contexto: RespuestaContextoXm | null
  benchmarkCargando: boolean
  /** Id de la edificación analizada: resalta su fila en la comparación interna. */
  edificacionId: string
}

export function ComparativoPanel({
  serieSistema,
  serieMercado,
  contexto,
  benchmarkCargando,
  edificacionId,
}: ComparativoPanelProps) {
  const respuestasSerie: (RespuestaSerieXm | null)[] = [serieSistema, serieMercado]
  const seriesOk = respuestasSerie.filter(
    (r): r is Extract<RespuestaSerieXm, { estado: 'ok' }> => r?.estado === 'ok'
  )
  const erroresSerie = respuestasSerie.filter(
    (r): r is Extract<RespuestaSerieXm, { estado: 'error' }> => r?.estado === 'error'
  )
  const comparacion = contexto?.estado === 'ok' ? contexto.contexto.comparacionInterna : null
  const catalogo = contexto?.estado === 'ok' ? contexto.contexto.catalogo : []
  const fechaConsulta = contexto?.estado === 'ok' ? fechaCorta(contexto.contexto.fechaConsulta) : null

  return (
    <div className="space-y-6">
      {/* 1. Señal principal: los datos internos de SIGE */}
      <section
        aria-labelledby="titulo-comparacion-interna"
        className="ui-card space-y-4 p-5 sm:p-6"
      >
        <SeccionTitulo
          id="titulo-comparacion-interna"
          titulo="Tendencia interna entre edificaciones SIGE"
          meta={
            comparacion && (
              <span className="tabular-nums">
                {comparacion.ventanaReciente} vs {comparacion.ventanaPrevia}
              </span>
            )
          }
        />

        {contexto?.estado === 'error' ? (
          <p className="ui-callout ui-callout-warn">{contexto.mensaje}</p>
        ) : comparacion === null ? (
          !benchmarkCargando && (
            <div className="ui-empty py-8">
              <p className="max-w-md text-xs">
                Sin datos disponibles para la comparación interna.
              </p>
            </div>
          )
        ) : comparacion.filas.length === 0 ? (
          <div className="ui-empty py-8">
            <p className="ui-title text-sm">Sin facturas registradas</p>
            <p className="max-w-md text-xs">
              Aún no hay facturas en los últimos 24 meses para comparar las
              edificaciones entre sí.
            </p>
          </div>
        ) : (
          <div className="ui-table-shell">
            <table className="ui-table">
              <thead>
                <tr>
                  <th scope="col">Edificación</th>
                  <th scope="col">Promedio últimos 12 meses</th>
                  <th scope="col">Interanual</th>
                  <th scope="col">Datos</th>
                </tr>
              </thead>
              <tbody>
                {comparacion.filas.map((fila) => {
                  const esActual = fila.edificacionId === edificacionId
                  return (
                    <tr
                      key={fila.edificacionId}
                      className={
                        esActual ? 'bg-emerald-50/70 dark:bg-emerald-950/25' : undefined
                      }
                    >
                      <td className="whitespace-nowrap font-medium">
                        {fila.nombre}
                        {esActual && (
                          <span
                            className={`${CLASE_BADGE} ml-2 border-emerald-600/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300`}
                          >
                            Tu edificación
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {fila.promedioKwh !== null ? formatoKwh(fila.promedioKwh) : '—'}
                      </td>
                      <td
                        className={`whitespace-nowrap text-right font-medium tabular-nums ${
                          fila.variacionPct === null
                            ? 'text-gray-500 dark:text-gray-400'
                            : fila.variacionPct > 0
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {fila.variacionPct !== null
                          ? formatoPct(fila.variacionPct)
                          : 'datos insuficientes'}
                      </td>
                      <td className="whitespace-nowrap text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                        {fila.mesesConDatos}/24 meses
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 2. Referencia externa: contexto secundario, no la magnitud propia */}
      <section
        aria-labelledby="titulo-benchmark-xm"
        className="ui-card space-y-4 border border-dashed p-5 sm:p-6"
      >
        <SeccionTitulo
          id="titulo-benchmark-xm"
          titulo="Referencia externa — datos nacionales XM"
          meta={
            <span className="tabular-nums">
              {fechaConsulta ? `Consulta: ${fechaConsulta}` : 'Consultando…'}
            </span>
          }
        />
        <p className="ui-muted text-xs">
          Contexto de mercado para ubicar la tendencia de la edificación: describe el
          comportamiento del sistema, NO la magnitud del consumo propio.
        </p>

        {benchmarkCargando ? (
          <div aria-busy="true" aria-live="polite" className="space-y-3">
            <div className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
            <p className="ui-muted text-xs">Consultando las series de XM…</p>
          </div>
        ) : (
          <div className="space-y-4">
            {erroresSerie.length > 0 && (
              <p className="ui-callout ui-callout-warn">{erroresSerie[0].mensaje}</p>
            )}
            {seriesOk.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {seriesOk.map(({ serie, advertencias }) => (
                  <TarjetaSerieXm
                    key={serie.clave}
                    serie={serie}
                    advertencias={advertencias}
                  />
                ))}
              </div>
            )}
            <p className="ui-callout ui-callout-info">
              XM no publica consumo por edificación: estas series describen el
              comportamiento del sistema (tendencia y estacionalidad), no la magnitud
              de la edificación. El detalle por sector CIIU solo existe en forma
              horaria sin filtros, por lo que la comparación se hace con las series
              nacionales del SIN.
            </p>
          </div>
        )}
      </section>

      {/* 3. Catálogo citable: colapsado (fuente para el informe técnico) */}
      <section
        aria-labelledby="titulo-documentos-xm"
        className="ui-card space-y-4 p-5 sm:p-6"
      >
        <SeccionTitulo
          id="titulo-documentos-xm"
          titulo="Datos y documentos XM"
          meta={
            fechaConsulta && (
              <span className="tabular-nums">Última consulta: {fechaConsulta}</span>
            )
          }
        />
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
          <li>
            <a
              href={URLS_XM.documentacion}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded font-medium text-uv-forest underline underline-offset-2 focus-ring"
            >
              Documentación oficial de la API XM
            </a>
          </li>
          <li>
            <a
              href={URLS_XM.portal}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded font-medium text-uv-forest underline underline-offset-2 focus-ring"
            >
              Portal de XM (datos y operación)
            </a>
          </li>
        </ul>
        <details className="group rounded-xl border border-gray-200 dark:border-slate-700">
          <summary className="ui-btn ui-btn-ghost ui-btn-sm focus-ring cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="transition-transform group-open:rotate-90">
              ▸
            </span>
            Catálogo de métricas (fuente citable)
          </summary>
          <div className="space-y-4 px-4 pb-4 pt-2">
            <p className="ui-muted text-xs">
              Catálogo oficial de las métricas usadas en el benchmark, tal como las
              publica la API de XM: fuente citable para el informe técnico.
            </p>
            <div className="ui-table-shell">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th scope="col">Métrica</th>
                    <th scope="col">Descripción oficial</th>
                    <th scope="col">Unidades</th>
                    <th scope="col">Cruce</th>
                    <th scope="col">Endpoint</th>
                    <th scope="col">Límite</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogo.map((metrica) => (
                    <tr key={metrica.metricId}>
                      <td className="font-medium">
                        {metrica.nombre}
                        <br />
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                          {metrica.metricId}
                        </span>
                      </td>
                      <td className="min-w-80 text-xs font-normal">
                        {metrica.descripcion}
                      </td>
                      <td className="whitespace-nowrap">{metrica.unidades}</td>
                      <td className="whitespace-nowrap">{metrica.cruce}</td>
                      <td className="whitespace-nowrap text-xs">
                        POST{' '}
                        {metrica.endpoint.replace('https://servapibi.xm.com.co', '')}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {metrica.maxDias} días
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>
    </div>
  )
}
