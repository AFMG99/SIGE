'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type HeaderPos = 'left' | 'center' | 'right'

const HeaderPosContext = createContext<HeaderPos>('center')

export function HeaderPosProvider({
  value,
  children,
}: {
  value: HeaderPos
  children: ReactNode
}) {
  return (
    <HeaderPosContext.Provider value={value}>
      {children}
    </HeaderPosContext.Provider>
  )
}

export function useHeaderPos(): HeaderPos {
  return useContext(HeaderPosContext)
}

type SubNavValue = {
  activeId: string
  setActiveId: (id: string) => void
}

const DEFAULT_ACTIVE_ID = 'resumen'

const SubNavContext = createContext<SubNavValue>({
  activeId: DEFAULT_ACTIVE_ID,
  setActiveId: () => {},
})

export function SubNavProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveIdState] = useState(DEFAULT_ACTIVE_ID)
  const setActiveId = (id: string) => setActiveIdState(id)
  const value = useMemo(() => ({ activeId, setActiveId }), [activeId])

  return (
    <SubNavContext.Provider value={value}>{children}</SubNavContext.Provider>
  )
}

export function useSubNav(): SubNavValue {
  return useContext(SubNavContext)
}
