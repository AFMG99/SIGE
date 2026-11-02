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
import { BloqueDrawer } from './BloqueDrawer'
import type { BloqueFormData } from './BloqueDrawer'
import type {
  ActualizarEdificacion,
  ActualizarDimensionesBloque,
  ActualizarEspacio,
  BloqueInfo,
  CrearBloque,
  CrearEdificacion,
  CrearEspacio,
  EdificacionInfo,
  EliminarBloque,
  EliminarEdificacion,
  EliminarEspacio,
  EspacioInfo,
} from './useCatalogoEdificaciones'
import { PISO_SIN_ASIGNAR } from '@/features/datos/models/geometria'

type ObjetivoBorrado = 'edificacion' | 'bloque' | 'espacio' | null

const formatearArea = (area?: number | null): string =>
  area == null
    ? 'Sin área registrada'
    : `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(area)} m²`

const leerGeometria = (form: HTMLFormElement) => {
  const leer = (nombre: string): string => {
    const campo = form.elements.namedItem(nombre)
    return campo instanceof HTMLInputElement ? campo.value.trim() : ''
  }
  return {
    piso: leer('piso'),
    largoM: leer('largoM'),
    anchoM: leer('anchoM'),
    altoM: leer('altoM'),
  }
}

export function EdificacionesPanel({
  edificaciones,
  bloques,
  espacios,
  crearEdificacion,
  actualizarEdificacion,
  eliminarEdificacion,
  crearBloque,
  eliminarBloque,
  actualizarDimensionesBloque,
  crearEspacio,
  actualizarEspacio,
  eliminarEspacio,
}: {
  edificaciones: EdificacionInfo[]
  bloques: BloqueInfo[]
  espacios: EspacioInfo[]
  crearEdificacion: CrearEdificacion
  actualizarEdificacion: ActualizarEdificacion
  eliminarEdificacion: EliminarEdificacion
  crearBloque: CrearBloque
  eliminarBloque: EliminarBloque
  actualizarDimensionesBloque: ActualizarDimensionesBloque
  crearEspacio: CrearEspacio
  actualizarEspacio: ActualizarEspacio
  eliminarEspacio: EliminarEspacio
}) {
  const { showToast } = useToast()

  const [edifDrawerOpen, setEdifDrawerOpen] = useState(false)
  /** Edificación en edición; null = modo creación. */
  const [edifEdicion, setEdifEdicion] = useState<EdificacionEditable | null>(null)
  const [guardandoEdificacion, setGuardandoEdificacion] = useState(false)
  const [bloqueDrawerOpen, setBloqueDrawerOpen] = useState(false)
  const [guardandoBloque, setGuardandoBloque] = useState(false)
  const [bloqueConfigurando, setBloqueConfigurando] = useState<string | null>(null)
  const [espacioConfigurando, setEspacioConfigurando] = useState<string | null>(null)
  const [guardandoGeometria, setGuardandoGeometria] = useState(false)
  /** Edificación destino del BloqueDrawer. */
  const [edificacionNueva, setEdificacionNueva] = useState<EdificacionInfo | null>(null)

  const [dialogoBorrado, setDialogoBorrado] = useState<ObjetivoBorrado>(null)
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
        datos.factor || undefined,
        { largoM: datos.largoM, anchoM: datos.anchoM, altoM: datos.altoM }
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
    try {
      const res = await crearEspacio(bloqueId, nombre, leerGeometria(form))
      if (res.estado === 'error') {
        setAviso(res.mensaje)
        return
      }
      setAviso(null)
      form.reset()
      showToast(res.mensaje, 'success')
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No fue posible crear el espacio.')
    }
  }

  const guardarGeometriaBloque = async (bloqueId: string, e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (guardandoGeometria) return
    setGuardandoGeometria(true)
    const form = e.currentTarget
    try {
      const res = await actualizarDimensionesBloque(bloqueId, leerGeometria(form))
      if (res.estado === 'error') {
        setAviso(res.mensaje)
        return
      }
      setAviso(null)
      setBloqueConfigurando(null)
      showToast(res.mensaje, 'success')
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No fue posible actualizar las dimensiones.')
    } finally {
      setGuardandoGeometria(false)
    }
  }

  const guardarGeometriaEspacio = async (espacioId: string, e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (guardandoGeometria) return
    setGuardandoGeometria(true)
    const form = e.currentTarget
    try {
      const res = await actualizarEspacio(espacioId, leerGeometria(form))
      if (res.estado === 'error') {
        setAviso(res.mensaje)
        return
      }
      setAviso(null)
      setEspacioConfigurando(null)
      showToast(res.mensaje, 'success')
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No fue posible actualizar el espacio.')
    } finally {
      setGuardandoGeometria(false)
    }
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
                          <p className="ui-muted text-[11px]">
                            {b.largoM == null || b.anchoM == null
                              ? 'Sin dimensiones geométricas'
                              : `Huella ${formatearArea(b.areaHuellaM2)} · ${b.largoM} × ${b.anchoM}${b.altoM == null ? '' : ` × ${b.altoM}`} m`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setBloqueConfigurando(bloqueConfigurando === b.id ? null : b.id)
                          }
                          disabled={borrando || guardandoGeometria}
                          aria-label={`Configurar dimensiones del bloque ${b.codigo}`}
                          className="ui-btn ui-btn-secondary shrink-0"
                        >
                          Dimensiones
                        </button>
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

                      {bloqueConfigurando === b.id && (
                        <form
                          onSubmit={(e2) => void guardarGeometriaBloque(b.id, e2)}
                          className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-slate-700"
                        >
                          <p className="ui-label">Opciones avanzadas · dimensiones en metros</p>
                          <div className="mt-2 grid gap-3 sm:grid-cols-3">
                            {([
                              ['largoM', 'Largo'],
                              ['anchoM', 'Ancho'],
                              ['altoM', 'Altura'],
                            ] as const).map(([field, label]) => (
                              <label key={field} className="ui-field">
                                <span className="ui-label">{label}</span>
                                <input
                                  type="number"
                                  name={field}
                                  min="0.01"
                                  max="10000"
                                  step="0.01"
                                  defaultValue={b[field] ?? ''}
                                  disabled={guardandoGeometria}
                                  className="ui-input"
                                />
                              </label>
                            ))}
                          </div>
                          <p className="ui-muted mt-2 text-xs">
                            Al ingresar largo y ancho se calcula el área de huella sin modificar el área útil energética.
                          </p>
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setBloqueConfigurando(null)}
                              disabled={guardandoGeometria}
                              className="ui-btn ui-btn-secondary"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={guardandoGeometria}
                              className="ui-btn ui-btn-primary"
                            >
                              {guardandoGeometria ? 'Guardando…' : 'Guardar dimensiones'}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Espacios del bloque: consulta + alta rápida + baja */}
                      <div className="mt-2 space-y-2">
                        {espaciosDe.map((s) => (
                          <div key={s.id} className="rounded-md bg-gray-50 px-2.5 py-2 dark:bg-slate-800/60">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium">{s.nombre}</p>
                                <p className="ui-muted mt-0.5 text-[11px]">
                                  Piso: {s.piso || PISO_SIN_ASIGNAR}
                                  {s.areaCalculadaM2 != null
                                    ? ` · ${formatearArea(s.areaCalculadaM2)}`
                                    : ''}
                                  {s.largoM == null || s.anchoM == null
                                    ? ''
                                    : ` · ${s.largoM} × ${s.anchoM}${s.altoM == null ? '' : ` × ${s.altoM}`} m`}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEspacioConfigurando(espacioConfigurando === s.id ? null : s.id)
                                  }
                                  disabled={borrando || guardandoGeometria}
                                  aria-label={`Configurar piso y dimensiones del espacio ${s.nombre}, piso ${s.piso || PISO_SIN_ASIGNAR}, bloque ${b.codigo}`}
                                  className="ui-btn ui-btn-secondary shrink-0"
                                >
                                  Configurar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEspacioObjetivo(s)
                                    setDialogoBorrado('espacio')
                                  }}
                                  disabled={borrando}
                                  aria-label={`Eliminar espacio ${s.nombre}, piso ${s.piso || PISO_SIN_ASIGNAR}, bloque ${b.codigo}`}
                                  className="focus-ring rounded text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                            {espacioConfigurando === s.id && (
                              <form
                                onSubmit={(e2) => void guardarGeometriaEspacio(s.id, e2)}
                                className="mt-3 border-t border-gray-200 pt-3 dark:border-slate-700"
                              >
                                <p className="ui-label">Opciones avanzadas · ubicación y dimensiones</p>
                                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                  <label className="ui-field sm:col-span-2">
                                    <span className="ui-label">Piso o nivel</span>
                                    <input
                                      type="text"
                                      name="piso"
                                      maxLength={60}
                                      defaultValue={s.piso === PISO_SIN_ASIGNAR ? '' : s.piso}
                                      placeholder="Ej. 1, 2, Sótano"
                                      disabled={guardandoGeometria}
                                      className="ui-input"
                                    />
                                  </label>
                                  {([
                                    ['largoM', 'Largo (m)'],
                                    ['anchoM', 'Ancho (m)'],
                                    ['altoM', 'Altura (m)'],
                                  ] as const).map(([field, label]) => (
                                    <label key={field} className="ui-field">
                                      <span className="ui-label">{label}</span>
                                      <input
                                        type="number"
                                        name={field}
                                        min="0.01"
                                        max="10000"
                                        step="0.01"
                                        defaultValue={s[field] ?? ''}
                                        disabled={guardandoGeometria}
                                        className="ui-input"
                                      />
                                    </label>
                                  ))}
                                </div>
                                <div className="mt-3 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEspacioConfigurando(null)}
                                    disabled={guardandoGeometria}
                                    className="ui-btn ui-btn-secondary"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={guardandoGeometria}
                                    className="ui-btn ui-btn-primary"
                                  >
                                    {guardandoGeometria ? 'Guardando…' : 'Guardar'}
                                  </button>
                                </div>
                              </form>
                            )}
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
                          <details className="relative">
                            <summary className="focus-ring flex min-h-10 cursor-pointer items-center rounded-lg border border-gray-200 px-2 text-xs font-medium dark:border-slate-700">
                              Avanzado
                            </summary>
                            <div className="absolute right-0 z-10 mt-1 w-[min(20rem,85vw)] space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                              <label className="ui-field">
                                <span className="ui-label">Piso o nivel</span>
                                <input
                                  type="text"
                                  name="piso"
                                  maxLength={60}
                                  placeholder="Ej. 1, 2, Sótano"
                                  className="ui-input"
                                />
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                {([
                                  ['largoM', 'Largo (m)'],
                                  ['anchoM', 'Ancho (m)'],
                                  ['altoM', 'Altura (m)'],
                                ] as const).map(([field, label]) => (
                                  <label key={field} className="ui-field">
                                    <span className="ui-label">{label}</span>
                                    <input
                                      type="number"
                                      name={field}
                                      min="0.01"
                                      max="10000"
                                      step="0.01"
                                      className="ui-input"
                                    />
                                  </label>
                                ))}
                              </div>
                              <p className="ui-muted text-xs">
                                El área se calcula automáticamente con largo × ancho. Si se omite el piso, quedará «Sin asignar».
                              </p>
                            </div>
                          </details>
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
