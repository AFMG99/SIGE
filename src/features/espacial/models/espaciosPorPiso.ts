import type { Bloque3DNode } from './espacial.types'

export const TODOS_LOS_PISOS = '__todos__'
export const PISO_SIN_ASIGNAR = 'Sin asignar'

export function obtenerPisos(bloques: Bloque3DNode[]): string[] {
  const pisos = new Set<string>()
  for (const bloque of bloques) {
    for (const espacio of bloque.espacios) {
      pisos.add(espacio.piso.trim() || PISO_SIN_ASIGNAR)
    }
  }

  return Array.from(pisos).sort((a, b) => {
    if (a === PISO_SIN_ASIGNAR) return 1
    if (b === PISO_SIN_ASIGNAR) return -1
    return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
  })
}

export function filtrarBloquesPorPiso(
  bloques: Bloque3DNode[],
  piso: string
): Bloque3DNode[] {
  return bloques
    .map((bloque) => ({
      ...bloque,
      espacios:
        piso === TODOS_LOS_PISOS
          ? bloque.espacios
          : bloque.espacios.filter(
              (espacio) => (espacio.piso.trim() || PISO_SIN_ASIGNAR) === piso
            ),
    }))
    .filter((bloque) => bloque.espacios.length > 0)
}
