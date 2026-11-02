'use client'
import type { EstimacionGuardada } from '../models/estimaciones'
import { MODELO_LABELS } from '../models/estimaciones'

interface Props {
  historial: EstimacionGuardada[]
}

export function HistorialEstimaciones({ historial }: Props) {
  if (historial.length === 0) {
    return (
      <div className="ui-panel flex flex-col items-center justify-center py-16 gap-3">
        <IconEmpty />
        <p className="text-ui-muted text-sm">No hay estimaciones guardadas aún</p>
      </div>
    )
  }

  return (
    <div className="ui-panel overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ui-border text-ui-muted text-left">
            <th className="pb-2 pr-4 font-medium">Edificación</th>
            <th className="pb-2 pr-4 font-medium">Modelo</th>
            <th className="pb-2 pr-4 font-medium">Horizonte</th>
            <th className="pb-2 pr-4 font-medium">Período base</th>
            <th className="pb-2 pr-4 font-medium">MAPE</th>
            <th className="pb-2 font-medium">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {historial.map((e) => (
            <tr key={e.id} className="border-b border-ui-border/50 hover:bg-ui-hover transition-colors">
              <td className="py-2 pr-4">{e.edificacionNombre}</td>
              <td className="py-2 pr-4">{MODELO_LABELS[e.modelo]}</td>
              <td className="py-2 pr-4">{e.horizonte} meses</td>
              <td className="py-2 pr-4">{e.periodoBase}</td>
              <td className="py-2 pr-4">
                {e.mape !== null ? `${e.mape.toFixed(2)}%` : '—'}
              </td>
              <td className="py-2 text-ui-muted">
                {new Date(e.creadoEn).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IconEmpty() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-10 text-ui-muted">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}