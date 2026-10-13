/**
 * Unit tests de xm.ts — agregación diaria/horaria → mensual, índice
 * base 100, variación interanual, límite de concurrencia y espejos Zod.
 * Todo puro: sin red y sin fechas reales salvo las inyectadas.
 */
import { describe, expect, it } from 'vitest'

import {
  agregarDiarioMensual,
  agregarHorarioMensual,
  conLimite,
  construirSerie,
  mesesCompletosRecientes,
  respuestaDiariaXmSchema,
  respuestaHorariaXmSchema,
  restarMeses,
  trazarSparkline,
  ventanaDelMes,
} from './xm'

describe('mesesCompletosRecientes', () => {
  it('excluye el mes en curso y devuelve 13 meses ascendentes', () => {
    const meses = mesesCompletosRecientes(13, new Date(2026, 9, 13))
    expect(meses).toHaveLength(13)
    expect(meses[0]).toBe('2025-09')
    expect(meses[12]).toBe('2026-09')
  })

  it('cruza de año cuando la referencia es enero', () => {
    const meses = mesesCompletosRecientes(3, new Date(2026, 0, 5))
    expect(meses).toEqual(['2025-10', '2025-11', '2025-12'])
  })
})

describe('ventanaDelMes', () => {
  it('usa el último día real del mes (año no bisiesto)', () => {
    expect(ventanaDelMes('2026-02')).toEqual({
      inicio: '2026-02-01',
      fin: '2026-02-28',
    })
  })

  it('usa 31 días en meses largos', () => {
    expect(ventanaDelMes('2026-07').fin).toBe('2026-07-31')
  })
})

describe('restarMeses', () => {
  it('resta cruzando años', () => {
    expect(restarMeses('2026-01', 12)).toBe('2025-01')
    expect(restarMeses('2025-03', 14)).toBe('2024-01')
    expect(restarMeses('2026-12', 13)).toBe('2025-11')
  })
})

describe('agregarDiarioMensual', () => {
  it('suma los valores diarios por mes calendario', () => {
    const porMes = agregarDiarioMensual([
      { Date: '2026-07-01', DailyEntities: [{ Id: 'Sistema', Value: '100.5' }] },
      { Date: '2026-07-02', DailyEntities: [{ Id: 'Sistema', Value: 100 }] },
      { Date: '2026-08-01', DailyEntities: [{ Id: 'Sistema', Value: '50' }] },
    ])
    expect(porMes.get('2026-07')).toBeCloseTo(200.5)
    expect(porMes.get('2026-08')).toBe(50)
  })

  it('ignora valores no numéricos sin envenenar la suma', () => {
    const porMes = agregarDiarioMensual([
      { Date: '2026-07-01', DailyEntities: [{ Id: 'Sistema', Value: 'n/d' }] },
      { Date: '2026-07-02', DailyEntities: [{ Id: 'Sistema', Value: '40' }] },
    ])
    expect(porMes.get('2026-07')).toBe(40)
  })
})

describe('agregarHorarioMensual', () => {
  it('suma Hour01..Hour24 a kWh diarios y luego por mes', () => {
    const horas = Object.fromEntries(
      Array.from({ length: 24 }, (_, i) => [`Hour${String(i + 1).padStart(2, '0')}`, '10'])
    )
    const porMes = agregarHorarioMensual([
      { Date: '2026-07-01', HourlyEntities: [{ Id: 'Sistema', Values: horas }] },
      { Date: '2026-07-02', HourlyEntities: [{ Id: 'Sistema', Values: horas }] },
    ])
    expect(porMes.get('2026-07')).toBe(480)
  })

  it('tolera horas faltantes o nulas', () => {
    const porMes = agregarHorarioMensual([
      {
        Date: '2026-07-01',
        HourlyEntities: [
          { Id: 'Sistema', Values: { Hour01: '5', Hour02: null, Hour03: 'n/d' } },
        ],
      },
    ])
    expect(porMes.get('2026-07')).toBe(5)
  })
})

describe('construirSerie', () => {
  const periodos = [
    '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
    '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
  ]

  it('fija base 100 en el primer punto y calcula la interanual', () => {
    const porMes = new Map(periodos.map((p, i) => [p, 1000 + i * 10]))
    const { serie, sinDatos } = construirSerie('sistema', 'Demanda', periodos, porMes)

    expect(sinDatos).toEqual([])
    expect(serie.puntos[0]).toEqual({ periodo: '2025-10', kwh: 1000, indice: 100 })
    expect(serie.puntos[12].indice).toBeCloseTo(1120 / 1000 * 100)
    // último (2026-10) vs mismo mes un año atrás (2025-10): +12 %
    expect(serie.variacionInteranual).toBeCloseTo(12)
  })

  it('reporta los meses sin datos y la interanual en null si falta la base', () => {
    const porMes = new Map([
      ['2026-09', 500],
      ['2026-10', 550],
    ])
    const { serie, sinDatos } = construirSerie('sistema', 'Demanda', periodos, porMes)

    expect(sinDatos).toHaveLength(11)
    expect(sinDatos[0]).toBe('2025-10')
    expect(serie.puntos).toHaveLength(2)
    expect(serie.puntos[0].indice).toBe(100)
    // Sin 2025-10 no hay base interanual
    expect(serie.variacionInteranual).toBeNull()
  })
})

describe('conLimite', () => {
  it('respeta el tope de concurrencia y conserva el orden', async () => {
    let activas = 0
    let maximas = 0
    const tareas = Array.from({ length: 10 }, (_, i) => async () => {
      activas += 1
      maximas = Math.max(maximas, activas)
      await new Promise((resolver) => setTimeout(resolver, 5))
      activas -= 1
      return i
    })

    const resultados = await conLimite(tareas, 3)
    expect(resultados).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(maximas).toBeLessThanOrEqual(3)
  })

  it('sin tareas devuelve una lista vacía', async () => {
    await expect(conLimite([], 5)).resolves.toEqual([])
  })
})

describe('trazarSparkline', () => {
  it('traza un punto por cada índice dentro del lienzo', () => {
    const puntos = Array.from({ length: 13 }, (_, i) => ({ indice: 95 + i }))
    const trazado = trazarSparkline(puntos, 132, 40)
    const coordenadas = trazado.split(' ')
    expect(coordenadas).toHaveLength(13)
    for (const par of coordenadas) {
      const [x, y] = par.split(',').map(Number)
      expect(x).toBeGreaterThanOrEqual(1)
      expect(x).toBeLessThanOrEqual(132)
      expect(y).toBeGreaterThanOrEqual(1)
      expect(y).toBeLessThanOrEqual(40)
    }
  })

  it('con menos de dos puntos no traza nada', () => {
    expect(trazarSparkline([{ indice: 100 }])).toBe('')
    expect(trazarSparkline([])).toBe('')
  })
})

describe('espejos Zod de XM', () => {
  it('acepta la forma diaria con Value numérico o texto', () => {
    const parse = respuestaDiariaXmSchema.safeParse({
      Metric: { Id: 'DemaSIN', Name: 'Demanda Energia SIN por Sistema' },
      Items: [{ Date: '2026-09-01', DailyEntities: [{ Id: 'Sistema', Value: 123.4 }] }],
    })
    expect(parse.success).toBe(true)
  })

  it('acepta la forma horaria con Hours variados', () => {
    const parse = respuestaHorariaXmSchema.safeParse({
      Metric: { Id: 'DemaComeNoReg', Name: 'Demanda Comercial' },
      Items: [
        {
          Date: '2026-09-01',
          HourlyEntities: [{ Id: 'Sistema', Values: { Hour01: '10', Hour02: 20 } }],
        },
      ],
    })
    expect(parse.success).toBe(true)
  })

  it('rechaza una respuesta sin Metric', () => {
    const parse = respuestaDiariaXmSchema.safeParse({ Items: [] })
    expect(parse.success).toBe(false)
  })
})
