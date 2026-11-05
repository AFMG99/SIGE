import { resultadoProyeccionDemo } from '../__fixtures__/forecast'
import type { ResultadoProyeccion } from '../../models/forecast'

/** Copia local del ítem del historial (espejo de `EstimacionHistorialItem` del controller). */
type HistorialItem = {
  id: string
  edificacionId: string
  edificacionNombre: string
  bloqueNombre: string | null
  modelo: string
  horizonte: number
  periodoBase: string
  mesesHistorico: number
  mesesDepurados: number
  advertencias: string | null
  createdAt: string
}

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

/** Historial en memoria: las estimaciones "guardadas" durante la historia. */
let historialDemo: HistorialItem[] = []

export async function guardarEstimacion(input: {
  edificacionId: string
  bloqueId: string | null
  resultado: ResultadoProyeccion
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const proyeccion = input.resultado?.proyeccion
  if (!proyeccion?.ok) {
    return { ok: false, error: 'Los resultados no cumplen el contrato de proyección.' }
  }
  const id = `est-${historialDemo.length + 1}`
  historialDemo = [
    {
      id,
      edificacionId: input.edificacionId,
      edificacionNombre: 'Campus Principal Robledo',
      bloqueNombre: input.bloqueId ? 'Bloque de Aulas Mayores' : null,
      modelo: proyeccion.modelo,
      horizonte: proyeccion.pronostico.length,
      periodoBase: proyeccion.serie.at(-1)?.periodo ?? '',
      mesesHistorico: proyeccion.originales,
      mesesDepurados: proyeccion.depurados,
      advertencias: proyeccion.advertencia ?? null,
      createdAt: new Date().toISOString(),
    },
    ...historialDemo,
  ]
  return { ok: true, id }
}

export async function listarHistorialEstimaciones(edificacionId?: string): Promise<
  { ok: true; items: HistorialItem[] } | { ok: false; error: string }
> {
  return {
    ok: true,
    items: historialDemo.filter(
      (item) => !edificacionId || item.edificacionId === edificacionId
    ),
  }
}

export async function obtenerEstimacionGuardada(id: string): Promise<
  { ok: true; resultado: ResultadoProyeccion } | { ok: false; error: string }
> {
  const guardada = historialDemo.find((item) => item.id === id)
  if (!guardada) return { ok: false, error: 'La estimación solicitada no existe.' }
  return { ok: true, resultado: resultadoProyeccionDemo }
}
