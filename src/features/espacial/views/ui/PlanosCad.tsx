'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirmarImportacionCad } from '@/features/espacial/controllers/confirmarImportacionCad'
import {
  aplicarUnidades,
  extraerDxf,
  MAX_CAD_FILE_BYTES,
  type CandidatoEspacial,
  type ResultadoDxf,
  type UnidadDxf,
  UNIDADES_DXF,
} from '../../models/planosCad'
import type { Edificacion3DScene } from '../../models/espacial.types'
import { PISO_SIN_ASIGNAR } from '@/features/datos/models/geometria'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'

interface PlanosCadProps {
  edificacion: Edificacion3DScene
  puedeImportar: boolean
}

interface AsignacionContorno {
  espacioId: string
  piso: string
  largoM: number | null
  anchoM: number | null
  areaM2: number | null
}

type ArchivoTipo = 'dxf' | 'pdf' | 'webp' | 'no-compatible'

const obtenerTipoArchivo = (file: File): ArchivoTipo => {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'dxf') return 'dxf'
  if (extension === 'pdf') return 'pdf'
  if (extension === 'webp') return 'webp'
  return 'no-compatible'
}

const mensajeFormatoNoCompatible = (file: File) => {
  const extension = file.name.split('.').pop()?.toUpperCase() || 'desconocido'
  if (extension === 'DWG') {
    return 'La lectura directa de DWG no está disponible en esta versión. Exporte desde su aplicación CAD como DXF vectorial o PDF.'
  }
  return `El formato ${extension} no está habilitado. Use DXF vectorial para extraer medidas, o PDF/WebP como referencia visual.`
}

function VistaPreviaDxf({
  resultado,
  candidatos,
  asignaciones,
  espaciosObjetivo,
  contornosOcupados,
  contornoSeleccionadoId,
  onSeleccionarContorno,
  onAsociarEspacio,
}: {
  resultado: ResultadoDxf
  candidatos: CandidatoEspacial[]
  asignaciones: Record<string, AsignacionContorno>
  espaciosObjetivo: Edificacion3DScene['bloques'][number]['espacios']
  contornosOcupados: Set<string>
  contornoSeleccionadoId: string | null
  onSeleccionarContorno: (contornoId: string) => void
  onAsociarEspacio: (contornoId: string, espacioId: string) => void
}) {
  const puntos = [
    ...resultado.geometriaVista.flatMap((entity) => {
      if (entity.tipo === 'trazo') return entity.puntos
      if (entity.tipo === 'circulo') {
        return [
          { x: entity.centro.x - entity.radio, y: entity.centro.y - entity.radio },
          { x: entity.centro.x + entity.radio, y: entity.centro.y + entity.radio },
        ]
      }
      return [entity.punto]
    }),
    ...resultado.contornos.flatMap((contorno) => contorno.puntos),
  ]
  if (puntos.length === 0) {
    return (
      <div className="ui-empty min-h-64">
        <p className="font-semibold">No se encontró geometría visible</p>
        <p className="mt-1 text-sm">
          El DXF no contiene entidades que el visor pueda representar.
        </p>
      </div>
    )
  }

  const limites = puntos.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.x),
      maxX: Math.max(current.maxX, point.x),
      minY: Math.min(current.minY, point.y),
      maxY: Math.max(current.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  )
  const { minX, maxX, minY, maxY } = limites
  const drawingWidth = Math.max(maxX - minX, 1)
  const drawingHeight = Math.max(maxY - minY, 1)
  const longestSide = Math.max(drawingWidth, drawingHeight)
  const drawingPadding = longestSide * 0.025
  const selectedCandidate = candidatos.find(
    (candidate) => candidate.id === contornoSeleccionadoId
  )
  const selectedAssignment = selectedCandidate
    ? asignaciones[selectedCandidate.id]
    : undefined
  const viewWidth = selectedCandidate
    ? Math.max(selectedCandidate.maxX - selectedCandidate.minX, selectedCandidate.maxY - selectedCandidate.minY, 1) * 4
    : drawingWidth + drawingPadding * 2
  const viewHeight = selectedCandidate
    ? Math.max(selectedCandidate.maxX - selectedCandidate.minX, selectedCandidate.maxY - selectedCandidate.minY, 1) * 4
    : drawingHeight + drawingPadding * 2
  const viewCenterX = selectedCandidate
    ? (selectedCandidate.minX + selectedCandidate.maxX) / 2
    : (minX + maxX) / 2
  const viewCenterY = selectedCandidate
    ? -(selectedCandidate.minY + selectedCandidate.maxY) / 2
    : -(minY + maxY) / 2
  const viewBoxX = viewCenterX - viewWidth / 2
  const viewBoxY = viewCenterY - viewHeight / 2
  const espaciosDisponibles = selectedCandidate
    ? espaciosObjetivo.filter(
        (space) =>
          space.id === selectedAssignment?.espacioId ||
          !contornosOcupados.has(space.id)
      )
    : []

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
        <p className="text-xs text-slate-300">
          Plano completo
          {selectedCandidate
            ? ` · enfoque ${selectedCandidate.etiqueta || `contorno ${selectedCandidate.id}`}`
            : ''}
        </p>
        <button
          type="button"
          className="ui-btn ui-btn-ghost min-h-10 text-xs"
          disabled={!contornoSeleccionadoId}
          onClick={() => onSeleccionarContorno('')}
        >
          Ver plano completo
        </button>
      </div>
      <svg
        role="group"
        aria-label={`Visor DXF con ${resultado.geometriaVista.length} entidades de referencia y ${candidatos.length} contornos seleccionables`}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewWidth} ${viewHeight}`}
        className="h-[24rem] w-full touch-pan-x touch-pan-y"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect
          x={viewBoxX}
          y={viewBoxY}
          width={viewWidth}
          height={viewHeight}
          fill="#0f172a"
        />
        {resultado.geometriaVista.map((entity) => {
          if (entity.tipo === 'trazo') {
            return (
              <polyline
                key={`contexto-${entity.id}`}
                data-testid={`geometria-dxf-${entity.id}`}
                points={[
                  ...entity.puntos,
                  ...(entity.cerrado ? [entity.puntos[0]] : []),
                ]
                  .map((point) => `${point.x},${-point.y}`)
                  .join(' ')}
                fill="none"
                stroke="#8da0b8"
                strokeWidth={Math.max(longestSide / 2000, 0.02)}
                opacity="0.72"
                vectorEffect="non-scaling-stroke"
              />
            )
          }
          if (entity.tipo === 'circulo') {
            return (
              <circle
                key={`contexto-${entity.id}`}
                cx={entity.centro.x}
                cy={-entity.centro.y}
                r={entity.radio}
                fill="none"
                stroke="#8da0b8"
                strokeWidth={Math.max(longestSide / 2000, 0.02)}
                opacity="0.72"
                vectorEffect="non-scaling-stroke"
              />
            )
          }
          return (
            <text
              key={`contexto-${entity.id}`}
              x={entity.punto.x}
              y={-entity.punto.y}
              fill="#cbd5e1"
              fontSize={longestSide / 180}
              opacity="0.8"
            >
              {entity.texto}
            </text>
          )
        })}
        {candidatos.map((candidate) => {
          const labelX = (candidate.minX + candidate.maxX) / 2
          const labelY = -(candidate.minY + candidate.maxY) / 2
          const seleccionado = candidate.id === contornoSeleccionadoId
          const vinculado = Boolean(asignaciones[candidate.id]?.espacioId)
          return (
            <g key={`contorno-${candidate.id}`}>
              <polygon
                data-testid={`contorno-dxf-${candidate.id}`}
                role="button"
                tabIndex={0}
                aria-label={`Seleccionar contorno ${candidate.id}${candidate.etiqueta ? `, ${candidate.etiqueta}` : ''}`}
                aria-pressed={seleccionado}
                points={candidate.puntos.map((point) => `${point.x},${-point.y}`).join(' ')}
                fill={seleccionado ? '#92bd2470' : vinculado ? '#00652e70' : '#00652e45'}
                stroke={seleccionado ? '#facc15' : vinculado ? '#4ade80' : '#bef264'}
                strokeWidth={seleccionado ? 3 : 1.5}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: 'pointer' }}
                onClick={() => onSeleccionarContorno(candidate.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSeleccionarContorno(candidate.id)
                  }
                }}
              />
              {(candidate.etiqueta || asignaciones[candidate.id]?.espacioId) && (
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#f8fafc"
                  fontSize={longestSide / 100}
                  pointerEvents="none"
                >
                  {candidate.etiqueta || 'Contorno'}{asignaciones[candidate.id]?.espacioId
                    ? ` · ${espaciosObjetivo.find((space) => space.id === asignaciones[candidate.id]?.espacioId)?.nombre ?? 'Vinculado'}`
                    : ''}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {selectedCandidate && (
        <div className="grid gap-3 border-t border-slate-800 bg-slate-900 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)] sm:items-end">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-lime-300">
              Contorno {selectedCandidate.id} seleccionado
            </p>
            <p className="mt-1 truncate text-sm font-medium text-white">
              {selectedCandidate.etiqueta || 'Sin etiqueta CAD'}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Capa {selectedCandidate.capa} · {selectedCandidate.largoM ?? '—'} × {selectedCandidate.anchoM ?? '—'} m
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Área del polígono · {selectedCandidate.areaM2?.toFixed(2) ?? '—'} m²
            </p>
          </div>
          <label className="ui-field">
            <span className="text-xs font-medium text-slate-200">Vincular con espacio SIGE</span>
            <select
              className="ui-input min-h-10"
              aria-label={`Asociar contorno ${selectedCandidate.id} con espacio SIGE`}
              value={selectedAssignment?.espacioId ?? ''}
              onChange={(event) => onAsociarEspacio(selectedCandidate.id, event.target.value)}
            >
              <option value="">No importar este contorno</option>
              {espaciosDisponibles.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.nombre} · piso {space.piso}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}

export function PlanosCad({ edificacion, puedeImportar }: PlanosCadProps) {
  const router = useRouter()
  const [bloqueId, setBloqueId] = useState(edificacion.bloques[0]?.id ?? '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [tipoArchivo, setTipoArchivo] = useState<ArchivoTipo | null>(null)
  const [urlPrevia, setUrlPrevia] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoDxf | null>(null)
  const [unidadCodigo, setUnidadCodigo] = useState<UnidadDxf | null>(null)
  const [asignaciones, setAsignaciones] = useState<Record<string, AsignacionContorno>>({})
  const [contornoSeleccionadoId, setContornoSeleccionadoId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [estado, setEstado] = useState('')
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [confirmacionAbierta, setConfirmacionAbierta] = useState(false)
  const parseRequestId = useRef(0)
  const visorRef = useRef<HTMLElement | null>(null)

  const bloque = useMemo(
    () => edificacion.bloques.find((item) => item.id === bloqueId),
    [bloqueId, edificacion.bloques]
  )
  const candidatos = useMemo(
    () => (resultado ? aplicarUnidades(resultado, unidadCodigo) : []),
    [resultado, unidadCodigo]
  )
  const asignados = useMemo(
    () =>
      candidatos.flatMap((candidate) => {
        const asignacion = asignaciones[candidate.id]
        if (
          !asignacion?.espacioId ||
          !asignacion.piso.trim() ||
          asignacion.largoM == null ||
          asignacion.anchoM == null ||
          asignacion.areaM2 == null ||
          !Number.isFinite(asignacion.largoM) ||
          !Number.isFinite(asignacion.anchoM) ||
          !Number.isFinite(asignacion.areaM2) ||
          asignacion.largoM <= 0 ||
          asignacion.anchoM <= 0 ||
          asignacion.areaM2 <= 0
        ) {
          return []
        }
        return [
          {
            espacioId: asignacion.espacioId,
            piso: asignacion.piso,
            largoM: asignacion.largoM,
            anchoM: asignacion.anchoM,
            areaM2: asignacion.areaM2,
          },
        ]
      }),
    [asignaciones, candidatos]
  )
  const espaciosObjetivo = useMemo(() => bloque?.espacios ?? [], [bloque])
  const espaciosPorId = useMemo(
    () => new Map(espaciosObjetivo.map((space) => [space.id, space])),
    [espaciosObjetivo]
  )

  useEffect(() => {
    if (
      !archivo ||
      archivo.size > MAX_CAD_FILE_BYTES ||
      (tipoArchivo !== 'pdf' && tipoArchivo !== 'webp')
    ) {
      setUrlPrevia(null)
      return
    }

    const objectUrl = URL.createObjectURL(archivo)
    setUrlPrevia(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [archivo, tipoArchivo])

  useEffect(() => {
    if (!resultado || candidatos.length === 0) {
      setAsignaciones({})
      return
    }

    setAsignaciones(
      Object.fromEntries(
        candidatos.map((candidate) => [
          candidate.id,
          {
            espacioId: '',
            piso: PISO_SIN_ASIGNAR,
            largoM: candidate.largoM,
            anchoM: candidate.anchoM,
            areaM2: candidate.areaM2,
          },
        ])
      )
    )
  }, [resultado, candidatos, bloqueId])

  const limpiarArchivo = () => {
    parseRequestId.current++
    setArchivo(null)
    setTipoArchivo(null)
    setResultado(null)
    setUnidadCodigo(null)
    setAsignaciones({})
    setContornoSeleccionadoId(null)
    setError('')
    setEstado('')
    setCargando(false)
  }

  const cambiarArchivo = async (file: File | undefined) => {
    if (!file) return
    limpiarArchivo()
    const requestId = ++parseRequestId.current
    setArchivo(file)
    const tipo = obtenerTipoArchivo(file)
    setTipoArchivo(tipo)

    if (file.size > MAX_CAD_FILE_BYTES) {
      setError('El archivo supera el límite de 10 MB.')
      return
    }
    if (tipo === 'no-compatible') {
      setError(mensajeFormatoNoCompatible(file))
      return
    }
    if (tipo !== 'dxf') {
      setEstado(
        tipo === 'pdf'
          ? 'PDF cargado solo como referencia visual; no se extraerán medidas.'
          : 'WebP cargado solo como referencia visual; no se extraerán medidas.'
      )
      return
    }

    setCargando(true)
    setError('')
    setEstado('Leyendo el DXF localmente en este navegador…')
    try {
      const source = await file.text()
      if (requestId !== parseRequestId.current) return
      const parsed = extraerDxf(source)
      setResultado(parsed)
      setUnidadCodigo(parsed.unidadesDetectadas)
      setEstado(
        parsed.contornos.length
          ? `Lectura completa: ${parsed.contornos.length} recinto(s) delimitado(s) listos para revisar.`
          : 'Lectura completa; no se encontraron recintos delimitados en capas SIGE_ESPACIOS_*.'
      )
    } catch (parseError) {
      if (requestId !== parseRequestId.current) return
      const details =
        parseError instanceof Error ? parseError.message : 'Error desconocido al analizar el DXF.'
      setError(`No se pudo interpretar el DXF: ${details}`)
      setEstado('')
    } finally {
      if (requestId === parseRequestId.current) setCargando(false)
    }
  }

  const actualizarAsignacion = (
    candidateId: string,
    change: Partial<AsignacionContorno>
  ) => {
    setAsignaciones((current) => ({
      ...current,
      [candidateId]: { ...current[candidateId], ...change },
    }))
  }

  const seleccionarContorno = (candidateId: string) => {
    setContornoSeleccionadoId(candidateId || null)
    if (candidateId) {
      requestAnimationFrame(() =>
        visorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      )
    }
  }

  const asociarEspacio = (candidateId: string, espacioId: string) => {
    const assignment = asignaciones[candidateId]
    if (!assignment) return
    seleccionarContorno(candidateId)
    actualizarAsignacion(candidateId, {
      espacioId,
      piso: espaciosPorId.get(espacioId)?.piso ?? PISO_SIN_ASIGNAR,
      largoM: assignment.largoM,
      anchoM: assignment.anchoM,
      areaM2: assignment.areaM2,
    })
  }

  const guardarImportacion = async () => {
    if (!bloque || asignados.length === 0) return
    setGuardando(true)
    setError('')
    setEstado('')
    try {
      const response = await confirmarImportacionCad({
        bloqueId: bloque.id,
        espacios: asignados,
      })
      if (response.estado === 'error') {
        setError(response.mensaje)
        return
      }
      setEstado(response.mensaje)
      router.refresh()
    } catch (saveError) {
      console.error('Error al confirmar la importación CAD:', saveError)
      setError('No fue posible comunicarse con el servidor para guardar la importación.')
    } finally {
      setGuardando(false)
    }
  }

  const ocupadosPorOtros = (candidateId: string) =>
    new Set(
      Object.entries(asignaciones)
        .filter(([id, value]) => id !== candidateId && value.espacioId)
        .map(([, value]) => value.espacioId)
    )

  return (
    <section aria-labelledby="planos-cad-title" className="space-y-5">
      <div className="ui-panel overflow-hidden">
        <header className="grid gap-5 border-b border-gray-200 p-5 dark:border-slate-800 sm:grid-cols-[1fr_auto] sm:items-end sm:p-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-uv-forest dark:text-uv-soft">
              Revisión local · sin conversión remota
            </p>
            <h2 id="planos-cad-title" className="ui-title mt-2 text-xl">
              Planos CAD
            </h2>
            <p className="ui-muted mt-2 text-sm leading-relaxed">
              Revise el plano DXF, seleccione sus contornos y vincúlelos visualmente con espacios
              existentes antes de confirmar medidas. El archivo permanece en el navegador.
            </p>
          </div>
          <label className="ui-field w-full sm:w-64">
            <span className="ui-label">Bloque de destino</span>
            <select
              aria-label="Bloque de destino"
              className="ui-input min-h-10"
              value={bloqueId}
              onChange={(event) => {
                setBloqueId(event.target.value)
                setEstado('')
                setError('')
              }}
            >
              {edificacion.bloques.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.codigo} · {item.nombre}
                </option>
              ))}
            </select>
          </label>
        </header>

        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
          <div className="space-y-4">
            <label
              htmlFor="cad-file"
              className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-uv-forest hover:bg-emerald-50/40 focus-within:ring-2 focus-within:ring-uv-lime dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-uv-forest text-white">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 16V4m0 0L7 9m5-5 5 5M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4" />
                </svg>
              </span>
              <span className="mt-3 text-sm font-semibold text-uv-ink dark:text-white">
                {archivo ? archivo.name : 'Seleccione un archivo'}
              </span>
              <span className="ui-muted mt-1 text-xs">
                DXF vectorial para medidas · PDF y WebP como referencia · máximo 10 MB
              </span>
              <input
                id="cad-file"
                type="file"
                accept=".dxf,.pdf,.webp,.dwg"
                className="sr-only"
                aria-label="Seleccionar archivo de plano"
                onChange={(event) => {
                  void cambiarArchivo(event.currentTarget.files?.[0])
                  event.currentTarget.value = ''
                }}
              />
            </label>

            {archivo && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {archivo.name}
                  </p>
                  <p className="ui-muted text-xs">
                    {(archivo.size / 1024).toFixed(0)} KB · solo disponible en esta sesión
                  </p>
                </div>
                <button type="button" className="ui-btn ui-btn-ghost min-h-10" onClick={limpiarArchivo}>
                  Quitar archivo
                </button>
              </div>
            )}

            {cargando && (
              <p role="status" className="ui-callout ui-callout-info">
                Analizando el archivo en este navegador…
              </p>
            )}
            {error && (
              <p role="alert" className="ui-callout ui-callout-danger">
                {error}
              </p>
            )}
            {estado && !error && (
              <p role="status" className="ui-callout ui-callout-success">
                {estado}
              </p>
            )}

            {tipoArchivo === 'dxf' && resultado && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                  <p className="ui-muted text-xs">Entidades leídas</p>
                  <p className="mt-1 text-lg font-semibold text-uv-ink dark:text-white">
                    {resultado.totalEntidades.toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                  <p className="ui-muted text-xs">Recintos delimitados importables</p>
                  <p className="mt-1 text-lg font-semibold text-uv-ink dark:text-white">
                    {candidatos.length}
                  </p>
                </div>
                <label className="ui-field sm:col-span-2">
                  <span className="ui-label">Unidad de origen del dibujo</span>
                  <select
                    className="ui-input"
                    aria-label="Unidad de origen del dibujo"
                    value={unidadCodigo ?? ''}
                    onChange={(event) => {
                      const unit = UNIDADES_DXF.find(
                        (option) => option.codigo === Number(event.target.value)
                      )
                      setUnidadCodigo(unit?.codigo ?? null)
                    }}
                  >
                    <option value="">Sin definir — no calcular medidas</option>
                    {UNIDADES_DXF.map((unit) => (
                      <option key={unit.codigo} value={unit.codigo}>
                        {unit.nombre}
                        {unit.codigo === resultado.unidadesDetectadas ? ' · detectada en DXF' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {resultado.capas.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="ui-label">Capas detectadas</p>
                    <div className="mt-2 flex max-h-24 flex-wrap gap-2 overflow-auto">
                      {resultado.capas.slice(0, 30).map((layer) => (
                        <span
                          key={layer}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {layer}
                        </span>
                      ))}
                      {resultado.capas.length > 30 && (
                        <span className="ui-muted self-center text-xs">
                          +{resultado.capas.length - 30} capas
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside ref={visorRef} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-uv-ink dark:text-white">Vista previa</h3>
              {tipoArchivo === 'dxf' && resultado && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Contexto DXF · contornos interactivos
                </span>
              )}
            </div>
            {tipoArchivo === 'dxf' && resultado ? (
              <VistaPreviaDxf
                resultado={resultado}
                candidatos={candidatos}
                asignaciones={asignaciones}
                espaciosObjetivo={espaciosObjetivo}
                contornosOcupados={
                  contornoSeleccionadoId
                    ? ocupadosPorOtros(contornoSeleccionadoId)
                    : new Set<string>()
                }
                contornoSeleccionadoId={contornoSeleccionadoId}
                onSeleccionarContorno={seleccionarContorno}
                onAsociarEspacio={asociarEspacio}
              />
            ) : tipoArchivo === 'pdf' && urlPrevia ? (
              <iframe
                title="Vista previa del plano PDF"
                src={urlPrevia}
                className="h-[24rem] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700"
              />
            ) : tipoArchivo === 'webp' && urlPrevia ? (
              <div className="flex h-[24rem] items-center justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-700 dark:bg-slate-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlPrevia} alt="Vista previa del plano WebP" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="ui-empty min-h-64">
                <p className="font-semibold">La previsualización aparecerá aquí</p>
                <p className="mt-1 text-sm">
                  Use DXF vectorial. DWG requiere exportación previa desde su aplicación CAD.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {resultado?.advertencias.length ? (
        <div className="ui-callout ui-callout-warn">
          <p className="font-semibold">Limitaciones de la lectura DXF</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {resultado.advertencias.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!puedeImportar && (
        <p className="ui-callout ui-callout-info">
          Puede revisar los planos, pero su rol no tiene permiso para guardar cambios. Solicite acceso
          de modificación de planos a un administrador.
        </p>
      )}

      {tipoArchivo === 'dxf' && resultado && (
        <div className="ui-panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-gray-200 p-5 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-uv-forest dark:text-uv-soft">
                Revisión antes de guardar
              </p>
              <h3 className="ui-title mt-1 text-lg">Asocie contornos con espacios existentes</h3>
              <p className="ui-muted mt-1 text-sm">
                Seleccione la fila para localizar su contorno en el plano o haga clic en el
                contorno para resaltarla. Vincule el espacio y revise piso y dimensiones; no se
                crean espacios nuevos.
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {asignados.length} de {candidatos.length} listos
            </p>
          </div>

            <p className="ui-callout ui-callout-warn mx-5 mt-5">
              SIGE solo toma como recintos las polilíneas cerradas de capas cuyo nombre comience por
              SIGE_ESPACIOS_. El programa no deduce habitaciones desde muros. Revise ubicación y
              capa en el visor y no delimite columnas, puertas, ventanas ni símbolos como espacios.
            </p>

            {candidatos.length === 0 ? (
              <div className="ui-empty m-5">
                <p className="font-semibold">Este archivo todavía no contiene recintos listos para vincular</p>
                <p className="mt-1 text-sm">
                  En el CAD, cree una capa con el prefijo <strong>SIGE_ESPACIOS_</strong>, dibuje en
                  ella una polilínea cerrada por recinto (sin arcos) y vuelva a exportar como DXF.
                  Puede empezar con unos pocos recintos de prueba.
                </p>
              </div>
            ) : espaciosObjetivo.length === 0 ? (
            <div className="ui-empty m-5">
              <p className="font-semibold">El bloque no tiene espacios registrados</p>
              <p className="mt-1 text-sm">
                Cree primero los espacios en Gestión de Datos. Esta importación solo actualiza espacios existentes.
              </p>
            </div>
          ) : candidatos.length > 100 ? (
            <div className="ui-callout ui-callout-warn m-5">
              Este plano contiene más de 100 contornos. Reduzca o separe el archivo antes de continuar.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {candidatos.map((candidate) => {
                const assignment = asignaciones[candidate.id] ?? {
                  espacioId: '',
                  piso: PISO_SIN_ASIGNAR,
                  largoM: candidate.largoM,
                  anchoM: candidate.anchoM,
                  areaM2: candidate.areaM2,
                }
                const occupied = ocupadosPorOtros(candidate.id)
                const seleccionado = candidate.id === contornoSeleccionadoId

                return (
                  <article
                    key={candidate.id}
                    className={`grid gap-4 p-4 transition-colors sm:p-5 lg:grid-cols-[minmax(8rem,0.7fr)_minmax(12rem,1fr)_minmax(8rem,0.7fr)_minmax(10rem,0.8fr)] lg:items-end ${
                      seleccionado
                        ? 'bg-emerald-50/70 ring-1 ring-inset ring-uv-forest dark:bg-emerald-950/30'
                        : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-uv-forest dark:text-uv-soft">
                        Contorno · {candidate.capa}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-uv-ink dark:text-white">
                        {candidate.etiqueta || 'Sin etiqueta CAD'}
                      </p>
                      <p className="ui-muted mt-1 text-xs">
                        {assignment.largoM == null || assignment.anchoM == null
                          ? 'Defina unidades para calcular'
                          : `Extensión ${assignment.largoM} × ${assignment.anchoM} m · área del recinto ${assignment.areaM2?.toFixed(2) ?? '—'} m²`}
                      </p>
                      <button
                        type="button"
                        className="ui-btn ui-btn-ghost mt-2 min-h-10"
                        aria-label={
                          seleccionado
                            ? `Contorno ${candidate.id} seleccionado en el plano`
                            : `Mostrar contorno ${candidate.id} en el plano`
                        }
                        aria-pressed={seleccionado}
                        onClick={() => seleccionarContorno(candidate.id)}
                      >
                        {seleccionado ? 'Resaltado en el plano' : 'Mostrar en el plano'}
                      </button>
                    </div>
                    <label className="ui-field">
                      <span className="ui-label">Espacio existente</span>
                      <select
                        className="ui-input"
                        aria-label={`Espacio existente para contorno ${candidate.id}`}
                        value={assignment.espacioId}
                        onChange={(event) => {
                          asociarEspacio(candidate.id, event.target.value)
                        }}
                      >
                        <option value="">No importar este contorno</option>
                        {espaciosObjetivo
                          .filter(
                            (space) =>
                              space.id === assignment.espacioId || !occupied.has(space.id)
                          )
                          .map((space) => (
                            <option key={space.id} value={space.id}>
                              {space.nombre} · piso {space.piso}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="ui-field">
                      <span className="ui-label">Piso destino</span>
                      <input
                        className="ui-input"
                        aria-label={`Piso destino para contorno ${candidate.id}`}
                        value={assignment.piso}
                        maxLength={60}
                        onChange={(event) =>
                          actualizarAsignacion(candidate.id, { piso: event.target.value })
                        }
                      />
                    </label>
                    <div className="flex items-end gap-2">
                      <label className="ui-field min-w-0 flex-1">
                        <span className="ui-label">Extensión largo (m)</span>
                        <input
                          className="ui-input"
                          aria-label={`Largo en metros para contorno ${candidate.id}`}
                          type="number"
                          min="0.001"
                          max="10000"
                          step="0.001"
                          value={assignment.largoM ?? ''}
                          onChange={(event) =>
                            actualizarAsignacion(candidate.id, {
                              largoM: event.target.value ? Number(event.target.value) : null,
                            })
                          }
                        />
                      </label>
                      <span className="pb-2 text-slate-400">×</span>
                      <label className="ui-field min-w-0 flex-1">
                        <span className="ui-label">Extensión ancho (m)</span>
                        <input
                          className="ui-input"
                          aria-label={`Ancho en metros para contorno ${candidate.id}`}
                          type="number"
                          min="0.001"
                          max="10000"
                          step="0.001"
                          value={assignment.anchoM ?? ''}
                          onChange={(event) =>
                            actualizarAsignacion(candidate.id, {
                              anchoM: event.target.value ? Number(event.target.value) : null,
                            })
                          }
                        />
                      </label>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          <footer className="flex flex-col gap-3 border-t border-gray-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="ui-muted text-xs">
              Se guarda piso, extensión máxima, ancho y área de polígono en espacios existentes. El polígono y archivo no se persisten.
            </p>
            <button
              type="button"
              className="ui-btn ui-btn-primary min-h-10 shrink-0"
              disabled={
                !puedeImportar ||
                !bloque ||
                !asignados.length ||
                guardando ||
                candidatos.length > 100
              }
              onClick={() => setConfirmacionAbierta(true)}
            >
              Revisar e importar {asignados.length ? `(${asignados.length})` : ''}
            </button>
          </footer>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmacionAbierta}
        onClose={() => setConfirmacionAbierta(false)}
        onConfirm={() => void guardarImportacion()}
        title="Confirmar importación de medidas"
        description={`Se actualizarán ${asignados.length} espacio(s) existente(s) del bloque ${bloque?.codigo ?? ''}. Los cambios se guardarán en SIGE y se registrarán en auditoría.`}
        confirmText={guardando ? 'Guardando…' : 'Confirmar importación'}
        cancelText="Seguir revisando"
        variant="primary"
      />
    </section>
  )
}
