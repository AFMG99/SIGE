// Tipos y contratos para la representación espacial 3D y su mapeo desde la BD

export type RenderMode = 'PARAMETRIC' | 'GLTF_MODEL'

export interface EquipoSummary {
  id: string
  tipo: string
  cantidad: number
  potenciaNominal: number // Watts
  horasUsoDia: number
  diasUsoMes: number
  usenIndicador: string
  potenciaTotalW: number
}

export interface Espacio3DNode {
  id: string
  nombre: string
  bloqueId: string
  equipos: EquipoSummary[]
  potenciaTotalW: number
  cantidadEquipos: number
}

export interface Bloque3DNode {
  id: string
  codigo: string
  nombre: string
  areaUtil: number
  factorInfraestructura: number
  renderMode: RenderMode
  modelUrl?: string // Espacio para futuros modelos GLTF/GLB
  // Coordenadas calculadas en el espacio 3D
  position: [number, number, number] // [x, y, z]
  dimensions: [number, number, number] // [ancho (x), alto (y), profundidad (z)]
  metricas: {
    areaUtil: number
    potenciaTotalW: number
    cantidadEquipos: number
    densidadPotenciaWm2: number // W / m²
  }
  espacios: Espacio3DNode[]
}

export interface Edificacion3DScene {
  id: string
  nombre: string
  tipo: string
  area?: number | null
  ubicacionNombre?: string | null
  bloques: Bloque3DNode[]
  totales: {
    potenciaTotalW: number
    areaTotalM2: number
    cantidadEquipos: number
    densidadPromedioWm2: number
  }
}
