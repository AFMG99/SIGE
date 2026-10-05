import type {
  ResultadoImportacionEquipos,
  ResultadoImportacionFacturas,
  ResultadoImportacionVariables,
} from '@/lib/validations/energia'

/**
 * Resultados de importación deterministas para documentación (Storybook).
 * Reproducen lo que devuelven las server actions reales cuando la importación
 * termina bien, sin tocar la base de datos.
 */

export const resultadoFacturasDemo = {
  estado: 'completado',
  insertadas: 5,
  actualizadas: 1,
  rechazadas: 1,
  errores: [{ fila: 7, razon: 'El mes debe estar entre 01 y 12' }],
  mensaje: 'Se importaron 5 facturas nuevas, 1 actualizada y 1 rechazada.',
} satisfies ResultadoImportacionFacturas

export const resultadoEquiposDemo = {
  estado: 'completado',
  insertadas: 5,
  actualizadas: 1,
  espaciosCreados: 2,
  rechazadas: 1,
  errores: [{ fila: 7, razon: 'Tipo de equipo inválido en la fila' }],
  mensaje: 'Se importaron 5 equipos nuevos, 1 actualizado y 1 rechazado.',
} satisfies ResultadoImportacionEquipos

export const resultadoVariablesDemo = {
  estado: 'completado',
  insertadas: 4,
  actualizadas: 2,
  rechazadas: 1,
  errores: [{ fila: 7, razon: 'Mes inválido en la fila' }],
  mensaje: 'Importación finalizada: 4 nuevas, 2 actualizadas, 1 rechazada.',
} satisfies ResultadoImportacionVariables
