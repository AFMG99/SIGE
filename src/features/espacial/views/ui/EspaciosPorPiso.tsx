'use client'

import type { Edificacion3DScene } from '../../models/espacial.types'
import {
  filtrarBloquesPorPiso,
  obtenerPisos,
  TODOS_LOS_PISOS,
} from '../../models/espaciosPorPiso'

interface EspaciosPorPisoProps {
  edificacion: Edificacion3DScene
  pisoSeleccionado: string
  onPisoChange: (piso: string) => void
  onVerBloque: (bloqueId: string) => void
}

const formatoArea = (area: number): string =>
  `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(area)} m²`

export function EspaciosPorPiso({
  edificacion,
  pisoSeleccionado,
  onPisoChange,
  onVerBloque,
}: EspaciosPorPisoProps) {
  const pisos = obtenerPisos(edificacion.bloques)
  const bloques = filtrarBloquesPorPiso(edificacion.bloques, pisoSeleccionado)
  const espacios = bloques.flatMap((bloque) => bloque.espacios)
  const areaMedida = espacios.reduce(
    (total, espacio) => total + (espacio.areaCalculadaM2 ?? 0),
    0
  )
  const espaciosMedidos = espacios.filter(
    (espacio) => espacio.largoM != null && espacio.anchoM != null
  ).length

  return (
    <section aria-labelledby="espacios-piso-title" className="space-y-5">
      <div className="ui-panel overflow-hidden">
        <div className="grid gap-5 border-b border-gray-200 p-5 dark:border-slate-800 sm:grid-cols-[1fr_auto] sm:items-end sm:p-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-uv-forest dark:text-uv-soft">
              Inventario espacial
            </p>
            <h2 id="espacios-piso-title" className="ui-title mt-2 text-xl">
              Espacios por piso
            </h2>
            <p className="ui-muted mt-2 text-sm leading-relaxed">
              Consulte las áreas y dimensiones registradas para cada nivel. Las posiciones
              físicas en planta se mostrarán cuando se cuente con geometría validada.
            </p>
          </div>
          <label className="ui-field w-full sm:w-56">
            <span className="ui-label">Piso o nivel</span>
            <select
              aria-label="Filtrar espacios por piso"
              className="ui-input"
              value={pisoSeleccionado}
              onChange={(event) => onPisoChange(event.target.value)}
            >
              <option value={TODOS_LOS_PISOS}>Todos los pisos</option>
              {pisos.map((piso) => (
                <option key={piso} value={piso}>
                  {piso}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-slate-800 sm:grid-cols-3">
          <div className="p-4 sm:px-6">
            <p className="ui-muted text-xs">Espacios en vista</p>
            <p className="mt-1 text-xl font-semibold text-uv-ink dark:text-white">
              {espacios.length}
            </p>
          </div>
          <div className="p-4 sm:px-6">
            <p className="ui-muted text-xs">Área geométrica registrada</p>
            <p className="mt-1 text-xl font-semibold text-uv-ink dark:text-white">
              {formatoArea(areaMedida)}
            </p>
          </div>
          <div className="col-span-2 border-t border-gray-200 p-4 dark:border-slate-800 sm:col-span-1 sm:border-l-0 sm:border-t-0 sm:px-6">
            <p className="ui-muted text-xs">Con dimensiones</p>
            <p className="mt-1 text-xl font-semibold text-uv-ink dark:text-white">
              {espaciosMedidos} <span className="text-sm font-normal">/ {espacios.length}</span>
            </p>
          </div>
        </div>
      </div>

      {bloques.length === 0 ? (
        <div className="ui-empty">
          <p className="font-semibold">No hay espacios para mostrar en este nivel</p>
          <p className="mt-1 text-sm">
            Asigne espacios a pisos desde Gestión de Datos para consultarlos aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bloques.map((bloque) => (
            <section key={bloque.id} className="ui-card overflow-hidden">
              <header className="flex flex-col gap-3 border-b border-gray-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-uv-forest dark:text-uv-soft">
                    {bloque.codigo}
                  </p>
                  <h3 className="mt-1 truncate text-base font-semibold text-uv-ink dark:text-white">
                    {bloque.nombre}
                  </h3>
                </div>
                <button
                  type="button"
                  className="ui-btn ui-btn-secondary min-h-10 shrink-0"
                  onClick={() => onVerBloque(bloque.id)}
                >
                  Ver bloque 3D
                </button>
              </header>

              <ul className="grid gap-px bg-gray-200 sm:grid-cols-2 xl:grid-cols-3 dark:bg-slate-800">
                {bloque.espacios.map((espacio) => {
                  const dimensiones =
                    espacio.largoM != null && espacio.anchoM != null
                      ? `${espacio.largoM} × ${espacio.anchoM}${espacio.altoM == null ? '' : ` × ${espacio.altoM}`} m`
                      : 'Dimensiones pendientes'

                  return (
                    <li
                      key={espacio.id}
                      className="flex min-h-28 flex-col justify-between gap-4 bg-white p-4 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-semibold text-uv-ink dark:text-white">
                            {espacio.nombre}
                          </h4>
                          <p className="ui-muted mt-1 text-xs">Piso: {espacio.piso}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {espacio.areaCalculadaM2 == null
                            ? 'Área pendiente'
                            : formatoArea(espacio.areaCalculadaM2)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2 dark:border-slate-800">
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {dimensiones}
                        </span>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {espacio.cantidadEquipos} equipos ·{' '}
                          {(espacio.potenciaTotalW / 1000).toFixed(2)} kW
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
