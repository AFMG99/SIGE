'use client'

/**
 * Vista «Agenda» del calendario (S6, Fase 6; ampliada en S9 con los eventos
 * del árbol de la edificación seleccionada).
 *
 * Lista cronológica del mes referido: una fila por día con contenido, con la
 * fecha corta, el título, el detalle y el badge de origen. La agenda se
 * alimenta de `itemsDeAgenda`: festivos nacionales del catálogo puro + los
 * eventos visibles (S9, herencia S8 ya aplicada por el llamador), expandidos
 * sobre cada día de su rango; un mismo día agrupa festivo y eventos. Las
 * filas de evento muestran el punto de color de su tipo, la descripción como
 * detalle y el badge de ámbito (nivel + objetivo). Cálculo en cliente, sin
 * requests.
 */

import {
  itemsDeAgenda,
  type EventoAgenda,
  type ItemAgenda,
} from '../models/calendarioVista'

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const MES_CORTO = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

/** Día de la semana civil (0=domingo) de una fecha ISO, vía UTC. */
const diaDeLaSemana = (iso: string): number =>
  new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))).getUTCDay()

const PUNTO_TIPO = 'inline-block h-2.5 w-2.5 shrink-0 rounded-full'

const BADGE_AMBITO =
  'inline-flex max-w-full shrink-0 items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300'

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
  /** Eventos visibles del contexto (S9); vacío = solo festivos. */
  eventos?: EventoAgenda[]
}

export function CalendarioVistaAgenda({
  ano,
  mes,
  hoy,
  eventos = [],
}: CalendarioVistaAgendaProps) {
  const items = itemsDeAgenda(ano, mes, eventos)

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
                  {dia.items.map((item, idx) => (
                    <div
                      key={`${item.tipo}-${item.titulo}-${idx}`}
                      className="flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p
                          className={[
                            'flex items-center gap-1.5 text-sm font-medium',
                            item.tipo === 'EVENTO'
                              ? 'text-gray-800 dark:text-gray-100'
                              : 'text-emerald-800 dark:text-emerald-300',
                          ].join(' ')}
                        >
                          {item.tipo === 'EVENTO' && (
                            <span
                              className={`${PUNTO_TIPO} ${item.punto ?? 'bg-uv-mid'}`}
                              role="img"
                              aria-label={`Tipo ${item.etiquetaTipo ?? 'evento'}`}
                            />
                          )}
                          <span className="min-w-0 break-words">{item.titulo}</span>
                        </p>
                        {item.detalle && <p className="ui-muted text-xs">{item.detalle}</p>}
                      </div>
                      {item.origen && (
                        <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {item.origen}
                        </span>
                      )}
                      {item.ambito && (
                        <span className={BADGE_AMBITO}>{item.ambito}</span>
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
