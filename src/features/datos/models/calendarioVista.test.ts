import { describe, expect, it } from 'vitest'
import {
  anclaDeSemana,
  fechasDeLaSemana,
  isoDeHoy,
  itemsDeAgenda,
  sumarDiasIso,
} from './calendarioVista'

describe('fechasDeLaSemana (semana civil lunes→domingo)', () => {
  it('el viernes 2026-10-16 cae en la semana lun 12 – dom 18', () => {
    expect(fechasDeLaSemana('2026-10-16')).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ])
  })

  it('cruza el fin de mes: el domingo 2026-11-01 cierra lun 26 oct – dom 1 nov', () => {
    expect(fechasDeLaSemana('2026-11-01')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ])
  })

  it('cruza el fin de año: 2027-01-01 cierra lun 28 dic – dom 3 ene', () => {
    expect(fechasDeLaSemana('2027-01-01')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ])
  })

  it('un lunes devuelve su propia semana (idempotente)', () => {
    expect(fechasDeLaSemana('2026-10-12')).toHaveLength(7)
    expect(fechasDeLaSemana('2026-10-12')[0]).toBe('2026-10-12')
    expect(fechasDeLaSemana('2026-10-12')[6]).toBe('2026-10-18')
  })
})

describe('sumarDiasIso', () => {
  it('cruza el año: 2026-12-31 + 1 = 2027-01-01', () => {
    expect(sumarDiasIso('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('acepta deltas negativos', () => {
    expect(sumarDiasIso('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('sumar 7 días conserva el día de la semana', () => {
    expect(sumarDiasIso('2026-10-16', 7)).toBe('2026-10-23')
    expect(sumarDiasIso('2026-10-16', -7)).toBe('2026-10-09')
  })
})

describe('isoDeHoy', () => {
  it('devuelve la fecha local en formato YYYY-MM-DD', () => {
    const hoy = isoDeHoy()
    expect(hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    expect(hoy).toBe(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
  })
})

describe('anclaDeSemana (regla del ancla de la vista semanal)', () => {
  it('usa hoy cuando cae en el mes referido', () => {
    expect(anclaDeSemana(10, 2026, '2026-10-16')).toBe('2026-10-16')
  })

  it('usa el día 1 del mes referido cuando hoy queda fuera', () => {
    expect(anclaDeSemana(7, 2026, '2026-10-16')).toBe('2026-07-01')
    expect(anclaDeSemana(11, 2026, '2026-10-16')).toBe('2026-11-01')
  })
})

describe('itemsDeAgenda (agenda del mes)', () => {
  it('devuelve los festivos del mes ordenados por fecha, con tipo y origen', () => {
    const items = itemsDeAgenda(2026, 7)
    expect(items.map((i) => i.fecha)).toEqual(['2026-07-13', '2026-07-20'])
    expect(items.map((i) => i.tipo)).toEqual(['FESTIVO', 'FESTIVO'])
    expect(items[0].titulo).toBe('Nuestra Señora del Rosario de Chiquinquirá')
    expect(items[0].origen).toBe('EMILIANI')
    expect(items[1].titulo).toBe('Día de la Independencia')
    expect(items[1].origen).toBe('FIJO')
  })

  it('un mes sin festivos devuelve la lista vacía (estado vacío de la agenda)', () => {
    expect(itemsDeAgenda(2026, 2)).toEqual([])
  })

  it('mantiene el orden cronológico en meses con dos festivos', () => {
    expect(itemsDeAgenda(2026, 12).map((i) => i.fecha)).toEqual(['2026-12-08', '2026-12-25'])
    expect(itemsDeAgenda(2026, 11).map((i) => i.fecha)).toEqual(['2026-11-02', '2026-11-16'])
  })
})
