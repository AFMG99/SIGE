import { describe, expect, it } from 'vitest'
import {
  anclaDeSemana,
  eventosPorFecha,
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

// ============================================================
// S9 — la agenda gana los eventos del árbol de la edificación
// ============================================================

const eventoRango = {
  tipo: 'INSTITUCIONAL',
  nombre: 'Semana de pruebas institucionales',
  descripcion: 'Simulacro de evacuación y jornada de bienvenida.',
  fechaInicio: '2026-06-08',
  fechaFin: '2026-06-12',
  ambito: 'Edificación completa',
}

const eventoDiaUnico = {
  tipo: 'MANTENIMIENTO',
  nombre: 'Mantenimiento red eléctrica',
  descripcion: null,
  fechaInicio: '2026-06-22',
  fechaFin: null,
  ambito: 'Bloque · A-101 — Ala Norte',
}

describe('itemsDeAgenda con eventos (S9)', () => {
  it('expande un evento de rango sobre cada día que cubre (inclusive)', () => {
    const items = itemsDeAgenda(2026, 6, [eventoRango]).filter((i) => i.tipo === 'EVENTO')
    expect(items.map((i) => i.fecha)).toEqual([
      '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12',
    ])
    expect(items.every((i) => i.tipo === 'EVENTO')).toBe(true)
    expect(items[0].titulo).toBe('Semana de pruebas institucionales')
    expect(items[0].detalle).toBe('Simulacro de evacuación y jornada de bienvenida.')
    expect(items[0].ambito).toBe('Edificación completa')
    // Punto de color resuelto desde CATALOGO_TIPOS_EVENTO (token de marca).
    expect(items[0].punto).toBe('bg-uv-forest')
  })

  it('agrupa festivo y eventos del mismo día, con los festivos primero', () => {
    const items = itemsDeAgenda(2026, 6, [
      eventoDiaUnico,
      { ...eventoRango, fechaInicio: '2026-06-29', fechaFin: null },
    ])
    // 29 jun (San Pedro y San Pablo): el festivo antes que el evento.
    const del29 = items.filter((i) => i.fecha === '2026-06-29')
    expect(del29.map((i) => i.tipo)).toEqual(['FESTIVO', 'EVENTO'])
    // El evento de día único no se expande; el de rango sí.
    expect(items.filter((i) => i.tipo === 'EVENTO').map((i) => i.fecha)).toEqual([
      '2026-06-22', '2026-06-29',
    ])
  })

  it('omite eventos de otros meses y mantiene el orden cronológico', () => {
    const items = itemsDeAgenda(2026, 6, [
      eventoDiaUnico,
      { ...eventoRango, fechaInicio: '2026-07-15', fechaFin: null },
    ]).filter((i) => i.tipo === 'EVENTO')
    expect(items.map((i) => i.fecha)).toEqual(['2026-06-22'])
  })

  it('un evento de mes sin festivos puebla la agenda (supera el estado vacío)', () => {
    const items = itemsDeAgenda(2026, 2, [
      { ...eventoDiaUnico, fechaInicio: '2026-02-10', fechaFin: null },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].punto).toBe('bg-uv-turquoise')
  })

  it('ignora fechas mal formadas (fail-safe: no rompe la agenda)', () => {
    const items = itemsDeAgenda(2026, 6, [
      { ...eventoDiaUnico, fechaInicio: '22/06/2026' },
    ])
    expect(items.filter((i) => i.tipo === 'EVENTO')).toHaveLength(0)
  })
})

describe('eventosPorFecha (S9 — mapa fecha → eventos)', () => {
  it('expande los rangos de cada día y agrupa por fecha', () => {
    const mapa = eventosPorFecha([
      { id: 'e1', tipo: 'ACADEMICO', nombre: 'Inscripción', fechaInicio: '2026-06-10', fechaFin: '2026-06-11' },
    ])
    expect(mapa.get('2026-06-10')?.map((e) => e.id)).toEqual(['e1'])
    expect(mapa.get('2026-06-11')?.map((e) => e.id)).toEqual(['e1'])
    expect(mapa.get('2026-06-12')).toBeUndefined()
  })

  it('fechaFin null o anterior a la inicial cuenta como día único', () => {
    const mapa = eventosPorFecha([
      { id: 'e1', tipo: 'EXCEPCION', nombre: 'Corte', fechaInicio: '2026-06-30', fechaFin: null },
      { id: 'e2', tipo: 'EXCEPCION', nombre: 'Raro', fechaInicio: '2026-06-15', fechaFin: '2026-06-01' },
    ])
    expect(mapa.get('2026-06-30')?.map((e) => e.id)).toEqual(['e1'])
    expect(mapa.get('2026-06-15')?.map((e) => e.id)).toEqual(['e2'])
    expect(mapa.get('2026-06-01')).toBeUndefined()
  })

  it('varios eventos del mismo día quedan ordenados de forma determinista', () => {
    const mapa = eventosPorFecha([
      { id: 'e1', tipo: 'INSTITUCIONAL', nombre: 'Semana', fechaInicio: '2026-06-10', fechaFin: '2026-06-10' },
      { id: 'e2', tipo: 'ACADEMICO', nombre: 'Charla', fechaInicio: '2026-06-10', fechaFin: null },
    ])
    // Orden por tipo (alfabético) y luego nombre, sin depender de la entrada.
    expect(mapa.get('2026-06-10')?.map((e) => e.id)).toEqual(['e2', 'e1'])
  })
})
