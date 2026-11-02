import type { SidebarItem } from '@/shared/views/sidebar/SidebarNav'

export const ESTIMACIONES_SECTIONS: SidebarItem[] = [
  { id: 'nueva', label: 'Nueva estimación', icon: <IconNuevaEstimacion /> },
  { id: 'historial', label: 'Historial', icon: <IconHistorial /> },
]

function IconNuevaEstimacion() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
      <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
    </svg>
  )
}

function IconHistorial() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .27.144.518.378.651l3 1.75a.75.75 0 00.744-1.302L10.75 9.56V5z" clipRule="evenodd" />
    </svg>
  )
}