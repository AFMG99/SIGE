import { describe, expect, it } from 'vitest'
import {
  diasOperativosDelMes,
  calcularGde,
  configCalendarioSchema,
  CATALOGO_TIPOS_DIA,
  mapearUbicaciones,
  TDEA_PLANTILLA,
} from './calendario'
import type { RangoCalendarioInfo } from './calendario'

/** Rangos de prueba: febrero 2026 (28 días), mes de referencia de las pruebas. */
const rangosFebrero: RangoCalendarioInfo[] = [
  // Del 1 al 10 de febrero: vacaciones (no operativo).
  { id: 'r1', fechaInicio: '2026-01-01', fechaFin: '2026-02-10', tipoDia: 'VACACIONES' },
  // Del 11 al 28: actividad académica (operativo).
  { id: 'r2', fechaInicio: '2026-02-11', fechaFin: '2026-02-28', tipoDia: 'LECTIVO' },
]

const config = { horaInicioOperacion: 6, horasOperacionDia: 12, temperaturaBase: 23 }

describe('CATALOGO_TIPOS_DIA', () => {
  it('incluye los cuatro tipos y marca LECTIVO/HABIL como operativos', () => {
    expect(CATALOGO_TIPOS_DIA).toHaveLength(4)
    const operativos = CATALOGO_TIPOS_DIA.filter((t) => t.operativo).map((t) => t.codigo)
    expect(operativos).toEqual(['LECTIVO', 'HABIL'])
  })
})

describe('diasOperativosDelMes', () => {
  it('cuenta solo los días operativos del mes', () => {
    // 11 al 28 de febrero = 18 días operativos.
    expect(diasOperativosDelMes(rangosFebrero, 2, 2026)).toBe(18)
  })

  it('devuelve 0 cuando el mes no tiene rangos', () => {
    expect(diasOperativosDelMes(rangosFebrero, 5, 2026)).toBe(0)
  })

  it('cuenta festivos dentro de un mes lectivo como no operativos', () => {
    const rangos: RangoCalendarioInfo[] = [
      { id: 'r1', fechaInicio: '2026-03-01', fechaFin: '2026-03-31', tipoDia: 'LECTIVO' },
      { id: 'r2', fechaInicio: '2026-03-20', fechaFin: '2026-03-20', tipoDia: 'FESTIVO' },
    ]
    // 31 días de marzo menos el festivo del 20.
    expect(diasOperativosDelMes(rangos, 3, 2026)).toBe(30)
  })

  it('cruza el cambio de año (enero lectivo iniciado en diciembre)', () => {
    const rangos: RangoCalendarioInfo[] = [
      { id: 'r1', fechaInicio: '2025-12-01', fechaFin: '2026-01-15', tipoDia: 'LECTIVO' },
    ]
    expect(diasOperativosDelMes(rangos, 1, 2026)).toBe(15)
  })
})

describe('calcularGde', () => {
  /** Crea 24 horas constantes para un día. */
  const dia = (fecha: string, temp: number) => ({ fecha, horas: Array(24).fill(temp) })

  it('aplica (Tp − Tb) solo cuando Tp supera la temperatura base', () => {
    // Día operativo a 27 °C → (27 − 23) = 4; día operativo a 20 °C → 0.
    const temps = [dia('2026-02-11', 27), dia('2026-02-12', 20)]
    const res = calcularGde({ rangos: rangosFebrero, config, tempsHorarias: temps, mes: 2, ano: 2026 })
    expect(res.gde).toBe(4)
    expect(res.diasOperativos).toBe(18)
    // Solo 2 de los 18 días operativos tienen datos de temperatura.
    expect(res.diasConTemperatura).toBe(2)
    expect(res.diasSinTemperatura).toBe(16)
  })

  it('promedia solo las horas del horario operativo [H, H+dur)', () => {
    // Horas 0-5 (fuera del horario 6..17) a 10 °C no deben influir.
    const horas = Array(24).fill(27)
    for (let h = 0; h < 6; h++) horas[h] = 10
    const res = calcularGde({
      rangos: [{ fechaInicio: '2026-02-11', fechaFin: '2026-02-11', tipoDia: 'LECTIVO' }],
      config,
      tempsHorarias: [dia('2026-02-11', 0).horas.map((_, i) => horas[i])].map((h, i) => ({
        fecha: `2026-02-11`,
        horas: h,
      })),
      mes: 2,
      ano: 2026,
    })
    expect(res.gde).toBe(4)
  })

  it('devuelve gde 0 y motivo cuando no hay días operativos', () => {
    const res = calcularGde({
      rangos: [{ fechaInicio: '2026-05-01', fechaFin: '2026-05-31', tipoDia: 'VACACIONES' }],
      config,
      tempsHorarias: [],
      mes: 5,
      ano: 2026,
    })
    expect(res.gde).toBe(0)
    expect(res.diasOperativos).toBe(0)
  })

  it('la plantilla del TdeA produce días operativos coherentes con el semestre 2026-1', () => {
    // Febrero 2026 con la plantilla: lectivo desde el 09/02 (inicio real del período).
    const dias = diasOperativosDelMes(TDEA_PLANTILLA.rangos, 2, 2026)
    expect(dias).toBe(20) // 9 al 28 de febrero
  })
})

// ============================================================
// Fase 6 — configuración operativa: ubicación (S1) + Xe opt-in (S4)
// ============================================================

describe('configCalendarioSchema (ubicación e interruptor Xe)', () => {
  const base = {
    horaInicioOperacion: 6,
    horasOperacionDia: 12,
    temperaturaBase: 23,
    lat: 6.2477,
    lon: -75.5662,
  }

  it('acepta la configuración mínima con defaults (Xe apagado, sin nombre)', () => {
    const res = configCalendarioSchema.safeParse(base)
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.usarHorariosXe).toBe(false)
    expect(res.data.ubicacionNombre).toBe(null)
  })

  it('recorta el nombre de ubicación y conserva el interruptor Xe encendido', () => {
    const res = configCalendarioSchema.safeParse({
      ...base,
      ubicacionNombre: '  Medellín, Antioquia  ',
      usarHorariosXe: true,
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.ubicacionNombre).toBe('Medellín, Antioquia')
    expect(res.data.usarHorariosXe).toBe(true)
  })

  it('rechaza un interruptor no booleano y un nombre demasiado largo', () => {
    expect(configCalendarioSchema.safeParse({ ...base, usarHorariosXe: 'si' }).success).toBe(false)
    expect(
      configCalendarioSchema.safeParse({ ...base, ubicacionNombre: 'x'.repeat(161) }).success
    ).toBe(false)
  })
})

// ============================================================
// Fase 6 — geocoding Open-Meteo: mapeo puro de resultados (S1)
// ============================================================

describe('mapearUbicaciones (geocoding de Open-Meteo)', () => {
  it('mapea los campos y normaliza los ausentes a null', () => {
    const res = mapearUbicaciones({
      results: [
        {
          name: 'Medellín',
          latitude: 6.2477,
          longitude: -75.5662,
          admin1: 'Antioquia',
          country: 'Colombia',
          timezone: 'America/Bogota',
        },
        { name: 'Envigado', latitude: 6.1696, longitude: -75.5736 },
      ],
    })
    expect(res).toHaveLength(2)
    expect(res[0]).toEqual({
      nombre: 'Medellín',
      admin1: 'Antioquia',
      pais: 'Colombia',
      lat: 6.2477,
      lon: -75.5662,
      timezone: 'America/Bogota',
    })
    expect(res[1]).toEqual({
      nombre: 'Envigado',
      admin1: null,
      pais: null,
      lat: 6.1696,
      lon: -75.5736,
      timezone: null,
    })
  })

  it('filtra entradas sin nombre, sin coordenadas o fuera de rango', () => {
    const res = mapearUbicaciones({
      results: [
        { name: '   ', latitude: 1, longitude: 2 },
        { name: 'Sin lat', longitude: -75 },
        { name: 'Sin lon', latitude: 6 },
        { name: 'Lat no numérico', latitude: 'x', longitude: 2 },
        { name: 'Lat fuera de rango', latitude: 120, longitude: 0 },
        { name: 'Lon fuera de rango', latitude: 6, longitude: -200 },
        { name: 'Válida', latitude: 6, longitude: -75 },
        'garbage',
        null,
        42,
      ],
    })
    expect(res).toHaveLength(1)
    expect(res[0].nombre).toBe('Válida')
  })

  it('devuelve una lista vacía ante payloads sin resultados', () => {
    expect(mapearUbicaciones({})).toEqual([])
    expect(mapearUbicaciones(null)).toEqual([])
    expect(mapearUbicaciones({ results: null })).toEqual([])
    expect(mapearUbicaciones({ results: [] })).toEqual([])
  })

  it('limita el listado a 8 aunque la fuente devuelva más', () => {
    const results = Array.from({ length: 12 }, (_, i) => ({
      name: `Ciudad ${i}`,
      latitude: 6 + i * 0.01,
      longitude: -75,
    }))
    const res = mapearUbicaciones({ results })
    expect(res).toHaveLength(8)
    expect(res[0].nombre).toBe('Ciudad 0')
  })
})
