'use client'

/**
 * Vista «Calendario» de la sección Edificaciones (Fase 4, slice mínimo — S11).
 *
 * Rejilla mensual con los festivos nacionales de Colombia resaltados, según el
 * catálogo determinista de `models/festivos.ts` (Ley Emiliani, Pascua y la
 * Ley 2578/2026): sin requests ni API externas, cero impacto en el tiempo de
 * respuesta del despliegue serverless en Vercel. Semana de lunes a domingo.
 */

import { useState } from 'react'
import { festivosDelMes, type Festivo } from '../models/festivos'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const pad = (n: number): string => String(n).padStart(2, '0')

const celdaFecha = (ano: number, mes: number, dia: number): string =>
  `${ano}-${pad(mes)}-${pad(dia)}`

interface CalendarioFestivosProps {
  /** Mes de arranque (1-12); por defecto, el mes actual. */
  mesInicial?: number
  /** Año de arranque; por defecto, el año actual. */
  anoInicial?: number
}

export function CalendarioFestivos({ mesInicial, anoInicial }: CalendarioFestivosProps = {}) {
  const [ref, setRef] = useState(() => {
    const hoy = new Date()
    return {
      mes: mesInicial ?? hoy.getMonth() + 1,
      ano: anoInicial ?? hoy.getFullYear(),
    }
  })
  const [hoy] = useState(() => {
    const d = new Date()
    return celdaFecha(d.getFullYear(), d.getMonth() + 1, d.getDate())
  })

  const { mes, ano } = ref
  const festivos = festivosDelMes(ano, mes)
  const porFecha = new Map<string, Festivo>(festivos.map((f) => [f.fecha, f]))

  // Rejilla: lunes primero ((getUTCDay() + 6) % 7) y días del mes vía UTC.
  const diasPrevios = (new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay() + 6) % 7
  const diasEnMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate()

  const navegar = (delta: number) => {
    setRef((r) => {
      const idx = r.mes - 1 + delta
      return {
        mes: ((idx % 12) + 12) % 12 + 1,
        ano: r.ano + Math.floor(idx / 12),
      }
    })
  }

  const volverAHoy = () => {
    const d = new Date()
    setRef({ mes: d.getMonth() + 1, ano: d.getFullYear() })
  }

  // Celdas de la rejilla: huecos (null) al inicio y al cierre para que cada
  // fila tenga exactamente 7 días (filas ARIA válidas de lunes a domingo).
  const celdas: (number | null)[] = [
    ...Array.from({ length: diasPrevios }, () => null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ]
  while (celdas.length % 7 !== 0) celdas.push(null)
  const semanas: (number | null)[][] = []
  for (let i = 0; i < celdas.length; i += 7) {
    semanas.push(celdas.slice(i, i + 7))
  }

  return (
    <div className="ui-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="ui-title text-sm">Calendario de festivos de Colombia</h3>
          <p className="ui-muted mt-1 text-xs">
            Festivos nacionales oficiales con sus fechas de descanso (Ley Emiliani 51 de 1983 y
            cálculo por Pascua). Catálogo verificado contra el calendario oficial del MinHacienda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navegar(-1)}
            aria-label="Mes anterior"
            className="focus-ring min-h-10 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200"
          >
            ‹
          </button>
          <p aria-live="polite" className="ui-title min-w-36 text-center text-sm">
            {MESES[mes - 1]} de {ano}
          </p>
          <button
            type="button"
            onClick={() => navegar(1)}
            aria-label="Mes siguiente"
            className="focus-ring min-h-10 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200"
          >
            ›
          </button>
          <button
            type="button"
            onClick={volverAHoy}
            className="focus-ring min-h-10 cursor-pointer rounded-lg border border-emerald-600 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* Rejilla mensual: filas de 7 celdas (lunes primero, semana completa) */}
      <div
        className="mt-4 flex flex-col gap-1"
        role="grid"
        aria-label={`Calendario de ${MESES[mes - 1]} de ${ano}`}
      >
        <div role="row" className="grid grid-cols-7 gap-1 text-center">
          {DIAS_SEMANA.map((d, i) => (
            <div
              key={d}
              role="columnheader"
              className={`ui-label pb-1 text-[11px] ${i >= 5 ? 'text-gray-400 dark:text-gray-500' : ''}`}
            >
              {d}
            </div>
          ))}
        </div>

        {semanas.map((semana, s) => (
          <div key={s} role="row" className="grid grid-cols-7 gap-1">
            {semana.map((dia, i) => {
              if (dia === null) {
                return (
                  <div
                    key={`hueco-${s}-${i}`}
                    role="gridcell"
                    aria-hidden="true"
                    className="min-h-12"
                  />
                )
              }
              const fecha = celdaFecha(ano, mes, dia)
              const festivo = porFecha.get(fecha)
              const esHoy = fecha === hoy
              const finDeSemana = i >= 5
              return (
                <div
                  key={fecha}
                  role="gridcell"
                  aria-label={`${dia} de ${MESES[mes - 1]}${festivo ? `, festivo: ${festivo.nombre}` : ''}`}
                  title={festivo?.nombre}
                  className={[
                    'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1',
                    finDeSemana && !festivo
                      ? 'border-transparent bg-gray-50 dark:bg-slate-800/50'
                      : 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800/40',
                    festivo
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50'
                      : '',
                    esHoy ? 'ring-2 ring-uv-lime' : '',
                  ].join(' ')}
                >
                  <span
                    className={`text-sm ${
                      festivo
                        ? 'font-semibold text-emerald-800 dark:text-emerald-300'
                        : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {dia}
                  </span>
                  {festivo && (
                    <span className="hidden w-full truncate text-center text-[10px] font-medium leading-tight text-emerald-700 dark:text-emerald-400 sm:block">
                      {festivo.nombre}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Lista del mes: nombres completos (la rejilla los trunca en móvil) */}
      <div className="mt-4 border-t border-gray-100 pt-4 dark:border-slate-800">
        <h4 className="ui-label">
          Festivos de {MESES[mes - 1]} de {ano}
        </h4>
        {festivos.length === 0 ? (
          <div className="ui-empty mt-2">Sin festivos nacionales en este mes.</div>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-slate-800 dark:border-slate-700">
            {festivos.map((f) => (
              <li key={f.fecha} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    {f.nombre}
                  </p>
                  <p className="ui-muted text-xs">
                    {Number(f.fecha.slice(8, 10))} de {MESES[mes - 1]}
                    {f.origen === 'EMILIANI' ? ' · descanso trasladado al lunes (Ley Emiliani)' : ''}
                    {f.origen === 'PASCUA' ? ' · fecha movible según la Pascua' : ''}
                  </p>
                </div>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
