"use client"

/**
 * Sidebar navigation for the SIGE-TdeA data-management module.
 *
 * - SidebarTree: recursive renderer — children indented (20px per level) with a
 *   vertical guide line on the left marking the hierarchy.
 * - SidebarNav: collapsible left container used while the header sits on top
 *   (center position). When the header is docked left/right the same tree is
 *   embedded into the module nav instead (see ModuleNav).
 */

import React, { useState } from 'react'

export interface SidebarItem {
  id: string
  label: string
  icon?: React.ReactNode
  children?: SidebarItem[]
  route?: string
}

export const SIDEBAR_W_EXPANDED = 256
export const SIDEBAR_W_COLLAPSED = 56
export const SIDEBAR_INDENT = 16
const CHILD_OFFSET_STEP = 38
const GUIDE_GAP = 12

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 transition-transform duration-200"
      style={{ transform: open ? 'rotate(90deg)' : 'none' }}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function PanelToggleIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d={expanded ? 'm16 15-3-3 3-3' : 'm14 9 3 3-3 3'} />
    </svg>
  )
}

export function SidebarTree({
  items,
  activeId,
  onSelect,
  depth = 0,
  collapsed = false,
  defaultExpanded = [],
}: {
  items: SidebarItem[]
  activeId?: string
  onSelect?: (item: SidebarItem) => void
  depth?: number
  collapsed?: boolean
  defaultExpanded?: string[]
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(defaultExpanded.map((id) => [id, true]))
  )

  const toggleExpand = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  const renderList = (
    list: SidebarItem[],
    level: number,
    offset: number
  ): React.ReactNode => {
    const marginLeft = level === 0 ? 0 : offset
    const paddingLeft = level === 0 ? 8 : 6
    const contentOffset = marginLeft + paddingLeft

    return (
      <ul className="m-0 list-none p-0">
        {list.map((item, index) => {
          const hasChildren = Boolean(item.children?.length)
          const isExpanded = hasChildren && Boolean(expanded[item.id])
          const isActive = activeId === item.id
          const childOffset = contentOffset + CHILD_OFFSET_STEP

          return (
            <li key={item.id} className="relative">
              <button
                type="button"
                data-no-drag
                title={item.label}
                aria-expanded={hasChildren ? isExpanded : undefined}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  if (hasChildren) toggleExpand(item.id)
                  else onSelect?.(item)
                }}
                className={`datos-row group relative flex h-9 cursor-pointer items-center gap-2 rounded-lg pr-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-uv-lime ${
                  isActive
                    ? 'bg-white/15 font-medium text-white'
                    : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                style={{
                  animationDelay: `${index * 40}ms`,
                  ...(collapsed
                    ? {}
                    : {
                        marginLeft,
                        paddingLeft,
                        width: `calc(100% - ${marginLeft}px)`,
                      }),
                }}
              >
                {isActive && !collapsed && (
                  <span
                    aria-hidden
                    className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-uv-lime"
                  />
                )}

                {hasChildren && !collapsed && (
                  <span
                    className={`shrink-0 transition-colors ${
                      isActive
                        ? 'text-uv-lime'
                        : 'text-emerald-200/70 group-hover:text-uv-lime'
                    }`}
                  >
                    <Chevron open={isExpanded} />
                  </span>
                )}

                <span
                  className={`shrink-0 transition-colors ${
                    isActive
                      ? 'text-uv-lime'
                      : 'text-emerald-100/75 group-hover:text-white'
                  }`}
                >
                  {item.icon}
                </span>

                <span
                  className={`min-w-0 truncate text-[13px] ${
                    collapsed ? 'hidden' : ''
                  }`}
                >
                  {item.label}
                </span>
              </button>

              {isExpanded && item.children && (
                <div className="relative">
                  <span
                    aria-hidden
                    className="absolute bottom-1 top-0 z-10 w-px bg-white/25"
                    style={{ left: childOffset - GUIDE_GAP }}
                  />
                  {renderList(item.children, level + 1, childOffset)}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  return renderList(items, depth, SIDEBAR_INDENT * depth + 8)
}

export default function SidebarNav({
  items,
  activeId,
  onSelect,
  open,
  onToggle,
}: {
  items: SidebarItem[]
  activeId?: string
  onSelect?: (item: SidebarItem) => void
  open: boolean
  onToggle: () => void
}) {
  return (
    <aside
      aria-label="Menú lateral del módulo de datos"
      className="fixed left-0 top-16 z-30 flex flex-col overflow-hidden chrome-forest border-r border-emerald-950/70 transition-[width] duration-300"
      style={{
        width: open ? SIDEBAR_W_EXPANDED : SIDEBAR_W_COLLAPSED,
        height: 'calc(100vh - 4rem)',
      }}
    >
      <div
        className={`flex h-12 shrink-0 items-center border-b border-white/10 bg-emerald-950/30 ${
          open ? 'justify-end px-2' : 'justify-center'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? 'Contraer menú lateral' : 'Expandir menú lateral'}
          title={open ? 'Contraer menú' : 'Expandir menú'}
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-md border border-white/15 bg-white/10 text-emerald-50 transition-colors hover:border-white/30 hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-uv-lime"
        >
          <PanelToggleIcon expanded={open} />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        <SidebarTree
          items={items}
          activeId={activeId}
          onSelect={onSelect}
          collapsed={!open}
        />
      </nav>
    </aside>
  )
}
