import { describe, expect, it } from 'vitest'
import {
  proyeccionMotorSchema,
  solicitudProyeccionSchema,
} from './forecast'
import { proyeccionDemo } from '../views/__fixtures__/forecast'

describe('contrato de proyección ARIMA', () => {
  it('valida alcance, horizonte y orden manual', () => {
    expect(
      solicitudProyeccionSchema.safeParse({
        edificacionId: 'edificacion-1',
        bloqueId: null,
        horizonte: 3,
        orden: [1, 1, 0],
      }).success
    ).toBe(true)

    expect(
      solicitudProyeccionSchema.safeParse({
        edificacionId: 'edificacion-1',
        horizonte: 4,
      }).success
    ).toBe(true)
    expect(
      solicitudProyeccionSchema.safeParse({
        edificacionId: 'edificacion-1',
        horizonte: 25,
      }).success
    ).toBe(false)
    expect(
      solicitudProyeccionSchema.safeParse({
        edificacionId: 'edificacion-1',
        horizonte: 1,
        orden: [3, 0, 0],
      }).success
    ).toBe(false)
  })

  it('acepta una proyección bajo 36 meses solo si incluye advertencia', () => {
    expect(proyeccionMotorSchema.safeParse(proyeccionDemo).success).toBe(true)
    const resultadoCorto = {
      ...proyeccionDemo,
      depurados: 35,
      serie: proyeccionDemo.serie.slice(0, 35),
      advertencia:
        'Se requieren al menos 36 meses depurados; solo hay 35. Se continúa con la estimación.',
    }

    expect(proyeccionMotorSchema.safeParse(resultadoCorto).success).toBe(true)
    expect(
      proyeccionMotorSchema.safeParse({
        ...resultadoCorto,
        advertencia: undefined,
      }).success
    ).toBe(false)
    // La advertencia ya no está restringida a históricos cortos: el motor la
    // emite también con 48 meses cuando el horizonte supera 12 o el modelo es
    // MA/SES, así que una proyección completa con advertencia es válida.
    expect(
      proyeccionMotorSchema.safeParse({
        ...proyeccionDemo,
        advertencia: 'No aplica',
      }).success
    ).toBe(true)
  })
})
