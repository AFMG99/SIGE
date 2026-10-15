/**
 * Geometría pura de los gráficos compartidos (T1).
 * Cubre: ticks bonitos, límites con margen/raíz cero, curva monotona
 * (sin sobrepasar los datos), trozado de huecos y mapeo de tramos.
 */
import { describe, expect, it } from 'vitest'

import {
  caminoMonotono,
  limitesSerie,
  puntosTramo,
  ticksBonitos,
  tramosContinuos,
} from './curvas'

describe('ticksBonitos', () => {
  it('usa pasos 1/2/5×10ᵏ y no excede 12 ticks', () => {
    const ticks = ticksBonitos(0, 1000)
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks.length).toBeLessThanOrEqual(12)
    const paso = ticks[1] - ticks[0]
    const mantisa = paso / Math.pow(10, Math.floor(Math.log10(paso)))
    expect([1, 2, 5]).toContain(mantisa)
  })

  it('rango degenerado devuelve el propio min', () => {
    expect(ticksBonitos(5, 5)).toEqual([5])
  })

  it('los ticks caen dentro de [min, max]', () => {
    for (const t of ticksBonitos(-37.5, 412.9)) {
      expect(t).toBeGreaterThanOrEqual(-37.5 - 1e-9)
      expect(t).toBeLessThanOrEqual(412.9 + 1e-9)
    }
  })
})

describe('limitesSerie', () => {
  it('añade un 8 % de margen simétrico', () => {
    const [min, max] = limitesSerie([10, 20, 30])
    expect(min).toBeCloseTo(10 - 1.6)
    expect(max).toBeCloseTo(30 + 1.6)
  })

  it('desdeCero ancla el piso en 0 y protege el techo', () => {
    const [min, max] = limitesSerie([10, 20, 30], { desdeCero: true })
    expect(min).toBe(0)
    expect(max).toBeGreaterThan(30)
  })

  it('serie plana se expande para poder escalar', () => {
    const [min, max] = limitesSerie([50, 50])
    expect(max).toBeGreaterThan(min)
  })

  it('serie vacía devuelve [0, 1]', () => {
    expect(limitesSerie([])).toEqual([0, 1])
  })
})

describe('caminoMonotono', () => {
  it('casos degenerados: vacío, uno y dos puntos', () => {
    expect(caminoMonotono([])).toBe('')
    expect(caminoMonotono([{ x: 5, y: 7 }])).toBe('M5,7')
    expect(caminoMonotono([{ x: 0, y: 0 }, { x: 10, y: 4 }])).toBe('M0,0L10,4')
  })

  it('genera curvas C que terminan exactamente en cada punto', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 8 },
      { x: 20, y: 3 },
      { x: 30, y: 12 },
    ]
    const d = caminoMonotono(pts)
    expect(d.startsWith('M0,0')).toBe(true)
    expect(d.match(/C/g)?.length).toBe(3)
    expect(d.endsWith('30,12')).toBe(true)
  })

  it('monotonía: con una meseta (pendiente 0) no inventa extremos locales', () => {
    // Datos con meseta: la tangente debe ser 0 en el tramo plano.
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 5 },
    ]
    const d = caminoMonotono(pts)
    // Tangente 0 en x=10 ⇒ el primer control C1y coincide con el punto (0).
    expect(d).toContain('C3.33,0')
  })
})

describe('tramosContinuos', () => {
  it('troza en null/undefined/NaN y conserva tramos de un punto', () => {
    expect(tramosContinuos([1, 2, null, 4, 5, 6])).toEqual([[0, 1], [3, 4, 5]])
    expect(tramosContinuos([null, undefined, NaN])).toEqual([])
    expect(tramosContinuos([7])).toEqual([[0]])
  })
})

describe('puntosTramo', () => {
  it('mapea índices a coordenadas con los valores originales', () => {
    const valores: (number | null)[] = [10, null, 30]
    const pts = puntosTramo(
      [0, 2],
      (i) => i * 5,
      (v) => v * 2,
      valores
    )
    expect(pts).toEqual([
      { x: 0, y: 20 },
      { x: 10, y: 60 },
    ])
  })
})
