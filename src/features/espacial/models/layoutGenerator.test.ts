import { describe, it, expect } from 'vitest'
import { generateCampus3DLayout, RawBloqueInput } from './layoutGenerator'

describe('generateCampus3DLayout', () => {
  it('retorna array vacío si no se proporcionan bloques', () => {
    expect(generateCampus3DLayout([])).toEqual([])
  })

  it('calcula dimensiones proporcionales y métricas de potencia por bloque', () => {
    const rawBloques: RawBloqueInput[] = [
      {
        id: 'bloque-1',
        codigo: 'BL-01',
        nombre: 'Bloque Académico',
        areaUtil: 400,
        factorInfraestructura: 1.5,
        espacios: [
          {
            id: 'esp-1',
            nombre: 'Aula 101',
            bloqueId: 'bloque-1',
            equipos: [
              {
                id: 'eq-1',
                tipo: 'ILUMINACION',
                cantidad: 10,
                potenciaNominal: 50, // 500W
                horasUsoDia: 8,
                diasUsoMes: 20,
                usenIndicador: 'kWh',
              },
              {
                id: 'eq-2',
                tipo: 'HVAC',
                cantidad: 2,
                potenciaNominal: 1500, // 3000W
                horasUsoDia: 6,
                diasUsoMes: 20,
                usenIndicador: 'kWh',
              },
            ],
          },
        ],
      },
    ]

    const result = generateCampus3DLayout(rawBloques)

    expect(result).toHaveLength(1)
    const bloque = result[0]

    expect(bloque.codigo).toBe('BL-01')
    expect(bloque.renderMode).toBe('PARAMETRIC')
    // Potencia total: 10*50 + 2*1500 = 3500W
    expect(bloque.metricas.potenciaTotalW).toBe(3500)
    expect(bloque.metricas.cantidadEquipos).toBe(12)
    // Densidad: 3500 / 400 = 8.75 W/m²
    expect(bloque.metricas.densidadPotenciaWm2).toBe(8.75)
    // Dimensiones calculadas
    expect(bloque.dimensions[0]).toBeGreaterThan(0)
    expect(bloque.dimensions[1]).toBe(1.5 * 4) // factor * 4
    expect(bloque.dimensions[2]).toBeGreaterThan(0)
    // Base reposa sobre el suelo Y = height / 2
    expect(bloque.position[1]).toBe(bloque.dimensions[1] / 2)
  })

  it('usa dimensiones medidas de bloque y mantiene pisos y áreas de los espacios', () => {
    const [bloque] = generateCampus3DLayout([
      {
        id: 'bloque-medido',
        codigo: 'BL-02',
        nombre: 'Bloque medido',
        areaUtil: 100,
        areaHuellaM2: 120,
        largoM: 20,
        anchoM: 6,
        altoM: 9,
        factorInfraestructura: 2,
        espacios: [
          {
            id: 'espacio-medido',
            nombre: 'Aula 201',
            bloqueId: 'bloque-medido',
            piso: '2',
            largoM: 5,
            anchoM: 4,
            altoM: 3,
            areaCalculadaM2: 20,
            equipos: [],
          },
        ],
      },
    ])

    expect(bloque.dimensions[0]).toBeCloseTo(5.6)
    expect(bloque.dimensions[1]).toBeCloseTo(2.52)
    expect(bloque.dimensions[2]).toBeCloseTo(1.68)
    expect(bloque.areaUtil).toBe(100)
    expect(bloque.areaHuellaM2).toBe(120)
    expect(bloque.espacios[0]).toMatchObject({
      piso: '2',
      largoM: 5,
      anchoM: 4,
      altoM: 3,
      areaCalculadaM2: 20,
    })
  })

  it('usa el layout paramétrico heredado cuando las dimensiones no están completas', () => {
    const [bloque] = generateCampus3DLayout([
      {
        id: 'bloque-legado',
        codigo: 'BL-03',
        nombre: 'Bloque legado',
        areaUtil: 400,
        factorInfraestructura: 1.5,
        largoM: 20,
        espacios: [],
      },
    ])

    expect(bloque.dimensions[0]).toBeCloseTo(5.6)
    expect(bloque.dimensions[1]).toBe(6)
    expect(bloque.dimensions[2]).toBeCloseTo(5.6)
  })
})
