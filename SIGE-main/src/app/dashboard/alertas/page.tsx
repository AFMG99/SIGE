import { redirect } from 'next/navigation'
import { AlertasView } from '@/features/alertas/views/AlertasView'
import { leerEstadosEvaluacion } from '@/features/alertas/controllers/evaluacion'
import {
  esDireccionAlerta,
  esEstadoAlerta,
  esSeveridadAlerta,
  type AlertaVista,
  type EvaluacionVista,
} from '@/features/alertas/models/alertas'
import { canWithOverrides, requireModuleAccess } from '@/shared/models/authz'
import { prisma } from '@/shared/models/prisma'

/**
 * Módulo 4 — Alertas de consumo inusual (HU-08).
 *
 * Página delgada: guard de lectura del módulo `alerts` (independiente de
 * `consumption` para que un Directivo vea alertas sin poder cargar facturas) →
 * consultas → props serializables. La decisión de si la bandeja está
 * desactualizada se resuelve aquí comparando firmas baratas (aggregates), sin
 * ejecutar el motor de análisis.
 */
export default async function AlertasPage() {
  const user = await requireModuleAccess('alerts')
  if (!user) {
    redirect('/dashboard')
  }

  const [edificaciones, alertas, puedeEvaluar, puedeConfigurar] = await Promise.all([
    prisma.edificacion.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
    prisma.alertaConsumo.findMany({
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
      select: {
        id: true,
        edificacionId: true,
        periodo: true,
        mes: true,
        ano: true,
        consumoKwh: true,
        bandaInf: true,
        bandaSup: true,
        desviacionPct: true,
        direccion: true,
        severidad: true,
        umbralPct: true,
        umbralK: true,
        estado: true,
        nota: true,
        actualizadoAt: true,
        edificacion: { select: { nombre: true } },
      },
    }),
    canWithOverrides(user, 'alerts', 'evaluate'),
    canWithOverrides(user, 'alerts', 'config'),
  ])

  const estados = await leerEstadosEvaluacion(edificaciones.map((e) => e.id))

  const configs = Object.fromEntries(
    Object.entries(estados).map(([id, estado]) => [id, estado.config])
  )

  const evaluaciones: Record<string, EvaluacionVista> = Object.fromEntries(
    Object.entries(estados).map(([id, estado]) => [
      id,
      {
        firma: estado.evaluacion?.firma ?? '',
        periodosEvaluables: estado.evaluacion?.periodosEvaluables ?? 0,
        noEvaluables: estado.evaluacion?.noEvaluables ?? 0,
        evaluadoEn: estado.evaluacion?.evaluadoEn.toISOString() ?? null,
        desactualizada: estado.desactualizada,
      } satisfies EvaluacionVista,
    ])
  )

  const alertasVista: AlertaVista[] = alertas.map((alerta) => ({
    id: alerta.id,
    edificacionId: alerta.edificacionId,
    edificacionNombre: alerta.edificacion.nombre,
    periodo: alerta.periodo,
    mes: alerta.mes,
    ano: alerta.ano,
    consumoKwh: alerta.consumoKwh,
    bandaInf: alerta.bandaInf,
    bandaSup: alerta.bandaSup,
    desviacionPct: alerta.desviacionPct,
    // Las columnas son String en la BD (sin enums de Prisma): se estrechan al
    // dominio y, si un valor quedara fuera del catálogo, se descarta la fila
    // en vez de pintar un estado imposible.
    direccion: esDireccionAlerta(alerta.direccion) ? alerta.direccion : 'alza',
    severidad: esSeveridadAlerta(alerta.severidad) ? alerta.severidad : 'baja',
    umbralPct: alerta.umbralPct,
    umbralK: alerta.umbralK,
    estado: esEstadoAlerta(alerta.estado) ? alerta.estado : 'nueva',
    nota: alerta.nota,
    actualizadoAt: alerta.actualizadoAt.toISOString(),
  }))

  return (
    <AlertasView
      edificaciones={edificaciones}
      alertas={alertasVista}
      configs={configs}
      evaluaciones={evaluaciones}
      puedeEvaluar={puedeEvaluar}
      puedeConfigurar={puedeConfigurar}
    />
  )
}
