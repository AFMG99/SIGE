'use client'
import type { ProyeccionPeriodo } from '../models/estimaciones'

interface Props {
  proyecciones: ProyeccionPeriodo[]
}

export function ProyeccionChart({ proyecciones }: Props) {
  if (proyecciones.length === 0) return null

  const width = 600
  const height = 220
  const padL = 48, padR = 16, padT = 16, padB = 32

  const values = proyecciones.flatMap((p) => [p.lower, p.upper, p.kwh])
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const rangeV = maxV - minV || 1

  const cx = (i: number) => padL + (i / (proyecciones.length - 1)) * (width - padL - padR)
  const cy = (v: number) => padT + (1 - (v - minV) / rangeV) * (height - padT - padB)

  const bandPath =
    proyecciones.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${cy(p.upper)}`).join(' ') +
    ' ' +
    [...proyecciones].reverse().map((p, i) => `${i === 0 ? 'L' : 'L'}${cx(proyecciones.length - 1 - i)},${cy(p.lower)}`).join(' ') +
    ' Z'

  const linePath = proyecciones.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${cy(p.kwh)}`).join(' ')

  const tickEvery = 3

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* band */}
      <path d={bandPath} fill="currentColor" className="text-emerald-500/20" />
      {/* center line */}
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth={2} className="text-emerald-600" />
      {/* x labels */}
      {proyecciones.map((p, i) =>
        i % tickEvery === 0 ? (
          <text key={p.periodo} x={cx(i)} y={height - 4} textAnchor="middle" fontSize={9} fill="currentColor" className="text-ui-muted">
            {p.periodo.slice(2)}
          </text>
        ) : null
      )}
      {/* y labels */}
      {[minV, (minV + maxV) / 2, maxV].map((v) => (
        <text key={v} x={padL - 4} y={cy(v) + 3} textAnchor="end" fontSize={9} fill="currentColor" className="text-ui-muted">
          {Math.round(v)}
        </text>
      ))}
    </svg>
  )
}