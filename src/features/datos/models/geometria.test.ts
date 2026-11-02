import { describe, expect, it } from 'vitest'
import { normalizarPiso, validarDimensiones, PISO_SIN_ASIGNAR } from './geometria'

describe('validarDimensiones', () => {
  it('calcula área a partir de largo y ancho y conserva altura opcional', () => {
    expect(validarDimensiones({ largoM: '8.5', anchoM: '4', altoM: '3.2' })).toEqual({
      ok: true,
      valor: {
        largoM: 8.5,
        anchoM: 4,
        altoM: 3.2,
        areaCalculadaM2: 34,
      },
    })
  })

  it('permite guardar altura sin calcular área si no hay largo ni ancho', () => {
    expect(validarDimensiones({ altoM: 3 })).toEqual({
      ok: true,
      valor: { largoM: null, anchoM: null, altoM: 3, areaCalculadaM2: null },
    })
  })

  it('rechaza dimensiones no positivas y largo/ancho incompletos', () => {
    expect(validarDimensiones({ largoM: 8 })).toMatchObject({ ok: false })
    expect(validarDimensiones({ largoM: 0, anchoM: 4 })).toMatchObject({ ok: false })
    expect(validarDimensiones({ largoM: 'x', anchoM: 4 })).toMatchObject({ ok: false })
    expect(validarDimensiones({ largoM: Number.MAX_VALUE, anchoM: 2 })).toMatchObject({ ok: false })
  })
})

describe('normalizarPiso', () => {
  it('usa el nivel predeterminado para valores vacíos y normaliza espacios', () => {
    expect(normalizarPiso('  ')).toBe(PISO_SIN_ASIGNAR)
    expect(normalizarPiso('  Piso   2 ')).toBe('Piso 2')
  })

  it('rechaza etiquetas de piso mayores a 60 caracteres', () => {
    expect(normalizarPiso('x'.repeat(61))).toBeNull()
  })
})
