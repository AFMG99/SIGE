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
  PERIODICIDAD,
  SIMULADOR_POR_DEFECTO,
  TEXTO_MODELO,
  type AnalisisResultado,
  type EstadoSimulador,
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
import { CLASE_BADGE } from './panels/comunes'

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
  /** Simulador de umbral exploratorio (issue #79): dueño el shell. */
  const [sim, setSim] = React.useState<EstadoSimulador>(SIMULADOR_POR_DEFECTO)
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
        // automático del selector, a la serie mensual, al Resumen y con el
        // simulador de umbral en sus valores normativos.
        setNivelId('edi')
        setModeloId('')
        setPeriodicidad('mes')
        setSim(SIMULADOR_POR_DEFECTO)
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
          <div className="space-y-2">
            <h1 className="ui-title text-3xl">Análisis estadístico y patrones</h1>
            <p className="ui-muted max-w-3xl text-sm leading-relaxed">
              Señala las épocas de consumo inusual del histórico completo de facturas y las
              relaciona con el calendario académico. Cada período se evalúa contra la banda de
              confianza de su mes (±10 %, ec. 3; ±2·DesvEst, ec. 4-5 cuando hay 10 o más
              muestras del mes) según la Resolución UPME 0016 de 2024.
            </p>
          </div>

          {/* Barra compacta: edificación · período · ejecutar */}
          <div className="ui-card space-y-4 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
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
                <div className="ui-field sm:w-56">
                  <span id="analisis-periodo-label" className="ui-label">
                    Período analizado
                  </span>
                  <p
                    aria-labelledby="analisis-periodo-label"
                    className="ui-input min-h-10 flex items-center text-sm tabular-nums text-gray-600 dark:text-gray-300"
                  >
                    {resultado ? `${resultado.desde} → ${resultado.hasta}` : '— sin ejecutar —'}
                  </p>
                </div>
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

          {/* Resultado: cabecera + configuración + sección activa del sidebar */}
          {salida && resumen && resultado && (
            <>
              {/* Nombre de la edificación + estado del análisis */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <h2 className="ui-title text-2xl">{resultado.nombreEdificacion}</h2>
                  <span
                    aria-live="polite"
                    className={`${CLASE_BADGE} ${
                      cargando
                        ? 'border-sky-600/40 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300'
                        : 'border-emerald-600/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                    }`}
                  >
                    {cargando ? 'Analizando…' : 'Análisis ejecutado'}
                  </span>
                </div>
                <p className="ui-muted text-xs tabular-nums">
                  {resultado.desde} → {resultado.hasta} · calculado el{' '}
                  {new Date(resultado.calculadoEn).toLocaleString('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'America/Bogota',
                  })}
                </p>
              </div>

              {/* Configuración del análisis: controles avanzados agrupados
                  (issue #79) — gobiernan los cuatro submódulos. */}
              <section
                aria-labelledby="titulo-config-analisis"
                className="ui-card space-y-4 p-5 sm:p-6"
              >
                <h3 id="titulo-config-analisis" className="ui-title text-sm">
                  Configuración del análisis
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="ui-field">
                    <label htmlFor="analisis-periodicidad" className="ui-label">
                      Periodicidad
                    </label>
                    <ListboxSelect
                      id="analisis-periodicidad"
                      value={periodicidad}
                      onChange={(valor) => setPeriodicidad(valor as Periodicidad)}
                      options={PERIODICIDAD.map((p) => ({
                        value: p.valor,
                        label: p.habilitado ? p.etiqueta : `${p.etiqueta} — ${p.motivo}`,
                        disabled: !p.habilitado,
                      }))}
                      className="ui-input min-h-10 w-full"
                    />
                  </div>
                  <div className="ui-field">
                    <label htmlFor="analisis-modelo" className="ui-label">
                      Modelo de línea base
                    </label>
                    <ListboxSelect
                      id="analisis-modelo"
                      value={modeloClave ?? ''}
                      onChange={setModeloId}
                      options={opcionesSelectorModelo.map((o) => ({
                        value: o.clave,
                        label: o.etiqueta,
                        disabled: !o.habilitado,
                      }))}
                      placeholder="— Ningún modelo disponible —"
                      className="ui-input min-h-10 w-full"
                    />
                  </div>
                  <div className="ui-field">
                    <label htmlFor="analisis-nivel" className="ui-label">
                      Nivel de análisis
                    </label>
                    <ListboxSelect
                      id="analisis-nivel"
                      value={nivelId}
                      onChange={setNivelId}
                      options={opcionesNivel}
                      className="ui-input min-h-10 w-full"
                    />
                  </div>
                </div>
                <p className="ui-muted text-xs">
                  La periodicidad y el modelo también gobiernan la gráfica y la tabla de
                  ahorros; el nivel define los KPIs de gestión del submódulo Patrones.
                </p>
              </section>

              {seccion === 'resumen' && (
                <ResumenPanel
                  resumen={resumen}
                  salida={salida}
                  modeloActual={modeloActual}
                  periodicidad={periodicidad}
                  sim={sim}
                  onSimChange={(parcial) => setSim((prev) => ({ ...prev, ...parcial }))}
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
                <PatronesPanel resumen={resumen} salida={salida} nivel={nivel} />
              )}
              {seccion === 'ahorros' && (
                <AhorrosPanel
                  modelos={modelos}
                  opcionesSelectorModelo={opcionesSelectorModelo}
                  modeloClave={modeloClave}
                  modeloActual={modeloActual}
                  descripcionModelo={descripcionModelo}
                  periodicidad={periodicidad}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
