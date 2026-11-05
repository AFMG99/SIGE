/**
 * Modelo de LBEn que se registra en `AjusteEnergetico.modelo` al crear un
 * ajuste (Resolución UPME 0016 de 2024, §7.6.2: el ajuste rutinario se
 * documenta sobre el modelo de línea base que lo aplica).
 */

/** Prioridad de modelo LBEn (misma que usa reportesController) al registrar `modelo` de un ajuste. */
export const PRIORIDAD_MODELOS_LBEN = ['VALOR_ABSOLUTO', 'COCIENTE', 'REGRESSION_ESTADISTICA', 'CONFORT_THERMAL'] as const

/**
 * Devuelve el tipo de LBEn de mayor prioridad presente en `tipos` (los tipos
 * guardados en `LineaBaseEnergia` para el bloque del ajuste). Los tipos
 * desconocidos se ignoran; si ninguno coincide, devuelve `null`.
 */
export function resolverModeloLben(tipos: readonly string[]): string | null {
  for (const modelo of PRIORIDAD_MODELOS_LBEN) {
    if (tipos.includes(modelo)) return modelo
  }
  return null
}
