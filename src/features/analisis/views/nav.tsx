import type { SidebarItem } from '@/shared/views/sidebar/SidebarNav'
import { IconAhorros, IconComparativo, IconPatrones, IconResumen } from './icons'

/** Secciones del módulo de análisis — espejo de `DATOS_SECTIONS` (módulo de datos). */
export const ANALISIS_SECTIONS: SidebarItem[] = [
  { id: 'resumen', label: 'Resumen', icon: <IconResumen /> },
  { id: 'comparativo', label: 'Comparativo', icon: <IconComparativo /> },
  { id: 'patrones', label: 'Patrones de consumo', icon: <IconPatrones /> },
  { id: 'ahorros', label: 'Ahorros', icon: <IconAhorros /> },
]
