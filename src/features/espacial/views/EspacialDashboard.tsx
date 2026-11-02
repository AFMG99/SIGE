'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Edificacion3DScene, Bloque3DNode } from '../models/espacial.types'
import { TODOS_LOS_PISOS } from '../models/espaciosPorPiso'
import { EspacialInspector } from './ui/EspacialInspector'
import { EspacialLegend } from './ui/EspacialLegend'
import { EspaciosPorPiso } from './ui/EspaciosPorPiso'
import { PlanosCad } from './ui/PlanosCad'

const EspacialCanvas = dynamic(() => import('./EspacialCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Iniciando visualizador 3D...
        </p>
      </div>
    </div>
  ),
})

interface EspacialDashboardProps {
  edificaciones: Edificacion3DScene[]
  puedeImportarCad: boolean
}

export function EspacialDashboard({
  edificaciones,
  puedeImportarCad,
}: EspacialDashboardProps) {
  const router = useRouter()
  const [vista, setVista] = useState<'campus' | 'pisos' | 'cad'>('campus')
  const [pisoSeleccionado, setPisoSeleccionado] = useState(TODOS_LOS_PISOS)
  const [selectedEdificacionId, setSelectedEdificacionId] = useState<string>(
    edificaciones[0]?.id || ''
  )
  const [selectedBloqueId, setSelectedBloqueId] = useState<string | null>(null)
  const [customPositions, setCustomPositions] = useState<Record<string, [number, number]>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)

  const activeEdificacion = useMemo(() => {
    return edificaciones.find((e) => e.id === selectedEdificacionId) || edificaciones[0]
  }, [edificaciones, selectedEdificacionId])

  // Cargar posiciones guardadas en localStorage para la edificación activa
  useEffect(() => {
    if (!activeEdificacion) return
    try {
      const saved = localStorage.getItem(`sige_espacial_pos_${activeEdificacion.id}`)
      if (saved) {
        setCustomPositions(JSON.parse(saved))
      } else {
        setCustomPositions({})
      }
    } catch {
      // Ignorar fallos de lectura de localStorage
    }
  }, [activeEdificacion])

  // Guardar en localStorage cuando se termine de arrastrar
  const handleEndDrag = useCallback(() => {
    if (!activeEdificacion) return
    try {
      localStorage.setItem(
        `sige_espacial_pos_${activeEdificacion.id}`,
        JSON.stringify(customPositions)
      )
    } catch {
      // Ignorar
    }
  }, [activeEdificacion, customPositions])

  // Mover bloque en tiempo real
  const handleMoveBloque = useCallback((bloqueId: string, x: number, z: number) => {
    setCustomPositions((prev) => ({
      ...prev,
      [bloqueId]: [Number(x.toFixed(2)), Number(z.toFixed(2))],
    }))
  }, [])

  // Restablecer a la cuadrícula por defecto
  const handleRestablecerPosiciones = () => {
    if (!activeEdificacion) return
    localStorage.removeItem(`sige_espacial_pos_${activeEdificacion.id}`)
    setCustomPositions({})
  }

  // Refrescar datos desde la BD
  const handleRefrescar = () => {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 800)
  }

  // Combinar posiciones por defecto con las customizadas por el usuario
  const bloquesConPosicion = useMemo(() => {
    if (!activeEdificacion) return []
    return activeEdificacion.bloques.map((b) => {
      const custom = customPositions[b.id]
      if (custom) {
        return {
          ...b,
          position: [custom[0], b.position[1], custom[1]] as [number, number, number],
        }
      }
      return b
    })
  }, [activeEdificacion, customPositions])

  const selectedBloque = useMemo(() => {
    if (!bloquesConPosicion || !selectedBloqueId) return null
    return bloquesConPosicion.find((b) => b.id === selectedBloqueId) || null
  }, [bloquesConPosicion, selectedBloqueId])

  if (!edificaciones || edificaciones.length === 0) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="ui-panel flex flex-col items-center justify-center p-12 text-center">
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
            No hay edificaciones registradas
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Primero registre edificaciones y bloques en el módulo de carga de datos.
          </p>
        </div>
      </main>
    )
  }

  const kwInstalados = ((activeEdificacion?.totales.potenciaTotalW || 0) / 1000).toFixed(1)
  const tienePosicionesGuardadas = Object.keys(customPositions).length > 0

  return (
    <main className="mx-auto w-full max-w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
      {/* Barra de cabecera con selector y acciones */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="ui-title text-2xl sm:text-3xl font-bold tracking-tight">
            {vista === 'campus'
              ? 'Representación Espacial 3D'
              : vista === 'pisos'
                ? 'Espacios por piso'
                : 'Planos CAD'}
          </h1>
          <p className="ui-muted text-sm leading-relaxed">
            {vista === 'campus'
              ? 'Haga clic y arrastre con el mouse directamente sobre cualquier bloque para ubicarlo en el campus.'
              : vista === 'pisos'
                ? 'Explore los espacios registrados por piso, con sus dimensiones, áreas y equipos asociados.'
                : 'Cargue y revise un plano localmente; confirme las medidas antes de actualizar espacios existentes.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {tienePosicionesGuardadas && (
            <button
              onClick={handleRestablecerPosiciones}
              className="ui-btn ui-btn-ghost text-xs"
              title="Restablecer distribución automática"
            >
              Restablecer distribución
            </button>
          )}

          <button
            onClick={handleRefrescar}
            disabled={isRefreshing}
            className="ui-btn ui-btn-secondary text-xs flex items-center gap-1.5"
            title="Recargar datos de la base de datos"
          >
            <svg
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>

          {edificaciones.length > 1 && (
            <select
              value={selectedEdificacionId}
              onChange={(e) => {
                setSelectedEdificacionId(e.target.value)
                setSelectedBloqueId(null)
                setPisoSeleccionado(TODOS_LOS_PISOS)
              }}
              aria-label="Seleccionar edificación"
              className="ui-input py-1.5 text-xs font-semibold"
            >
              {edificaciones.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.nombre}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div
        role="group"
        aria-label="Vista espacial"
        className="inline-flex max-w-full flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900"
      >
        <button
          type="button"
          aria-pressed={vista === 'campus'}
          onClick={() => setVista('campus')}
          className={`ui-btn ${vista === 'campus' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
        >
          Campus 3D
        </button>
        <button
          type="button"
          aria-pressed={vista === 'pisos'}
          onClick={() => setVista('pisos')}
          className={`ui-btn ${vista === 'pisos' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
        >
          Espacios por piso
        </button>
        <button
          type="button"
          aria-pressed={vista === 'cad'}
          onClick={() => setVista('cad')}
          className={`ui-btn ${vista === 'cad' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
        >
          Planos CAD
        </button>
      </div>

      {vista !== 'cad' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Área Total de Bloques
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {(activeEdificacion?.totales.areaTotalM2 || 0).toLocaleString('es-CO')} m²
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Potencia Nominal Instalada
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {kwInstalados} kW
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Densidad Media de Carga
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {activeEdificacion?.totales.densidadPromedioWm2} W/m²
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Equipos Censados
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {activeEdificacion?.totales.cantidadEquipos} unidades
            </p>
          </div>
        </div>
      )}

      {vista === 'campus' ? (
        <div className="relative h-[620px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-inner dark:border-slate-800">
          <EspacialCanvas
            bloques={bloquesConPosicion}
            selectedBloqueId={selectedBloqueId}
            onSelectBloque={(b) => setSelectedBloqueId(b ? b.id : null)}
            onMoveBloque={handleMoveBloque}
            onEndDrag={handleEndDrag}
          />

          <div className="absolute bottom-4 left-4 z-10">
            <EspacialLegend />
          </div>

          <EspacialInspector
            bloque={selectedBloque}
            onClose={() => setSelectedBloqueId(null)}
            onUpdateArea={(_id, _area) => {
              router.refresh()
            }}
          />
        </div>
      ) : vista === 'pisos' ? (
        <EspaciosPorPiso
          edificacion={activeEdificacion}
          pisoSeleccionado={pisoSeleccionado}
          onPisoChange={setPisoSeleccionado}
          onVerBloque={(bloqueId) => {
            setSelectedBloqueId(bloqueId)
            setVista('campus')
          }}
        />
      ) : (
        <PlanosCad
          key={activeEdificacion.id}
          edificacion={activeEdificacion}
          puedeImportar={puedeImportarCad}
        />
      )}
    </main>
  )
}
