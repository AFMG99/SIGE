import { describe, expect, it } from 'vitest'
import {
  diasOperativosDelMes,
  calcularGde,
  CATALOGO_TIPOS_DIA,
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
