'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { visibleModules, type ModuleId, type Role } from '@/shared/models/permissions'
import { Chevron, SidebarTree, SIDEBAR_INDENT, type SidebarItem } from './sidebar/SidebarNav'
import { useSubNav } from './nav/NavContext'
import { DATOS_SECTIONS } from '@/features/datos/views/nav'
import { ANALISIS_SECTIONS } from '@/features/analisis/views/nav'

export type NavVariant = 'bar' | 'sidebar' | 'rail'

export interface NavItem {
  id: string
  fullLabel: string
  shortLabel: string
  href: string
  moduleId?: ModuleId
  icon: React.ReactNode
}

const ICONS: Record<string, React.ReactNode> = {
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  'arrow-up-tray': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" />
      <path d="M17 5v3" />
      <path d="M7 5v3" />
      <path d="M21 12H9a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2" />
      <path d="M15 15v-3" />
    </svg>
  ),
  'squares-2x2': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  'chart-bar': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  bell: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  calculator: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8" />
      <path d="M8 10h8" />
      <path d="M8 14h8" />
      <path d="M12 18h.01" />
    </svg>
  ),
  'document-chart-bar': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 12h4" />
      <path d="M10 16h4" />
      <path d="M10 20h.01" />
    </svg>
  ),
  map: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </svg>
  ),
}

/** Single source of truth for module links (header, drawer and the home
 *  view's cards). Exported read-only: rendering/filtering happens outside. */
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'users',
    fullLabel: 'Usuarios y acceso',
    shortLabel: 'Usuarios',
    href: '/dashboard/users',
    moduleId: 'users',
    icon: ICONS.users,
  },
  {
    id: 'consumption',
    fullLabel: 'Gestión de datos',
    shortLabel: 'Datos',
    href: '/dashboard/datos',
    moduleId: 'consumption',
    icon: ICONS['arrow-up-tray'],
  },
  {
    id: 'dashboard',
    fullLabel: 'Dashboard',
    shortLabel: 'Dashboard',
    href: '/dashboard',
    icon: ICONS['squares-2x2'],
  },
  {
    id: 'analisis',
    fullLabel: 'Análisis estadístico',
    shortLabel: 'Análisis',
    href: '/dashboard/analisis',
    // El módulo analiza facturas/variables de consumo: se muestra solo a
    // quien ve «Datos» (evita un link muerto para Comunidad Universitaria).
    moduleId: 'consumption',
    icon: ICONS['chart-bar'],
  },
  {
    id: 'alertas',
    fullLabel: 'Alertas',
    shortLabel: 'Alertas',
    href: '/dashboard/alertas',
    icon: ICONS.bell,
  },
  {
    id: 'estimates',
    fullLabel: 'Estimaciones',
    shortLabel: 'Estimaciones',
    href: '/dashboard/estimaciones',
    moduleId: 'estimates',
    icon: ICONS.calculator,
  },
  {
    id: 'reports',
    fullLabel: 'Reportes',
    shortLabel: 'Reportes',
    href: '/dashboard/reportes',
    moduleId: 'reports',
    icon: ICONS['document-chart-bar'],
  },
  {
    id: 'plans',
    fullLabel: 'Representación espacial',
    shortLabel: 'Espacial',
    href: '/dashboard/espacial',
    moduleId: 'plans',
    icon: ICONS.map,
  },
]

/** Shared visibility rule (static matrix + temporary overrides). Exported so
 *  the home cards gate exactly like the nav — never a parallel implementation. */
export function isItemVisible(role: string | null, item: NavItem, extraModules: string[] = []): boolean {
  if (!item.moduleId) return true
  if (!role) return false
  const visible = visibleModules(role as Role)
  return visible.includes(item.moduleId) || extraModules.includes(item.moduleId)
}

/**
 * Módulos con navegación interna por secciones: en la variante `sidebar` su
 * árbol se embebe bajo el link (equivalente al SidebarNav propio del módulo,
 * que sólo existe con la cabecera arriba). `onNavigate` en el select cierra
 * el cajón móvil al elegir sección (la sección no toca la URL).
 */
const MODULE_TREES: Record<
  string,
  { ruta: string; secciones: SidebarItem[]; etiqueta: string }
> = {
  consumption: {
    ruta: '/dashboard/datos',
    secciones: DATOS_SECTIONS,
    etiqueta: 'Mostrar u ocultar las secciones del módulo de datos',
  },
  analisis: {
    ruta: '/dashboard/analisis',
    secciones: ANALISIS_SECTIONS,
    etiqueta: 'Mostrar u ocultar las secciones del módulo de análisis',
  },
}

export function ModuleNav({
  role,
  variant,
  extraModules = [],
  onNavigate,
}: {
  role: string | null
  variant: NavVariant
  extraModules?: string[]
  /** Called when the user picks a module or a datos section — used by the
   *  mobile drawer to close itself (section changes don't touch the URL). */
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const { activeId, setActiveId } = useSubNav()
  const [treeOpen, setTreeOpen] = useState(true)

  const enRutaDe = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')
  const enRutaConArbol = Object.values(MODULE_TREES).some((t) =>
    enRutaDe(t.ruta)
  )

  useEffect(() => {
    if (enRutaConArbol) setTreeOpen(true)
  }, [enRutaConArbol])

  const visibleItems = NAV_ITEMS.filter((item) => isItemVisible(role, item, extraModules))

  const isActive = (href: string): boolean => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  const baseClasses = 'relative rounded-lg transition-colors data-no-drag'

  /**
   * Marcador del módulo activo: el mismo tick uv-lime que usa `SidebarTree`
   * para la sección activa, para que el estado activo se reconozca igual en
   * barra, riel y cajón (además del `aria-current` para lectores de pantalla).
   */
  const activoMarker = (
    <span
      aria-hidden
      className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-uv-lime"
    />
  )

  const renderItem = (item: NavItem, index: number) => {
    const active = isActive(item.href)
    const inactiveClass = 'text-emerald-100/85 hover:text-white hover:bg-white/10'
    const activeClass = 'bg-white/15 text-white font-medium'
    const commonClass = `${baseClasses} ${active ? activeClass : inactiveClass}`
    const current = active ? 'page' : undefined

    if (variant === 'rail') {
      return (
        <Link
          key={item.id}
          href={item.href}
          className={`chrome-focus flex h-8 w-8 items-center justify-center ${commonClass}`}
          title={item.fullLabel}
          aria-label={item.fullLabel}
          aria-current={current}
          data-no-drag
        >
          {active && activoMarker}
          {item.icon}
        </Link>
      )
    }

    if (variant === 'bar') {
      return (
        <Link
          key={item.id}
          href={item.href}
          className={`chrome-focus flex items-center gap-1 whitespace-nowrap px-2 py-1.5 ${commonClass}`}
          title={item.fullLabel}
          aria-current={current}
          data-no-drag
        >
          {active && activoMarker}
          <span className="shrink-0">{item.icon}</span>
          <span className="text-[13px]">{item.shortLabel}</span>
        </Link>
      )
    }

    // sidebar variant: los módulos con árbol de secciones embeben su tree.
    const tree = MODULE_TREES[item.id]
    if (!tree) {
      return (
        <Link
          key={item.id}
          href={item.href}
          onClick={onNavigate}
          className={`chrome-focus flex min-h-10 w-full items-center gap-2 px-3 py-2 lg:min-h-0 ${commonClass}`}
          aria-current={current}
          data-no-drag
        >
          {active && activoMarker}
          <span className="shrink-0">{item.icon}</span>
          <span className="text-[13px] truncate">{item.fullLabel}</span>
        </Link>
      )
    }

    const onModuleRoute = enRutaDe(tree.ruta)
    const showTree = onModuleRoute && treeOpen

    return (
      <div key={item.id} className="relative">
        {/* Fila: el enlace navega al módulo y el botón alterna sus secciones.
            Controles hermanos, nunca anidados — HTML válido y orden de foco
            lógico (el enlace entra antes que su conmutador). */}
        <div className={`flex items-center gap-1 ${commonClass}`} data-no-drag>
          <Link
            href={item.href}
            onClick={onNavigate}
            className="chrome-focus relative flex min-h-10 flex-1 items-center gap-2 px-3 py-2 lg:min-h-0"
            aria-current={current}
            data-no-drag
          >
            {active && activoMarker}
            <span className="shrink-0">{item.icon}</span>
            <span className="min-w-0 flex-1 truncate text-[13px]">
              {item.fullLabel}
            </span>
          </Link>

          {onModuleRoute && (
            <button
              type="button"
              data-no-drag
              aria-expanded={treeOpen}
              aria-label={tree.etiqueta}
              title={treeOpen ? 'Contraer secciones' : 'Expandir secciones'}
              onClick={() => setTreeOpen((v) => !v)}
              className="chrome-focus mr-1 grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-md text-emerald-200/70 transition-colors hover:text-uv-lime lg:h-5 lg:w-5"
            >
              <Chevron open={treeOpen} />
            </button>
          )}
        </div>

        {showTree && (
          <div className="relative mb-1 mt-1 max-h-64 overflow-y-auto">
            <span
              aria-hidden
              className="absolute bottom-2 top-0 z-10 w-px bg-white/25"
              style={{ left: SIDEBAR_INDENT - 4 }}
            />
            <SidebarTree
              items={tree.secciones}
              activeId={activeId}
              onSelect={(subItem) => {
                setActiveId(subItem.id)
                onNavigate?.()
              }}
              depth={1}
            />
          </div>
        )}
      </div>
    )
  }

  if (variant === 'bar') {
    return (
      // below `lg` the whole bar collapses into MobileNavDrawer
      <nav
        className="hidden items-center gap-1 lg:flex"
        aria-label="Navegación principal"
      >
        {visibleItems.map(renderItem)}
      </nav>
    )
  }

  if (variant === 'rail') {
    return (
      <nav className="flex flex-col gap-1" aria-label="Navegación principal">
        {visibleItems.map(renderItem)}
      </nav>
    )
  }

  // sidebar variant
  return (
    <nav className="flex flex-col gap-1 w-full" aria-label="Navegación principal">
      {visibleItems.map(renderItem)}
    </nav>
  )
}