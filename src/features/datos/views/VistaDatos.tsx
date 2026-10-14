'use client'

/**
 * Vista de visualización de los datos guardados en la base de datos.
 *
 * Vive en la pestaña "Visualización" de cada sección (separada de la carga):
 * chips de resumen, gráfico de barras animado, búsqueda sin acentos y tabla
 * paginada. Recibe el view-model puro de `existencias.ts`.
 */

import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { EASE } from './motion'
import type { PanelDatosVM } from './existencias'

const FILAS_POR_PAGINA = 25

const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const TONOS = {
  emerald: {
    barra: 'bg-emerald-500 hover:bg-emerald-600',
    barraH: 'bg-emerald-500',
    badge:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    icono: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    nota: 'ui-callout-success',
  },
  amber: {
    barra: 'bg-amber-500 hover:bg-amber-600',
    barraH: 'bg-amber-500',
    badge:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    icono: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    nota: 'ui-callout-warn',
  },
  sky: {
    barra: 'bg-sky-500 hover:bg-sky-600',
    barraH: 'bg-sky-500',
    badge:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
    icono: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
    nota: 'ui-callout-info',
  },
  purple: {
    barra: 'bg-uv-purple hover:opacity-80',
    barraH: 'bg-uv-purple',
    badge:
      'border-uv-purple/30 bg-uv-purple/10 text-uv-purple dark:border-uv-purple/40 dark:bg-uv-purple/20 dark:text-uv-purple',
    icono: 'bg-uv-purple/15 text-uv-purple dark:bg-uv-purple/20 dark:text-uv-purple',
    nota: 'ui-callout-info',
  },
} as const

function IconoBaseDatos({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </svg>
  )
}

function GraficoBarras({
  datos,
  tipo,
  barra,
  barraH,
}: {
  datos: PanelDatosVM['grafico']['datos']
  tipo: 'barras' | 'barrasH'
  barra: string
  barraH: string
}) {
  if (datos.length === 0) return null
  const maximo = Math.max(...datos.map((d) => d.valor), 0)

  if (tipo === 'barrasH') {
    return (
      <div className="mt-4 space-y-3">
        {datos.map((d, i) => (
          <div key={d.etiqueta}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-gray-700 dark:text-gray-300">{d.etiqueta}</span>
              <span className="shrink-0 font-medium tabular-nums text-gray-900 dark:text-gray-100">
                {d.tooltip}
              </span>
            </div>
            <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${maximo > 0 ? (d.valor / maximo) * 100 : 0}%` }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}
                className={`h-full rounded-full ${barraH}`}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-4 flex h-40 items-end gap-1.5">
      {datos.map((d, i) => (
        <div
          key={d.etiqueta}
          className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1"
        >
          <span className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white shadow-sm group-hover:block dark:bg-slate-700">
            {d.tooltip}
          </span>
          <motion.div
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, delay: i * 0.05, ease: EASE }}
            style={{
              height: `${maximo > 0 ? Math.max((d.valor / maximo) * 100, 2) : 2}%`,
              transformOrigin: 'bottom',
            }}
            className={`w-full rounded-t-sm ${barra}`}
          />
          <span className="text-[10px] leading-none text-gray-400">{d.etiqueta}</span>
        </div>
      ))}
    </div>
  )
}

export function VistaDatos({
  tono,
  titulo,
  descripcion,
  total,
  chips,
  grafico,
  columnas,
  filas,
  nota,
  vacio,
}: PanelDatosVM) {
  const clases = TONOS[tono]
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return filas
    return filas.filter((f) => f.celdas.some((c) => normalizar(c).includes(q)))
  }, [filas, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const desde = paginaActual * FILAS_POR_PAGINA
  const visibles = filtradas.slice(desde, desde + FILAS_POR_PAGINA)
  const sinCoincidencias = busqueda.trim().length > 0 && filtradas.length === 0
  const muestraParcial = filas.length < total

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${clases.icono}`} aria-hidden>
          <IconoBaseDatos />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="ui-title text-sm">{titulo}</h3>
          <p className="ui-muted truncate text-xs">{descripcion}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${clases.badge}`}
        >
          {total} {total === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      {total === 0 ? (
        <div className="ui-empty py-12">
          <IconoBaseDatos className="h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="ui-title text-sm">{vacio.titulo}</p>
          <p className="max-w-md text-xs">{vacio.descripcion}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {chips.map((c) => (
              <div key={c.etiqueta} className="ui-stat">
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{c.valor}</p>
                <p className="ui-muted mt-0.5 text-xs">{c.etiqueta}</p>
              </div>
            ))}
          </div>

          <div className="ui-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="ui-title text-sm">{grafico.titulo}</h4>
              <p className="ui-muted text-xs">Vista de los registros guardados</p>
            </div>
            <GraficoBarras
              datos={grafico.datos}
              tipo={grafico.tipo}
              barra={clases.barra}
              barraH={clases.barraH}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <label htmlFor="panel-existentes-buscar" className="sr-only">
                Buscar en datos guardados
              </label>
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                id="panel-existentes-buscar"
                type="search"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setPagina(0)
                }}
                placeholder="Buscar por cualquier columna…"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100"
              />
            </div>
            <p className="ui-muted text-xs">
              {muestraParcial
                ? `Mostrando las ${filas.length} más recientes de ${total} guardados`
                : `${total} ${total === 1 ? 'registro guardado' : 'registros guardados'}`}
            </p>
          </div>

          {sinCoincidencias ? (
            <div className="ui-empty py-10">
              <p className="ui-title text-sm">Sin coincidencias</p>
              <p className="text-xs">Ningún registro coincide con «{busqueda.trim()}».</p>
            </div>
          ) : (
            <div className="ui-table-shell max-h-96 overflow-auto">
              <table className="ui-table">
                <caption className="sr-only">
                  {titulo}: registros almacenados en la base de datos.
                </caption>
                <thead className="sticky top-0 z-0">
                  <tr>
                    {columnas.map((col) => (
                      <th
                        key={col.id}
                        scope="col"
                        className={`whitespace-nowrap ${col.derecha ? 'text-right' : ''}`}
                      >
                        {col.etiqueta}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {visibles.map((fila) => (
                    <tr
                      key={fila.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-slate-800/60"
                    >
                      {fila.celdas.map((celda, i) => (
                        <td
                          key={columnas[i]?.id ?? i}
                          className={`whitespace-nowrap text-gray-700 dark:text-gray-300 ${
                            columnas[i]?.derecha ? 'text-right tabular-nums' : ''
                          }`}
                        >
                          {celda}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtradas.length > FILAS_POR_PAGINA && (
            <div className="ui-muted flex flex-wrap items-center justify-between gap-3 text-xs">
              <p>
                Mostrando {desde + 1}–{Math.min(desde + FILAS_POR_PAGINA, filtradas.length)} de{' '}
                {filtradas.length} {muestraParcial ? '(recientes)' : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Página anterior"
                  disabled={paginaActual === 0}
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  aria-label="Página siguiente"
                  disabled={paginaActual >= totalPaginas - 1}
                  onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <p className={`ui-callout ${clases.nota} text-xs`}>
        <svg
          className="mt-0.5 h-3.5 w-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <span>{nota}</span>
      </p>
    </div>
  )
}
