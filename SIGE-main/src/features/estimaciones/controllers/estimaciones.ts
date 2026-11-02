'use server'
import { requireModuleAccess } from '@/shared/models/authz'
import { prisma } from '@/shared/models/prisma'
import type { ModeloEstimacion, ResultadoEstimacion } from '../models/estimaciones'

const PYTHON_URL = process.env.PYTHON_URL ?? 'http://localhost:8000'
const LBEN_SECRET = process.env.LBEN_SECRET ?? ''

export async function calcularEstimacion(
  edificacionId: string,
  modelo: ModeloEstimacion,
  parametros: Record<string, number>,
  horizonte: number
): Promise<ResultadoEstimacion> {
  const user = await requireModuleAccess('estimates')
  if (!user) throw new Error('Sin acceso al módulo de estimaciones')
  const facturas = await prisma.facturaEnergia.findMany({
    where: { edificacionId },
    orderBy: { periodo: 'asc' },
    select: { periodo: true, consumoKwh: true },
  })
  if (facturas.length === 0) throw new Error('La edificación no tiene facturas registradas')
  const registros = facturas.map((f) => ({ periodo: f.periodo, consumo_kwh: f.consumoKwh }))
  const res = await fetch(`${PYTHON_URL}/api/estimaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-lben-key': LBEN_SECRET },
    body: JSON.stringify({ edificacion_id: edificacionId, registros, modelo, parametros, horizonte }),
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`Error del motor Python: ${err}`) }
  return res.json() as Promise<ResultadoEstimacion>
}

export async function guardarEstimacion(
  edificacionId: string,
  resultado: ResultadoEstimacion,
  modelo: ModeloEstimacion,
  parametros: Record<string, number>,
  horizonte: number
): Promise<string> {
  const user = await requireModuleAccess('estimates')
  if (!user) throw new Error('Sin acceso')
  const estimacion = await prisma.estimacionConsumo.create({
    data: {
      edificacionId, modelo, parametros, horizonte,
      periodoBase: resultado.periodo_base,
      mesesHistorico: resultado.meses_historico,
      resultados: resultado.proyecciones as object[],
      mape: resultado.mape,
      advertencias: resultado.advertencias,
      creadoPor: user.id,
    },
  })
  return estimacion.id
}

export async function listarEstimaciones(edificacionId?: string) {
  const user = await requireModuleAccess('estimates')
  if (!user) throw new Error('Sin acceso')
  return prisma.estimacionConsumo.findMany({
    where: edificacionId ? { edificacionId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, modelo: true, horizonte: true, periodoBase: true,
      mesesHistorico: true, mape: true, advertencias: true,
      resultados: true, createdAt: true,
      edificacion: { select: { nombre: true } },
    },
  })
}