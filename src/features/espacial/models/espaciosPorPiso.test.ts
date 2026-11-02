import { describe, expect, it } from 'vitest'
import { filtrarBloquesPorPiso, obtenerPisos, TODOS_LOS_PISOS } from './espaciosPorPiso'
import type { Bloque3DNode } from './espacial.types'

const crearBloque = (
  id: string,
  espacios: Bloque3DNode['espacios']
): Bloque3DNode =>
  ({
    id,
    codigo: id,
    nombre: id,
    areaUtil: 100,
    factorInfraestructura: 1,
    renderMode: 'PARAMETRIC',
    position: [0, 0, 0],
    dimensions: [1, 1, 1],
    metricas: {
      areaUtil: 100,
      potenciaTotalW: 0,
      cantidadEquipos: 0,
      densidadPotenciaWm2: 0,
    },
    espacios,
  })

const crearEspacio = (id: string, piso: string): Bloque3DNode['espacios'][number] => ({
  id,
  nombre: id,
  bloqueId: 'bloque',
  piso,
  equipos: [],
  potenciaTotalW: 0,
  cantidadEquipos: 0,
})

describe('espaciosPorPiso', () => {
  it('ordena niveles numéricos naturalmente y deja los no asignados al final', () => {
    const bloques = [
      crearBloque('b1', [
        crearEspacio('a', '10'),
        crearEspacio('b', '2'),
        crearEspacio('c', '1'),
        crearEspacio('d', 'Sin asignar'),
      ]),
    ]

    expect(obtenerPisos(bloques)).toEqual(['1', '2', '10', 'Sin asignar'])
  })

  it('filtra espacios por nivel y omite bloques sin coincidencias', () => {
    const bloques = [
      crearBloque('b1', [crearEspacio('a', '1'), crearEspacio('b', '2')]),
      crearBloque('b2', [crearEspacio('c', '2')]),
    ]

    expect(filtrarBloquesPorPiso(bloques, '2').map((bloque) => [
      bloque.id,
      bloque.espacios.map((espacio) => espacio.id),
    ])).toEqual([
      ['b1', ['b']],
      ['b2', ['c']],
    ])
    expect(filtrarBloquesPorPiso(bloques, TODOS_LOS_PISOS)).toHaveLength(2)
  })
})
