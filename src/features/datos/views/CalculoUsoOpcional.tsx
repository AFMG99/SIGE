'use client'

/**
 * Paso opcional de «Cálculo de horas de uso» al cierre de los importadores de
 * equipos y variables (spec §6).
 *
 * Reutiliza `useCalculoMasivo` —la misma máquina de estados de la sección
 * «Cálculo de uso»— para no duplicar la lógica de vista previa, ejecución por
 * lotes, progreso, «Detener» y resumen. La diferencia es el alcance: aquí la
 * edificación viene fijada por la importación recién terminada y solo se
 * escriben periodos SIN resultado (el recálculo destructivo sigue viviendo en
 * Edificaciones › Cálculo de uso).
 */

import { useEffect } from 'react'

import { clavePeriodo } from '@/features/datos/models/calculoUso'
import {
  ANOS_UI,
  MESES,
  periodoEnCurso,
  useCalculoMasivo,
} from './useCalculoMasivo'
import type { ModoCalculoUso } from '@/features/datos/models/calculoUso'

export type CalculoUsoOpcionalProps = {
  /** Edificación recién importada; el cálculo se limita a ella. */
  edificacionId: string
  /** Nombre visible de la edificación (solo presentación). */
  edificacionNombre?: string
}

export function CalculoUsoOpcional({
  edificacionId,
  edificacionNombre,
}: CalculoUsoOpcionalProps) {
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
    modo,
    setModo,
    vistaPrevia,
    previaCargando,
    previsualizar,
    ejecutando,
    procesados,
    resumen,
    ejecutar,
    detener,
  } = useCalculoMasivo()

  // La edificación la fija la importación: el hook arranca sin selección y se
  // sincroniza al montar (y si el importador cambiara de edificación).
  useEffect(() => {
    if (edificacionId) cambiarEdificacion(edificacionId)
  }, [cambiarEdificacion, edificacionId])

  const seEscribiran = vistaPrevia?.seEscribiran ?? []
  const pendientes = seEscribiran.length
  const clavesPendientes = new Set(seEscribiran)
  const procesadosDelIntervalo = procesados.filter((p) =>
    clavesPendientes.has(p.clave)
  ).length
  const enCurso = periodoEnCurso(seEscribiran, procesados)
  const avance =
    pendientes > 0 ? Math.min(100, (procesadosDelIntervalo / pendientes) * 100) : 0

  if (!edificacionId) return null

  return (
    <section className="ui-card" aria-labelledby="calculo-opcional-titulo">
      <h3 id="calculo-opcional-titulo" className="ui-title text-sm">
        Cálculo de horas de uso (opcional)
      </h3>
      <p className="ui-muted mt-1 text-xs">
        {edificacionNombre ? `Edificación: ${edificacionNombre}. ` : ''}
        Deriva las horas y los días de uso del calendario y de los horarios
        vigentes para los periodos importados.
        {modo === 'solo-vacios'
          ? ' Solo escribe periodos sin resultado; los existentes se conservan.'
          : ' Reemplaza los valores de todos los periodos seleccionados.'}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div>
          <label htmlFor="calculo-opcional-mes-inicial" className="ui-label">
            Mes inicial
          </label>
          <select
            id="calculo-opcional-mes-inicial"
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
          <label htmlFor="calculo-opcional-ano-inicial" className="ui-label">
            Año inicial
          </label>
          <select
            id="calculo-opcional-ano-inicial"
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
          <label htmlFor="calculo-opcional-mes-final" className="ui-label">
            Mes final
          </label>
          <select
            id="calculo-opcional-mes-final"
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
          <label htmlFor="calculo-opcional-ano-final" className="ui-label">
            Año final
          </label>
          <select
            id="calculo-opcional-ano-final"
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
          <label htmlFor="calculo-opcional-modo" className="ui-label w-full">
            Modo
          </label>
          <select
            id="calculo-opcional-modo"
            value={modo}
            onChange={(e) => setModo(e.target.value as ModoCalculoUso)}
            className="ui-input mt-1 min-h-10 w-full"
            disabled={previaCargando || ejecutando}
          >
            <option value="solo-vacios">Solo campos vacíos</option>
            <option value="reemplazar">Reemplazar existentes</option>
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

      {previaCargando && (
        <p role="status" className="ui-muted mt-3 text-xs">
          Generando la vista previa del intervalo…
        </p>
      )}

      {vistaPrevia && !previaCargando && (
        <div className="mt-4 space-y-3">
          <p className="ui-muted text-xs">
            Intervalo: {clavePeriodo(vistaPrevia.intervalo.desde)} –{' '}
            {clavePeriodo(vistaPrevia.intervalo.hasta)}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="ui-stat">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Meses en el intervalo: {vistaPrevia.intervalo.cantidadMeses}
              </p>
            </div>
            <div className="ui-stat">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Resultados existentes: {vistaPrevia.conteos.existentes}
              </p>
            </div>
            <div className="ui-stat">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Periodos pendientes: {vistaPrevia.conteos.pendientes}
              </p>
            </div>
            <div className="ui-stat">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Se calcularán ahora: {pendientes}
              </p>
            </div>
          </div>

          {pendientes === 0 ? (
            <p className="ui-callout ui-callout-info text-xs" role="status">
              No hay periodos pendientes en este intervalo. Los resultados
              existentes se conservan; para recalcularlos use Edificaciones ›
              Cálculo de uso.
            </p>
          ) : (
            !ejecutando &&
            !resumen && (
              <button
                type="button"
                onClick={() => void ejecutar()}
                className="ui-btn ui-btn-primary min-h-10"
              >
                Ejecutar cálculo ({pendientes}{' '}
                {pendientes === 1 ? 'periodo' : 'periodos'})
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
                aria-label="Avance del cálculo de uso"
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
                    etiqueta: 'Calculados',
                    valor: resumen.calculados,
                    clase: 'text-emerald-700 dark:text-emerald-400',
                  },
                  {
                    etiqueta: 'Conservados',
                    valor: resumen.conservados,
                    clase: 'text-sky-700 dark:text-sky-400',
                  },
                  {
                    etiqueta: 'Fallidos',
                    valor: resumen.fallidos,
                    clase: 'text-red-600 dark:text-red-400',
                  },
                  {
                    etiqueta: 'En revisión',
                    valor: resumen.revisar,
                    clase: 'text-amber-700 dark:text-amber-400',
                  },
                ].map((c) => (
                  <div key={c.etiqueta} className="ui-stat">
                    <p className={`text-lg font-semibold ${c.clase}`}>
                      {c.valor}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {c.etiqueta}
                    </p>
                  </div>
                ))}
              </div>
              {resumen.fallidos > 0 && (
                <p className="ui-callout ui-callout-warn text-xs" role="status">
                  {resumen.fallidos} periodo(s) fallido(s). Puede volver a
                  revisar el intervalo para reintentarlos.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
