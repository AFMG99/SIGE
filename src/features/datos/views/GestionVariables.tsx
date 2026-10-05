'use client'

/**
 * Pestaña "Gestión" de Variables Operativas: CRUD sobre los datos ya
 * guardados.
 *
 * Edita en línea los seis campos operativos de cada registro (población fija
 * y flotante, días lectivos/laborales y GDE), elimina filas con confirmación
 * y vacía la base de variables para empezar desde cero. El periodo
 * (mes + año) y el bloque son inmutables: son la clave única del registro.
 *
 * Vaciar no borra facturas ni líneas base guardadas (son snapshots de
 * resultados), y el catálogo de edificaciones, bloques y espacios se conserva
 * porque lo comparten Facturas, Equipos y Líneas Base.
 *
 * Mantiene un espejo local de ediciones/eliminaciones para que la UI
 * responda al instante mientras `router.refresh()` sincroniza el servidor.
 */

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { actualizarVariable, eliminarVariable, vaciarVariables } from '@/features/datos/controllers/variables'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'
import { useToast } from '@/shared/views/ui/ToastProvider'
import type { VariableExistente, VariablesExistentes } from './existencias'

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
  'w-20 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm tabular-nums focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100'

const BOTON_FILA =
  'focus-ring rounded-md px-2 py-1 text-xs font-medium transition-colors'

type Borrador = {
  poblacionFija: string
  poblacionFlotante: string
  diasLectivosLaborales: string
  gradesDiaEnfriamiento: string
}

type GestionVariablesProps = {
  variables: VariablesExistentes
}

export function GestionVariables({ variables }: GestionVariablesProps) {
  const router = useRouter()
  const { showToast } = useToast()

  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)
  const [editando, setEditando] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [idPorEliminar, setIdPorEliminar] = useState<string | null>(null)
  const [abriendoVaciar, setAbriendoVaciar] = useState(false)

  const [editadas, setEditadas] = useState<Record<string, VariableExistente>>({})
  const [eliminadas, setEliminadas] = useState<Set<string>>(new Set())
  const [vaciados, setVaciados] = useState(false)

  const filasActuales = useMemo(() => {
    if (vaciados) return []
    return variables.filas
      .filter((v) => !eliminadas.has(v.id))
      .map((v) => editadas[v.id] ?? v)
  }, [variables.filas, editadas, eliminadas, vaciados])

  const totalActual = vaciados ? 0 : Math.max(0, variables.total - eliminadas.size)

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return filasActuales
    return filasActuales.filter((v) =>
      [
        v.periodo,
        v.bloqueCodigo,
        v.bloqueNombre,
        String(v.poblacionFija),
        String(v.poblacionFlotante),
        String(v.diasLectivosLaborales),
        String(v.gradesDiaEnfriamiento),
      ].some((c) => normalizar(c).includes(q))
    )
  }, [filasActuales, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const desde = paginaActual * FILAS_POR_PAGINA
  const visibles = filtradas.slice(desde, desde + FILAS_POR_PAGINA)
  const sinCoincidencias = busqueda.trim().length > 0 && filtradas.length === 0

  function iniciarEdicion(variable: VariableExistente) {
    setEditando(variable.id)
    setBorrador({
      poblacionFija: String(variable.poblacionFija),
      poblacionFlotante: String(variable.poblacionFlotante),
      diasLectivosLaborales: String(variable.diasLectivosLaborales),
      gradesDiaEnfriamiento: String(variable.gradesDiaEnfriamiento),
    })
  }

  function cancelarEdicion() {
    setEditando(null)
    setBorrador(null)
  }

  async function guardar() {
    if (!editando || !borrador) return

    const poblacionFija = Number(borrador.poblacionFija)
    const poblacionFlotante = Number(borrador.poblacionFlotante)
    const diasLectivosLaborales = Number(borrador.diasLectivosLaborales)
    const gradesDiaEnfriamiento = Number(borrador.gradesDiaEnfriamiento)

    const enteros = [poblacionFija, poblacionFlotante, diasLectivosLaborales]
    if (enteros.some((n) => !Number.isFinite(n) || !Number.isInteger(n) || n < 0)) {
      showToast('Los conteos de población y días deben ser enteros no negativos.', 'error')
      return
    }
    if (!Number.isFinite(gradesDiaEnfriamiento) || gradesDiaEnfriamiento < 0) {
      showToast('El GDE debe ser un número no negativo.', 'error')
      return
    }

    const original = filasActuales.find((v) => v.id === editando)
    setGuardando(true)
    const res = await actualizarVariable(editando, {
      poblacionFija,
      poblacionFlotante,
      diasLectivosLaborales,
      gradesDiaEnfriamiento,
    })
    setGuardando(false)
    showToast(res.mensaje, res.estado === 'completado' ? 'success' : 'error')
    if (res.estado === 'completado') {
      if (original) {
        setEditadas((prev) => ({
          ...prev,
          [original.id]: {
            ...original,
            poblacionFija,
            poblacionFlotante,
            diasLectivosLaborales,
            gradesDiaEnfriamiento,
          },
        }))
      }
      cancelarEdicion()
      router.refresh()
    }
  }

  async function confirmarEliminacion() {
    if (!idPorEliminar) return
    const res = await eliminarVariable(idPorEliminar)
    showToast(res.mensaje, res.estado === 'completado' ? 'success' : 'error')
    if (res.estado === 'completado') {
      setEliminadas((prev) => new Set(prev).add(idPorEliminar))
      if (editando === idPorEliminar) cancelarEdicion()
      router.refresh()
    }
    setIdPorEliminar(null)
  }

  async function confirmarVaciar() {
    const res = await vaciarVariables()
    showToast(res.mensaje, res.estado === 'completado' ? 'success' : 'error')
    if (res.estado === 'completado') {
      setVaciados(true)
      setEditadas({})
      cancelarEdicion()
      router.refresh()
    }
    setAbriendoVaciar(false)
  }

  const variableEnEdicion = editando
    ? filasActuales.find((v) => v.id === editando)
    : undefined
  const variablePorEliminar = idPorEliminar
    ? filasActuales.find((v) => v.id === idPorEliminar)
    : undefined

  const campoNumerico = (
    clave: keyof Borrador,
    etiqueta: string,
    opciones: { min?: number; step?: number } = {}
  ) => (
    <input
      type="number"
      min={opciones.min ?? 0}
      step={opciones.step ?? 1}
      aria-label={`${etiqueta} de ${variableEnEdicion?.periodo ?? ''}`}
      value={borrador?.[clave] ?? ''}
      onChange={(e) => setBorrador((b) => (b ? { ...b, [clave]: e.target.value } : b))}
      className={`${INPUT_CLASE} ml-auto text-right`}
    />
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="ui-title text-sm">Gestión de variables guardadas</h3>
          <p className="ui-muted text-xs">
            Edite población, días lectivos/laborales y GDE; elimine registros o vacíe la base.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
          {totalActual} {totalActual === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <label htmlFor="gestion-variables-buscar" className="sr-only">
            Buscar en variables para gestionar
          </label>
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            id="gestion-variables-buscar"
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setPagina(0)
            }}
            placeholder="Buscar por cualquier columna…"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100"
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
          <p className="ui-title text-sm">No hay variables operativas</p>
          <p className="max-w-md text-xs">
            No hay registros de población y clima. Use la pestaña Carga para importarlos desde
            cero; facturas, líneas base y el catálogo de bloques se conservan.
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
              Variables operativas: filas editables y eliminables.
            </caption>
            <thead className="sticky top-0 z-0">
              <tr>
                <th scope="col" className="whitespace-nowrap">
                  Periodo
                </th>
                <th scope="col" className="whitespace-nowrap">
                  Bloque
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  Pob. fija
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  Pob. flotante
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  Días
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  GDE
                </th>
                <th scope="col" className="whitespace-nowrap text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {visibles.map((variable) =>
                variableEnEdicion?.id === variable.id && borrador ? (
                  <tr key={variable.id} className="bg-sky-50/60 dark:bg-sky-950/30">
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {variable.periodo}
                    </td>
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {variable.bloqueCodigo}
                    </td>
                    <td className="text-right">
                      {campoNumerico('poblacionFija', 'Población fija')}
                    </td>
                    <td className="text-right">
                      {campoNumerico('poblacionFlotante', 'Población flotante')}
                    </td>
                    <td className="text-right">
                      {campoNumerico('diasLectivosLaborales', 'Días')}
                    </td>
                    <td className="text-right">
                      {campoNumerico('gradesDiaEnfriamiento', 'GDE', { step: 0.01 })}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label={`Guardar cambios en ${variable.periodo}`}
                          disabled={guardando}
                          onClick={guardar}
                          className={`${BOTON_FILA} bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50`}
                        >
                          {guardando ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Cancelar edición de ${variable.periodo}`}
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
                  <tr key={variable.id} className="hover:bg-gray-50/70 dark:hover:bg-slate-800/60">
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {variable.periodo}
                    </td>
                    <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {variable.bloqueCodigo}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {fmtEntero.format(variable.poblacionFija)}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {fmtEntero.format(variable.poblacionFlotante)}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {fmtEntero.format(variable.diasLectivosLaborales)}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {fmtDecimal2.format(variable.gradesDiaEnfriamiento)}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label={`Editar variable ${variable.periodo} del bloque ${variable.bloqueCodigo}`}
                          onClick={() => iniciarEdicion(variable)}
                          className={`${BOTON_FILA} border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800`}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          aria-label={`Eliminar variable ${variable.periodo} del bloque ${variable.bloqueCodigo}`}
                          onClick={() => setIdPorEliminar(variable.id)}
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
        El periodo (mes y año) y el bloque definen la identidad del registro y no se modifican
        desde aquí: para cambiarlos reimporte el archivo. Vaciar no borra facturas ni líneas base
        guardadas, ni el catálogo de bloques.
      </p>

      <ConfirmDialog
        isOpen={idPorEliminar !== null}
        onClose={() => setIdPorEliminar(null)}
        onConfirm={confirmarEliminacion}
        title={`¿Eliminar la variable de ${variablePorEliminar?.periodo ?? ''}?`}
        description={`Se eliminará el registro del bloque ${variablePorEliminar?.bloqueCodigo ?? ''} de forma permanente. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
      />

      <ConfirmDialog
        isOpen={abriendoVaciar}
        onClose={() => setAbriendoVaciar(false)}
        onConfirm={confirmarVaciar}
        title="¿Vaciar la base de variables operativas?"
        description={`Se eliminarán los ${totalActual} registros de población y clima. Facturas, líneas base guardadas y el catálogo de bloques se conservan. Esta acción no se puede deshacer.`}
        confirmText="Vaciar todo"
      />
    </div>
  )
}
