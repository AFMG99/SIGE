/**
 * Unit tests de shares.ts — fuente única del criterio de reparto
 * (área×factor vs. carga nominal) que comparten LBEn y el módulo de
 * análisis.
 */
import { describe, expect, it } from 'vitest'
import {
  cargaDeEquipos,
  crearCriterioShares,
  type BloqueShare,
  type EspacioShare,
} from './shares'

const EQUIPOS_SALON: EspacioShare['equipos'] = [
  // 2 × 1.5 kW × 8 h/día × 20 d/mes = 480 kWh/mes
  { cantidad: 2, potenciaNominal: 1.5, horasUsoDia: 8, diasUsoMes: 20 },
]

const EQUIPOS_LAB: EspacioShare['equipos'] = [
  // 1 × 3 kW × 10 h/día × 22 d/mes = 660 kWh/mes
  { cantidad: 1, potenciaNominal: 3, horasUsoDia: 10, diasUsoMes: 22 },
]

function fixtures(mediaNormalizado = 1000) {
  const bloques: BloqueShare[] = [
    { id: 'b1', areaUtil: 100, factorInfraestructura: 1.2 },
    { id: 'b2', areaUtil: 300, factorInfraestructura: 1.0 },
  ]
  const espacios: EspacioShare[] = [
    { id: 'e1', bloqueId: 'b1', equipos: EQUIPOS_SALON },
    { id: 'e2', bloqueId: 'b1', equipos: EQUIPOS_LAB },
    { id: 'e3', bloqueId: 'b2', equipos: [] },
  ]
  return { bloques, espacios, criterio: crearCriterioShares({ bloques, espacios, mediaNormalizado }) }
}

describe('cargaDeEquipos', () => {
  it('multiplica cantidad × potencia × horas × días', () => {
    expect(cargaDeEquipos(EQUIPOS_SALON)).toBe(480)
    expect(cargaDeEquipos(EQUIPOS_LAB)).toBe(660)
    expect(cargaDeEquipos([])).toBe(0)
  })
})

describe('crearCriterioShares — cobertura de área completa', () => {
  it('elige facturas_area y reparte por área × factor con Σ = 1', () => {
    const { criterio } = fixtures()
    expect(criterio.origen).toBe('facturas_area')
    expect(criterio.coberturaArea).toBe(true)
    expect(criterio.bloquesSinArea).toBe(0)
    // pesos: b1 = 100 × 1.2 = 120 · b2 = 300 × 1 = 300 · Σ = 420
    expect(criterio.pesoTotalBloques).toBe(420)
    expect(criterio.shareDeBloque('b1')).toBeCloseTo(120 / 420, 10)
    expect(criterio.shareDeBloque('b1') + criterio.shareDeBloque('b2')).toBeCloseTo(1, 10)
  })

  it('bloque desconocido tiene share 0', () => {
    const { criterio } = fixtures()
    expect(criterio.shareDeBloque('no-existe')).toBe(0)
  })
})

describe('crearCriterioShares — cobertura de área incompleta', () => {
  it('cae a modelo_ingenieria y divide carga ÷ factura media', () => {
    const bloques: BloqueShare[] = [
      { id: 'b1', areaUtil: 100, factorInfraestructura: 1.2 },
      { id: 'b2', areaUtil: 0, factorInfraestructura: 1.0 },
    ]
    const espacios: EspacioShare[] = [
      { id: 'e1', bloqueId: 'b1', equipos: EQUIPOS_SALON },
      { id: 'e2', bloqueId: 'b2', equipos: EQUIPOS_LAB },
    ]
    const criterio = crearCriterioShares({ bloques, espacios, mediaNormalizado: 1000 })
    expect(criterio.origen).toBe('modelo_ingenieria')
    expect(criterio.coberturaArea).toBe(false)
    expect(criterio.bloquesSinArea).toBe(1)
    expect(criterio.shareDeBloque('b1')).toBeCloseTo(480 / 1000, 10)
    expect(criterio.shareDeBloque('b2')).toBeCloseTo(660 / 1000, 10)
  })
})

describe('crearCriterioShares — share de espacio dentro del bloque', () => {
  it('reparte por carga nominal entre los espacios hermanos', () => {
    const { criterio } = fixtures()
    // b1: e1 = 480, e2 = 660, Σ = 1140
    expect(criterio.shareDeEspacio('b1', 'e1')).toBeCloseTo(480 / 1140, 10)
    expect(criterio.shareDeEspacio('b1', 'e2')).toBeCloseTo(660 / 1140, 10)
  })

  it('sin equipos en el bloque hace reparto igualitario', () => {
    const { criterio } = fixtures()
    const espacios: EspacioShare[] = [
      { id: 'e1', bloqueId: 'b3', equipos: [] },
      { id: 'e2', bloqueId: 'b3', equipos: [] },
    ]
    const criterio2 = crearCriterioShares({
      bloques: [{ id: 'b3', areaUtil: 50, factorInfraestructura: 1 }],
      espacios,
      mediaNormalizado: 1000,
    })
    expect(criterio2.shareDeEspacio('b3', 'e1')).toBe(0.5)
    expect(criterio2.shareDeEspacio('b3', 'e2')).toBe(0.5)
    expect(criterio.cargaTotalDeBloque('b2')).toBe(0)
  })
})
