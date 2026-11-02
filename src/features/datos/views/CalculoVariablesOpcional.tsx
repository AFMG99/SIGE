'use client'

/**
 * Paso opcional de «Cálculo de Variables Operativas» al cierre de los importadores.
 *
 * Permite calcular independientemente:
 * - Días lectivos/laborales (desde el calendario operativo)
 * - GDE (Grados Día de Enfriamiento, desde datos climáticos)
 *
 * Cada uno con su propio modo: «Solo campos vacíos» o «Reemplazar existentes».
 * Reutiliza `useCalculoVariablesMasivo` —la misma máquina de estados— para no
 * duplicar la lógica de vista previa, ejecución por lotes, progreso, «Detener»
 * y resumen. La diferencia es el alcance: aquí la edificación viene fijada por
 * la importación recién terminada y solo se escriben periodos SIN variable
 * existente (el importador es quien crea las filas; aquí solo actualizamos
 * campos calculables en variables ya existentes).
 */

import { useEffect } from 'react'

import {
  ANOS_UI,
  MESES,
  periodoEnCursoVariables,
  useCalculoVariablesMasivo,
} from './useCalculoVariablesMasivo'

export type CalculoVariablesOpcionalProps = {
  /** Edificación recién importada; el cálculo se limita a ella. */
  edificacionId: string
  /** Nombre visible de la edificación (solo presentación). */
  edificacionNombre?: string
}

export function CalculoVariablesOpcional({
  edificacionId,
  edificacionNombre,
}: CalculoVariablesOpcionalProps) {
  const {
    cambiarEdificacion,
    mesInicial,
    setMesInicial,
    anoInicial,
    setAnoInicial,
    mesFinal,
    setMesFinal,
    anoFinal,
    setAnoFinal,
    queCalcular,
    setQueCalcular,
    opciones,
    setOpciones,
    vistaPrevia,
    previaCargando,
    previsualizar,
    ejecutando,
    procesados,
    resumen,
    ejecutar,
    detener,
  } = useCalculoVariablesMasivo()

  // La edificación la fija la importación: el hook arranca sin selección y se
  // sincroniza al montar.
  useEffect(() => {
    if (edificacionId) cambiarEdificacion(edificacionId)
  }, [cambiarEdificacion, edificacionId])

  const periodosPendientes = vistaPrevia?.periodos.filter((p) => p.diasLaborales.seEscribe || p.gde.seEscribe) ?? []
  const pendientes = periodosPendientes.length
  const clavesPendientes = new Set(periodosPendientes.map((p) => p.clave))
  const procesadosDelIntervalo = procesados.filter((p) => clavesPendientes.has(p.clave)).length
  const enCurso = periodoEnCursoVariables(
    periodosPendientes.map((p) => p.clave),
    procesados
  )
  const avance = pendientes > 0 ? Math.min(100, (procesadosDelIntervalo / pendientes) * 100) : 0

  if (!edificacionId) return null

  return (
    <section className="ui-card" aria-labelledby="calculo-variables-opcional-titulo">
      <h3 id="calculo-variables-opcional-titulo" className="ui-title text-sm">
        Cálculo de Variables Operativas (opcional)
      </h3>
      <p className="ui-muted mt-1 text-xs">
        {edificacionNombre ? `Edificación: ${edificacionNombre}. ` : ''}
        Calcula días lectivos/laborales y GDE para los bloques y periodos importados.
        Solo actualiza variables operativas ya existentes; no crea filas nuevas.
      </p>

      {/* Selectores de periodo */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div>
          <label htmlFor="calculo-vars-mes-inicial" className="ui-label">
            Mes inicial
          </label>
          <select
            id="calculo-vars-mes-inicial"
            value={mesInicial}
            onChange={(e) => setMesInicial(Number(e.target.value))}
            className="ui-input mt-1 min-h-10"
          >
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="calculo-vars-ano-inicial" className="ui-label">
            Año inicial
          </label>
          <select
            id="calculo-vars-ano-inicial"
            value={anoInicial}
            onChange={(e) => setAnoInicial(Number(e.target.value))}
            className="ui-input mt-1 min-h-10"
          >
            {ANOS_UI.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="calculo-vars-mes-final" className="ui-label">
            Mes final
          </label>
          <select
            id="calculo-vars-mes-final"
            value={mesFinal}
            onChange={(e) => setMesFinal(Number(e.target.value))}
            className="ui-input mt-1 min-h-10"
          >
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="calculo-vars-ano-final" className="ui-label">
            Año final
          </label>
          <select
            id="calculo-vars-ano-final"
            value={anoFinal}
            onChange={(e) => setAnoFinal(Number(e.target.value))}
            className="ui-input mt-1 min-h-10"
          >
            {ANOS_UI.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void previsualizar()}
            disabled={previaCargando || ejecutando}
            className="ui-btn ui-btn-secondary min-h-10 w-full"
          >
            Revisar periodos
          </button>
        </div>
      </div>

      {/* Qué calcular y modos */}
      <div className="mt-4 space-y-3">
        <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <legend className="ui-label text-sm">Qué calcular</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={queCalcular.diasLaborales}
                onChange={(e) => setQueCalcular({ ...queCalcular, diasLaborales: e.target.checked })}
                disabled={previaCargando || ejecutando}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus-ring dark:border-slate-700"
              />
              <span className="text-sm">Días lectivos/laborales</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={queCalcular.gde}
                onChange={(e) => setQueCalcular({ ...queCalcular, gde: e.target.checked })}
                disabled={previaCargando || ejecutando}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus-ring dark:border-slate-700"
              />
              <span className="text-sm">GDE (Grados Día de Enfriamiento)</span>
            </label>
          </div>
        </fieldset>

        {queCalcular.diasLaborales && (
          <fieldset className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-500/10">
            <legend className="ui-label text-sm">Modo: Días lectivos/laborales</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modo-dias"
                  value="solo-vacios"
                  checked={opciones.modoDias === 'solo-vacios'}
                  onChange={(e) => setOpciones({ ...opciones, modoDias: e.target.value as 'solo-vacios' | 'reemplazar' })}
                  disabled={previaCargando || ejecutando}
                  className="h-4 w-4 border-gray-300 text-emerald-600 focus-ring dark:border-slate-700"
                />
                <span className="text-sm">Solo campos vacíos (conserva valores editados manualmente)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modo-dias"
                  value="reemplazar"
                  checked={opciones.modoDias === 'reemplazar'}
                  onChange={(e) => setOpciones({ ...opciones, modoDias: e.target.value as 'solo-vacios' | 'reemplazar' })}
                  disabled={previaCargando || ejecutando}
                  className="h-4 w-4 border-gray-300 text-emerald-600 focus-ring dark:border-slate-700"
                />
                <span className="text-sm">Reemplazar existentes</span>
              </label>
            </div>
            <p className="ui-muted mt-2 text-xs">
              Se deriva del calendario operativo (días LECTIVO/HÁBIL según rangos y política).
            </p>
          </fieldset>
        )}

        {queCalcular.gde && (
          <fieldset className="rounded-lg border border-uv-purple/20 bg-uv-purple/5 p-3 dark:border-uv-purple/30 dark:bg-uv-purple/10">
            <legend className="ui-label text-sm">Modo: GDE</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modo-gde"
                  value="solo-vacios"
                  checked={opciones.modoGde === 'solo-vacios'}
                  onChange={(e) => setOpciones({ ...opciones, modoGde: e.target.value as 'solo-vacios' | 'reemplazar' })}
                  disabled={previaCargando || ejecutando}
                  className="h-4 w-4 border-gray-300 text-emerald-600 focus-ring dark:border-slate-700"
                />
                <span className="text-sm">Solo campos vacíos (conserva valores editados manualmente)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modo-gde"
                  value="reemplazar"
                  checked={opciones.modoGde === 'reemplazar'}
                  onChange={(e) => setOpciones({ ...opciones, modoGde: e.target.value as 'solo-vacios' | 'reemplazar' })}
                  disabled={previaCargando || ejecutando}
                  className="h-4 w-4 border-gray-300 text-emerald-600 focus-ring dark:border-slate-700"
                />
                <span className="text-sm">Reemplazar existentes</span>
              </label>
            </div>
            <p className="ui-muted mt-2 text-xs">
              Requiere configuración operativa (H, Tb, coordenadas) y datos climáticos (Open-Meteo).
            </p>
          </fieldset>
        )}

        {previaCargando && (
          <p role="status" className="ui-muted mt-3 text-xs">
            Generando la vista previa del intervalo…
          </p>
        )}

        {vistaPrevia && !previaCargando && (
          <div className="mt-4 space-y-3">
            <p className="ui-muted text-xs">
              Intervalo: {vistaPrevia.intervalo.desde.ano}-{String(vistaPrevia.intervalo.desde.mes).padStart(2, '0')} –{' '}
              {vistaPrevia.intervalo.hasta.ano}-{String(vistaPrevia.intervalo.hasta.mes).padStart(2, '0')}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="ui-stat">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Meses en el intervalo: {vistaPrevia.intervalo.cantidadMeses}
                </p>
              </div>
              <div className="ui-stat">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Bloques × meses: {vistaPrevia.conteos.totalPeriodos}
                </p>
              </div>
              <div className="ui-stat">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Se escribirán días: {vistaPrevia.conteos.seEscribenDias}
                </p>
              </div>
              <div className="ui-stat">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Se escribirán GDE: {vistaPrevia.conteos.seEscribenGde}
                </p>
              </div>
            </div>

            {vistaPrevia.conteos.sinVariable > 0 && (
              <p className="ui-callout ui-callout-warn text-xs" role="status">
                {vistaPrevia.conteos.sinVariable} combinaciones bloque×mes no tienen variable operativa.
                El importador debe crear la fila primero; este paso solo actualiza campos calculables.
              </p>
            )}

            {pendientes === 0 ? (
              <p className="ui-callout ui-callout-info text-xs" role="status">
                No hay periodos pendientes con la configuración actual. Ajuste el intervalo,
                habilite cálculos o cambie los modos.
              </p>
            ) : (
              !ejecutando && !resumen && (
                <button
                  type="button"
                  onClick={() => void ejecutar()}
                  className="ui-btn ui-btn-primary min-h-10"
                >
                  Ejecutar cálculos ({pendientes} {pendientes === 1 ? 'periodo' : 'periodos'})
                </button>
              )
            )}

            {ejecutando && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <p role="status" className="ui-muted">
                    {enCurso ? `Procesando ${enCurso}…` : 'Cerrando el lote…'} (
                    {Math.min(procesadosDelIntervalo, pendientes)} de {pendientes})
                  </p>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {Math.round(avance)}%
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700"
                  role="progressbar"
                  aria-label="Avance del cálculo de variables"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(avance)}
                  aria-valuetext={`${Math.min(procesadosDelIntervalo, pendientes)} de ${pendientes}`}
                >
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
                    style={{ width: `${avance}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={detener}
                  className="ui-btn ui-btn-danger-outline mt-1 min-h-10"
                >
                  Detener
                </button>
              </div>
            )}

            {resumen && !ejecutando && (
              <div className="space-y-3">
                <h4 className="ui-title text-sm">Resultado del cálculo</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      etiqueta: 'Días calculados',
                      valor: resumen.calculadosDias,
                      clase: 'text-emerald-700 dark:text-emerald-400',
                    },
                    {
                      etiqueta: 'GDE calculadas',
                      valor: resumen.calculadosGde,
                      clase: 'text-uv-purple dark:text-uv-purple',
                    },
                    {
                      etiqueta: 'Días fallidos',
                      valor: resumen.fallidosDias,
                      clase: 'text-red-600 dark:text-red-400',
                    },
                    {
                      etiqueta: 'GDE fallidas',
                      valor: resumen.fallidosGde,
                      clase: 'text-red-600 dark:text-red-400',
                    },
                  ].map((c) => (
                    <div key={c.etiqueta} className="ui-stat">
                      <p className={`text-lg font-semibold ${c.clase}`}>{c.valor}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{c.etiqueta}</p>
                    </div>
                  ))}
                </div>
                {(resumen.fallidosDias + resumen.fallidosGde) > 0 && (
                  <p className="ui-callout ui-callout-warn text-xs" role="status">
                    {resumen.fallidosDias + resumen.fallidosGde} cálculo(s) fallido(s).
                    Puede volver a revisar el intervalo para reintentarlos.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}