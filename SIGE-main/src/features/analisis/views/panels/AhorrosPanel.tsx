import React from 'react'
import {
  ahorroAnual,
  formatoNumero,
  FORMULA_AHORRO,
  lbenPromedio,
  MESES_ES,
  textoCriterio,
  type AhorroModelo,
  type ModeloClave,
  type ModeloLBEn,
  type ModelosLBEn,
  type OpcionModelo,
  type Periodicidad,
} from '../../models/analisis'
import { ATRIBUTOS_ICONO, ChipIcon, SeccionTitulo } from './comunes'
import { BarList } from '@/shared/views/charts'

/**
 * Submódulo Ahorros: «Línea base del análisis» — identidad y validación
 * del modelo §7.4, 3 KPIs y la tabla §8.1 (o estados vacío/degradado).
 *
 * Los selectores de modelo y periodicidad viven ahora en la sección
 * «Configuración del análisis» del shell (issue #79): su estado sigue
 * gobernando el overlay LBEn y el modo de la gráfica del submódulo
 * Resumen (el shell es el dueño), y este panel solo consume el modelo
 * ya elegido.
 */
export interface AhorrosPanelProps {
  modelos: ModelosLBEn | null
  opcionesSelectorModelo: OpcionModelo[]
  modeloClave: ModeloClave | null
  modeloActual: ModeloLBEn | null
  descripcionModelo: string | null
  periodicidad: Periodicidad
}

export function AhorrosPanel({
  modelos,
  opcionesSelectorModelo,
  modeloClave,
  modeloActual,
  descripcionModelo,
  periodicidad,
}: AhorrosPanelProps) {
  const ahorro: AhorroModelo | null = modeloActual?.ahorro ?? null
  // Modo anual de la tabla §8.1: Σ de las 12 filas mensuales.
  const ahorroAnualTotal = ahorro && periodicidad === 'ano' ? ahorroAnual(ahorro) : null
  const lbenMedia = modeloActual ? lbenPromedio(modeloActual) : null
  const mesesConLben =
    modeloActual?.lben_mensual.filter((v): v is number => typeof v === 'number') ?? []
  const lbenAnual =
    mesesConLben.length > 0 ? mesesConLben.reduce((suma, v) => suma + v, 0) : null

  // Chips de validación: sólo los criterios aplicables al modelo elegido.
  const chipsValidacion: string[] = []
  if (modeloActual) {
    const v = modeloActual.validacion
    chipsValidacion.push(`n = ${formatoNumero(v.n, 0)} datos depurados`)
    const criterio = textoCriterio(v.criterio)
    if (criterio) chipsValidacion.push(criterio)
    if (v.intervalo_inf !== null && v.intervalo_sup !== null) {
      chipsValidacion.push(
        `Intervalo 95 %: [${formatoNumero(v.intervalo_inf)}, ${formatoNumero(v.intervalo_sup)}]`
      )
    }
    if (v.r2 !== null) chipsValidacion.push(`R² = ${formatoNumero(v.r2, 4)}`)
    if (v.mape !== null) chipsValidacion.push(`MAPE = ${formatoNumero(v.mape, 2)} %`)
    if (v.p_value_max !== null) {
      chipsValidacion.push(`p-valor máx. = ${formatoNumero(v.p_value_max, 4)}`)
    }
  }
  // Valores display de los KPIs de la línea base (la unidad del dominio
  // es kWh/mes en todos los modelos; el modo anual sólo agrega).
  const lbenKpi =
    periodicidad === 'ano'
      ? lbenAnual !== null
        ? `${formatoNumero(lbenAnual, 0)} kWh/año`
        : '—'
      : lbenMedia !== null
        ? `${formatoNumero(lbenMedia, 0)} kWh/mes`
        : '—'
  const potencialKpi = ahorro
    ? periodicidad === 'ano'
      ? `${formatoNumero(ahorroAnualTotal?.potencial ?? 0, 1)} kWh/año`
      : `${formatoNumero(ahorro.potencial_mensual, 1)} kWh/mes`
    : 'No aplica'
  const pctAhorro =
    periodicidad === 'ano'
      ? ahorroAnualTotal?.potencial_pct ?? null
      : ahorro?.potencial_pct ?? null

  if (!modelos) {
    return (
      <p className="ui-callout ui-callout-warn">
        El motor no devolvió la sección de modelos de línea base (versión
        anterior del servicio engine). El análisis de períodos inusuales está
        completo; actualice el motor para habilitar el selector de modelos y
        los ahorros §8.1.
      </p>
    )
  }

  // Barras del layout de referencia: potencial §8.1 de TODOS los modelos
  // disponibles que la Resolución define, ordenadas desc (ranking). Los
  // modelos sin potencial se listan aparte — nunca se fabrica un número.
  const filasModelos = Object.entries(modelos)
    .filter(([, m]) => m.estado === 'disponible' && m.ahorro !== null)
    .map(([clave, m]) => {
      const a = m.ahorro!
      const anual = periodicidad === 'ano' ? ahorroAnual(a) : null
      return {
        clave,
        etiqueta: m.etiqueta,
        valor: anual ? anual.potencial : a.potencial_mensual,
        pct: anual ? anual.potencial_pct : a.potencial_pct,
        unidad: periodicidad === 'ano' ? 'kWh/año' : 'kWh/mes',
      }
    })
    .sort((x, y) => y.valor - x.valor)
  const etiquetasSinPotencial = Object.values(modelos)
    .filter((m) => m.estado === 'disponible' && m.ahorro === null)
    .map((m) => m.etiqueta)

  return (
    <section aria-labelledby="titulo-lben-analisis" className="ui-card space-y-4 p-5 sm:p-6">
      <SeccionTitulo
        id="titulo-lben-analisis"
        titulo="Línea base del análisis"
        meta="Recálculo al vuelo · Resolución UPME 0016 de 2024 §7.4-7.5 y §8.1"
      />

      {!modeloClave || !modeloActual || !descripcionModelo ? (
        <p className="ui-callout ui-callout-warn">
          Ninguno de los modelos de línea base pudo calcularse con esta serie.
          Revise el motor para conocer el motivo de cada modelo.
        </p>
      ) : (
        <>
          {/* Identidad del modelo: etiqueta, fórmula, chips y faltantes */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-uv-ink dark:text-slate-100">
                {modeloActual.etiqueta}
              </h4>
              <code className="ui-chip">{modeloActual.unidad}</code>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300">
              {modeloActual.formula}
            </p>
            <p className="ui-muted text-xs">{descripcionModelo}</p>
            {opcionesSelectorModelo.some((o) => !o.habilitado) && (
              <ul className="ui-muted space-y-1 text-xs">
                {opcionesSelectorModelo
                  .filter((o) => !o.habilitado)
                  .map((o) => (
                    <li key={o.clave}>
                      <span className="font-medium">{o.etiqueta}:</span> {o.motivo}
                    </li>
                  ))}
              </ul>
            )}
            <ul className="flex flex-wrap gap-1.5">
              {chipsValidacion.map((chip) => (
                <li key={chip}>
                  <code className="ui-chip">{chip}</code>
                </li>
              ))}
            </ul>
          </div>

          {/* KPIs de la línea base (kWh/mes: unidad del dominio) */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div className="ui-card-stat h-full">
              <div className="flex items-center gap-2">
                <ChipIcon>
                  <svg {...ATRIBUTOS_ICONO}>
                    <path d="M3 3v18h18" />
                    <path d="m7 15 4-6 4 3 5-8" />
                  </svg>
                </ChipIcon>
                <p className="ui-muted text-xs">
                  {periodicidad === 'ano' ? 'LBEn (total anual)' : 'LBEn (promedio)'}
                </p>
              </div>
              <p className="ui-title mt-2 text-2xl tabular-nums">{lbenKpi}</p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {periodicidad === 'ano'
                  ? 'Suma de los 12 meses calendario del modelo.'
                  : 'Media de los 12 meses calendario del modelo.'}
              </p>
            </div>
            <div className="ui-card-stat h-full">
              <div className="flex items-center gap-2">
                <ChipIcon>
                  <svg {...ATRIBUTOS_ICONO}>
                    <path d="m13 2-2 8h5l-3 12" />
                  </svg>
                </ChipIcon>
                <p className="ui-muted text-xs">Potencial de ahorro §8.1</p>
              </div>
              <p className="ui-title mt-2 text-2xl tabular-nums">{potencialKpi}</p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {ahorro
                  ? periodicidad === 'ano'
                    ? 'Suma de los 12 potenciales mensuales.'
                    : 'Media de los 12 potenciales mensuales (ec. 9).'
                  : 'La Resolución no define potencial para este modelo.'}
              </p>
            </div>
            <div className="ui-card-stat h-full">
              <div className="flex items-center gap-2">
                <ChipIcon>
                  <svg {...ATRIBUTOS_ICONO}>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                </ChipIcon>
                <p className="ui-muted text-xs">% de la LBEn</p>
              </div>
              <p className="ui-title mt-2 text-2xl tabular-nums">
                {pctAhorro !== null ? `${formatoNumero(pctAhorro, 1)} %` : '—'}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Ec. 12 — potencial ÷ LBEn del mismo período.
              </p>
            </div>
          </div>

          {/* Barras: potencial de ahorro por modelo (ranking, layout ref.) */}
          {filasModelos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-uv-ink dark:text-slate-100">
                Potencial de ahorro por modelo §8.1
              </h4>
              <BarList
                titulo="Potencial de ahorro por modelo"
                datos={filasModelos.map((f) => ({
                  clave: f.clave,
                  etiqueta: f.etiqueta,
                  valor: f.valor,
                  textoValor: `${formatoNumero(f.valor, 1)} ${f.unidad}${
                    f.pct !== null ? ` · ${formatoNumero(f.pct, 1)} %` : ''
                  }`,
                }))}
                vacio="Ningún modelo define potencial de ahorro."
              />
              {etiquetasSinPotencial.length > 0 && (
                <p className="ui-muted text-xs">
                  La Resolución no define potencial para:{' '}
                  {etiquetasSinPotencial.join(', ')}.
                </p>
              )}
            </div>
          )}

          {/* Tabla §8.1: potencial de ahorro por mes calendario */}
          {ahorro ? (
            <div className="space-y-2">
              <div className="ui-table-shell">
                <table className="ui-table text-sm">
                  <thead>
                    <tr>
                      <th scope="col">{periodicidad === 'ano' ? 'Período' : 'Mes'}</th>
                      <th scope="col" className="text-right">
                        LBEn
                      </th>
                      <th scope="col" className="text-right">
                        Mejor desempeño
                      </th>
                      <th scope="col" className="text-right">
                        Potencial
                      </th>
                      <th scope="col" className="text-right">
                        % de la LBEn
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodicidad === 'ano' ? (
                      <tr>
                        <td>Total anual (12 meses)</td>
                        <td className="text-right tabular-nums">
                          {formatoNumero(ahorroAnualTotal?.lben ?? 0)}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatoNumero(ahorroAnualTotal?.mejor ?? 0)}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatoNumero(ahorroAnualTotal?.potencial ?? 0)}
                        </td>
                        <td className="text-right tabular-nums">
                          {ahorroAnualTotal?.potencial_pct === null ||
                          ahorroAnualTotal === null
                            ? '—'
                            : `${formatoNumero(ahorroAnualTotal.potencial_pct, 1)} %`}
                        </td>
                      </tr>
                    ) : (
                      ahorro.por_mes.map((fila) => (
                        <tr key={fila.mes}>
                          <td>{MESES_ES[fila.mes - 1]}</td>
                          <td className="text-right tabular-nums">
                            {formatoNumero(fila.lben)}
                          </td>
                          <td className="text-right tabular-nums">
                            {formatoNumero(fila.mejor)}
                          </td>
                          <td className="text-right tabular-nums">
                            {formatoNumero(fila.potencial)}
                          </td>
                          <td className="text-right tabular-nums">
                            {fila.potencial_pct === null
                              ? '—'
                              : `${formatoNumero(fila.potencial_pct, 1)} %`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="ui-muted text-xs">
                {periodicidad === 'ano'
                  ? `Modo anual: suma de los 12 meses en ${modeloActual.unidad.replace('/mes', '/año')}.`
                  : `LBEn y potencial en ${modeloActual.unidad}; «Mejor desempeño» es el consumo mínimo del mes en el periodo base.`}
              </p>
              {FORMULA_AHORRO[modeloClave] && (
                <p className="ui-muted text-xs">{FORMULA_AHORRO[modeloClave]}</p>
              )}
            </div>
          ) : (
            <div className="ui-empty py-8">
              <p className="ui-title text-sm">§8.1 no define potencial</p>
              <p className="max-w-xl text-xs">
                {modeloActual.nota ??
                  'La Resolución no define potencial de ahorro para este modelo.'}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}
