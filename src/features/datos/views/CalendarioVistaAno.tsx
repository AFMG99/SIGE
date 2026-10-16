'use client'

/**
 * Vista «12 meses» del calendario (S5, Fase 6).
 *
 * Rejilla con los 12 meses del año seleccionado: nombre, mini-rejilla de
 * puntos de 6×7 (festivos resaltados con el catálogo puro de
 * `models/festivos.ts`) y recuento de festivos. Cada tarjeta es un botón que
 * salta a ese mes en la vista mensual. Cálculo en cliente, sin requests.
 */

import { festivosDelMes } from '../models/festivos'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const pad = (n: number): string => String(n).padStart(2, '0')

interface CalendarioVistaAnoProps {
  /** Año mostrado en la rejilla de 12 meses. */
  ano: number
  /** Mes seleccionado en la vista mensual (contorno emerald en su tarjeta). */
  mesSeleccionado: number
  /** Fecha de hoy `YYYY-MM-DD`; marca la tarjeta del mes en curso. */
  hoy: string
  /** El usuario elige un mes: la vista cambia a «Mes» sobre ese mes. */
  onElegirMes: (mes: number) => void
}

export function CalendarioVistaAno({
  ano,
  mesSeleccionado,
  hoy,
  onElegirMes,
}: CalendarioVistaAnoProps) {
  const anoHoy = Number(hoy.slice(0, 4))
  const mesHoy = Number(hoy.slice(5, 7))

  return (
    <div
      role="group"
      aria-label={`Los 12 meses de ${ano}`}
      className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
    >
      {MESES.map((nombre, i) => {
        const mes = i + 1
        const festivos = festivosDelMes(ano, mes)
        const porFecha = new Set(festivos.map((f) => f.fecha))
        const diasPrevios = (new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay() + 6) % 7
        const diasEnMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
        const esMesActual = ano === anoHoy && mes === mesHoy
        const plural = festivos.length === 1 ? 'festivo' : 'festivos'

        // Mini-rejilla fija de 6 filas × 7 columnas (42 celdas), huecos al
        // inicio y al cierre para que los puntos se alineen con la semana.
        const celdas: (number | null)[] = [
          ...Array.from({ length: diasPrevios }, () => null),
          ...Array.from({ length: diasEnMes }, (_, d) => d + 1),
        ]
        while (celdas.length < 42) celdas.push(null)

        return (
          <button
            key={mes}
            type="button"
            onClick={() => onElegirMes(mes)}
            aria-label={`Elegir ${nombre} de ${ano} (${festivos.length} ${plural})`}
            aria-current={esMesActual ? 'date' : undefined}
            className={[
              'focus-ring flex cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left',
              'hover:border-emerald-400 dark:hover:border-emerald-700',
              mes === mesSeleccionado
                ? 'border-emerald-600 dark:border-emerald-700'
                : 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800/40',
              esMesActual ? 'ring-2 ring-uv-lime' : '',
            ].join(' ')}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{nombre}</span>
              <span className="ui-muted text-[10px]">
                {festivos.length} {plural}
              </span>
            </span>
            <span aria-hidden="true" className="grid grid-cols-7 justify-items-center gap-1">
              {celdas.map((dia, c) =>
                dia === null ? (
                  <span key={`hueco-${c}`} className="h-1.5 w-1.5" />
                ) : (
                  <span
                    key={`${mes}-${dia}`}
                    className={`h-1.5 w-1.5 rounded-full ${
                      porFecha.has(`${ano}-${pad(mes)}-${pad(dia)}`)
                        ? 'bg-emerald-600 dark:bg-emerald-400'
                        : 'bg-gray-300 dark:bg-slate-600'
                    }`}
                  />
                )
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
