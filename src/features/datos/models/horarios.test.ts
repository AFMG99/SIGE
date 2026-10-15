import { describe, expect, it } from 'vitest'
import { CATALOGO_DIAS, horarioEquipoSchema, formatearDias, formatearFranja } from './horarios'

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
