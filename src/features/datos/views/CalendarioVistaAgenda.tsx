'use client'

/**
 * Vista «Agenda» del calendario (S6, Fase 6).
 *
 * Lista cronológica del mes referido: una fila por día con contenido, con la
 * fecha corta, el título, el detalle y el badge de origen. Hoy la agenda se
 * alimenta de `itemsDeAgenda` (festivos nacionales del catálogo puro); los
 * eventos institucionales/académicos/mantenimiento (T7) y los días lectivos
 * (T8) se añadirán al mismo modelo de items sin tocar el agrupado por día.
 * Cálculo en cliente, sin requests.
 */

import { itemsDeAgenda, type ItemAgenda } from '../models/calendarioVista'

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const MES_CORTO = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

/** Día de la semana civil (0=domingo) de una fecha ISO, vía UTC. */
const diaDeLaSemana = (iso: string): number =>
  new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))).getUTCDay()

interface DiaAgenda {
  fecha: string
  items: ItemAgenda[]
}

interface CalendarioVistaAgendaProps {
  /** Año del mes referido. */
  ano: number
  /** Mes del referido (1-12). */
  mes: number
  /** Fecha de hoy `YYYY-MM-DD`; resalta su fila si cae en el mes referido. */
  hoy: string
}

export function CalendarioVistaAgenda({ ano, mes, hoy }: CalendarioVistaAgendaProps) {
  const items = itemsDeAgenda(ano, mes)

  // Agrupado por día conservando el orden cronológico de los items.
  const dias: DiaAgenda[] = []
  const indice = new Map<string, number>()
  items.forEach((item) => {
    const i = indice.get(item.fecha)
    if (i === undefined) {
      indice.set(item.fecha, dias.length)
      dias.push({ fecha: item.fecha, items: [item] })
    } else {
      dias[i].items.push(item)
    }
  })

  const MES_LARGO = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]

  return (
    <div className="mt-4 space-y-4">
      <h4 className="ui-label">
        Agenda de {MES_LARGO[mes - 1]} de {ano}
      </h4>
      {dias.length === 0 ? (
        <div className="ui-empty">Sin eventos en este mes.</div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-slate-800 dark:border-slate-700">
          {dias.map((dia) => {
            const esHoy = dia.fecha === hoy
            return (
              <li
                key={dia.fecha}
                className={[
                  'flex flex-wrap items-start gap-3 px-3 py-2',
                  esHoy ? 'bg-emerald-50 ring-1 ring-inset ring-uv-lime dark:bg-emerald-950/40' : '',
                ].join(' ')}
              >
                <div className="w-16 shrink-0">
                  <time
                    dateTime={dia.fecha}
                    className="block text-xs font-semibold text-gray-800 dark:text-gray-100"
                  >
                    {Number(dia.fecha.slice(8, 10))} {MES_CORTO[Number(dia.fecha.slice(5, 7)) - 1]}
                  </time>
                  <span className="ui-muted block text-[10px]">
                    {DIAS_CORTOS[diaDeLaSemana(dia.fecha)]}
                    {esHoy ? ' · hoy' : ''}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  {dia.items.map((item) => (
                    <div key={item.titulo} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-emerald-800 dark:text-emerald-300">
                          {item.titulo}
                        </p>
                        {item.detalle && <p className="ui-muted text-xs">{item.detalle}</p>}
                      </div>
                      {item.origen && (
                        <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {item.origen}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
