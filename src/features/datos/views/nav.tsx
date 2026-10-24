import type { SidebarItem } from '@/shared/views/sidebar/SidebarNav'
import {
  IconAjuste,
  IconEdificacion,
  IconEquipo,
  IconFactura,
  IconLineaBase,
  IconResumen,
  IconVariable,
} from './icons'

export const DATOS_SECTIONS: SidebarItem[] = [
  { id: 'resumen', label: 'Resumen', icon: <IconResumen /> },
  { id: 'edificaciones', label: 'Edificaciones', icon: <IconEdificacion /> },
  { id: 'facturas', label: 'Facturas de energía', icon: <IconFactura /> },
  { id: 'equipos', label: 'Equipos Eléctricos', icon: <IconEquipo /> },
  { id: 'variables', label: 'Variables Operativas', icon: <IconVariable /> },
  { id: 'lineas-base', label: 'Líneas Base', icon: <IconLineaBase /> },
  { id: 'ajustes', label: 'Ajustes', icon: <IconAjuste /> },
]
