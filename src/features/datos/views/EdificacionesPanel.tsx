'use client'

/**
 * Sección «Edificaciones» (nivel principal del módulo de datos): catálogo
 * maestro de la estructura física — edificaciones → bloques → espacios —
 * que segmenta facturas, equipos y variables. Crea, edita y elimina
 * edificaciones; gestiona bloques y espacios (cantidad de espacios, UPME §7.3).
 *
 * El estado vive en `DatosContent` (`useCatalogoEdificaciones`): este panel
 * solo invoca los callbacks y refleja lo que devuelven, de modo que lo creado
 * aquí se ve al instante en Facturas, Equipos, Variables y Líneas Base.
 */

import { useState, FormEvent } from 'react'
import { tipoEdificacionPorCodigo } from '@/features/datos/models/validations'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'
import { useToast } from '@/shared/views/ui/ToastProvider'
import { EdificacionDrawer } from './EdificacionDrawer'
import type { EdificacionFormData, EdificacionEditable } from './EdificacionDrawer'
import { CalendarioGdeDrawer } from './CalendarioGdeDrawer'
import { BloqueDrawer } from './BloqueDrawer'
import type { BloqueFormData } from './BloqueDrawer'
import type {
  ActualizarEdificacion,
  BloqueInfo,
  CalendarioInfo,
  CrearBloque,
  CrearEdificacion,
  CrearEspacio,
  EdificacionInfo,
  EliminarBloque,
  EliminarEdificacion,
  EliminarEspacio,
  EspacioInfo,
  RangoCalendarioUI,
} from './useCatalogoEdificaciones'

type ObjetivoBorrado = 'edificacion' | 'bloque' | 'espacio' | null

const formatearArea = (area?: number | null): string =>
  area == null
    ? 'Sin área registrada'
    : `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(area)} m²`

export function EdificacionesPanel({
  edificaciones,
  bloques,
  espacios,
  calendarios,
  rangos,
  crearEdificacion,
  actualizarEdificacion,
  eliminarEdificacion,
  crearBloque,
  eliminarBloque,
  crearEspacio,
  eliminarEspacio,
}: {
  edificaciones: EdificacionInfo[]
  bloques: BloqueInfo[]
  espacios: EspacioInfo[]
  /** Configuración operativa (calendario/GDE) por edificación. */
  calendarios: CalendarioInfo[]
  /** Rangos de fechas de todos los calendarios. */
  rangos: RangoCalendarioUI[]
  crearEdificacion: CrearEdificacion
  actualizarEdificacion: ActualizarEdificacion
  eliminarEdificacion: EliminarEdificacion
  crearBloque: CrearBloque
  eliminarBloque: EliminarBloque
  crearEspacio: CrearEspacio
  eliminarEspacio: EliminarEspacio
}) {
  const { showToast } = useToast()

  const [edifDrawerOpen, setEdifDrawerOpen] = useState(false)
  /** Edificación en edición; null = modo creación. */
  const [edifEdicion, setEdifEdicion] = useState<EdificacionEditable | null>(null)
  const [guardandoEdificacion, setGuardandoEdificacion] = useState(false)
  const [bloqueDrawerOpen, setBloqueDrawerOpen] = useState(false)
  const [guardandoBloque, setGuardandoBloque] = useState(false)
  /** Edificación destino del BloqueDrawer. */
  const [edificacionNueva, setEdificacionNueva] = useState<EdificacionInfo | null>(null)

  const [dialogoBorrado, setDialogoBorrado] = useState<ObjetivoBorrado>(null)
  /** Edificación con el drawer de calendario/GDE abierto. */
  const [calEdificacion, setCalEdificacion] = useState<EdificacionInfo | null>(null)
  const [edificacionObjetivo, setEdificacionObjetivo] = useState<EdificacionInfo | null>(null)
  const [bloqueObjetivo, setBloqueObjetivo] = useState<BloqueInfo | null>(null)
  const [espacioObjetivo, setEspacioObjetivo] = useState<EspacioInfo | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const etiquetaTipo = (codigo: string): string => tipoEdificacionPorCodigo(codigo).etiqueta

  // ------------------------------------------
  // Creación y edición (drawers)
  // ------------------------------------------

  const abrirCreacion = () => {
    setEdifEdicion(null)
    setEdifDrawerOpen(true)
  }

  const abrirEdicion = (e: EdificacionInfo) => {
    setEdifEdicion({ id: e.id, nombre: e.nombre, tipo: e.tipo, area: e.area })
    setEdifDrawerOpen(true)
  }

  /** Submit del EdificacionDrawer (crear o editar): en error lanza para que el drawer muestre la alerta. */
  const guardarDesdeDrawer = async (datos: EdificacionFormData) => {
    if (guardandoEdificacion) return
    setGuardandoEdificacion(true)
    try {
      const res = edifEdicion
        ? await actualizarEdificacion(edifEdicion.id, { nombre: datos.nombre, area: datos.area })
        : await crearEdificacion(datos.nombre, datos.tipo, datos.area)
      if (res.estado === 'error') {
        throw new Error(res.mensaje)
      }
      setEdifDrawerOpen(false)
      setAviso(null)
      showToast(res.mensaje, 'success')
    } finally {
      setGuardandoEdificacion(false)
    }
  }

  /** Submit del BloqueDrawer: en error lanza para que el drawer muestre la alerta. */
  const crearBloqueDesdeDrawer = async (datos: BloqueFormData) => {
    if (guardandoBloque || !edificacionNueva) return
    setGuardandoBloque(true)
    try {
      const res = await crearBloque(
        edificacionNueva.id,
        datos.codigo,
        datos.nombre,
        datos.area || undefined,
        datos.factor || undefined
      )
      if (res.estado === 'error') {
        throw new Error(res.mensaje)
      }
      setBloqueDrawerOpen(false)
      setAviso(null)
      showToast(res.mensaje, 'success')
    } finally {
      setGuardandoBloque(false)
    }
  }

  /** Alta rápida de espacio en un bloque (cantidad de espacios — UPME §7.3). */
  const crearEspacioEnBloque = async (bloqueId: string, e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const campo = form.elements.namedItem('nombre-espacio') as HTMLInputElement | null
    const nombre = campo?.value.trim() ?? ''
    if (!campo || !nombre) return
    const res = await crearEspacio(bloqueId, nombre)
    if (res.estado === 'error') {
      setAviso(res.mensaje)
      return
    }
    setAviso(null)
    campo.value = ''
    showToast(res.mensaje, 'success')
  }

  // ------------------------------------------
  // Eliminación (confirmación)
  // ------------------------------------------

  const cerrarBorrado = () => {
    if (borrando) return
    setDialogoBorrado(null)
    setEdificacionObjetivo(null)
    setBloqueObjetivo(null)
    setEspacioObjetivo(null)
  }

  const confirmarBorrado = async () => {
    if (borrando) return
    setBorrando(true)
    try {
      if (dialogoBorrado === 'edificacion' && edificacionObjetivo) {
        const res = await eliminarEdificacion(edificacionObjetivo.id)
        if (res.estado === 'error') {
          setDialogoBorrado(null)
          setAviso(res.mensaje)
          return
        }
        showToast(res.mensaje, 'success')
      } else if (dialogoBorrado === 'bloque' && bloqueObjetivo) {
        const res = await eliminarBloque(bloqueObjetivo.id)
        if (res.estado === 'error') {
          setDialogoBorrado(null)
          setAviso(res.mensaje)
          return
        }
        showToast(res.mensaje, 'success')
      } else if (dialogoBorrado === 'espacio' && espacioObjetivo) {
        const res = await eliminarEspacio(espacioObjetivo.id)
        if (res.estado === 'error') {
          setDialogoBorrado(null)
          setAviso(res.mensaje)
          return
        }
        showToast(res.mensaje, 'success')
      }
      setAviso(null)
      cerrarBorrado()
    } finally {
      setBorrando(false)
    }
  }

  const totalEspacios = espacios.length

  return (
    <div className="space-y-6">
      {aviso && (
        <div
          className="ui-callout ui-callout-danger flex items-start justify-between gap-3"
          role="alert"
        >
          <p>{aviso}</p>
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="focus-ring -m-1 shrink-0 rounded p-1 font-bold text-red-500 hover:text-red-700"
            aria-label="Cerrar aviso"
          >
            ×
          </button>
        </div>
      )}

      {/* Resumen del catálogo */}
      <div className="ui-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="ui-title text-sm">Catálogo de edificaciones</h3>
            <p className="ui-muted mt-1 text-xs">
              Estructura que segmenta facturas, equipos y variables. Las edificaciones con tipo
              «Campus Educativo» u «Oficina Pública» se organizan en bloques; los demás tipos
              usan un bloque único automático.
            </p>
          </div>
          <button
            type="button"
            onClick={abrirCreacion}
            className="ui-btn ui-btn-primary shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nueva edificación
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <dt className="ui-label">Edificaciones</dt>
            <dd className="ui-title mt-0.5 text-lg">{edificaciones.length}</dd>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <dt className="ui-label">Bloques</dt>
            <dd className="ui-title mt-0.5 text-lg">{bloques.length}</dd>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <dt className="ui-label">Espacios</dt>
            <dd className="ui-title mt-0.5 text-lg">{totalEspacios}</dd>
          </div>
        </dl>

        {edificaciones.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center dark:border-slate-700">
            <p className="ui-title text-sm">Sin edificaciones</p>
            <p className="ui-muted mt-1 text-xs">
              Cree la primera edificación con el botón «Nueva edificación».
            </p>
          </div>
        )}
      </div>

      {/* Ficha por edificación */}
      {edificaciones.map((e) => {
        const info = tipoEdificacionPorCodigo(e.tipo)
        const bloquesDe = bloques.filter((b) => b.edificacionId === e.id)
        return (
          <div key={e.id} className="ui-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="ui-title text-sm">{e.nombre}</h3>
                  <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    {info.etiqueta}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      e.area == null
                        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-gray-300'
                    }`}
                  >
                    {formatearArea(e.area)}
                  </span>
                </div>
                <p className="ui-muted mt-1 text-xs">
                  {info.requiereBloque
                    ? 'Tipo con bloques: cree bloques para segmentar equipos y variables.'
                    : 'Tipo sin bloques: usa el bloque único automático.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCalEdificacion(e)}
                  disabled={borrando}
                  aria-label={`Calendario y GDE de ${e.nombre}`}
                  className="ui-btn ui-btn-secondary"
                >
                  Calendario y GDE
                </button>
                {info.requiereBloque && (
                  <button
                    type="button"
                    onClick={() => {
                      setEdificacionNueva(e)
                      setBloqueDrawerOpen(true)
                    }}
                    className="ui-btn ui-btn-secondary"
                  >
                    Nuevo bloque
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => abrirEdicion(e)}
                  disabled={borrando}
                  aria-label={`Editar edificación ${e.nombre}`}
                  className="ui-btn ui-btn-secondary"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEdificacionObjetivo(e)
                    setDialogoBorrado('edificacion')
                  }}
                  disabled={borrando}
                  aria-label={`Eliminar edificación ${e.nombre}`}
                  className="ui-btn ui-btn-secondary text-red-600 hover:border-red-400 hover:text-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>

            {bloquesDe.length === 0 ? (
              <p className="ui-muted mt-3 text-xs">
                Sin bloques registrados. Los equipos y variables necesitan al menos uno.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-slate-800 dark:border-slate-700">
                {bloquesDe.map((b) => {
                  const espaciosDe = espacios.filter((s) => s.bloqueId === b.id)
                  return (
                    <li key={b.id} className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {b.codigo} — {b.nombre}
                          </p>
                          <p className="ui-muted text-xs">
                            {espaciosDe.length === 0
                              ? 'Sin espacios'
                              : espaciosDe.length === 1
                                ? '1 espacio'
                                : `${espaciosDe.length} espacios`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBloqueObjetivo(b)
                            setDialogoBorrado('bloque')
                          }}
                          disabled={borrando}
                          aria-label={`Eliminar bloque ${b.codigo}`}
                          className="ui-btn ui-btn-secondary shrink-0 text-red-600 hover:border-red-400 hover:text-red-700"
                        >
                          Eliminar
                        </button>
                      </div>

                      {/* Espacios del bloque: consulta + alta rápida + baja */}
                      <div className="mt-2 space-y-2">
                        {espaciosDe.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-2.5 py-1.5 dark:bg-slate-800/60"
                          >
                            <p className="min-w-0 truncate text-xs">{s.nombre}</p>
                            <button
                              type="button"
                              onClick={() => {
                                setEspacioObjetivo(s)
                                setDialogoBorrado('espacio')
                              }}
                              disabled={borrando}
                              aria-label={`Eliminar espacio ${s.nombre}`}
                              className="focus-ring shrink-0 rounded text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Eliminar
                            </button>
                          </div>
                        ))}
                        <form
                          onSubmit={(e2) => void crearEspacioEnBloque(b.id, e2)}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="text"
                            name="nombre-espacio"
                            placeholder="Nombre del espacio (ej. Aula 101)"
                            maxLength={100}
                            aria-label={`Nuevo espacio en el bloque ${b.codigo}`}
                            className="ui-input min-h-10 flex-1 py-1.5 text-xs"
                          />
                          <button
                            type="submit"
                            disabled={borrando}
                            className="ui-btn ui-btn-secondary ui-btn-sm shrink-0"
                          >
                            Añadir espacio
                          </button>
                        </form>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}

      {/* Drawers de creación/edición (patrón "Nuevo usuario": panel lateral con portal) */}
      <EdificacionDrawer
        isOpen={edifDrawerOpen}
        onClose={() => setEdifDrawerOpen(false)}
        onSubmit={guardarDesdeDrawer}
        submitting={guardandoEdificacion}
        edicion={edifEdicion}
      />
      <BloqueDrawer
        isOpen={bloqueDrawerOpen}
        onClose={() => setBloqueDrawerOpen(false)}
        onSubmit={crearBloqueDesdeDrawer}
        edificacion={edificacionNueva}
        submitting={guardandoBloque}
      />
      <CalendarioGdeDrawer
        isOpen={calEdificacion != null}
        onClose={() => setCalEdificacion(null)}
        edificacion={calEdificacion}
        configInicial={
          calEdificacion
            ? calendarios.find((c) => c.edificacionId === calEdificacion.id) ?? null
            : null
        }
        rangosIniciales={
          calEdificacion
            ? (() => {
                const cfg = calendarios.find((c) => c.edificacionId === calEdificacion.id)
                return cfg ? rangos.filter((r) => r.calendarioId === cfg.id) : []
              })()
            : []
        }
      />

      {/* Confirmaciones de borrado */}
      <ConfirmDialog
        isOpen={dialogoBorrado === 'edificacion'}
        onClose={cerrarBorrado}
        onConfirm={() => void confirmarBorrado()}
        title="Eliminar edificación"
        description={`Se eliminará la edificación "${
          edificacionObjetivo?.nombre ?? ''
        }" junto con todos sus bloques y sus espacios vacíos. Si tiene facturas o datos guardados, la eliminación se rechazará. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
      />
      <ConfirmDialog
        isOpen={dialogoBorrado === 'bloque'}
        onClose={cerrarBorrado}
        onConfirm={() => void confirmarBorrado()}
        title="Eliminar bloque"
        description={`Se eliminará el bloque "${
          bloqueObjetivo ? `${bloqueObjetivo.codigo} — ${bloqueObjetivo.nombre}` : ''
        }" y sus espacios vacíos. Si tiene datos guardados, la eliminación se rechazará. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
      />
      <ConfirmDialog
        isOpen={dialogoBorrado === 'espacio'}
        onClose={cerrarBorrado}
        onConfirm={() => void confirmarBorrado()}
        title="Eliminar espacio"
        description={`Se eliminará el espacio "${
          espacioObjetivo?.nombre ?? ''
        }". Si tiene equipos registrados, la eliminación se rechazará. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
      />
    </div>
  )
}
