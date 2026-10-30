'use client'

/**
 * Pestaña "Gestión" del Inventario de Equipos: CRUD sobre los datos ya
 * guardados.
 *
 * Edita tipo, cantidad y potencia nominal en línea (la ubicación
 * bloque/espacio es inmutable), elimina filas con confirmación y vacía el
 * inventario para empezar desde cero. El catálogo de edificaciones,
 * bloques y espacios se conserva porque lo comparten Variables Operativas
 * y Líneas Base.
 *
 * Mantiene un espejo local de ediciones/eliminaciones para que la UI
 * responda al instante mientras `router.refresh()` sincroniza el servidor.
 */

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { actualizarEquipo, eliminarEquipo, vaciarEquipos } from '@/features/datos/controllers/equipos'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'
import { useToast } from '@/shared/views/ui/ToastProvider'
import type { EquipoExistente, EquiposExistentes } from './existencias'

const FILAS_POR_PAGINA = 25

const fmtEntero = new Intl.NumberFormat('es-CO')
const fmtDecimal2 = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const INPUT_CLASE =
  'w-24 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm tabular-nums focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100'

const BOTON_FILA =
  'focus-ring rounded-md px-2 py-1 text-xs font-medium transition-colors'

type Borrador = {
  tipo: string
  cantidad: string
  potenciaNominal: string
}

type GestionEquiposProps = {
  equipos: EquiposExistentes
}

export function GestionEquipos({ equipos }: GestionEquiposProps) {
  const router = useRouter()
  const { showToast } = useToast()

  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)
  const [editando, setEditando] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [idPorEliminar, setIdPorEliminar] = useState<string | null>(null)
  const [abriendoVaciar, setAbriendoVaciar] = useState(false)

  const [editadas, setEditadas] = useState<Record<string, EquipoExistente>>({})
  const [eliminadas, setEliminadas] = useState<Set<string>>(new Set())
  const [vaciados, setVaciados] = useState(false)

  const filasActuales = useMemo(() => {
    if (vaciados) return []
    return equipos.filas
      .filter((e) => !eliminadas.has(e.id))
      .map((e) => editadas[e.id] ?? e)
  }, [equipos.filas, editadas, eliminadas, vaciados])

  const totalActual = vaciados ? 0 : Math.max(0, equipos.total - eliminadas.size)

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return filasActuales
    return filasActuales.filter((e) =>
      [
        e.edificacion,
        e.bloqueCodigo,
        e.bloqueNombre,
        e.espacio,
        e.tipo,
        String(e.cantidad),
        String(e.potenciaNominal),
      ].some((c) => normalizar(c).includes(q))
    )
  }, [filasActuales, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const desde = paginaActual * FILAS_POR_PAGINA
  const visibles = filtradas.slice(desde, desde + FILAS_POR_PAGINA)
  const sinCoincidencias = busqueda.trim().length > 0 && filtradas.length === 0

  function iniciarEdicion(equipo: EquipoExistente) {
    setEditando(equipo.id)
    setBorrador({
      tipo: equipo.tipo,
      cantidad: String(equipo.cantidad),
      potenciaNominal: String(equipo.potenciaNominal),
    })
  }

  function cancelarEdicion() {
    setEditando(null)
    setBorrador(null)
  }

  async function guardar() {
    if (!editando || !borrador) return
    const tipo = borrador.tipo.trim()
    const cantidad = Number(borrador.cantidad)
    const potencia = Number(borrador.potenciaNominal)
    if (!tipo) {
      showToast('El tipo de equipo es obligatorio.', 'error')
      return
    }
    if (!Number.isFinite(cantidad) || !Number.isFinite(potencia)) {
      showToast('Ingrese valores numéricos en cantidad y potencia.', 'error')
      return
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0 || potencia < 0) {
      showToast('La cantidad debe ser un entero mayor a 0 y la potencia no puede ser negativa.', 'error')
      return
    }

    const original = filasActuales.find((e) => e.id === editando)
    setGuardando(true)
    const res = await actualizarEquipo(editando, {
      tipo,
      cantidad,
      potenciaNominal: potencia,
    })
    setGuardando(false)
    showToast(res.mensaje, res.estado === 'completado' ? 'success' : 'error')
    if (res.estado === 'completado') {
      if (original) {
        setEditadas((prev) => ({
          ...prev,
          [original.id]: { ...original, tipo, cantidad, potenciaNominal: potencia },
        }))
      }
      cancelarEdicion()
      router.refresh()
    }
  }

  async function confirmarEliminacion() {
    if (!idPorEliminar) return
    const res = await eliminarEquipo(idPorEliminar)
    showToast(res.mensaje, res.estado === 'completado' ? 'success' : 'error')
    if (res.estado === 'completado') {
      setEliminadas((prev) => new Set(prev).add(idPorEliminar))
      if (editando === idPorEliminar) cancelarEdicion()
      router.refresh()
    }
    setIdPorEliminar(null)
  }

  async function confirmarVaciar() {
    const res = await vaciarEquipos()
    showToast(res.mensaje, res.estado === 'completado' ? 'success' : 'error')
    if (res.estado === 'completado') {
      setVaciados(true)
      setEditadas({})
      cancelarEdicion()
      router.refresh()
    }
    setAbriendoVaciar(false)
  }

  const equipoEnEdicion = editando ? filasActuales.find((e) => e.id === editando) : undefined
  const equipoPorEliminar = idPorEliminar
    ? filasActuales.find((e) => e.id === idPorEliminar)
    : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="ui-title text-sm">Gestión del inventario guardado</h3>
          <p className="ui-muted text-xs">
            Edite cantidades y potencias, elimine equipos o vacíe el inventario.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          {totalActual} {totalActual === 1 ? 'equipo' : 'equipos'}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <label htmlFor="gestion-equipos-buscar" className="sr-only">
            Buscar en equipos para gestionar
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
            id="gestion-equipos-buscar"
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setPagina(0)
            }}
            placeholder="Buscar por cualquier columna…"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100"
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
          <p className="ui-title text-sm">El inventario está vacío</p>
          <p className="max-w-md text-xs">
            No hay equipos registrados. Use la pestaña Carga para importar un inventario desde
            cero; edificaciones, bloques y espacios se conservan.
          </p>
        </div>
      ) : sinCoincidencias ? (
        <div className="ui-empty py-10">
          <p className="ui-title text-sm">Sin coincidencias</p>
          <p className="text-xs">Ningún equipo coincide con «{busqueda.trim()}».</p>
        </div>
      ) : (
        <div className="ui-table-shell max-h-96 overflow-auto">
          <table className="ui-table">
            <caption className="sr-only">
              Inventario de equipos eléctricos: filas editables y eliminables.
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
                  Espacio
                </th>
                <th scope="col" className="whitespace-nowrap">
                  Tipo
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  Cantidad
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  Potencia (kW)
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {visibles.map((equipo) =>
                equipoEnEdicion?.id === equipo.id && borrador ? (
                  <tr key={equipo.id} className="bg-amber-50/60 dark:bg-amber-950/30">
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {equipo.edificacion}
                    </td>
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {equipo.bloqueCodigo}
                    </td>
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {equipo.espacio}
                    </td>
                    <td className="whitespace-nowrap">
                      <input
                        type="text"
                        maxLength={60}
                        aria-label={`Tipo de equipo en ${equipo.espacio}`}
                        value={borrador.tipo}
                        onChange={(e) =>
                          setBorrador((b) => (b ? { ...b, tipo: e.target.value } : b))
                        }
                        className={`${INPUT_CLASE} w-36`}
                      />
                    </td>
                    <td className="text-right">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        aria-label={`Cantidad en ${equipo.espacio}`}
                        value={borrador.cantidad}
                        onChange={(e) =>
                          setBorrador((b) => (b ? { ...b, cantidad: e.target.value } : b))
                        }
                        className={`${INPUT_CLASE} ml-auto text-right`}
                      />
                    </td>
                    <td className="text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        aria-label={`Potencia nominal en ${equipo.espacio}`}
                        value={borrador.potenciaNominal}
                        onChange={(e) =>
                          setBorrador((b) => (b ? { ...b, potenciaNominal: e.target.value } : b))
                        }
                        className={`${INPUT_CLASE} ml-auto text-right`}
                      />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label={`Guardar cambios en ${equipo.espacio}`}
                          disabled={guardando}
                          onClick={guardar}
                          className={`${BOTON_FILA} bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50`}
                        >
                          {guardando ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Cancelar edición de ${equipo.espacio}`}
                          disabled={guardando}
                          onClick={cancelarEdicion}
                          className={`${BOTON_FILA} border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800`}
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={equipo.id} className="hover:bg-gray-50/70 dark:hover:bg-slate-800/60">
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {equipo.edificacion}
                    </td>
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {equipo.bloqueCodigo}
                    </td>
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {equipo.espacio}
                    </td>
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {equipo.tipo}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {fmtEntero.format(equipo.cantidad)}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {fmtDecimal2.format(equipo.potenciaNominal)}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label={`Editar equipo ${equipo.tipo} en ${equipo.espacio}`}
                          onClick={() => iniciarEdicion(equipo)}
                          className={`${BOTON_FILA} border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800`}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          aria-label={`Eliminar equipo ${equipo.tipo} en ${equipo.espacio}`}
                          onClick={() => setIdPorEliminar(equipo.id)}
                          className={`${BOTON_FILA} border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40`}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
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
        La ubicación de cada equipo (bloque y espacio) no se modifica desde aquí: para mover
        equipos reimporte el inventario. Vaciar no borra edificaciones, bloques ni espacios.
      </p>

      <ConfirmDialog
        isOpen={idPorEliminar !== null}
        onClose={() => setIdPorEliminar(null)}
        onConfirm={confirmarEliminacion}
        title={`¿Eliminar ${equipoPorEliminar?.tipo ?? 'equipo'} en ${equipoPorEliminar?.espacio ?? ''}?`}
        description="El equipo se eliminará permanentemente del inventario. Esta acción no se puede deshacer."
        confirmText="Eliminar"
      />

      <ConfirmDialog
        isOpen={abriendoVaciar}
        onClose={() => setAbriendoVaciar(false)}
        onConfirm={confirmarVaciar}
        title="¿Vaciar el inventario de equipos?"
        description={`Se eliminarán los ${totalActual} equipos guardados. Edificaciones, bloques y espacios se conservan. Esta acción no se puede deshacer.`}
        confirmText="Vaciar todo"
      />
    </div>
  )
}
