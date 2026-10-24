'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bloque3DNode } from '../../models/espacial.types'
import { actualizarAreaBloque } from '../../controllers/actualizarBloque'

interface EspacialInspectorProps {
  bloque: Bloque3DNode | null
  onClose: () => void
  onUpdateArea?: (bloqueId: string, area: number) => void
}

export function EspacialInspector({
  bloque,
  onClose,
  onUpdateArea,
}: EspacialInspectorProps) {
  const router = useRouter()
  const [activeEspacioId, setActiveEspacioId] = useState<string | null>(null)
  const [editandoArea, setEditandoArea] = useState(false)
  const [areaInput, setAreaInput] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    if (bloque) {
      setAreaInput(String(bloque.areaUtil || ''))
      setEditandoArea(false)
      setMensaje(null)
    }
  }, [bloque])

  if (!bloque) return null

  const kwTotal = (bloque.metricas.potenciaTotalW / 1000).toFixed(2)

  const handleGuardarArea = async () => {
    const nuevaArea = Number(areaInput)
    if (!Number.isFinite(nuevaArea) || nuevaArea <= 0) {
      setMensaje({ tipo: 'error', texto: 'Ingrese un área válida mayor a 0' })
      return
    }

    setGuardando(true)
    setMensaje(null)
    try {
      const res = await actualizarAreaBloque(bloque.id, nuevaArea)
      if (res.estado === 'ok') {
        setMensaje({ tipo: 'ok', texto: res.mensaje })
        setEditandoArea(false)
        if (onUpdateArea) {
          onUpdateArea(bloque.id, nuevaArea)
        }
        router.refresh()
      } else {
        setMensaje({ tipo: 'error', texto: res.mensaje })
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al comunicarse con el servidor' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <aside className="absolute top-4 right-4 z-20 w-84 max-h-[calc(100%-2rem)] flex flex-col rounded-2xl bg-white/95 p-4 shadow-2xl backdrop-blur-md border border-slate-200 overflow-hidden dark:bg-slate-900/95 dark:border-slate-800 transition-all duration-300">
      {/* Cabecera */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              {bloque.codigo}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Factor: {bloque.factorInfraestructura}
            </span>
          </div>
          <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
            {bloque.nombre}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          title="Cerrar panel"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Métricas clave con edición de área */}
      <div className="grid grid-cols-2 gap-2 py-3 border-b border-slate-200 text-xs dark:border-slate-800">
        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
          <p className="text-slate-500 dark:text-slate-400">Potencia Total</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">{kwTotal} kW</p>
        </div>

        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-slate-500 dark:text-slate-400">Área Útil</p>
            {!editandoArea && (
              <button
                onClick={() => setEditandoArea(true)}
                className="text-[10px] text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Editar
              </button>
            )}
          </div>
          {editandoArea ? (
            <div className="mt-1 flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                min="1"
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs font-bold text-slate-900 dark:bg-slate-700 dark:text-white dark:border-slate-600"
              />
              <button
                onClick={handleGuardarArea}
                disabled={guardando}
                className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {guardando ? '...' : 'OK'}
              </button>
              <button
                onClick={() => setEditandoArea(false)}
                className="text-[10px] text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
          ) : (
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {bloque.areaUtil} m²
            </p>
          )}
        </div>

        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
          <p className="text-slate-500 dark:text-slate-400">Densidad Carga</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {bloque.metricas.densidadPotenciaWm2} W/m²
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
          <p className="text-slate-500 dark:text-slate-400">Total Equipos</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {bloque.metricas.cantidadEquipos} uds.
          </p>
        </div>
      </div>

      {mensaje && (
        <div
          className={`mt-2 rounded-lg p-2 text-xs font-medium ${
            mensaje.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Lista de Espacios y Equipos */}
      <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider dark:text-slate-300">
          Espacios Registrados ({bloque.espacios.length})
        </p>

        {bloque.espacios.length === 0 ? (
          <p className="text-xs italic text-slate-400 py-2">
            No hay espacios configurados en este bloque.
          </p>
        ) : (
          bloque.espacios.map((esp) => {
            const isExpanded = activeEspacioId === esp.id
            const espKw = (esp.potenciaTotalW / 1000).toFixed(2)

            return (
              <div
                key={esp.id}
                className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm text-xs dark:bg-slate-800/50 dark:border-slate-700/60"
              >
                <button
                  onClick={() => setActiveEspacioId(isExpanded ? null : esp.id)}
                  className="flex w-full items-center justify-between text-left font-medium text-slate-800 dark:text-slate-200"
                >
                  <span className="truncate pr-2 font-semibold">{esp.nombre}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[11px] text-slate-500">{espKw} kW</span>
                    <svg
                      className={`h-4 w-4 text-slate-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2 dark:border-slate-700/40">
                    {esp.equipos.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">
                        Sin inventario de equipos asignado.
                      </p>
                    ) : (
                      esp.equipos.map((eq) => (
                        <div
                          key={eq.id}
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 text-[11px] dark:bg-slate-900/50"
                        >
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {eq.tipo}
                            </span>
                            <span className="text-slate-400 ml-1">
                              ({eq.cantidad} × {eq.potenciaNominal}W)
                            </span>
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {(eq.potenciaTotalW / 1000).toFixed(2)} kW
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
