'use client'

/**
 * Modo «Edificaciones» (sección Facturas de energía): catálogo maestro de la
 * estructura física — edificaciones → bloques → espacios — que segmenta
 * facturas, equipos y variables. Crea y elimina edificaciones y bloques; los
 * espacios nacen con la importación de equipos y no se editan aquí.
 *
 * El estado vive en `DatosContent` (`useCatalogoEdificaciones`): este panel
 * solo invoca los callbacks y refleja lo que devuelven, de modo que lo creado
 * aquí se ve al instante en Equipos, Variables y Líneas Base.
 */

import { useState } from 'react'
import { tipoEdificacionPorCodigo } from '@/lib/validations/energia'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/ToastProvider'
import { EdificacionDrawer } from './EdificacionDrawer'
import type { EdificacionFormData } from './EdificacionDrawer'
import { BloqueDrawer } from './BloqueDrawer'
import type { BloqueFormData } from './BloqueDrawer'
import type {
  BloqueInfo,
  CrearBloque,
  CrearEdificacion,
  EdificacionInfo,
  EliminarBloque,
  EliminarEdificacion,
  EspacioInfo,
} from './useCatalogoEdificaciones'

type ObjetivoBorrado = 'edificacion' | 'bloque' | null

export function EdificacionesPanel({
  edificaciones,
  bloques,
  espacios,
  crearEdificacion,
  eliminarEdificacion,
  crearBloque,
  eliminarBloque,
}: {
  edificaciones: EdificacionInfo[]
  bloques: BloqueInfo[]
  espacios: EspacioInfo[]
  crearEdificacion: CrearEdificacion
  eliminarEdificacion: EliminarEdificacion
  crearBloque: CrearBloque
  eliminarBloque: EliminarBloque
}) {
  const { showToast } = useToast()

  const [edifDrawerOpen, setEdifDrawerOpen] = useState(false)
  const [guardandoEdificacion, setGuardandoEdificacion] = useState(false)
  const [bloqueDrawerOpen, setBloqueDrawerOpen] = useState(false)
  const [guardandoBloque, setGuardandoBloque] = useState(false)
  /** Edificación destino del BloqueDrawer. */
  const [edificacionNueva, setEdificacionNueva] = useState<EdificacionInfo | null>(null)

  const [dialogoBorrado, setDialogoBorrado] = useState<ObjetivoBorrado>(null)
  const [edificacionObjetivo, setEdificacionObjetivo] = useState<EdificacionInfo | null>(null)
  const [bloqueObjetivo, setBloqueObjetivo] = useState<BloqueInfo | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const etiquetaTipo = (codigo: string): string => tipoEdificacionPorCodigo(codigo).etiqueta

  // ------------------------------------------
  // Creación (drawers)
  // ------------------------------------------

  /** Submit del EdificacionDrawer: en error lanza para que el drawer muestre la alerta. */
  const crearDesdeDrawer = async (datos: EdificacionFormData) => {
    if (guardandoEdificacion) return
    setGuardandoEdificacion(true)
    try {
      const res = await crearEdificacion(datos.nombre, datos.tipo)
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

  // ------------------------------------------
  // Eliminación (confirmación)
  // ------------------------------------------

  const cerrarBorrado = () => {
    if (borrando) return
    setDialogoBorrado(null)
    setEdificacionObjetivo(null)
    setBloqueObjetivo(null)
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
            onClick={() => setEdifDrawerOpen(true)}
            className="ui-btn ui-btn-primary shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nueva edificación
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
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
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                    >
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
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}

      {/* Drawers de creación (patrón "Nuevo usuario": panel lateral con portal) */}
      <EdificacionDrawer
        isOpen={edifDrawerOpen}
        onClose={() => setEdifDrawerOpen(false)}
        onSubmit={crearDesdeDrawer}
        submitting={guardandoEdificacion}
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
    </div>
  )
}
