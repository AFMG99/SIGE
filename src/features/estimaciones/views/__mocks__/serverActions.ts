import { resultadoProyeccionDemo } from '../__fixtures__/forecast'

let sinLineaBase = false
let historialCorto = false

export function __setearSinLineaBase(valor: boolean) {
  sinLineaBase = valor
}

export function __setearHistorialCorto(valor: boolean) {
  historialCorto = valor
}

export async function ejecutarProyeccion() {
  const proyeccion = historialCorto
    ? {
        ...resultadoProyeccionDemo.proyeccion,
        originales: 36,
        depurados: 35,
        serie: resultadoProyeccionDemo.proyeccion.serie.slice(0, 35),
        advertencia:
          'Se requieren al menos 36 meses depurados; solo hay 35. Se continúa con la estimación, pero su confiabilidad puede ser menor.',
      }
    : resultadoProyeccionDemo.proyeccion

  return {
    ok: true as const,
    resultado: {
      ...resultadoProyeccionDemo,
      proyeccion,
      lineaBase: sinLineaBase
        ? { origen: null, nombre: null, lbenMensual: null }
        : resultadoProyeccionDemo.lineaBase,
    },
  }
}
