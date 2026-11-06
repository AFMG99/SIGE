'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

interface EspacioDisponible {
  id: string
  nombre: string
  piso: string
  bloqueId: string
  bloque: { codigo: string; nombre: string }
}

interface AsociacionGuardada {
  id: string
  nodeKey: string
  nodeName: string
  nodePath: string | null
  espacioId: string | null
  dimensiones: unknown
}

interface Props {
  modeloId: string
  node: {
    nodeKey: string
    nombre: string
    dimensiones: [number, number, number]
  }
  puedeEditar: boolean
}

export function AsociacionEspacioModelo({ modeloId, node, puedeEditar }: Props) {
  const [espacios, setEspacios] = useState<EspacioDisponible[]>([])
  const [asociaciones, setAsociaciones] = useState<AsociacionGuardada[]>([])
  const [espacioId, setEspacioId] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const response = await fetch(`/api/espacial/modelos/${encodeURIComponent(modeloId)}/elementos`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'No se pudieron consultar los espacios.')
      setEspacios(data.espacios as EspacioDisponible[])
      setAsociaciones(data.elementos as AsociacionGuardada[])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error consultando asociaciones.')
    } finally {
      setCargando(false)
    }
  }, [modeloId])

  useEffect(() => { void cargar() }, [cargar])

  const asociacionActual = useMemo(
    () => asociaciones.find((item) => item.nodeKey === node.nodeKey),
    [asociaciones, node.nodeKey]
  )

  useEffect(() => {
    setEspacioId(asociacionActual?.espacioId ?? '')
    setMensaje('')
    setError('')
  }, [asociacionActual?.espacioId, node.nodeKey])

  const guardar = async () => {
    if (!puedeEditar) return
    setGuardando(true)
    setError('')
    setMensaje('')
    try {
      const response = await fetch(`/api/espacial/modelos/${encodeURIComponent(modeloId)}/elementos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeKey: node.nodeKey,
          nodeName: node.nombre,
          nodePath: node.nodeKey,
          espacioId: espacioId || null,
          dimensiones: node.dimensiones,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'No fue posible guardar la asociación.')
      await cargar()
      setMensaje(espacioId ? 'Elemento asociado al espacio correctamente.' : 'Asociación retirada correctamente.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error guardando la asociación.')
    } finally {
      setGuardando(false)
    }
  }

  const seleccion = espacios.find((espacio) => espacio.id === espacioId)

  return (
    <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900 dark:bg-sky-950/20">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-900 dark:text-white">Asociar con un espacio de SIGE</p>
        {asociacionActual?.espacioId && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Asociado</span>}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
        Seleccione el espacio existente que representa este elemento. La asociación no crea ni modifica espacios.
      </p>

      {cargando ? (
        <p className="mt-3 text-xs text-slate-500">Consultando espacios registrados…</p>
      ) : espacios.length === 0 ? (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">No hay espacios registrados para esta edificación o bloque. Registre primero los espacios en SIGE.</p>
      ) : (
        <>
          <label className="mt-3 block text-xs text-slate-600 dark:text-slate-300">
            Espacio correspondiente
            <select
              className="ui-input mt-1 w-full"
              value={espacioId}
              disabled={!puedeEditar || guardando}
              onChange={(event) => setEspacioId(event.target.value)}
            >
              <option value="">Sin asociación</option>
              {espacios.map((espacio) => (
                <option key={espacio.id} value={espacio.id}>
                  {espacio.bloque.codigo} · {espacio.bloque.nombre} · Piso {espacio.piso} · {espacio.nombre}
                </option>
              ))}
            </select>
          </label>
          {seleccion && (
            <p className="mt-2 text-[11px] text-slate-500">
              Espacio seleccionado: {seleccion.nombre} · {seleccion.bloque.nombre} · Piso {seleccion.piso}
            </p>
          )}
          {puedeEditar && (
            <button type="button" className="ui-btn ui-btn-primary mt-3 w-full text-xs" disabled={guardando || espacioId === (asociacionActual?.espacioId ?? '')} onClick={() => void guardar()}>
              {guardando ? 'Guardando…' : espacioId ? 'Guardar asociación' : 'Retirar asociación'}
            </button>
          )}
        </>
      )}

      {!puedeEditar && <p className="mt-2 text-[11px] text-slate-500">Su rol permite consultar asociaciones, pero no modificarlas.</p>}
      {mensaje && <p role="status" className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{mensaje}</p>}
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  )
}
