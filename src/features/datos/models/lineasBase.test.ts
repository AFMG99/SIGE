import { describe, expect, it } from 'vitest'
import {
  advertenciaMinimos,
  UPME_MIN_MESES,
  UPME_MIN_VALORES_MES,
} from './lineasBase'

describe('advertenciaMinimos', () => {
  it('devuelve null cuando hay al menos el mínimo de meses depurados', () => {
    expect(
      advertenciaMinimos({ mesesFacturados: 48, depurados: 48 })
    ).toBeNull()
  })

  it('devuelve null con mesesInsuficientes vacío o fuera de rango', () => {
    expect(
      advertenciaMinimos({ mesesFacturados: 36, depurados: 36, mesesInsuficientes: [] })
    ).toBeNull()
    expect(
      advertenciaMinimos({ mesesFacturados: 48, depurados: 48, mesesInsuficientes: [0, 13] })
    ).toBeNull()
  })

  it('advierte cuando faltan meses, con el mínimo UPME y la sugerencia de ajustes', () => {
    const a = advertenciaMinimos({ mesesFacturados: 30, depurados: 24 })
    expect(a).toBeTruthy()
    expect(a).toContain('24')
    expect(a).toContain(String(UPME_MIN_MESES))
    expect(a).toContain('UPME 0016')
    expect(a).toMatch(/sugiere/i)
  })

  it('incluye la regla 3×12 con los meses señalados cuando aplican', () => {
    const a = advertenciaMinimos({
      mesesFacturados: 48,
      depurados: 48,
      mesesInsuficientes: [2, 11],
    })
    expect(a).toBeTruthy()
    expect(a).toContain('2, 11')
    expect(a).toContain(String(UPME_MIN_VALORES_MES))
    expect(a).toMatch(/3×12/)
    expect(a).toMatch(/sugiere/i)
  })
})
