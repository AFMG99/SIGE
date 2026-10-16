import { describe, expect, it } from 'vitest'
import {
  CATALOGO_DIAS,
  horarioEquipoSchema,
  formatearDias,
  formatearFranja,
  claveAmbito,
  hayConflictoHorario,
  formatearVigencia,
  type HorarioComparable,
} from './horarios'

describe('CATALOGO_DIAS', () => {
  it('incluye los 7 días con su orden canónico', () => {
    expect(CATALOGO_DIAS.map((d) => d.codigo)).toEqual([
      'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM',
    ])
  })
})

describe('horarioEquipoSchema (validación de entrada)', () => {
  const valido = {
    nombre: 'HVAC administración',
    diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
    horaInicio: 6,
    horaFin: 18,
  }

  it('acepta un horario completo', () => {
    expect(horarioEquipoSchema.safeParse(valido).success).toBe(true)
  })

  it('rechaza sin días de la semana', () => {
    expect(horarioEquipoSchema.safeParse({ ...valido, diasSemana: [] }).success).toBe(false)
  })

  it('rechaza un código de día inexistente', () => {
    expect(
      horarioEquipoSchema.safeParse({ ...valido, diasSemana: ['LUN', 'FOO'] }).success
    ).toBe(false)
  })

  it('rechaza cuando la hora final no es posterior a la inicial', () => {
    expect(horarioEquipoSchema.safeParse({ ...valido, horaInicio: 18, horaFin: 6 }).success).toBe(false)
    expect(horarioEquipoSchema.safeParse({ ...valido, horaInicio: 8, horaFin: 8 }).success).toBe(false)
  })

  it('rechaza nombre vacío o demasiado largo', () => {
    expect(horarioEquipoSchema.safeParse({ ...valido, nombre: '' }).success).toBe(false)
    expect(horarioEquipoSchema.safeParse({ ...valido, nombre: 'x'.repeat(81) }).success).toBe(false)
  })
})

describe('formatearDias / formatearFranja (presentación)', () => {
  it('enumera días seleccionados en orden canónico y abrevía bloques corridos', () => {
    expect(formatearDias(['LUN', 'MAR', 'MIE', 'JUE', 'VIE'])).toBe('Lun–Vie')
    expect(formatearDias(['SAB', 'DOM'])).toBe('Sáb, Dom')
    expect(formatearDias(['MIE', 'VIE'])).toBe('Mié, Vie')
  })

  it('formatea la franja en 24h con dos dígitos', () => {
    expect(formatearFranja(6, 18)).toBe('06:00–18:00')
    expect(formatearFranja(9, 13)).toBe('09:00–13:00')
  })
})

// ============================================================
// Fase 5 — ámbito jerárquico, vigencia y conflictos (S12)
// ============================================================

describe('horarioEquipoSchema: ámbito jerárquico y vigencia', () => {
  const base = {
    nombre: 'Laboratorio 201',
    diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
    horaInicio: 7,
    horaFin: 17,
  }

  it('acepta el horario de edificación sin ámbito (retrocompatible)', () => {
    expect(horarioEquipoSchema.safeParse(base).success).toBe(true)
    expect(
      horarioEquipoSchema.safeParse({ ...base, ambito: {}, desde: null, hasta: null }).success
    ).toBe(true)
  })

  it('acepta la cascada completa y los niveles intermedios', () => {
    expect(
      horarioEquipoSchema.safeParse({
        ...base,
        ambito: { bloqueId: 'blo-1', espacioId: 'esp-1', equipoId: 'eq-1' },
        desde: '2026-08-01',
        hasta: '2026-12-15',
      }).success
    ).toBe(true)
    expect(
      horarioEquipoSchema.safeParse({ ...base, ambito: { bloqueId: 'blo-1' } }).success
    ).toBe(true)
    expect(
      horarioEquipoSchema.safeParse({
        ...base,
        ambito: { bloqueId: 'blo-1', espacioId: 'esp-1' },
      }).success
    ).toBe(true)
  })

  it('rechaza la cascada rota: equipo sin espacio ni bloque, espacio sin bloque', () => {
    expect(
      horarioEquipoSchema.safeParse({ ...base, ambito: { equipoId: 'eq-1' } }).success
    ).toBe(false)
    expect(
      horarioEquipoSchema.safeParse({
        ...base,
        ambito: { espacioId: 'esp-1', equipoId: 'eq-1' },
      }).success
    ).toBe(false)
    expect(
      horarioEquipoSchema.safeParse({ ...base, ambito: { espacioId: 'esp-1' } }).success
    ).toBe(false)
  })

  it('rechaza vigencia invertida y acepta la vigencia abierta', () => {
    expect(
      horarioEquipoSchema.safeParse({
        ...base,
        desde: '2026-12-15',
        hasta: '2026-08-01',
      }).success
    ).toBe(false)
    expect(
      horarioEquipoSchema.safeParse({ ...base, desde: '2026-08-01', hasta: null }).success
    ).toBe(true)
  })
})

describe('claveAmbito (identidad del ámbito para conflictos)', () => {
  it('distingue los cuatro niveles por el más específico', () => {
    expect(claveAmbito({})).toBe('edificacion')
    expect(claveAmbito({ bloqueId: 'blo-1' })).toBe('bloque:blo-1')
    expect(claveAmbito({ bloqueId: 'blo-1', espacioId: 'esp-1' })).toBe('espacio:esp-1')
    expect(
      claveAmbito({ bloqueId: 'blo-1', espacioId: 'esp-1', equipoId: 'eq-1' })
    ).toBe('equipo:eq-1')
    // Un equipo de otro bloque no se confunde: la cascada es la del equipo.
    expect(claveAmbito({ equipoId: 'eq-1' })).toBe('equipo:eq-1')
  })
})

describe('hayConflictoHorario (S12: mismo ámbito + días + franja + vigencia)', () => {
  const h = (extra: Partial<HorarioComparable>): HorarioComparable => ({
    edificacionId: 'edi-1',
    ambito: {},
    diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
    horaInicio: 8,
    horaFin: 12,
    desde: null,
    hasta: null,
    ...extra,
  })

  it('detecta conflicto cuando coinciden ámbito, día, franja y vigencia', () => {
    expect(
      hayConflictoHorario(h({}), h({ horaInicio: 10, horaFin: 16 }))
    ).toBe(true)
  })

  it('no hay conflicto entre ámbitos distintos (edificación vs bloque)', () => {
    expect(
      hayConflictoHorario(h({}), h({ ambito: { bloqueId: 'blo-1' } }))
    ).toBe(false)
  })

  it('no hay conflicto si los días no se solapan', () => {
    expect(
      hayConflictoHorario(h({ diasSemana: ['LUN'] }), h({ diasSemana: ['SAB'] }))
    ).toBe(false)
  })

  it('no hay conflicto con franjas que se tocan por un borde (semicerradas)', () => {
    expect(hayConflictoHorario(h({}), h({ horaInicio: 12, horaFin: 18 }))).toBe(false)
    expect(hayConflictoHorario(h({}), h({ horaInicio: 4, horaFin: 8 }))).toBe(false)
  })

  it('no hay conflicto con vigencias disjuntas ni entre edificaciones distintas', () => {
    expect(
      hayConflictoHorario(
        h({ hasta: '2026-06-30' }),
        h({ desde: '2026-07-01' })
      )
    ).toBe(false)
    expect(
      hayConflictoHorario(h({}), h({ edificacionId: 'edi-2' }))
    ).toBe(false)
  })

  it('la vigencia se solapa en un borde compartido (mismo día activo)', () => {
    expect(
      hayConflictoHorario(h({ hasta: '2026-06-30' }), h({ desde: '2026-06-30' }))
    ).toBe(true)
    // Y una vigencia abierta siempre se solapa con cualquier otra.
    expect(hayConflictoHorario(h({ hasta: null }), h({ desde: '2030-01-01' }))).toBe(true)
  })

  it('ignora el nombre: dos grupos distintos en el mismo ámbito chocan igual', () => {
    expect(
      hayConflictoHorario(h({}), h({ horaInicio: 8, horaFin: 10 }))
    ).toBe(true)
  })
})

describe('formatearVigencia (presentación)', () => {
  it('formatea los cuatro casos en es-CO', () => {
    expect(formatearVigencia(null, null)).toBe('Sin vigencia registrada')
    expect(formatearVigencia('2026-08-01', null)).toBe('Desde 01/08/2026')
    expect(formatearVigencia(null, '2027-06-30')).toBe('Hasta 30/06/2027')
    expect(formatearVigencia('2026-08-01', '2026-12-15')).toBe('01/08/2026 → 15/12/2026')
  })
})
