'use client'

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react'
import {
  DashboardHeader,
  BAR_H,
  type HeaderAccount,
  type HeaderPos,
} from './DashboardHeader'
import { HeaderPosProvider, SubNavProvider } from './nav/NavContext'

const TRANS = 'padding 0.3s cubic-bezier(0.22,1,0.36,1)'

/**
 * Authenticated area shell:
 *  - renders the movable header (top bar ↔ collapsible side rail)
 *  - animates page padding so content never sits under the header:
 *      center  → pt-64 (below the full-width bar)
 *      left/right → pl/pr = current sidebar width (64 collapsed rail / 220 expanded)
 */
export function DashboardShell({
  children,
  role,
  extraModules = [],
  account = null,
}: {
  children: ReactNode
  role?: string | null
  extraModules?: string[]
  /** Logged-in identity forwarded to the header's account menu. */
  account?: HeaderAccount | null
}) {
  const [pos, setPos] = useState<HeaderPos>('center')
  const [railW, setRailW] = useState(0)
  const onPosChange = useCallback((p: HeaderPos) => setPos(p), [])
  const onSidebarWidth = useCallback((w: number) => setRailW(w), [])

  const style: CSSProperties =
    pos === 'center'
      ? { paddingTop: BAR_H, transition: TRANS }
      : {
          paddingTop: 0,
          paddingLeft: pos === 'left' ? railW : 0,
          paddingRight: pos === 'right' ? railW : 0,
          transition: TRANS,
        }

  return (
    <HeaderPosProvider value={pos}>
      <SubNavProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950" style={style}>
          <DashboardHeader
            onPosChange={onPosChange}
            onSidebarWidth={onSidebarWidth}
            role={role}
            extraModules={extraModules}
            account={account}
          />
          {children}
        </div>
      </SubNavProvider>
    </HeaderPosProvider>
  )
}
