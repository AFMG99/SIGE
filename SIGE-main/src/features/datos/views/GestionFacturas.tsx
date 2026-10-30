'use client'

/**
 * Pestaña "Gestión" de Facturas de energía: CRUD sobre los datos ya guardados.
 *
 * Edita los campos de una fila en línea (el periodo es la identidad y no
 * cambia), elimina filas con confirmación y vacía la base de facturas
 * —incluidas las Líneas Base que se calculan a partir de ellas— para
 * empezar desde cero. Las variables operativas se conservan.
 *
 * Mantiene un espejo local de ediciones/eliminaciones para que la UI
 * responda al instante mientras `router.refresh()` sincroniza el servidor.
 */

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { actualizarFactura, eliminarFactura, vaciarFacturas } from '@/features/datos/controllers/facturas'
import { eliminarLineaBase, vaciarLineasBase } from '@/features/datos/controllers/lineasBase'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'
import { useToast } from '@/shared/views/ui/ToastProvider'
import { LABEL_POR_TIPO_LBEN } from '@/features/datos/models/lineasBase'
import type { FacturaExistente, FacturasExistentes, LineaBaseExistente } from './existencias'

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
  'w-28 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm tabular-nums focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100'

const BOTON_FILA =
  'focus-ring rounded-md px-2 py-1 text-xs font-medium transition-colors'

type Borrador = {
  diasFacturados: string
  consumoKwh: string
  costoCop: string
}

type GestionFacturasProps = {
  facturas: FacturasExistentes
  /** Total de líneas base guardadas, para el diálogo de "vaciar". */
  lineasBaseTotal: number
  /** Hasta 50 líneas base guardadas para la tabla de gestión. */
  lineasBaseFilas: LineaBaseExistente[]
}

export function GestionFacturas({ facturas, lineasBaseTotal, lineasBaseFilas }: GestionFacturasProps) {
  const router = useRouter()
  const { showToast } = useToast()

  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)
  const [editando, setEditando] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [idPorEliminar, setIdPorEliminar] = useState<string | null>(null)
  const [abriendoVaciar, setAbriendoVaciar] = useState(false)

  // Espejo local: la fila editada/eliminada cambia de inmediato en pantalla.
  const [editadas, setEditadas] = useState<Record<string, FacturaExistente>>({})
  const [eliminadas, setEliminadas] = useState<Set<string>>(new Set())
  const [vaciadas, setVaciadas] = useState(false)

  // Espejo local de las líneas base guardadas (tabla aparte, misma sección).
  const [lineasBaseEliminadas, setLineasBaseEliminadas] = useState<Set<string>>(new Set())
  const [lineasBaseVaciadas, setLineasBaseVaciadas] = useState(false)
  const [lineaBasePorEliminar, setLineaBasePorEliminar] = useState<string | null>(null)
  const [abriendoVaciarLineasBase, setAbriendoVaciarLineasBase] = useState(false)

  const filasActuales = useMemo(() => {
    if (vaciadas) return []
    return facturas.filas
      .filter((f) => !eliminadas.has(f.id))
      .map((f) => editadas[f.id] ?? f)
  }, [facturas.filas, editadas, eliminadas, vaciadas])

  const totalActual = vaciadas ? 0 : Math.max(0, facturas.total - eliminadas.size)

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return filasActuales
    return filasActuales.filter((f) =>
      [f.periodo, f.edificacion, String(f.diasFacturados), String(f.consumoKwh), String(f.costoCop)].some(
        (valor) => valor.toLowerCase().includes(q.toLowerCase())
      )
    )
  }, [filasActuales, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const desde = paginaActual * FILAS_POR_PAGINA
  const visibles = filtradas.slice(desde, desde + FILAS_POR_PAGINA)
  const sinCoincidencias = busqueda.trim().length > 0 && filtradas.length === 0

  function iniciarEdicion(fila: FacturaExistente) {
    setEditando(fila.id)
    setBorrador({
      diasFacturados: String(fila.diasFacturados),
      consumoKwh: String(fila.consumoKwh),
      costoCop: String(fila.costoCop),
    })
  }

  function cancelarEdicion() {
    setEditando(null)
    setBorrador(null)
  }

  async function guardar() {
    if (!editando || !borrador) return
    const dias = Number(borrador.diasFacturados)
    const consumo = Number(borrador.consumoKwh)
    const costo = Number(borrador.costoCop)
    if (!Number.isFinite(dias) || !Number.isFinite(consumo) || !Number.isFinite(costo)) {
      showToast('Ingrese valores numéricos en todos los campos.', 'error')
      return
    }
    if (dias <= 0 || consumo < 0 || costo < 0) {
      showToast('Los días deben ser mayores a 0 y los valores no pueden ser negativos.', 'error')
      return
    }

    const original = filasActuales.find((f) => f.id === editando)
    setGuardando(true)
    const res = await actualizarFactura(editando, {
      diasFacturados: dias,
      consumoKwh: consumo,
      costoCop: costo,
    })
    setGuardando(false)
    showToast(res.mensaje, res.estado === 'completado' ? 'success' : 'error')
    if (res.estado === 'completado') {
      if (original) {
        setEditadas((prev) => ({
          ...prev,
          [original.id]: { ...original, diasFacturados: dias, consumoKwh: consumo, costoCop: costo },
        }))
      }
      cancelarEdicion()
      router.refresh()
    }
  }

  async function confirmarEliminacion() {
    if (!idPorEliminar) return
    const res = await eliminarFactura(idPorEliminar)
    showToast(res.mensaje, res.estado === 'completado' ? 'success' : 'error')
    if (res.estado === 'completado') {
      setEliminadas((prev) => new Set(prev).add(idPorEliminar))
      if (editando === idPorEliminar) cancelarEdicion()
      router.refresh()
    }
    setIdPorEliminar(null)
  }

  async function confirmarVaciar() {
    const res = await vaciarFacturas()
    showToast(res.mensaje, res.estado === 'completado' ? 'success' : 'error')
    if (res.estado === 'completado') {
      setVaciadas(true)
      setEditadas({})
      cancelarEdicion()
      router.refresh()
    }
    setAbriendoVaciar(false)
  }

  const filaEnEdicion = editando ? filasActuales.find((f) => f.id === editando) : undefined

  const filasLineaBase = useMemo(
    () =>
      lineasBaseVaciadas
        ? []
        : lineasBaseFilas.filter((lb) => !lineasBaseEliminadas.has(lb.id)),
    [lineasBaseFilas, lineasBaseEliminadas, lineasBaseVaciadas]
  )

  const totalLineasBase = lineasBaseVaciadas
    ? 0
    : Math.max(0, lineasBaseTotal - lineasBaseEliminadas.size)

  async function confirmarEliminarLineaBase() {
    if (!lineaBasePorEliminar) return
    const res = await eliminarLineaBase(lineaBasePorEliminar)
    showToast(res.mensaje, res.estado === 'completado' ? 'success' : 'error')
    if (res.estado === 'completado') {
      setLineasBaseEliminadas((prev) => new Set(prev).add(lineaBasePorEliminar))
      router.refresh()
    }
    setLineaBasePorEliminar(null)
  }

  async function confirmarVaciarLineasBase() {
    const res = await vaciarLineasBase()
    showToast(res.mensaje, res.estado === 'completado' ? 'success' : 'error')
    if (res.estado === 'completado') {
      setLineasBaseVaciadas(true)
      router.refresh()
    }
    setAbriendoVaciarLineasBase(false)
  }

  const filaLineaBasePorEliminar = lineaBasePorEliminar
    ? filasLineaBase.find((lb) => lb.id === lineaBasePorEliminar)
    : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="ui-title text-sm">Gestión de facturas guardadas</h3>
          <p className="ui-muted text-xs">
            Edite, elimine o vacíe los registros de facturas de energía y sus líneas base.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          {totalActual} {totalActual === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <label htmlFor="gestion-facturas-buscar" className="sr-only">
            Buscar en facturas para gestionar
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
            id="gestion-facturas-buscar"
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
          <p className="ui-title text-sm">No hay facturas guardadas</p>
          <p className="max-w-md text-xs">
            La base de facturas está vacía. Use la pestaña Carga para importar un nuevo
            histórico desde cero.
          </p>
        </div>
      ) : sinCoincidencias ? (
        <div className="ui-empty py-10">
          <p className="ui-title text-sm">Sin coincidencias</p>
          <p className="text-xs">Ningún registro coincide con «{busqueda.trim()}».</p>
        </div>
      ) : (
        <div className="ui-table-shell max-h-96 overflow-auto">
          <table className="ui-table">
            <caption className="sr-only">
              Facturas de energía guardadas: filas editables y eliminables.
            </caption>
            <thead className="sticky top-0 z-0">
              <tr>
                <th scope="col" className="whitespace-nowrap">
                  Periodo
                </th>
                <th scope="col" className="whitespace-nowrap">
                  Edificación
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  Días
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  Consumo (kWh)
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  Costo (COP)
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {visibles.map((fila) =>
                filaEnEdicion?.id === fila.id && borrador ? (
                  <tr key={fila.id} className="bg-emerald-50/60 dark:bg-emerald-950/30">
                    <td className="whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">
                      {fila.periodo}
                    </td>
                    <td className="whitespace-nowrap text-gray-500 dark:text-gray-400">
                      {fila.edificacion}
                    </td>
                    <td className="text-right">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        aria-label={`Días facturados de ${fila.periodo}`}
                        value={borrador.diasFacturados}
                        onChange={(e) =>
                          setBorrador((b) => (b ? { ...b, diasFacturados: e.target.value } : b))
                        }
                        className={`${INPUT_CLASE} ml-auto text-right`}
                      />
                    </td>
                    <td className="text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        aria-label={`Consumo kWh de ${fila.periodo}`}
                        value={borrador.consumoKwh}
                        onChange={(e) =>
                          setBorrador((b) => (b ? { ...b, consumoKwh: e.target.value } : b))
                        }
                        className={`${INPUT_CLASE} ml-auto text-right`}
                      />
                    </td>
                    <td className="text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        aria-label={`Costo COP de ${fila.periodo}`}
                        value={borrador.costoCop}
                        onChange={(e) =>
                          setBorrador((b) => (b ? { ...b, costoCop: e.target.value } : b))
                        }
                        className={`${INPUT_CLASE} ml-auto text-right`}
                      />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label={`Guardar cambios en ${fila.periodo}`}
                          disabled={guardando}
                          onClick={guardar}
                          className={`${BOTON_FILA} bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50`}
                        >
                          {guardando ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Cancelar edición de ${fila.periodo}`}
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
                  <tr key={fila.id} className="hover:bg-gray-50/70 dark:hover:bg-slate-800/60">
                    <td className="whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">
                      {fila.periodo}
                    </td>
                    <td className="whitespace-nowrap text-gray-500 dark:text-gray-400">
                      {fila.edificacion}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {fmtEntero.format(fila.diasFacturados)}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {fmtDecimal2.format(fila.consumoKwh)}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {fmtEntero.format(fila.costoCop)}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label={`Editar factura ${fila.periodo}`}
                          onClick={() => iniciarEdicion(fila)}
                          className={`${BOTON_FILA} border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800`}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          aria-label={`Eliminar factura ${fila.periodo}`}
                          onClick={() => setIdPorEliminar(fila.id)}
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

      {/* Líneas base guardadas: se eliminan aquí sin tocar las facturas. */}
      <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="ui-title text-sm">Líneas base guardadas</h4>
            <p className="ui-muted text-xs">
              Modelos calculados en la pestaña Líneas Base. Elimínelas una a una o vacíe la lista;
              las facturas y variables se conservan.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              {totalLineasBase} {totalLineasBase === 1 ? 'línea base' : 'líneas base'}
            </span>
            <button
              type="button"
              onClick={() => setAbriendoVaciarLineasBase(true)}
              disabled={totalLineasBase === 0}
              className="ui-btn ui-btn-danger-outline"
            >
              Vaciar líneas base
            </button>
          </div>
        </div>

        {totalLineasBase === 0 ? (
          <div className="ui-empty py-8">
            <p className="ui-title text-sm">No hay líneas base guardadas</p>
            <p className="max-w-md text-xs">
              Calcule y guarde un modelo desde la pestaña Líneas Base; aparecerá aquí para su
              gestión.
            </p>
          </div>
        ) : (
          <div className="ui-table-shell max-h-64 overflow-auto">
            <table className="ui-table">
              <caption className="sr-only">Líneas base guardadas: filas eliminables.</caption>
              <thead className="sticky top-0 z-0">
                <tr>
                  <th scope="col" className="whitespace-nowrap">
                    Alcance
                  </th>
                  <th scope="col" className="whitespace-nowrap">
                    Modelo
                  </th>
                  <th scope="col" className="whitespace-nowrap text-right">
                    R²
                  </th>
                  <th scope="col" className="whitespace-nowrap">
                    Guardada
                  </th>
                  <th scope="col" className="whitespace-nowrap text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filasLineaBase.map((lb) => (
                  <tr key={lb.id} className="hover:bg-gray-50/70 dark:hover:bg-slate-800/60">
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {lb.bloqueCodigo
                        ? `${lb.bloqueCodigo} — ${lb.bloqueNombre}`
                        : `Edificación completa${lb.edificacionNombre ? ` (${lb.edificacionNombre})` : ''}`}
                    </td>
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {LABEL_POR_TIPO_LBEN[lb.tipo] ?? lb.tipo}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {lb.r2 == null ? '—' : fmtDecimal2.format(lb.r2)}
                    </td>
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {lb.guardadaEn}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          aria-label={`Eliminar línea base ${LABEL_POR_TIPO_LBEN[lb.tipo] ?? lb.tipo} ${lb.bloqueCodigo ? `del bloque ${lb.bloqueCodigo}` : 'de la edificación completa'}`}
                          onClick={() => setLineaBasePorEliminar(lb.id)}
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

        <p className="ui-callout ui-callout-info text-xs">
          Vaciar las líneas base no afecta las facturas ni las variables operativas. También se
          eliminan automáticamente al vaciar la base de facturas.
        </p>
      </div>

      <p className="ui-callout ui-callout-info text-xs">
        Editar una factura recalcula su consumo normalizado (base 30 días). Las líneas base se
        derivan de estas facturas: al vaciar la base se eliminan también.
      </p>

      <ConfirmDialog
        isOpen={idPorEliminar !== null}
        onClose={() => setIdPorEliminar(null)}
        onConfirm={confirmarEliminacion}
        title={`¿Eliminar factura ${filasActuales.find((f) => f.id === idPorEliminar)?.periodo ?? ''}?`}
        description="El registro se eliminará permanentemente de la base de datos. Esta acción no se puede deshacer."
        confirmText="Eliminar"
      />

      <ConfirmDialog
        isOpen={abriendoVaciar}
        onClose={() => setAbriendoVaciar(false)}
        onConfirm={confirmarVaciar}
        title="¿Vaciar la base de facturas?"
        description={`Se eliminarán ${totalActual} facturas y ${lineasBaseTotal} líneas base guardadas. Las variables operativas se conservan. Esta acción no se puede deshacer.`}
        confirmText="Vaciar todo"
      />

      <ConfirmDialog
        isOpen={lineaBasePorEliminar !== null}
        onClose={() => setLineaBasePorEliminar(null)}
        onConfirm={confirmarEliminarLineaBase}
        title={`¿Eliminar la línea base ${filaLineaBasePorEliminar ? (LABEL_POR_TIPO_LBEN[filaLineaBasePorEliminar.tipo] ?? filaLineaBasePorEliminar.tipo).toLowerCase() : ''} ${filaLineaBasePorEliminar ? (filaLineaBasePorEliminar.bloqueCodigo ? `del bloque ${filaLineaBasePorEliminar.bloqueCodigo}` : 'de la edificación completa') : ''}?`}
        description="El registro se eliminará permanentemente de la base de datos. Las facturas y variables se conservan. Esta acción no se puede deshacer."
        confirmText="Eliminar"
      />

      <ConfirmDialog
        isOpen={abriendoVaciarLineasBase}
        onClose={() => setAbriendoVaciarLineasBase(false)}
        onConfirm={confirmarVaciarLineasBase}
        title="¿Vaciar las líneas base guardadas?"
        description={`Se eliminarán las ${totalLineasBase} líneas base guardadas. Facturas, variables, bloques y edificaciones se conservan. Esta acción no se puede deshacer.`}
        confirmText="Vaciar todo"
      />
    </div>
  )
}
