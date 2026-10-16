'use client'

/**
 * Vista «Semana» del calendario (S6, Fase 6).
 *
 * La semana (lunes→domingo) que contiene una fecha ancla, con los festivos
 * del catálogo puro de `models/festivos.ts`, estilo de fin de semana y
 * resalte de hoy. Las 7 columnas se apilan por debajo de `lg` (sin
 * desborde horizontal a 320px). Cálculo en cliente, sin requests.
 */

import { festivosDelAno, type Festivo } from '../models/festivos'
import { fechasDeLaSemana } from '../models/calendarioVista'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Etiqueta larga «12 de octubre» para el rango de la semana. */
const largo = (iso: string): string =>
  `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`

interface CalendarioVistaSemanaProps {
  /** Fecha ancla `YYYY-MM-DD` (la semana mostrada la contiene). */
  ancla: string
  /** Fecha de hoy `YYYY-MM-DD`; resalta la columna del día. */
  hoy: string
  /** Mueve el ancla ±`deltaDias` (±7 = semana anterior/siguiente). */
  onNavegarSemana: (deltaDias: number) => void
}

export function CalendarioVistaSemana({
  ancla,
  hoy,
  onNavegarSemana,
}: CalendarioVistaSemanaProps) {
  const fechas = fechasDeLaSemana(ancla)

  // Festivos de los años tocados por la semana (una consulta por año).
  const porFecha = new Map<string, Festivo>()
  fechas.forEach((fecha) => {
    festivosDelAno(Number(fecha.slice(0, 4))).forEach((f) => porFecha.set(f.fecha, f))
  })

  const mismoAno = fechas[0].slice(0, 4) === fechas[6].slice(0, 4)
  const rango = mismoAno
    ? `Del ${largo(fechas[0])} al ${largo(fechas[6])} de ${fechas[0].slice(0, 4)}`
    : `Del ${largo(fechas[0])} de ${fechas[0].slice(0, 4)} al ${largo(fechas[6])} de ${fechas[6].slice(0, 4)}`

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onNavegarSemana(-7)}
          className="focus-ring min-h-10 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200"
        >
          ‹ Semana
        </button>
        <p aria-live="polite" className="ui-muted text-xs">
          {rango}
        </p>
        <button
          type="button"
          onClick={() => onNavegarSemana(7)}
          className="focus-ring min-h-10 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200"
        >
          Semana ›
        </button>
      </div>

      {/* 7 columnas en `lg`; apiladas (una por fila) por debajo, sin desborde */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {fechas.map((fecha, i) => {
          const dia = Number(fecha.slice(8, 10))
          const festivo = porFecha.get(fecha)
          const esHoy = fecha === hoy
          const finDeSemana = i >= 5
          // Mutuamente excluyente: nunca conviven clases de borde/fondo en conflicto.
          const superficie = festivo
            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50'
            : finDeSemana
              ? 'border-transparent bg-gray-50 dark:bg-slate-800/50'
              : 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800/40'
          return (
            <div
              key={fecha}
              aria-current={esHoy ? 'date' : undefined}
              className={[
                'flex min-h-28 flex-col gap-1 rounded-lg border p-2',
                superficie,
                esHoy ? 'ring-2 ring-uv-lime' : '',
              ].join(' ')}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span className="ui-label text-[11px]">{DIAS_SEMANA[i]}</span>
                <span
                  className={`text-sm ${
                    festivo
                      ? 'font-semibold text-emerald-800 dark:text-emerald-300'
                      : 'font-semibold text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {dia}
                </span>
              </div>
              <time dateTime={fecha} className="ui-muted block text-[10px]">
                {fecha}
              </time>
              {festivo && (
                <div className="mt-auto min-w-0">
                  <p
                    className="truncate text-xs font-medium text-emerald-800 dark:text-emerald-300"
                    title={festivo.nombre}
                  >
                    {festivo.nombre}
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {festivo.origen}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
