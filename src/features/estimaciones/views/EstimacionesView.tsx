'use client'

import * as React from 'react'
import { ejecutarProyeccion } from '@/features/estimaciones/controllers/forecast'
import { SeriesChart } from '@/shared/views/charts'
import {
  type ResultadoProyeccion,
  type SolicitudProyeccion,
} from '../models/forecast'

interface EdificacionOption {
  id: string
  nombre: string
}

interface BloqueOption {
  id: string
  edificacionId: string
  codigo: string
  nombre: string
}

export interface EstimacionesViewProps {
  edificaciones: EdificacionOption[]
  bloques: BloqueOption[]
  puedeEjecutar: boolean
  puedeCrearOrden: boolean
  puedeDiagnosticar: boolean
}

const numeroCo = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 1,
})

function formatoKwh(valor: number): string {
  return `${numeroCo.format(valor)} kWh`
}

function variacionPct(actual: number, previo: number): string {
  if (!previo) return '—'
  const variacion = ((actual - previo) / previo) * 100
  return `${variacion > 0 ? '+' : ''}${numeroCo.format(variacion)} %`
}

export function EstimacionesView({
  edificaciones,
  bloques,
  puedeEjecutar,
  puedeCrearOrden,
  puedeDiagnosticar,
}: EstimacionesViewProps) {
  const [edificacionId, setEdificacionId] = React.useState(
    edificaciones.length === 1 ? edificaciones[0].id : ''
  )
  const [bloqueId, setBloqueId] = React.useState('')
  const [horizonte, setHorizonte] = React.useState<1 | 2 | 3>(3)
  const [modelo, setModelo] = React.useState<'AUTO' | 'MA' | 'SES'>('AUTO')
  const [ventana, setVentana] = React.useState(3)
  const [alpha, setAlpha] = React.useState(0.3)
  const [usarOrdenManual, setUsarOrdenManual] = React.useState(false)
  const [orden, setOrden] = React.useState<[number, number, number]>([1, 1, 1])
  const [resultado, setResultado] = React.useState<ResultadoProyeccion | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const bloquesEdificacion = bloques.filter(
    (bloque) => bloque.edificacionId === edificacionId
  )

  const ejecutar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (!edificacionId) {
      setError('Seleccione una edificación para proyectar el consumo.')
      return
    }

    const solicitud: SolicitudProyeccion = {
      edificacionId,
      bloqueId: bloqueId || null,
      horizonte,
      modelo,
      ...(modelo === 'MA' ? { ventana } : {}),
      ...(modelo === 'SES' ? { alpha } : {}),
      ...(modelo === 'AUTO' && usarOrdenManual ? { orden } : {}),
    }
    setCargando(true)
    setError(null)
    try {
      const respuesta = await ejecutarProyeccion(solicitud)
      if (respuesta.ok) {
        setResultado(respuesta.resultado)
      } else {
        setResultado(null)
        setError(respuesta.error)
      }
    } catch {
      setResultado(null)
      setError('No se pudo ejecutar la proyección. Intente nuevamente.')
    } finally {
      setCargando(false)
    }
  }

  const proyeccion = resultado?.proyeccion
  const meses = proyeccion?.serie ?? []
  const pronostico = proyeccion?.pronostico ?? []
  const etiquetas = [...meses.map((item) => item.periodo), ...pronostico.map((item) => item.periodo)]
  const lineaBase = resultado?.lineaBase.lbenMensual
  const valoresBase = lineaBase
    ? [
        ...meses.map((item) => lineaBase[Number(item.periodo.slice(5, 7)) - 1] ?? null),
        ...pronostico.map((item) => lineaBase[Number(item.periodo.slice(5, 7)) - 1] ?? null),
      ]
    : null
  const ultimaHistorica = meses.at(-1)?.consumo_modelado
  const serieGrafica = proyeccion
    ? [
        {
          clave: 'historico',
          nombre: 'Histórico depurado',
          tipo: 'area' as const,
          color: 'forest' as const,
          valores: [
            ...meses.map((item) => item.consumo_modelado),
            ...pronostico.map(() => null),
          ],
        },
        {
          clave: 'pronostico',
          nombre: 'Proyección ARIMA',
          tipo: 'area' as const,
          color: 'sky' as const,
          valores: [
            ...meses.map((_, indice) =>
              indice === meses.length - 1 ? (ultimaHistorica ?? null) : null
            ),
            ...pronostico.map((item) => item.consumo_kwh),
          ],
        },
        ...(valoresBase
          ? [
              {
                clave: 'lben',
                nombre: `LBEn guardada · ${resultado?.lineaBase.origen}`,
                tipo: 'linea' as const,
                color: 'deep' as const,
                valores: valoresBase,
              },
            ]
          : []),
      ]
    : []

  const atipicosImputados = meses.filter((item) => item.descartado).length
  const ultimoPronostico = pronostico.at(-1)
  const ultimoHistorico = meses.at(-1)?.consumo_modelado
  const alcance = resultado?.bloqueNombre
    ? `${resultado.edificacionNombre} · ${resultado.bloqueNombre}`
    : resultado?.edificacionNombre

  return (
    <main className="mx-auto w-full max-w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
      <header className="relative overflow-hidden rounded-2xl bg-uv-forest px-6 py-7 text-white shadow-sm sm:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border-[32px] border-white/10"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-uv-yellow">
          Módulo 5 · Escenarios de consumo
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Estimaciones energéticas
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">
          Compare modelos ARIMA/SARIMA, medias móviles y suavizamiento exponencial sobre el histórico
          normalizado y depurado según UPME.
        </p>
      </header>

      <section className="ui-panel space-y-5" aria-labelledby="configuracion-titulo">
        <div>
          <h2 id="configuracion-titulo" className="ui-title text-lg">
            Configurar proyección
          </h2>
          <p className="ui-muted mt-1 text-sm">
            Se recomiendan al menos 36 meses depurados para mayor confiabilidad. Con menos datos,
            se intentará la estimación y se mostrará una advertencia. El cálculo es exploratorio
            y no modifica la LBEn regulatoria.
          </p>
        </div>

        {edificaciones.length === 0 ? (
          <div className="ui-callout ui-callout-warn" role="status">
            No hay edificaciones disponibles para proyectar.
          </div>
        ) : !puedeEjecutar ? (
          <div className="ui-callout ui-callout-info" role="status">
            Su rol permite consultar el módulo, pero no ejecutar proyecciones.
          </div>
        ) : (
          <form onSubmit={ejecutar} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="ui-field">
                <label htmlFor="forecast-edificacion" className="ui-label">
                  Edificación
                </label>
                <select
                  id="forecast-edificacion"
                  className="ui-input min-h-10 focus-ring"
                  value={edificacionId}
                  onChange={(evento) => {
                    setEdificacionId(evento.target.value)
                    setBloqueId('')
                    setResultado(null)
                  }}
                  required
                >
                  <option value="">Seleccione una edificación</option>
                  {edificaciones.map((edificacion) => (
                    <option key={edificacion.id} value={edificacion.id}>
                      {edificacion.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ui-field">
                <label htmlFor="forecast-bloque" className="ui-label">
                  Alcance de consumo
                </label>
                <select
                  id="forecast-bloque"
                  className="ui-input min-h-10 focus-ring"
                  value={bloqueId}
                  onChange={(evento) => {
                    setBloqueId(evento.target.value)
                    setResultado(null)
                  }}
                  disabled={!edificacionId || bloquesEdificacion.length === 0}
                >
                  <option value="">Edificación completa</option>
                  {bloquesEdificacion.map((bloque) => (
                    <option key={bloque.id} value={bloque.id}>
                      {bloque.codigo} · {bloque.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ui-field">
                <label htmlFor="forecast-modelo" className="ui-label">
                  Modelo estadístico
                </label>
                <select
                  id="forecast-modelo"
                  className="ui-input min-h-10 focus-ring"
                  value={modelo}
                  onChange={(evento) => {
                    setModelo(evento.target.value as 'AUTO' | 'MA' | 'SES')
                    setUsarOrdenManual(false)
                    setResultado(null)
                  }}
                >
                  <option value="AUTO">Automático (SARIMA / ARIMA)</option>
                  <option value="MA">Medias móviles (MA)</option>
                  <option value="SES">Suavizamiento exponencial (SES)</option>
                </select>
              </div>

              <div className="ui-field">
                <label htmlFor="forecast-horizonte" className="ui-label">
                  Horizonte
                </label>
                <select
                  id="forecast-horizonte"
                  className="ui-input min-h-10 focus-ring"
                  value={horizonte}
                  onChange={(evento) => {
                    if (evento.target.value === '1') setHorizonte(1)
                    else if (evento.target.value === '2') setHorizonte(2)
                    else setHorizonte(3)
                    setResultado(null)
                  }}
                >
                  <option value={1}>1 mes</option>
                  <option value={2}>2 meses</option>
                  <option value={3}>3 meses</option>
                </select>
              </div>
            </div>

            {modelo === 'MA' && (
              <div className="ui-field max-w-xs">
                <label htmlFor="forecast-ventana" className="ui-label">
                  Ventana de medias móviles
                </label>
                <select
                  id="forecast-ventana"
                  className="ui-input min-h-10 focus-ring"
                  value={ventana}
                  onChange={(evento) => {
                    setVentana(Number(evento.target.value))
                    setResultado(null)
                  }}
                >
                  {[2, 3, 4, 6, 12].map((valor) => (
                    <option key={valor} value={valor}>{valor} meses</option>
                  ))}
                </select>
              </div>
            )}

            {modelo === 'SES' && (
              <div className="ui-field max-w-xs">
                <label htmlFor="forecast-alpha" className="ui-label">
                  Suavizamiento (alpha): {alpha.toFixed(2)}
                </label>
                <input
                  id="forecast-alpha"
                  type="range"
                  min={0.05}
                  max={0.95}
                  step={0.05}
                  className="w-full accent-uv-forest focus-ring"
                  value={alpha}
                  onChange={(evento) => {
                    setAlpha(Number(evento.target.value))
                    setResultado(null)
                  }}
                />
                <p className="ui-muted text-xs">
                  El valor controla cuánto peso se asigna al dato más reciente.
                </p>
              </div>
            )}

            {modelo === 'AUTO' && puedeCrearOrden && (
              <fieldset className="rounded-xl border border-uv-mid/40 p-4 dark:border-slate-700">
                <legend className="px-1 text-sm font-medium text-uv-ink dark:text-slate-200">
                  Opciones avanzadas
                </legend>
                <label className="flex min-h-10 items-center gap-3 text-sm text-uv-ink dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-uv-forest focus-ring"
                    checked={usarOrdenManual}
                    onChange={(evento) => {
                      setUsarOrdenManual(evento.target.checked)
                      setResultado(null)
                    }}
                  />
                  Definir orden ARIMA manual (p, d, q)
                </label>
                {usarOrdenManual && (
                  <div className="mt-3 grid max-w-md grid-cols-3 gap-3">
                    {(['p', 'd', 'q'] as const).map((parametro, indice) => (
                      <div className="ui-field" key={parametro}>
                        <label htmlFor={`forecast-${parametro}`} className="ui-label">
                          {parametro}
                        </label>
                        <input
                          id={`forecast-${parametro}`}
                          type="number"
                          min={0}
                          max={2}
                          step={1}
                          className="ui-input min-h-10 focus-ring"
                          value={orden[indice]}
                          onChange={(evento) => {
                            const valor = Number(evento.target.value)
                            setOrden((actual) => {
                              const siguiente: [number, number, number] = [...actual]
                              if (Number.isInteger(valor)) {
                                siguiente[indice] = Math.min(2, Math.max(0, valor))
                              }
                              return siguiente
                            })
                            setResultado(null)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                className="ui-btn ui-btn-primary focus-ring"
                type="submit"
                disabled={cargando || !edificacionId}
              >
                {cargando ? 'Calculando proyección…' : 'Generar proyección'}
              </button>
              <p className="ui-muted text-xs">
                Ejecución bajo demanda · no modifica la LBEn guardada
              </p>
            </div>
          </form>
        )}

        {error && (
          <div className="ui-callout ui-callout-danger" role="alert">
            {error}
          </div>
        )}
      </section>

      {resultado && proyeccion && (
        <div className="space-y-6" aria-live="polite">
          <section className="ui-panel space-y-5" aria-labelledby="resultado-titulo">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-uv-forest dark:text-uv-soft">
                  Resultado · {alcance}
                </p>
                <h2 id="resultado-titulo" className="ui-title mt-1 text-xl">
                  Proyección para los próximos {pronostico.length}{' '}
                  {pronostico.length === 1 ? 'mes' : 'meses'}
                </h2>
              </div>
              <span className="inline-flex w-fit items-center rounded-full bg-uv-sky/20 px-3 py-1 text-sm font-medium text-uv-deep dark:bg-sky-900/40 dark:text-sky-200">
                Modelo {proyeccion.modelo}
              </span>
            </div>

            {proyeccion.advertencia && (
              <div className="ui-callout ui-callout-warn" role="status">
                {proyeccion.advertencia}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="ui-card-stat">
                <p className="ui-muted text-xs">Último mes proyectado</p>
                <p className="mt-2 text-xl font-semibold text-uv-ink dark:text-slate-100">
                  {ultimoPronostico ? formatoKwh(ultimoPronostico.consumo_kwh) : '—'}
                </p>
                <p className="ui-muted mt-1 text-xs">{ultimoPronostico?.periodo}</p>
              </article>
              <article className="ui-card-stat">
                <p className="ui-muted text-xs">Variación vs. último mes</p>
                <p className="mt-2 text-xl font-semibold text-uv-ink dark:text-slate-100">
                  {ultimoPronostico && ultimoHistorico !== undefined
                    ? variacionPct(ultimoPronostico.consumo_kwh, ultimoHistorico)
                    : '—'}
                </p>
                <p className="ui-muted mt-1 text-xs">Estimación exploratoria</p>
              </article>
              <article className="ui-card-stat">
                <p className="ui-muted text-xs">Histórico utilizado</p>
                <p className="mt-2 text-xl font-semibold text-uv-ink dark:text-slate-100">
                  {proyeccion.depurados} meses
                </p>
                <p className="ui-muted mt-1 text-xs">Depuración UPME · ±10 %</p>
              </article>
              <article className="ui-card-stat">
                <p className="ui-muted text-xs">Atípicos imputados</p>
                <p className="mt-2 text-xl font-semibold text-uv-ink dark:text-slate-100">
                  {atipicosImputados}
                </p>
                <p className="ui-muted mt-1 text-xs">LBEn mensual de valor absoluto</p>
              </article>
            </div>

            <div className="rounded-xl border border-uv-mid/30 p-3 dark:border-slate-700 sm:p-5">
              <SeriesChart
                etiquetas={etiquetas}
                series={serieGrafica}
                titulo={`Serie histórica y proyección mensual de ${alcance}`}
                formatoValor={formatoKwh}
                sinDatos="No hay datos suficientes para graficar la proyección."
              />
            </div>

            {resultado.lineaBase.origen && !lineaBase && (
              <div className="ui-callout ui-callout-warn">
                Existe una LBEn de valor absoluto guardada para este alcance, pero no se pudo leer
                su serie mensual; se omite la comparación.
              </div>
            )}
            {!resultado.lineaBase.origen && (
              <div className="ui-callout ui-callout-info">
                No hay una LBEn de valor absoluto guardada para comparar. La proyección está
                disponible y no sustituye la línea base regulatoria.
              </div>
            )}

            <div className="ui-table-shell">
              <table className="ui-table">
                <caption className="sr-only">
                  Valores proyectados e intervalos de confianza al 95 por ciento
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Período</th>
                    <th scope="col">Proyección</th>
                    <th scope="col">Intervalo 95 %</th>
                    <th scope="col">LBEn guardada</th>
                  </tr>
                </thead>
                <tbody>
                  {pronostico.map((punto) => {
                    const mes = Number(punto.periodo.slice(5, 7)) - 1
                    const valorBase = lineaBase?.[mes] ?? null
                    return (
                      <tr key={punto.periodo}>
                        <th scope="row">{punto.periodo}</th>
                        <td>{formatoKwh(punto.consumo_kwh)}</td>
                        <td>
                          {formatoKwh(punto.limite_inferior)} –{' '}
                          {formatoKwh(punto.limite_superior)}
                        </td>
                        <td>{valorBase === null ? '—' : formatoKwh(valorBase)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {proyeccion.diagnosticos && (
              <section
                className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900"
                aria-labelledby="diagnosticos-titulo"
              >
                <h3 id="diagnosticos-titulo" className="font-semibold text-uv-ink dark:text-slate-100">
                  Diagnóstico del modelo
                </h3>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <dt className="ui-muted">AIC</dt>
                    <dd className="mt-1 font-medium">{numeroCo.format(proyeccion.diagnosticos.aic)}</dd>
                  </div>
                  <div>
                    <dt className="ui-muted">MAPE de entrenamiento</dt>
                    <dd className="mt-1 font-medium">
                      {proyeccion.diagnosticos.mape_entrenamiento === null
                        ? 'No disponible'
                        : `${numeroCo.format(proyeccion.diagnosticos.mape_entrenamiento)} %`}
                    </dd>
                  </div>
                  <div>
                    <dt className="ui-muted">Media de residuos</dt>
                    <dd className="mt-1 font-medium">
                      {proyeccion.diagnosticos.media_residuos === null
                        ? 'No disponible'
                        : formatoKwh(proyeccion.diagnosticos.media_residuos)}
                    </dd>
                  </div>
                  <div>
                    <dt className="ui-muted">Prueba Ljung–Box</dt>
                    <dd className="mt-1 font-medium">
                      {proyeccion.diagnosticos.ljung_box_p_value === null
                        ? 'No disponible'
                        : numeroCo.format(proyeccion.diagnosticos.ljung_box_p_value)}
                    </dd>
                  </div>
                </dl>
                <p className="ui-muted mt-3 text-xs">
                  {proyeccion.modelo === 'MA' && proyeccion.parametros_modelo?.ventana
                    ? `Ventana ${proyeccion.parametros_modelo.ventana} meses`
                    : proyeccion.modelo === 'SES' && proyeccion.parametros_modelo?.alpha !== undefined
                      ? `Alpha ${numeroCo.format(proyeccion.parametros_modelo.alpha)}`
                      : `Orden ${proyeccion.orden.join(', ')}`}
                  {proyeccion.orden_estacional
                    ? ` · orden estacional ${proyeccion.orden_estacional.join(', ')}`
                    : ''}
                  {proyeccion.ajustes_aplicados > 0
                    ? ` · ${proyeccion.ajustes_aplicados} registros con ajustes no rutinarios`
                    : ''}
                </p>
              </section>
            )}
          </section>
          <p className="ui-muted px-1 text-xs leading-5">
            Esta proyección estadística es exploratoria. No reemplaza ni modifica la LBEn definida
            conforme a la Resolución UPME 0016 de 2024.
          </p>
        </div>
      )}
    </main>
  )
}
