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
  IconEdificacion,
  IconEquipo,
  IconFactura,
  IconGestionar,
  IconLineaBase,
  IconVariable,
  IconVistaPrevia,
} from './icons'
import { ImportadorFacturas } from './ImportadorFacturas'
import { ImportadorEquipos } from './ImportadorEquipos'
import { ImportadorVariables } from './ImportadorVariables'
import { EdificacionesPanel } from './EdificacionesPanel'
import { useCatalogoEdificaciones } from './useCatalogoEdificaciones'
import type { BloqueInfo, EdificacionInfo, EspacioInfo } from './useCatalogoEdificaciones'
import { ComoFunciona } from './ComoFunciona'
import { LineasBase } from './LineasBase'
import { VistaDatos } from './VistaDatos'
import { GestionFacturas } from './GestionFacturas'
import { GestionEquipos } from './GestionEquipos'
import { GestionVariables } from './GestionVariables'
import { GestionAjustes } from './GestionAjustes'
import { AjustesSection } from './AjustesSection'
import { EASE, revealBlur, revealUp, staggerContainer } from './motion'
import type {
  AjustesExistentes,
  EquiposExistentes,
  FacturasExistentes,
  LineaBaseExistente,
  VariablesExistentes,
} from './existencias'
import {
  construirPanelAjustes,
  construirPanelEquipos,
  construirPanelFacturas,
  construirPanelVariables,
} from './existencias'

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
  facturasExistentes,
  equiposExistentes,
  variablesExistentes,
  ajustesExistentes,
  lineasBaseFilas,
}: DatosContentProps) {
  const pos = useHeaderPos()
  const { activeId, setActiveId } = useSubNav()
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [vista, setVista] = React.useState<Modo>(puedeCargar ? 'carga' : 'datos')
  const modo: Modo = puedeCargar ? vista : 'datos'

  // Catálogo compartido: edificaciones y bloques viven aquí (fuente única para
  // Facturas de energía, Equipos, Variables y Líneas Base).
  const {
    edificaciones: edificacionesCat,
    bloques: bloquesCat,
    crearEdificacion,
    eliminarEdificacion,
    crearBloque,
    eliminarBloque,
  } = useCatalogoEdificaciones(edificaciones, bloques)

  /** Modo efectivo de una sección: si el modo global no existe en ella, cae al primero. */
  const modoDe = (modos: readonly ModoInfo[]): Modo =>
    modos.some((m) => m.id === modo) ? modo : (modos[0]?.id ?? 'datos')

  const modoFacturas = modoDe(MODOS)
  const modoEquipos = modoDe(MODOS_SECCION)
  const modoVariables = modoDe(MODOS_SECCION)
  const modoAjustes = modoDe(MODOS_AJUSTES) as 'carga' | 'datos' | 'gestion'

  /** Del importador (o su CTA vacío) al catálogo de edificaciones de Facturas de energía. */
  const irAlCatalogo = () => {
    setVista('edificaciones')
    setActiveId('facturas')
  }

  const headerOnTop = pos === 'center'
  const contentOffset = !headerOnTop
    ? 0
    : sidebarOpen
      ? SIDEBAR_W_EXPANDED
      : SIDEBAR_W_COLLAPSED

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
        className="inline-flex shrink-0 rounded-xl border border-gray-200 bg-gray-100 p-1.5 dark:border-slate-800 dark:bg-slate-900"
        role="group"
        aria-label={`Modo de la sección ${seccion}`}
      >
        {modos.map((m) => {
          const activa = modoActivo === m.id
          const deshabilitada =
            (m.id === 'carga' || m.id === 'gestion' || m.id === 'edificaciones') &&
            !puedeCargar
          return (
            <button
              key={m.id}
              type="button"
              disabled={deshabilitada}
              aria-pressed={activa}
              onClick={() => setVista(m.id)}
              className={`focus-ring relative flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors duration-300 ${
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
        className="p-6 transition-[margin] duration-300"
        style={{
          marginLeft: contentOffset,
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
                        : modoFacturas === 'edificaciones'
                          ? 'Administre las edificaciones, bloques y espacios: la estructura que segmenta facturas, equipos y variables.'
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
                <ImportadorFacturas
                  edificaciones={edificacionesCat}
                  onIrAlCatalogo={irAlCatalogo}
                  puedeCargar={puedeCargar}
                />
              ) : modoFacturas === 'gestion' ? (
                <GestionFacturas
                  facturas={facturasExistentes}
                  lineasBaseTotal={stats.lineasBase}
                  lineasBaseFilas={lineasBaseFilas}
                />
              ) : modoFacturas === 'edificaciones' ? (
                <EdificacionesPanel
                  edificaciones={edificacionesCat}
                  bloques={bloquesCat}
                  espacios={espacios}
                  crearEdificacion={crearEdificacion}
                  eliminarEdificacion={eliminarEdificacion}
                  crearBloque={crearBloque}
                  eliminarBloque={eliminarBloque}
                />
              ) : (
                <VistaDatos {...construirPanelFacturas(facturasExistentes)} />
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
                <ImportadorEquipos
                  edificaciones={edificacionesCat}
                  bloques={bloquesCat}
                  espacios={espacios}
                  crearBloque={crearBloque}
                  eliminarBloque={eliminarBloque}
                  onIrAlCatalogo={irAlCatalogo}
                  puedeCargar={puedeCargar}
                />
              ) : modoEquipos === 'gestion' ? (
                <GestionEquipos equipos={equiposExistentes} />
              ) : (
                <VistaDatos {...construirPanelEquipos(equiposExistentes)} />
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
                <ImportadorVariables
                  edificaciones={edificacionesCat}
                  bloques={bloquesCat}
                  crearBloque={crearBloque}
                  eliminarBloque={eliminarBloque}
                  onIrAlCatalogo={irAlCatalogo}
                  puedeCargar={puedeCargar}
                />
              ) : modoVariables === 'gestion' ? (
                <GestionVariables variables={variablesExistentes} />
              ) : (
                <VistaDatos {...construirPanelVariables(variablesExistentes)} />
              )}
            </div>
          )}

          {/* Sección: Líneas Base — 4 modelos LBEn con cálculo real */}
          {activeId === 'lineas-base' && (
            <LineasBase
              total={stats.lineasBase}
              edificaciones={edificacionesCat}
              bloques={bloquesCat}
              espacios={espacios}
              puedeCalcular={puedeCalcular}
              puedeGuardar={puedeCargar}
            />
          )}

          {/* Sección: Ajustes — carga, visualización y gestión con referencia Anexo 4 */}
          {activeId === 'ajustes' && (
            <AjustesSection
              ajustes={ajustesExistentes}
              ajustesAplicados={[]}
              modo={modoAjustes}
              puedeCargar={puedeCargar}
              onModoChange={setVista}
            />
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
  { id: 'edificaciones', label: 'Edificaciones', Icon: IconEdificacion },
] as const

/** Secciones sin el modo «Edificaciones» (solo Facturas de energía lo ofrece). */
const MODOS_SECCION = MODOS.filter((m) => m.id !== 'edificaciones')
/** Ajustes tiene todos los modos excepto 'edificaciones'. */
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

