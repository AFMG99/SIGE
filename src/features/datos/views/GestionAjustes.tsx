'use client'

/**
 * Pestaña "Gestión" de Ajustes Energéticos: CRUD sobre los datos ya guardados.
 *
 * Los ajustes no se crean desde la UI (hoy provienen de la semilla), pero sí
 * deben poder eliminarse: el catálogo de edificaciones/bloques cuenta estos
 * registros al bloquear el borrado de un bloque, así que vaciarlos aquí hace
 * accionable ese bloqueo. Ediciones en línea no aplican.
 *
 * Mantiene un espejo local de eliminaciones para que la UI responda al
 * instante mientras `router.refresh()` sincroniza el servidor.
 */

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { eliminarAjuste, vaciarAjustes } from '@/features/datos/controllers/ajustes'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'
import { useToast } from '@/shared/views/ui/ToastProvider'
import type { AjusteExistente, AjustesExistentes } from './existencias'

const FILAS_POR_PAGINA = 25

const fmtDecimal2 = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const etiquetaTipo = (tipo: string): string =>
  tipo === 'NO_RUTINARIO' ? 'No rutinario' : 'Rutinario'

const BOTON_FILA =
  'focus-ring rounded-md px-2 py-1 text-xs font-medium transition-colors'

type GestionAjustesProps = {
  ajustes: AjustesExistentes
  /** Abre el formulario de edición precargado con el ajuste indicado. */
  onEditar?: (ajuste: AjusteExistente) => void
}

export function GestionAjustes({ ajustes, onEditar }: GestionAjustesProps) {
  const router = useRouter()
  const { showToast } = useToast()

  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)
  const [idPorEliminar, setIdPorEliminar] = useState<string | null>(null)
  const [abriendoVaciar, setAbriendoVaciar] = useState(false)

  // Espejo local: la fila eliminada cambia de inmediato en pantalla.
  const [eliminadas, setEliminadas] = useState<Set<string>>(new Set())
  const [vaciados, setVaciados] = useState(false)

  const filasActuales = useMemo(
    () => (vaciados ? [] : ajustes.filas.filter((a) => !eliminadas.has(a.id))),
    [ajustes.filas, eliminadas, vaciados]
  )

  const totalActual = vaciados ? 0 : Math.max(0, ajustes.total - eliminadas.size)

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return filasActuales
    return filasActuales.filter((a) =>
      [
        a.edificacion,
        a.bloqueCodigo,
        a.bloqueNombre,
        a.tipo,
        a.periodo,
        String(a.valorAjuste),
        a.observaciones ?? '',
      ].some((c) => normalizar(c).includes(q))
    )
  }, [filasActuales, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const desde = paginaActual * FILAS_POR_PAGINA
  const visibles = filtradas.slice(desde, desde + FILAS_POR_PAGINA)
  const sinCoincidencias = busqueda.trim().length > 0 && filtradas.length === 0

  async function confirmarEliminacion() {
    if (!idPorEliminar) return
    const res = await eliminarAjuste(idPorEliminar)
    showToast(res.mensaje, res.estado === 'completado' ? 'success' : 'error')
    if (res.estado === 'completado') {
      setEliminadas((prev) => new Set(prev).add(idPorEliminar))
      router.refresh()
    }
    setIdPorEliminar(null)
  }

  async function confirmarVaciar() {
    const res = await vaciarAjustes()
    showToast(res.mensaje, res.estado === 'completado' ? 'success' : 'error')
    if (res.estado === 'completado') {
      setVaciados(true)
      router.refresh()
    }
    setAbriendoVaciar(false)
  }

  const ajustePorEliminar = idPorEliminar
    ? filasActuales.find((a) => a.id === idPorEliminar)
    : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="ui-title text-sm">Gestión de ajustes guardados</h3>
          <p className="ui-muted text-xs">
            Elimine ajustes puntuales o vacíe la base: el catálogo y los demás datos se conservan.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full border border-uv-purple/30 bg-uv-purple/10 px-2.5 py-1 text-[11px] font-medium text-uv-purple dark:border-uv-purple/40 dark:bg-uv-purple/20 dark:text-uv-purple">
          {totalActual} {totalActual === 1 ? 'ajuste' : 'ajustes'}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <label htmlFor="gestion-ajustes-buscar" className="sr-only">
            Buscar en ajustes para gestionar
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
            id="gestion-ajustes-buscar"
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setPagina(0)
            }}
            placeholder="Buscar por cualquier columna…"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-uv-purple focus:outline-none focus:ring-1 focus:ring-uv-purple dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100"
          />
        </div>
        <button
          type="button"
          onClick={() => setAbriendoVaciar(true)}
          disabled={totalActual === 0}
          className="ui-btn ui-btn-danger-outline"
        >
          Vaciar base de datos
        </button>
      </div>

      {totalActual === 0 ? (
        <div className="ui-empty py-12">
          <p className="ui-title text-sm">No hay ajustes guardados</p>
          <p className="max-w-md text-xs">
            La base de ajustes está vacía. Los bloques que dependían de estos registros ya pueden
            eliminarse desde el catálogo de edificaciones.
          </p>
        </div>
      ) : sinCoincidencias ? (
        <div className="ui-empty py-10">
          <p className="ui-title text-sm">Sin coincidencias</p>
          <p className="text-xs">Ningún ajuste coincide con «{busqueda.trim()}».</p>
        </div>
      ) : (
        <div className="ui-table-shell max-h-96 overflow-auto">
          <table className="ui-table">
            <caption className="sr-only">
              Ajustes energéticos guardados: filas eliminables.
            </caption>
            <thead className="sticky top-0 z-0">
              <tr>
                <th scope="col" className="whitespace-nowrap">
                  Edificación
                </th>
                <th scope="col" className="whitespace-nowrap">
                  Bloque
                </th>
                <th scope="col" className="whitespace-nowrap">
                  Tipo
                </th>
                <th scope="col" className="whitespace-nowrap">
                  Periodo
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  Valor
                </th>
                <th scope="col" className="whitespace-nowrap">
                  Observaciones
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {visibles.map((ajuste) => (
                <tr
                  key={ajuste.id}
                  className="hover:bg-gray-50/70 dark:hover:bg-slate-800/60"
                >
                  <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                    {ajuste.edificacion}
                  </td>
                  <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                    {ajuste.bloqueCodigo}
                  </td>
                  <td className="whitespace-nowrap">
                    <span
                      className={
                        ajuste.tipo === 'NO_RUTINARIO'
                          ? 'inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                      }
                    >
                      {etiquetaTipo(ajuste.tipo)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                    {ajuste.periodo}
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {fmtDecimal2.format(ajuste.valorAjuste)} %
                  </td>
                  <td className="max-w-56 truncate text-gray-700 dark:text-gray-300">
                    <span title={ajuste.observaciones ?? ''}>
                      {ajuste.observaciones ?? '—'}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      {onEditar && (
                        <button
                          type="button"
                          aria-label={`Editar ajuste ${etiquetaTipo(ajuste.tipo)} del bloque ${ajuste.bloqueCodigo}`}
                          onClick={() => onEditar(ajuste)}
                          className={`${BOTON_FILA} border border-uv-purple/40 text-uv-purple hover:bg-uv-purple/10 dark:border-uv-purple/50 dark:text-uv-purple`}
                        >
                          Editar
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Eliminar ajuste ${etiquetaTipo(ajuste.tipo)} del bloque ${ajuste.bloqueCodigo}`}
                        onClick={() => setIdPorEliminar(ajuste.id)}
                        className={`${BOTON_FILA} border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40`}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
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
            {filtradas.length}
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

      <p className="ui-callout ui-callout-info text-xs">
        Vaciar los ajustes no borra facturas, equipos, variables, líneas base, bloques ni
        edificaciones. Solo se eliminan estos registros, lo que habilita el borrado de bloques
        que quedaron bloqueados por tener ajustes.
      </p>

      <ConfirmDialog
        isOpen={idPorEliminar !== null}
        onClose={() => setIdPorEliminar(null)}
        onConfirm={confirmarEliminacion}
        title={`¿Eliminar el ajuste ${ajustePorEliminar ? etiquetaTipo(ajustePorEliminar.tipo).toLowerCase() : ''} del bloque ${ajustePorEliminar?.bloqueCodigo ?? ''}?`}
        description="El registro se eliminará permanentemente de la base de datos. Esta acción no se puede deshacer."
        confirmText="Eliminar"
      />

      <ConfirmDialog
        isOpen={abriendoVaciar}
        onClose={() => setAbriendoVaciar(false)}
        onConfirm={confirmarVaciar}
        title="¿Vaciar la base de ajustes?"
        description={`Se eliminarán los ${totalActual} ajustes guardados. Facturas, equipos, variables, líneas base, bloques y edificaciones se conservan. Esta acción no se puede deshacer.`}
        confirmText="Vaciar todo"
      />
    </div>
  )
}
