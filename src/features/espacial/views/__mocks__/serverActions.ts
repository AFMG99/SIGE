import type { ResultadoImportacionCad } from '../../controllers/confirmarImportacionCad'

export async function confirmarImportacionCad(): Promise<ResultadoImportacionCad> {
  return {
    estado: 'ok',
    cantidad: 1,
    mensaje: 'Se actualizaron 1 espacio del bloque seleccionado.',
  }
}
