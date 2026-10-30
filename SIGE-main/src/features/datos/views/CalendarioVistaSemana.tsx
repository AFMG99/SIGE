'use client'

/**
 * Vista «Semana» del calendario (S6, Fase 6; ampliada en S9 con el contexto
 * de edificación: eventos, chip de tipo de día y horas de uso).
 *
 * La semana (lunes→domingo) que contiene una fecha ancla, con los festivos
 * del catálogo puro de `models/festivos.ts`, estilo de fin de semana y
 * resalte de hoy. Con contexto (props opcionales de S9) cada columna añade
 * los nombres de los eventos visibles (truncados con `truncate`), el chip
 * del tipo de día resuelto de los rangos — MISMA regla que la GDE: el
 * último rango que cubre la fecha gana — y el badge «N h» de horas de uso
 * de los horarios vigentes. Las 7 columnas se apilan por debajo de `lg`
 * (sin desborde horizontal a 320px). Cálculo en cliente, sin requests.
 */

import { festivosDelAno, type Festivo } from '../models/festivos'
import {
  fechasDeLaSemana,
  puntoDeTipoEvento,
  type ItemFechaEvento,
} from '../models/calendarioVista'
import { chipTipoDia, tipoDiaEnFecha, type RangoFechas } from '../models/calendario'
import { horasDeUsoEnFecha, type HorarioHorasUso } from '../models/horarios'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Etiqueta larga «12 de octubre» para el rango de la semana. */
const largo = (iso: string): string =>
  `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`

const BADGE =
  'inline-flex max-w-full items-center rounded-full border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300'

interface CalendarioVistaSemanaProps {
  /** Fecha ancla `YYYY-MM-DD` (la semana mostrada la contiene). */
  ancla: string
  /** Fecha de hoy `YYYY-MM-DD`; resalta la columna del día. */
  hoy: string
  /** Mueve el ancla ±`deltaDias` (±7 = semana anterior/siguiente). */
  onNavegarSemana: (deltaDias: number) => void
  /** Rangos de la edificación (chip de tipo de día; S9). */
  rangos?: RangoFechas[]
  /** Horarios de la edificación (badge «N h»; S9). */
  horarios?: HorarioHorasUso[]
  /** Eventos visibles agrupados por fecha (S9; `eventosPorFecha` del modelo). */
  eventosPorFecha?: Map<string, ItemFechaEvento[]>
}

export function CalendarioVistaSemana({
  ancla,
  hoy,
  onNavegarSemana,
  rangos = [],
  horarios = [],
  eventosPorFecha,
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
          // S9: contexto de edificación → eventos, tipo de día y horas de uso.
          const eventosDelDia = eventosPorFecha?.get(fecha) ?? []
          const tipoDia = tipoDiaEnFecha(rangos, fecha)
          const chip = tipoDia ? chipTipoDia(tipoDia) : null
          const horas = horarios.length > 0 ? horasDeUsoEnFecha(horarios, fecha) : null
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
              {eventosDelDia.length > 0 && (
                <ul className="min-w-0 space-y-0.5">
                  {eventosDelDia.slice(0, 4).map((ev) => (
                    <li key={ev.id} className="flex items-center gap-1">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${puntoDeTipoEvento(ev.tipo)}`}
                        aria-hidden="true"
                      />
                      <span
                        className="truncate text-[10px] font-medium text-gray-700 dark:text-gray-300"
                        title={ev.nombre}
                      >
                        {ev.nombre}
                      </span>
                    </li>
                  ))}
                  {eventosDelDia.length > 4 && (
                    <li className="ui-muted text-[10px]">+{eventosDelDia.length - 4} más</li>
                  )}
                </ul>
              )}
              {(chip || horas !== null) && (
                <div className="mt-auto flex flex-wrap items-center gap-1">
                  {chip && (
                    <span
                      className={BADGE}
                      title={`Tipo de día: ${chip.etiqueta}`}
                    >
                      <span
                        className={`mr-1 h-1.5 w-1.5 shrink-0 rounded-full ${chip.punto}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{chip.etiqueta}</span>
                    </span>
                  )}
                  {horas !== null && (
                    <span
                      aria-label={`${horas} horas de uso`}
                      className="inline-flex shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    >
                      {horas} h
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
