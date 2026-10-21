"use client"

import React from 'react'
import { MotionConfig, motion } from 'framer-motion'
import type { Role } from '@/shared/models/permissions'
import { useHeaderPos, useSubNav } from '@/shared/views/nav/NavContext'
import SidebarNav, {
  SIDEBAR_W_COLLAPSED,
  SIDEBAR_W_EXPANDED,
} from '@/shared/views/sidebar/SidebarNav'
import { DATOS_SECTIONS } from './nav'
import {
  IconCarga,
  IconEquipo,
  IconFactura,
  IconGestionar,
  IconLineaBase,
  IconVariable,
  IconVistaPrevia,
} from './icons'
import { EdificacionesPanel } from './EdificacionesPanel'
import { CalendarioFestivos } from './CalendarioFestivos'
import { ConfiguracionCalendario } from './ConfiguracionCalendario'
import { ConfiguracionOperativa } from './ConfiguracionOperativa'
import { EventosCalendario } from './EventosCalendario'
import { useCatalogoEdificaciones } from './useCatalogoEdificaciones'
import type {
  BloqueInfo,
  CalendarioInfo,
  EdificacionInfo,
  EspacioInfo,
  HorarioEquipoInfo,
  RangoCalendarioUI,
} from './useCatalogoEdificaciones'
import { ComoFunciona } from './ComoFunciona'
import { VistaDatos } from './VistaDatos'
import { GestionFacturas } from './GestionFacturas'
import { GestionEquipos } from './GestionEquipos'
import { GestionVariables } from './GestionVariables'
import { HorariosEquipos } from './HorariosEquipos'
import { SectionSkeleton } from './SectionSkeleton'
import { EASE, revealBlur, revealUp, staggerContainer } from './motion'
import type {
  AjustesExistentes,
  EquiposExistentes,
  FacturasExistentes,
  LineaBaseExistente,
  VariablesExistentes,
} from './existencias'
import type { EventoInfo } from '../models/eventos'
import {
  construirPanelAjustes,
  construirPanelEquipos,
  construirPanelFacturas,
  construirPanelVariables,
} from './existencias'

// T7 (Phase 4b) — justified code splitting: these five sections never take
// part in the first paint (the route always boots on "Resumen": title, stat
// cards and `ComoFunciona` stay eager) and only mount behind an explicit
// section/mode switch. Splitting them out keeps their chunks — above all
// SheetJS (`xlsx`, ~110 kB gzip) used by the three import wizards — out of
// this route's First Load JS. Each usage site wraps its lazy component in a
// `<React.Suspense>` whose `SectionSkeleton` covers the download gap with a
// stable-height placeholder; props, behaviour and SSR output are unchanged.
// Plain `React.lazy` on purpose: `next/dynamic` is a bare package import the
// Vitest browser optimizer only discovers at runtime, which reloads the test
// page mid-run (dual React copies → invalid hook calls across the suite).
const ImportadorFacturas = React.lazy(() =>
  import('./ImportadorFacturas').then((m) => ({ default: m.ImportadorFacturas }))
)
const ImportadorEquipos = React.lazy(() =>
  import('./ImportadorEquipos').then((m) => ({ default: m.ImportadorEquipos }))
)
const ImportadorVariables = React.lazy(() =>
  import('./ImportadorVariables').then((m) => ({ default: m.ImportadorVariables }))
)
const LineasBase = React.lazy(() =>
  import('./LineasBase').then((m) => ({ default: m.LineasBase }))
)
const AjustesSection = React.lazy(() =>
  import('./AjustesSection').then((m) => ({ default: m.AjustesSection }))
)
const CalculoUso = React.lazy(() =>
  import('./CalculoUso').then((m) => ({ default: m.CalculoUso }))
)

type DatosContentProps = {
  role: Role
  puedeCargar: boolean
  puedeCalcular: boolean
  stats: {
    facturas: number
    equipos: number
    variables: number
    lineasBase: number
  }
  edificaciones: EdificacionInfo[]
  bloques: BloqueInfo[]
  espacios: EspacioInfo[]
  /** Configuración operativa por edificación (calendario de la GDE). */
  calendarios: CalendarioInfo[]
  /** Rangos de fechas con tipo de día de todos los calendarios. */
  rangos: RangoCalendarioUI[]
  /** Horarios de funcionamiento de equipos por edificación (UPME §7.1/§7.3). */
  horarios: HorarioEquipoInfo[]
  /** Eventos del calendario por edificación (S7; herencia S8 en T8). */
  eventos: EventoInfo[]
  facturasExistentes: FacturasExistentes
  equiposExistentes: EquiposExistentes
  variablesExistentes: VariablesExistentes
  ajustesExistentes: AjustesExistentes
  /** Líneas base guardadas (hasta 50) para la tabla de gestión de facturas. */
  lineasBaseFilas: LineaBaseExistente[]
}

export function DatosContent({
  role,
  puedeCargar,
  puedeCalcular,
  stats,
  edificaciones,
  bloques,
  espacios,
  calendarios,
  rangos,
  horarios,
  eventos,
  facturasExistentes,
  equiposExistentes,
  variablesExistentes,
  ajustesExistentes,
  lineasBaseFilas,
}: DatosContentProps) {
  const pos = useHeaderPos()
  const { activeId: activeIdCrudo, setActiveId } = useSubNav()
  // El SubNavContext es compartido con el módulo de análisis: si el id activo
  // viene de allí (p. ej. 'comparativo'), este módulo cae a Resumen en vez de
  // renderizar vacío.
  const activeId = DATOS_SECTIONS.some((s) => s.id === activeIdCrudo)
    ? activeIdCrudo
    : 'resumen'
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  /** Sub-vista de Edificaciones: catálogo (infraestructura), calendario de
   *  festivos/eventos o configuración operativa (6d1: ex-drawer). */
  const [vistaEdificaciones, setVistaEdificaciones] = React.useState<
    'infraestructura' | 'calendario' | 'configuracion'
  >('infraestructura')
  /**
   * S9: edificación seleccionada en la sub-vista «Calendario» — estado
   * COMPARTIDO entre el panel CRUD de eventos y el calendario (superposición
   * de eventos, tipo de día y horas de uso con la misma selección).
   */
  const [edificacionCalendario, setEdificacionCalendario] = React.useState('')
  const [vista, setVista] = React.useState<Modo>(puedeCargar ? 'carga' : 'datos')
  const modo: Modo = puedeCargar ? vista : 'datos'

  // Catálogo compartido: edificaciones, bloques y espacios viven aquí (fuente
  // única para Edificaciones, Facturas de energía, Equipos, Variables y Líneas Base).
  const {
    edificaciones: edificacionesCat,
    bloques: bloquesCat,
    espacios: espaciosCat,
    crearEdificacion,
    actualizarEdificacion,
    eliminarEdificacion,
    crearBloque,
    eliminarBloque,
    crearEspacio,
    eliminarEspacio,
  } = useCatalogoEdificaciones(edificaciones, bloques, espacios)

  /** Modo efectivo de una sección: si el modo global no existe en ella, cae al primero. */
  const modoDe = (modos: readonly ModoInfo[]): Modo =>
    modos.some((m) => m.id === modo) ? modo : (modos[0]?.id ?? 'datos')

  const modoFacturas = modoDe(MODOS)
  const modoEquipos = modoDe(MODOS_SECCION)
  const modoVariables = modoDe(MODOS_SECCION)
  const modoAjustes = modoDe(MODOS_AJUSTES) as 'carga' | 'datos' | 'gestion'

  // Las tiras de pills hacen scroll horizontal por debajo de `lg`: al renderizar
  // (montaje, cambio de modo o de ancho) se alinea el pill activo para que nunca
  // quede oculto tras el recorte. Sólo actúa si el pill sale de la tira, así que
  // no molesta cuando todo cabe o el usuario ya lo dejó visible.
  React.useLayoutEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-pill-strip]').forEach((tira) => {
      const activo = tira.querySelector<HTMLElement>('[aria-pressed="true"]')
      if (!activo) return
      const a = activo.getBoundingClientRect()
      const t = tira.getBoundingClientRect()
      if (a.left >= t.left && a.right <= t.right) return
      tira.scrollTo({ left: tira.scrollLeft + (a.left - t.left) - 8 })
    })
  })

  /** Del importador (o su CTA vacío) a la sección de primer nivel Edificaciones. */
  const irAlCatalogo = () => {
    setActiveId('edificaciones')
  }

  const headerOnTop = pos === 'center'
  const contentOffset = !headerOnTop
    ? 0
    : sidebarOpen
      ? SIDEBAR_W_EXPANDED
      : SIDEBAR_W_COLLAPSED
  /** The module sidebar only exists from `lg` up — below it the offset is 0. */
  const offsetClass =
    contentOffset === SIDEBAR_W_EXPANDED
      ? 'lg:ml-64'
      : contentOffset === SIDEBAR_W_COLLAPSED
        ? 'lg:ml-14'
        : ''

  const statCards = [
    { id: 'facturas', title: 'Facturas de energía', value: stats.facturas, subtitle: 'registros en BD', Icon: IconFactura, color: 'emerald' },
    { id: 'equipos', title: 'Equipos Registrados', value: stats.equipos, subtitle: 'equipos eléctricos', Icon: IconEquipo, color: 'amber' },
    { id: 'variables', title: 'Variables Mensuales', value: stats.variables, subtitle: 'registros activos', Icon: IconVariable, color: 'sky' },
    { id: 'lineas-base', title: 'Líneas Base', value: stats.lineasBase, subtitle: 'modelos LBEn', Icon: IconLineaBase, color: 'purple' },
  ]

  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    sky: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
    purple: 'bg-uv-purple/15 text-uv-purple dark:bg-uv-purple/20 dark:text-uv-purple',
  }

  const renderToggle = (
    seccion: string,
    acentoBg: string,
    modos: readonly ModoInfo[] = MODOS_SECCION
  ) => {
    // Si el modo global no existe en esta sección (p. ej. "carga" en Ajustes),
    // se cae al primero disponible para que el pill activo siempre coincida
    // con el contenido renderizado.
    const modoActivo: Modo = modoDe(modos)
    return (
      <div
        data-pill-strip
        className="scrollbar-hide inline-flex max-w-full shrink-0 snap-x snap-mandatory overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-1.5 dark:border-slate-800 dark:bg-slate-900 lg:justify-center lg:overflow-x-visible"
        role="group"
        aria-label={`Modo de la sección ${seccion}`}
      >
        {modos.map((m) => {
          const activa = modoActivo === m.id
          const deshabilitada = (m.id === 'carga' || m.id === 'gestion') && !puedeCargar
          return (
            <button
              key={m.id}
              type="button"
              disabled={deshabilitada}
              aria-pressed={activa}
              onClick={() => setVista(m.id)}
              className={`focus-ring relative flex min-h-10 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-colors duration-300 lg:min-h-0 ${
                activa
                  ? 'text-white'
                  : deshabilitada
                    ? 'cursor-not-allowed text-gray-300 dark:text-slate-600'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {activa && (
                <motion.span
                  layoutId={`vista-pill-${activeId}`}
                  className={`absolute inset-0 rounded-lg ${acentoBg}`}
                  transition={{ duration: 0.3, ease: EASE }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <m.Icon />
                {m.label}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {headerOnTop && (
        <SidebarNav
          items={DATOS_SECTIONS}
          activeId={activeId}
          onSelect={(item) => setActiveId(item.id)}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
        />
      )}

      {/* Contenido principal */}
      <div
        className={`p-6 transition-[margin] duration-300 ${offsetClass}`}
        style={{
          minHeight: headerOnTop ? 'calc(100vh - 4rem)' : '100vh',
        }}
      >
        {/* Resumen del módulo: título + tarjetas solo en esta pestaña */}
        {activeId === 'resumen' && (
          <>
            <motion.div
              initial="hidden"
              animate="show"
              variants={revealBlur}
              className="mb-6"
            >
              <h1 className="ui-title text-2xl">
                Módulo de Carga y Gestión de Datos
              </h1>
              <p className="ui-muted mt-1 text-sm">
                SIGE-TdeA - Resolución UPME 0016 de 2024 · {ROLE_CORTO[role]}
              </p>
              <p className="ui-muted mt-1 max-w-2xl text-sm">
                Importe y administre la información energética institucional:
                facturas de energía, inventario eléctrico, variables operativas y
                líneas base.
              </p>
            </motion.div>

            {/* Estadísticas */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer}
              className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4"
            >
              {statCards.map((stat) => (
                <motion.button
                  key={stat.id}
                  variants={revealUp}
                  type="button"
                  onClick={() => setActiveId(stat.id)}
                  className="ui-card-stat group cursor-pointer p-4 text-left focus-ring"
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-lg transition-transform group-hover:scale-105 ${
                      colorClasses[stat.color] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <stat.Icon />
                  </span>
                  <p className="ui-title mt-3 text-2xl">
                    {stat.value}
                  </p>
                  <p className="ui-label">{stat.title}</p>
                  <p className="ui-muted text-xs">{stat.subtitle}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-emerald-400">
                    Ir a la sección
                    <svg
                      width={12}
                      height={12}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}

        {/* Contenido por sección */}
        <section className="space-y-6">
          {/* Sección: Resumen — guía animada "Cómo funciona" */}
          {activeId === 'resumen' && <ComoFunciona />}

          {/* Sección: Facturas de energía — carga asistida + visualización separada */}
          {activeId === 'facturas' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="ui-title text-lg">Carga de Facturas de energía</h2>
                  <p className="ui-muted text-sm">
                    {modoFacturas === 'carga'
                      ? 'Importe facturas de energía desde un archivo o ingréselas manualmente.'
                      : modoFacturas === 'gestion'
                        ? 'Edite, elimine o vacíe las facturas guardadas y sus líneas base asociadas.'
                        : 'Consulte las facturas de energía guardadas: consumo, costos y periodos que alimentan la Línea Base.'}
                  </p>
                </div>
                {renderToggle('Facturas de energía', 'bg-emerald-600', MODOS)}
              </div>

              {!puedeCargar && (
                <div className="ui-callout ui-callout-info" role="status">
                  Su rol tiene permisos de <strong>solo lectura</strong> en este módulo. Puede
                  consultar la información, pero no cargar ni modificar facturas.
                </div>
              )}

              {modoFacturas === 'carga' ? (
                <React.Suspense fallback={<SectionSkeleton />}>
                  <ImportadorFacturas
                    edificaciones={edificacionesCat}
                    onIrAlCatalogo={irAlCatalogo}
                    puedeCargar={puedeCargar}
                  />
                </React.Suspense>
              ) : modoFacturas === 'gestion' ? (
                <GestionFacturas
                  facturas={facturasExistentes}
                  lineasBaseTotal={stats.lineasBase}
                  lineasBaseFilas={lineasBaseFilas}
                />
              ) : (
                <VistaDatos {...construirPanelFacturas(facturasExistentes)} />
              )}
            </div>
          )}

          {/* Sección: Edificaciones — catálogo maestro de la estructura física */}
          {activeId === 'edificaciones' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="ui-title text-lg">Gestión de Edificaciones</h2>
                  <p className="ui-muted text-sm">
                    Administre las edificaciones, bloques y espacios: la estructura que segmenta
                    facturas, equipos y variables, con las características que exige la línea base
                    de la Resolución UPME 0016 de 2024.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Vistas de edificaciones">
                  <button
                    type="button"
                    aria-pressed={vistaEdificaciones === 'infraestructura'}
                    onClick={() => setVistaEdificaciones('infraestructura')}
                    className={`focus-ring min-h-10 cursor-pointer rounded-lg px-3 text-sm font-medium ${
                      vistaEdificaciones === 'infraestructura'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-gray-300 bg-white text-gray-700 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200'
                    }`}
                  >
                    Infraestructura
                  </button>
                  <button
                    type="button"
                    aria-pressed={vistaEdificaciones === 'calendario'}
                    onClick={() => setVistaEdificaciones('calendario')}
                    className={`focus-ring min-h-10 cursor-pointer rounded-lg px-3 text-sm font-medium ${
                      vistaEdificaciones === 'calendario'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-gray-300 bg-white text-gray-700 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200'
                    }`}
                  >
                    Calendario
                  </button>
                  <button
                    type="button"
                    aria-pressed={vistaEdificaciones === 'configuracion'}
                    onClick={() => setVistaEdificaciones('configuracion')}
                    className={`focus-ring min-h-10 cursor-pointer rounded-lg px-3 text-sm font-medium ${
                      vistaEdificaciones === 'configuracion'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-gray-300 bg-white text-gray-700 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200'
                    }`}
                  >
                    Configuración operativa
                  </button>
                </div>
              </div>

              {vistaEdificaciones === 'configuracion' ? (
                !puedeCargar ? (
                  <div className="ui-callout ui-callout-info" role="status">
                    Su rol tiene permisos de <strong>solo lectura</strong> en este módulo. Puede
                    consultar la configuración operativa, pero no modificarla aquí.
                  </div>
                ) : (
                  <ConfiguracionOperativa
                    edificaciones={edificacionesCat}
                    calendarios={calendarios}
                  />
                )
              ) : vistaEdificaciones === 'calendario' ? (
                <div className="space-y-6">
                  {/* T7/T8: panel CRUD de eventos (S7/S8) hermano del calendario;
                      la selección de edificación es compartida (S9) y superpone
                      eventos, tipo de día y horas de uso a la rejilla/semana/agenda. */}
                  <EventosCalendario
                    edificaciones={edificacionesCat}
                    bloques={bloquesCat}
                    espacios={espaciosCat}
                    equipos={equiposExistentes.filas}
                    eventos={eventos}
                    puedeCargar={puedeCargar}
                    edificacionId={edificacionCalendario}
                    onEdificacionChange={setEdificacionCalendario}
                  />
                  <CalendarioFestivos
                    edificacionId={edificacionCalendario}
                    calendarios={calendarios}
                    rangos={rangos}
                    horarios={horarios}
                    eventos={eventos}
                    bloques={bloquesCat}
                    espacios={espaciosCat}
                    equipos={equiposExistentes.filas}
                  />
                  {/* 6d2/6d3: rangos + plantilla TdeA y horarios (ex-drawer) con
                      la MISMA selección de edificación que el calendario. */}
                  <ConfiguracionCalendario
                    edificacionId={edificacionCalendario}
                    calendarios={calendarios}
                    rangos={rangos}
                    horarios={horarios}
                    bloques={bloquesCat}
                    espacios={espaciosCat}
                    equipos={equiposExistentes.filas}
                    puedeCargar={puedeCargar}
                  />
                </div>
              ) : !puedeCargar ? (
                <div className="ui-callout ui-callout-info" role="status">
                  Su rol tiene permisos de <strong>solo lectura</strong> en este módulo. Puede
                  consultar las edificaciones desde las demás secciones, pero no modificarlas aquí.
                </div>
              ) : (
                <EdificacionesPanel
                  edificaciones={edificacionesCat}
                  bloques={bloquesCat}
                  espacios={espaciosCat}
                  crearEdificacion={crearEdificacion}
                  actualizarEdificacion={actualizarEdificacion}
                  eliminarEdificacion={eliminarEdificacion}
                  crearBloque={crearBloque}
                  eliminarBloque={eliminarBloque}
                  crearEspacio={crearEspacio}
                  eliminarEspacio={eliminarEspacio}
                />
              )}
            </div>
          )}

          {/* Sección: Equipos Eléctricos — carga asistida + visualización separada */}
          {activeId === 'equipos' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="ui-title text-lg">Inventario de Equipos Eléctricos</h2>
                  <p className="ui-muted text-sm">
                    {modoEquipos === 'carga'
                      ? 'Seleccione una edificación e importe su inventario segmentado por bloque y espacio: HVAC, iluminación, ofimática y motores.'
                      : modoEquipos === 'gestion'
                        ? 'Edite cantidades y potencias, elimine equipos o vacíe el inventario: el catálogo de espacios se conserva.'
                        : 'Consulte el inventario guardado: potencia instalada por edificación, con bloques y espacios que tienen equipos registrados.'}
                  </p>
                </div>
                {renderToggle('Equipos Eléctricos', 'bg-amber-500')}
              </div>

              {!puedeCargar && (
                <div className="ui-callout ui-callout-info" role="status">
                  Su rol tiene permisos de <strong>solo lectura</strong> en este módulo. Puede
                  consultar la información, pero no cargar ni modificar el inventario de equipos.
                </div>
              )}

              {modoEquipos === 'carga' ? (
                <React.Suspense fallback={<SectionSkeleton />}>
                  <ImportadorEquipos
                    edificaciones={edificacionesCat}
                    bloques={bloquesCat}
                    espacios={espacios}
                    calendarios={calendarios}
                    rangos={rangos}
                    horarios={horarios}
                    crearBloque={crearBloque}
                    eliminarBloque={eliminarBloque}
                    onIrAlCatalogo={irAlCatalogo}
                    puedeCargar={puedeCargar}
                  />
                </React.Suspense>
              ) : modoEquipos === 'gestion' ? (
                <GestionEquipos equipos={equiposExistentes} />
              ) : (
                <VistaDatos {...construirPanelEquipos(equiposExistentes)} />
              )}

              {/* Trazabilidad S3 (solo donde se listan equipos guardados): horarios
                  aplicables por nivel + horas de uso «esta semana» por equipo. */}
              {modoEquipos !== 'carga' && (
                <HorariosEquipos
                  equipos={equiposExistentes.filas}
                  horarios={horarios}
                />
              )}
            </div>
          )}

          {/* Sección: Variables Operativas — carga asistida + visualización separada */}
          {activeId === 'variables' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="ui-title text-lg">Variables Operativas</h2>
                  <p className="ui-muted text-sm">
                    {modoVariables === 'carga'
                      ? 'Seleccione una edificación e importe la población y el clima por bloque y periodo: población fija, población flotante, días lectivos/laborales y GDE.'
                      : modoVariables === 'gestion'
                        ? 'Edite población, días y GDE, elimine registros o vacíe la base: facturas y líneas base se conservan.'
                        : 'Consulte las variables guardadas: población fija y flotante y el GDE por bloque y periodo que contextualizan el consumo.'}
                  </p>
                </div>
                {renderToggle('Variables Operativas', 'bg-sky-500')}
              </div>

              {!puedeCargar && (
                <div className="ui-callout ui-callout-info" role="status">
                  Su rol tiene permisos de <strong>solo lectura</strong> en este módulo. Puede
                  consultar la información, pero no cargar ni modificar las variables operativas.
                </div>
              )}

              {modoVariables === 'carga' ? (
                <React.Suspense fallback={<SectionSkeleton />}>
                  <ImportadorVariables
                    edificaciones={edificacionesCat}
                    bloques={bloquesCat}
                    crearBloque={crearBloque}
                    eliminarBloque={eliminarBloque}
                    onIrAlCatalogo={irAlCatalogo}
                    puedeCargar={puedeCargar}
                    calendarios={calendarios}
                    rangos={rangos}
                    horarios={horarios}
                  />
                </React.Suspense>
              ) : modoVariables === 'gestion' ? (
                <GestionVariables variables={variablesExistentes} />
              ) : (
                <VistaDatos {...construirPanelVariables(variablesExistentes)} />
              )}
            </div>
          )}

          {/* Sección: Líneas Base — 4 modelos LBEn con cálculo real */}
          {activeId === 'lineas-base' && (
            <React.Suspense fallback={<SectionSkeleton />}>
              <LineasBase
                total={stats.lineasBase}
                edificaciones={edificacionesCat}
                bloques={bloquesCat}
                espacios={espacios}
                puedeCalcular={puedeCalcular}
                puedeGuardar={puedeCargar}
              />
            </React.Suspense>
          )}

          {/* Sección: Cálculo de uso — individual + vista previa (spec §5, T5).
              El cálculo requiere permiso de carga: sin él hay estado vacío. */}
          {activeId === 'calculo-uso' &&
            (!puedeCargar ? (
              <div className="ui-empty">No tiene permiso para calcular horas de uso.</div>
            ) : (
              <React.Suspense fallback={<SectionSkeleton />}>
                <CalculoUso edificaciones={edificacionesCat} puedeCargar={puedeCargar} />
              </React.Suspense>
            ))}

          {/* Sección: Ajustes — carga, visualización y gestión con referencia Anexo 4 */}
          {activeId === 'ajustes' && (
            <React.Suspense fallback={<SectionSkeleton />}>
              <AjustesSection
                ajustes={ajustesExistentes}
                ajustesAplicados={[]}
                modo={modoAjustes}
                puedeCargar={puedeCargar}
                onModoChange={setVista}
              />
            </React.Suspense>
          )}
        </section>
      </div>
    </div>
    </MotionConfig>
  )
}

const MODOS = [
  { id: 'carga', label: 'Carga', Icon: IconCarga },
  { id: 'datos', label: 'Visualización', Icon: IconVistaPrevia },
  { id: 'gestion', label: 'Gestión', Icon: IconGestionar },
] as const

/** Ajustes reutiliza los mismos modos que el resto de secciones. */
const MODOS_SECCION = MODOS
const MODOS_AJUSTES = MODOS_SECCION

type Modo = (typeof MODOS)[number]['id']
type ModoInfo = (typeof MODOS)[number]

const ROLE_CORTO: Record<Role, string> = {
  ADMIN_TI: 'Administrador (TI)',
  GESTOR_ENERGETICO: 'Gestor Energético',
  COORD_INFRAESTRUCTURA: 'Coord. Infraestructura',
  DIRECTIVO: 'Directivo',
  COMUNIDAD_UNIVERSITARIA: 'Comunidad Universitaria',
}

