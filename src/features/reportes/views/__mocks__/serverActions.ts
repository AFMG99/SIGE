import { DATOS_REPORTE_FIXTURE } from '../__fixtures__/reportes.fixtures'
import type { RespuestaDatosReporte } from '../../controllers/reportesController'

let fallarSiguiente = false

export function __setearFalloReporte(fallar: boolean) {
  fallarSiguiente = fallar
}

export async function obtenerDatosReporte(_input: unknown): Promise<RespuestaDatosReporte> {
  if (fallarSiguiente) {
    return { estado: 'error', mensaje: 'Error simulado al obtener datos del reporte' }
  }
  return { estado: 'ok', datos: DATOS_REPORTE_FIXTURE }
}
