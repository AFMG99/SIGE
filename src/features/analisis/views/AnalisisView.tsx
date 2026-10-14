'use client'

import React from 'react'
import { ListboxSelect, type ListboxOption } from '@/shared/views/ui/ListboxSelect'
import { useHeaderPos, useSubNav } from '@/shared/views/nav/NavContext'
import SidebarNav, {
  SIDEBAR_W_COLLAPSED,
  SIDEBAR_W_EXPANDED,
} from '@/shared/views/sidebar/SidebarNav'
import { ejecutarAnalisis } from '@/features/analisis/controllers/analisis'
import {
  cargarContextoXm,
  cargarSerieMercadoXm,
  cargarSerieSistemaXm,
} from '@/features/analisis/controllers/xm'
import {
  modeloPorDefecto,
  opcionesModelo,
  TEXTO_MODELO,
  type AnalisisResultado,
  type ModeloClave,
  type Periodicidad,
} from '../models/analisis'
import {
  type RespuestaContextoXm,
  type RespuestaSerieXm,
} from '../models/xm'
import { ANALISIS_SECTIONS } from './nav'
import { AhorrosPanel } from './panels/AhorrosPanel'
import { ComparativoPanel } from './panels/ComparativoPanel'
import { PatronesPanel } from './panels/PatronesPanel'
import { ResumenPanel } from './panels/ResumenPanel'

/**
 * Módulo 3 — Análisis estadístico y detección de patrones (HU-07 esc. 2,
 * HU-04 esc. 2).
 *
 * Shell con la misma navegación que el módulo de datos: un SidebarNav
 * lateral (Resumen · Comparativo · Patrones de consumo · Ahorros) cuando la
 * cabecera va arriba, y — cuando la cabecera está anclada a un costado — el
 * mismo árbol embebido en ModuleNav. El estado de sección vive en el
 * SubNavContext compartido, con fallback a `resumen` si el id activo viene
 * del módulo de datos. La cabecera con el selector de edificación y el
 * botón «Ejecutar análisis» gobierna los cuatro submódulos; cada sección
 * renderiza solo su panel. Todo dato entra por props; el análisis se
 * ejecuta bajo demanda vía server action (guard `consumption`/`analyze` en
 * el servidor) y no se persiste. El selector es por EDIFICACIÓN: la
 * factura es el dato medido (no un share estimado) y la detección por mes
 * calendario es invariante a la escala.
 */

const IDS_SECCION = new Set(ANALISIS_SECTIONS.map((s) => s.id))

export interface AnalisisViewProps {
  edificaciones: { id: string; nombre: string }[]
  /** false = puede consultar la página pero no ejecutar el análisis. */
  puedeAnalizar: boolean
}

export function AnalisisView({ edificaciones, puedeAnalizar }: AnalisisViewProps) {
  const pos = useHeaderPos()
  const { activeId, setActiveId } = useSubNav()
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [edificacionId, setEdificacionId] = React.useState(
    edificaciones.length === 1 ? edificaciones[0].id : ''
  )
  const [resultado, setResultado] = React.useState<AnalisisResultado | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  /** Nivel de los KPIs de gestión: 'edi' (exacto) | 'b:<id>' | 'e:<id>'. */
  const [nivelId, setNivelId] = React.useState('edi')
  /** Modelo de LBEn elegido («» = automático: el primero disponible, §7.4). */
  const [modeloId, setModeloId] = React.useState('')
  /** Granularidad de la serie y de la tabla de ahorros §8.1. */
  const [periodicidad, setPeriodicidad] = React.useState<Periodicidad>('mes')
  /** Resultado del benchmark XM: se carga una sola vez por análisis. */
  const [serieSistema, setSerieSistema] = React.useState<RespuestaSerieXm | null>(null)
  const [serieMercado, setSerieMercado] = React.useState<RespuestaSerieXm | null>(null)
  const [contexto, setContexto] = React.useState<RespuestaContextoXm | null>(null)
  const [benchmarkCargando, setBenchmarkCargando] = React.useState(false)
  const benchmarkSolicitado = React.useRef(false)

  // El SubNavContext es compartido con el módulo de datos: si el id activo
  // viene de allí (p. ej. 'facturas'), este módulo cae a Resumen en vez de
  // renderizar vacío.
  const seccion = IDS_SECCION.has(activeId) ? activeId : 'resumen'

  const opciones: ListboxOption[] = edificaciones.map((e) => ({
    value: e.id,
    label: e.nombre,
  }))

  const analizar = React.useCallback(async () => {
    if (!edificacionId) {
      setError('Seleccione una edificación para ejecutar el análisis.')
      return
    }
    setCargando(true)
    setError(null)
    try {
      const respuesta = await ejecutarAnalisis({ edificacionId })
      if (respuesta.ok) {
        setResultado(respuesta.analisis)
        // Un análisis nuevo vuelve al nivel exacto (edificación), al modelo
        // automático del selector, a la serie mensual y al Resumen.
        setNivelId('edi')
        setModeloId('')
        setPeriodicidad('mes')
        setActiveId('resumen')
      } else {
        setResultado(null)
        setError(respuesta.error)
      }
    } catch {
      setResultado(null)
      setError('No se pudo ejecutar el análisis. Intente nuevamente.')
    } finally {
      setCargando(false)
    }
  }, [edificacionId, setActiveId])

  const salida = resultado?.salida
  const resumen = salida?.resumen
  const niveles = resultado?.gestion.niveles ?? []
  const nivel = niveles.find((n) => n.clave === nivelId) ?? niveles[0] ?? null
  const opcionesNivel: ListboxOption[] = niveles.map((n) => ({
    value: n.clave,
    label: n.precision === 'estimado' ? `${n.nombre} · estimado` : n.nombre,
  }))

  // ── Línea base del análisis: el selector §7.4 vive en el submódulo
  // Ahorros, pero su estado gobierna también el overlay de la gráfica del
  // Resumen, así que el shell es el dueño y deriva aquí. ──────────────
  const modelos = salida?.modelos ?? null
  const opcionesSelectorModelo = opcionesModelo(modelos)
  const modeloClave: ModeloClave | null =
    modelos &&
    opcionesSelectorModelo.some((o) => o.clave === modeloId && o.habilitado)
      ? (modeloId as ModeloClave)
      : modeloPorDefecto(modelos)
  const modeloActual = modelos && modeloClave ? modelos[modeloClave] : null
  const descripcionModelo = modeloClave ? TEXTO_MODELO[modeloClave] : null

  // Benchmark XM: tres acciones en paralelo, una sola vez por análisis.
  React.useEffect(() => {
    if (!resultado || benchmarkSolicitado.current) return
    benchmarkSolicitado.current = true
    let vivo = true
    setBenchmarkCargando(true)
    void Promise.allSettled([
      cargarSerieSistemaXm(),
      cargarSerieMercadoXm(),
      cargarContextoXm(),
    ]).then(([sistema, mercado, ctx]) => {
      if (!vivo) return
      const falloSerie =
        'No se pudo contactar la API de XM. El análisis no se ve afectado.'
      setSerieSistema(
        sistema.status === 'fulfilled' ? sistema.value : { estado: 'error', mensaje: falloSerie }
      )
      setSerieMercado(
        mercado.status === 'fulfilled' ? mercado.value : { estado: 'error', mensaje: falloSerie }
      )
      setContexto(
        ctx.status === 'fulfilled'
          ? ctx.value
          : {
              estado: 'error',
              mensaje: 'No se pudo cargar la comparación interna y el catálogo de XM.',
            }
      )
      setBenchmarkCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [resultado])

  // El sidebar del módulo sólo existe desde `lg`: por debajo la navegación
  // entre secciones vive en el cajón móvil (ModuleNav), como en datos.
  const headerOnTop = pos === 'center'
  const contentOffset = !headerOnTop
    ? 0
    : sidebarOpen
      ? SIDEBAR_W_EXPANDED
      : SIDEBAR_W_COLLAPSED
  const offsetClass =
    contentOffset === SIDEBAR_W_EXPANDED
      ? 'lg:ml-64'
      : contentOffset === SIDEBAR_W_COLLAPSED
        ? 'lg:ml-14'
        : ''

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {headerOnTop && (
        <SidebarNav
          items={ANALISIS_SECTIONS}
          activeId={seccion}
          onSelect={(item) => setActiveId(item.id)}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          label="Menú lateral del módulo de análisis"
        />
      )}

      {/* Contenido principal */}
      <div
        className={`p-6 transition-[margin] duration-300 ${offsetClass}`}
        style={{
          minHeight: headerOnTop ? 'calc(100vh - 4rem)' : '100vh',
        }}
      >
        <div className="space-y-6">
          <div className="space-y-1.5">
            <h1 className="ui-title text-2xl">Análisis estadístico y patrones</h1>
            <p className="ui-muted max-w-3xl text-sm leading-relaxed">
              Señala las épocas de consumo inusual del histórico completo de facturas y las
              relaciona con el calendario académico. Cada período se evalúa contra la banda de
              confianza de su mes (±10 %, ec. 3; ±2·DesvEst, ec. 4-5 cuando hay 10 o más
              muestras del mes) según la Resolución UPME 0016 de 2024.
            </p>
          </div>

          {/* Controles: gobiernan los cuatro submódulos */}
          <div className="ui-card space-y-4 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
              <div className="ui-field min-w-0 flex-1">
                <label htmlFor="analisis-edificacion" className="ui-label">
                  Edificación
                </label>
                <ListboxSelect
                  id="analisis-edificacion"
                  value={edificacionId}
                  onChange={setEdificacionId}
                  options={opciones}
                  placeholder="— Seleccione una edificación —"
                  disabled={!puedeAnalizar || cargando}
                  className="ui-input min-h-10 w-full"
                />
              </div>
              <button
                type="button"
                className="ui-btn ui-btn-primary focus-ring w-full sm:w-auto"
                onClick={analizar}
                disabled={!puedeAnalizar || cargando || !edificacionId}
              >
                {cargando ? 'Analizando…' : 'Ejecutar análisis'}
              </button>
            </div>

            {!puedeAnalizar && (
              <p className="ui-callout ui-callout-info">
                Su rol puede consultar este módulo, pero ejecutar análisis requiere el permiso
                «Analizar consumo» (gestor energético o permiso personalizado).
              </p>
            )}
          </div>

          {error && (
            <p className="ui-callout ui-callout-danger" role="alert">
              {error}
            </p>
          )}

          {/* Estado inicial: sin resultado no hay nada que mostrar en ninguna sección */}
          {!resultado && !error && (
            <div className="ui-empty py-12">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-uv-forest dark:text-emerald-400"
                aria-hidden
              >
                <path d="M3 3v18h18" />
                <path d="m7 15 4-6 4 3 5-8" />
              </svg>
              <p className="ui-title text-sm">Sin análisis ejecutado</p>
              <p className="max-w-md text-xs">
                Seleccione una edificación y ejecute el análisis para ver la serie histórica, los
                períodos inusuales y su relación con el calendario académico. No se guarda
                información: el análisis se calcula bajo demanda.
              </p>
            </div>
          )}

          {/* Resultado: cabecera + sección activa del sidebar */}
          {salida && resumen && resultado && (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="ui-title text-base">{resultado.nombreEdificacion}</h2>
                <p className="ui-muted text-xs tabular-nums">
                  {resultado.desde} → {resultado.hasta} · calculado el{' '}
                  {new Date(resultado.calculadoEn).toLocaleString('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'America/Bogota',
                  })}
                </p>
              </div>

              {seccion === 'resumen' && (
                <ResumenPanel
                  resumen={resumen}
                  salida={salida}
                  modeloActual={modeloActual}
                  periodicidad={periodicidad}
                />
              )}
              {seccion === 'comparativo' && (
                <ComparativoPanel
                  serieSistema={serieSistema}
                  serieMercado={serieMercado}
                  contexto={contexto}
                  benchmarkCargando={benchmarkCargando}
                  edificacionId={edificacionId}
                />
              )}
              {seccion === 'patrones' && (
                <PatronesPanel
                  resumen={resumen}
                  salida={salida}
                  nivel={nivel}
                  opcionesNivel={opcionesNivel}
                  onNivelChange={setNivelId}
                />
              )}
              {seccion === 'ahorros' && (
                <AhorrosPanel
                  modelos={modelos}
                  opcionesSelectorModelo={opcionesSelectorModelo}
                  modeloClave={modeloClave}
                  modeloActual={modeloActual}
                  descripcionModelo={descripcionModelo}
                  periodicidad={periodicidad}
                  onModeloChange={setModeloId}
                  onPeriodicidadChange={setPeriodicidad}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
