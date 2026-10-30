import { Bloque3DNode, Espacio3DNode, RenderMode } from './espacial.types'

export interface RawBloqueInput {
  id: string
  codigo: string
  nombre: string
  areaUtil: number
  factorInfraestructura: number
  espacios: Array<{
    id: string
    nombre: string
    bloqueId: string
    equipos: Array<{
      id: string
      tipo: string
      cantidad: number
      potenciaNominal: number
      horasUsoDia: number
      diasUsoMes: number
      usenIndicador: string
    }>
  }>
}

/**
 * Escala del mundo 3D:
 * 1 unidad 3D ~= 4 metros reales para una vista volumétrica óptima.
 */
const SCALE_FACTOR = 0.28

export function generateCampus3DLayout(rawBloques: RawBloqueInput[]): Bloque3DNode[] {
  if (!rawBloques || rawBloques.length === 0) return []

  const n = rawBloques.length
  const cols = Math.ceil(Math.sqrt(n))
  const spacing = 4 // Margen entre bloques en unidades 3D

  const calculated = rawBloques.map((b) => {
    // Área útil individual y estricta del bloque
    const areaReal = typeof b.areaUtil === 'number' ? b.areaUtil : 0
    // Dimensión visual: si el bloque tiene 0 m², usar un mínimo visual de 40 m² para que sea visible e interactivo
    const areaVisual = Math.max(areaReal, 40)
    const baseSide = Math.max(Math.sqrt(areaVisual) * SCALE_FACTOR, 3.5)

    // Altura según factor de infraestructura (pisos/volumen)
    const factor = Math.max(b.factorInfraestructura || 1.0, 0.5)
    const height = Math.max(factor * 4, 2.5)

    let potenciaTotalW = 0
    let cantidadEquipos = 0

    const espacios3D: Espacio3DNode[] = (b.espacios || []).map((esp) => {
      let potEspacio = 0
      let cantEspacio = 0

      const equiposSummary = (esp.equipos || []).map((eq) => {
        const totalW = eq.cantidad * eq.potenciaNominal
        potEspacio += totalW
        cantEspacio += eq.cantidad
        return {
          id: eq.id,
          tipo: eq.tipo,
          cantidad: eq.cantidad,
          potenciaNominal: eq.potenciaNominal,
          horasUsoDia: eq.horasUsoDia,
          diasUsoMes: eq.diasUsoMes,
          usenIndicador: eq.usenIndicador,
          potenciaTotalW: totalW,
        }
      })

      potenciaTotalW += potEspacio
      cantidadEquipos += cantEspacio

      return {
        id: esp.id,
        nombre: esp.nombre,
        bloqueId: esp.bloqueId,
        equipos: equiposSummary,
        potenciaTotalW: potEspacio,
        cantidadEquipos: cantEspacio,
      }
    })

    const densidadPotenciaWm2 =
      areaReal > 0 ? Number((potenciaTotalW / areaReal).toFixed(2)) : 0

    return {
      raw: b,
      areaUtil: areaReal,
      dimensions: [baseSide, height, baseSide] as [number, number, number],
      espacios: espacios3D,
      metricas: {
        areaUtil: areaReal,
        potenciaTotalW,
        cantidadEquipos,
        densidadPotenciaWm2,
      },
    }
  })

  // Disponer en cuadrícula X-Z centrada en (0, 0)
  const maxSide = Math.max(...calculated.map((c) => c.dimensions[0]), 4)
  const cellStride = maxSide + spacing

  const totalWidth = cols * cellStride
  const rows = Math.ceil(n / cols)
  const totalDepth = rows * cellStride

  const offsetX = -totalWidth / 2 + cellStride / 2
  const offsetZ = -totalDepth / 2 + cellStride / 2

  return calculated.map((item, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)

    const posX = offsetX + col * cellStride
    const posZ = offsetZ + row * cellStride
    const posY = item.dimensions[1] / 2

    return {
      id: item.raw.id,
      codigo: item.raw.codigo,
      nombre: item.raw.nombre,
      areaUtil: item.areaUtil,
      factorInfraestructura: item.raw.factorInfraestructura,
      renderMode: 'PARAMETRIC' as RenderMode,
      modelUrl: undefined,
      position: [posX, posY, posZ],
      dimensions: item.dimensions,
      metricas: item.metricas,
      espacios: item.espacios,
    }
  })
}
