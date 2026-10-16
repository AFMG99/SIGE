import { describe, expect, it } from 'vitest'
import { esFestivo, festivosDelAno, festivosDelMes, pascua } from './festivos'

describe('pascua (algoritmo gregoriano)', () => {
  it('devuelve el domingo de Pascua de los años conocidos', () => {
    expect(pascua(2024)).toBe('2024-03-31')
    expect(pascua(2026)).toBe('2026-04-05')
    expect(pascua(2027)).toBe('2027-03-28')
  })
})

describe('festivosDelAno(2026) — golden contra el calendario oficial del MinHacienda', () => {
  // 19 festivos oficiales 2026 (incluye el nuevo de Chiquinquirá — Ley 2578/2026).
  const golden2026: [string, string][] = [
    ['2026-01-01', 'Año Nuevo'],
    ['2026-01-12', 'Día de los Reyes Magos'],
    ['2026-03-23', 'Día de San José'],
    ['2026-04-02', 'Jueves Santo'],
    ['2026-04-03', 'Viernes Santo'],
    ['2026-05-01', 'Día del Trabajo'],
    ['2026-05-18', 'Ascensión del Señor'],
    ['2026-06-08', 'Corpus Christi'],
    ['2026-06-15', 'Sagrado Corazón de Jesús'],
    ['2026-06-29', 'San Pedro y San Pablo'],
    ['2026-07-13', 'Nuestra Señora del Rosario de Chiquinquirá'],
    ['2026-07-20', 'Día de la Independencia'],
    ['2026-08-07', 'Batalla de Boyacá'],
    ['2026-08-17', 'Asunción de la Virgen'],
    ['2026-10-12', 'Día de la Diversidad Étnica y Cultural'],
    ['2026-11-02', 'Todos los Santos'],
    ['2026-11-16', 'Independencia de Cartagena'],
    ['2026-12-08', 'Inmaculada Concepción'],
    ['2026-12-25', 'Navidad'],
  ]

  it('produce exactamente las 19 fechas oficiales, ordenadas cronológicamente', () => {
    const oficiales = festivosDelAno(2026).map((f) => [f.fecha, f.nombre])
    expect(oficiales).toEqual(golden2026)
  })
})

describe('reglas del catálogo', () => {
  const fechas = (ano: number) => festivosDelAno(ano).map((f) => f.fecha)

  it('aplica la Ley Emiliani: traslada al lunes siguiente', () => {
    // 6 ene 2026 (martes) → lun 12; 19 mar 2026 (jueves) → lun 23.
    expect(fechas(2026)).toContain('2026-01-12')
    expect(fechas(2026)).toContain('2026-03-23')
    // 1 nov 2026 (domingo) → lun 2; 11 nov (miércoles) → lun 16.
    expect(fechas(2026)).toContain('2026-11-02')
    expect(fechas(2026)).toContain('2026-11-16')
    // San Pedro y San Pablo ya cae en lunes (29 jun 2026): no se mueve.
    expect(fechas(2026)).toContain('2026-06-29')
    expect(fechas(2026)).not.toContain('2026-06-30')
  })

  it('no mueve los festivos de fecha fija fuera de la Emiliani', () => {
    for (const f of ['2026-05-01', '2026-07-20', '2026-08-07', '2026-12-08', '2026-12-25']) {
      expect(fechas(2026)).toContain(f)
    }
  })

  it('computa los festivos movibles por Pascua', () => {
    // Pascua 2026 = 5 abr: Jueves/Viernes Santo −3/−2; Ascensión +39; Corpus +60.
    expect(fechas(2026)).toContain('2026-04-02')
    expect(fechas(2026)).toContain('2026-04-03')
    expect(fechas(2026)).toContain('2026-05-18')
    expect(fechas(2026)).toContain('2026-06-08')
  })

  it('el festivo de Chiquinquirá solo existe desde 2026 (Ley 2578 de 2026)', () => {
    expect(fechas(2026)).toContain('2026-07-13')
    expect(fechas(2025)).not.toContain('2025-07-13')
    expect(
      festivosDelAno(2025).some((f) => f.nombre.includes('Chiquinquirá'))
    ).toBe(false)
    // julio 2025: solo el 20 de julio.
    expect(festivosDelMes(2025, 7).map((f) => f.fecha)).toEqual(['2025-07-20'])
  })
})

describe('festivosDelMes / esFestivo (consultas de la vista)', () => {
  it('filtra los festivos de un mes concreto', () => {
    expect(festivosDelMes(2026, 7).map((f) => f.fecha)).toEqual([
      '2026-07-13',
      '2026-07-20',
    ])
    expect(festivosDelMes(2026, 2)).toEqual([])
  })

  it('responde si una fecha es festivo (formato YYYY-MM-DD)', () => {
    expect(esFestivo('2026-07-13')).toBe(true)
    expect(esFestivo('2026-07-14')).toBe(false)
    expect(esFestivo('2026-12-25')).toBe(true)
  })
})
