// Reparto del consumo entre bloques y espacios — FUENTE ÚNICA del criterio.
//
// Extraído de `calcularModelosLineaBase` (features/datos/controllers/
// lineasBase.ts) para que el módulo de análisis (HU-07/KPIs) calcule los
// mismos shares que el motor de líneas base sin duplicar la regla de
// negocio. Criterios (Catálogo y §7.5):
//
//   · `facturas_area`     — cuando TODOS los bloques tienen área útil > 0
//                           y Σ peso > 0: share = (área útil × factor de
//                           infraestructura) ÷ Σ. Normaliza contra Σ de lo
//                           que haya cargado (cobertura completa exigida).
//   · `modelo_ingenieria` — en cuanto falte área: share = carga nominal
//                           teórica del bloque (Σ kWh/mes de sus equipos)
//                           ÷ factura media; nunca infla (denominador =
//                           factura media del ámbito).
//
// Espacio dentro de su bloque: carga nominal de sus equipos ÷ carga total
// del bloque; reparto igualitario como fallback cuando no hay equipos.

import type { OrigenShare } from './lineasBase'

export type BloqueShare = {
  id: string
  areaUtil: number
  factorInfraestructura: number
}

export type EquipoEspacioShare = {
  cantidad: number
  potenciaNominal: number
  horasUsoDia: number
  diasUsoMes: number
}

export type EspacioShare = {
  id: string
  bloqueId: string
  equipos: EquipoEspacioShare[]
}

export type CriterioShares = {
  /** Criterio efectivo (cobertura completa de área o modelo de ingeniería). */
  origen: OrigenShare
  /** true = todos los bloques tienen área útil > 0 y Σ peso > 0. */
  coberturaArea: boolean
  /** Cantidad de bloques sin área útil (para el aviso del flujo LBEn). */
  bloquesSinArea: number
  /** Σ (área útil × factor de infraestructura) de todos los bloques. */
  pesoTotalBloques: number
  /** kWh/mes teóricos de un bloque (Σ de sus espacios). */
  cargaDeBloque: (bloqueId: string) => number
  /** kWh/mes teóricos de un espacio (Σ de sus equipos). */
  cargaDeEspacio: (espacioId: string) => number
  /** Σ kWh/mes teóricos de todos los espacios del bloque. */
  cargaTotalDeBloque: (bloqueId: string) => number
  /** Peso absoluto del bloque según el criterio (área×factor o carga). */
  pesoDeBloque: (bloqueId: string) => number
  /** Share absoluto del bloque (Σ de shares = 1 en `facturas_area`). */
  shareDeBloque: (bloqueId: string) => number
  /** Fracción del espacio DENTRO de su bloque (fallback igualitario). */
  shareDeEspacio: (bloqueId: string, espacioId: string) => number
}

/** kWh/mes teóricos de un espacio: Σ (cantidad × potencia × h/día × d/mes). */
export function cargaDeEquipos(equipos: EquipoEspacioShare[]): number {
  return equipos.reduce(
    (suma, eq) =>
      suma + eq.cantidad * eq.potenciaNominal * eq.horasUsoDia * eq.diasUsoMes,
    0
  )
}

/**
 * Construye el criterio de share para un conjunto de bloques y espacios.
 * `mediaNormalizado` es la factura media normalizada (kWh/mes, 30 d) del
 * ámbito: denominador del criterio de ingeniería y validación de cobertura.
 */
export function crearCriterioShares(args: {
  bloques: BloqueShare[]
  espacios: EspacioShare[]
  mediaNormalizado: number
}): CriterioShares {
  const { bloques, espacios, mediaNormalizado } = args

  const espaciosDeBloque = (bloqueId: string) =>
    espacios.filter((e) => e.bloqueId === bloqueId)

  const cargaDeEspacio = (espacioId: string): number => {
    const espacio = espacios.find((e) => e.id === espacioId)
    return espacio ? cargaDeEquipos(espacio.equipos) : 0
  }

  const cargaDeBloque = (bloqueId: string): number =>
    espaciosDeBloque(bloqueId).reduce((suma, e) => suma + cargaDeEquipos(e.equipos), 0)

  const cargaTotalDeBloque = (bloqueId: string): number => cargaDeBloque(bloqueId)

  const pesoDeBloque = (bloqueId: string): number => {
    const bloque = bloques.find((b) => b.id === bloqueId)
    return bloque ? bloque.areaUtil * bloque.factorInfraestructura : 0
  }

  const pesoTotalBloques = bloques.reduce(
    (suma, b) => suma + b.areaUtil * b.factorInfraestructura,
    0
  )

  const bloquesSinArea = bloques.filter((b) => !(b.areaUtil > 0)).length
  const coberturaArea =
    bloques.length > 0 && bloquesSinArea === 0 && pesoTotalBloques > 0
  const origen: OrigenShare = coberturaArea ? 'facturas_area' : 'modelo_ingenieria'

  const shareDeBloque = (bloqueId: string): number =>
    origen === 'facturas_area'
      ? pesoDeBloque(bloqueId) / pesoTotalBloques
      : cargaDeBloque(bloqueId) / mediaNormalizado

  const shareDeEspacio = (bloqueId: string, espacioId: string): number => {
    const hermanos = espaciosDeBloque(bloqueId)
    const cargaTotal = hermanos.reduce((suma, e) => suma + cargaDeEquipos(e.equipos), 0)
    return cargaTotal > 0
      ? cargaDeEspacio(espacioId) / cargaTotal
      : 1 / (hermanos.length || 1)
  }

  return {
    origen,
    coberturaArea,
    bloquesSinArea,
    pesoTotalBloques,
    cargaDeBloque,
    cargaDeEspacio,
    cargaTotalDeBloque,
    pesoDeBloque,
    shareDeBloque,
    shareDeEspacio,
  }
}
