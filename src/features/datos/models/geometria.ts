export const PISO_SIN_ASIGNAR = 'Sin asignar'
const MAX_DIMENSION_M = 10_000

export interface DimensionesInput {
  largoM?: number | string | null
  anchoM?: number | string | null
  altoM?: number | string | null
}

export interface DimensionesValidadas {
  largoM: number | null
  anchoM: number | null
  altoM: number | null
  areaCalculadaM2: number | null
}

type ResultadoDimensiones =
  | { ok: true; valor: DimensionesValidadas }
  | { ok: false; mensaje: string }

function parsearDimension(valor: number | string | null | undefined): number | null | false {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null
  const numero = Number(valor)
  return Number.isFinite(numero) && numero > 0 && numero <= MAX_DIMENSION_M ? numero : false
}

export function validarDimensiones(input: DimensionesInput): ResultadoDimensiones {
  const largoM = parsearDimension(input.largoM)
  const anchoM = parsearDimension(input.anchoM)
  const altoM = parsearDimension(input.altoM)

  if (largoM === false || anchoM === false || altoM === false) {
    return {
      ok: false,
      mensaje: `Las dimensiones deben ser positivas y no superar ${MAX_DIMENSION_M.toLocaleString('es-CO')} m.`,
    }
  }
  if ((largoM === null) !== (anchoM === null)) {
    return { ok: false, mensaje: 'Ingrese largo y ancho para calcular el área.' }
  }

  const areaCalculadaM2 =
    largoM === null || anchoM === null ? null : largoM * anchoM
  if (areaCalculadaM2 !== null && !Number.isFinite(areaCalculadaM2)) {
    return { ok: false, mensaje: 'El área calculada excede el rango permitido.' }
  }

  return {
    ok: true,
    valor: {
      largoM,
      anchoM,
      altoM,
      areaCalculadaM2,
    },
  }
}

export function normalizarPiso(valor: string | null | undefined): string | null {
  const piso = String(valor ?? '').trim().replace(/\s+/g, ' ')
  if (piso.length > 60) return null
  return piso || PISO_SIN_ASIGNAR
}

export function formatearDimensiones(
  dimensiones: Pick<DimensionesValidadas, 'largoM' | 'anchoM' | 'altoM'>
): string | null {
  const { largoM, anchoM, altoM } = dimensiones
  if (largoM == null || anchoM == null) return null
  return `${largoM} × ${anchoM}${altoM == null ? '' : ` × ${altoM}`} m`
}
