import { describe, expect, it } from 'vitest'
import { PRIORIDAD_MODELOS_LBEN, resolverModeloLben } from './ajustes'

describe('resolverModeloLben', () => {
  it('elige por prioridad cuando el bloque tiene varios modelos de LBEn', () => {
    expect(resolverModeloLben(['REGRESSION_ESTADISTICA', 'VALOR_ABSOLUTO'])).toBe(
      'VALOR_ABSOLUTO'
    )
  })

  it('devuelve el único modelo coincidente', () => {
    expect(resolverModeloLben(['COCIENTE'])).toBe('COCIENTE')
  })

  it('devuelve null cuando el bloque no tiene líneas base', () => {
    expect(resolverModeloLben([])).toBeNull()
  })

  it('devuelve null si solo hay tipos desconocidos', () => {
    expect(resolverModeloLben(['TIPO_INEXISTENTE', 'OTRO_TIPO'])).toBeNull()
  })

  it('ignora tipos desconocidos y respeta el orden de prioridad', () => {
    expect(resolverModeloLben(['DESCONOCIDO', 'CONFORT_THERMAL', 'COCIENTE'])).toBe('COCIENTE')
  })

  it('mantiene el orden de prioridad declarado (espejo de reportesController)', () => {
    expect(PRIORIDAD_MODELOS_LBEN).toEqual([
      'VALOR_ABSOLUTO',
      'COCIENTE',
      'REGRESSION_ESTADISTICA',
      'CONFORT_THERMAL',
    ])
  })
})
