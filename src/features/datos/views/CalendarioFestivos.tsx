'use client'

/**
 * Vista «Calendario» de la sección Edificaciones (Fase 4, slice mínimo — S11;
 * ampliada en la Fase 6 con S5/S6).
 *
 * Tres vistas navegables —«Mes» (rejilla + lista), «Semana» (lunes→domingo
 * alrededor de un ancla) y «Agenda» (lista cronológica del mes)— más la vista
 * de año («12 meses») para elegir el año y saltar a cualquier mes de un clic
 * (S5). Los festivos nacionales de Colombia salen del catálogo determinista
 * de `models/festivos.ts` (Ley Emiliani, Pascua y la Ley 2578/2026): sin
 * requests ni API externas, cero impacto en el tiempo de respuesta del
 * despliegue serverless en Vercel. Semana de lunes a domingo.
 */

import { useState } from 'react'
import { anclaDeSemana, isoDeHoy, sumarDiasIso } from '../models/calendarioVista'
import { festivosDelMes, type Festivo } from '../models/festivos'
import { CalendarioVistaAgenda } from './CalendarioVistaAgenda'
import { CalendarioVistaAno } from './CalendarioVistaAno'
import { CalendarioVistaSemana } from './CalendarioVistaSemana'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const pad = (n: number): string => String(n).padStart(2, '0')

const celdaFecha = (ano: number, mes: number, dia: number): string =>
  `${ano}-${pad(mes)}-${pad(dia)}`

/** Las tres vistas (S6) más la vista de año (S5), que sale de «Mes». */
type Vista = 'mes' | 'semana' | 'agenda' | 'ano'

const VISTAS: { id: Exclude<Vista, 'ano'>; etiqueta: string }[] = [
  { id: 'mes', etiqueta: 'Mes' },
  { id: 'semana', etiqueta: 'Semana' },
  { id: 'agenda', etiqueta: 'Agenda' },
]

interface CalendarioFestivosProps {
  /** Mes de arranque (1-12); por defecto, el mes actual. */
  mesInicial?: number
  /** Año de arranque; por defecto, el año actual. */
  anoInicial?: number
}

export function CalendarioFestivos({ mesInicial, anoInicial }: CalendarioFestivosProps = {}) {
  const [ref, setRef] = useState(() => {
    const d = new Date()
    return {
      mes: mesInicial ?? d.getMonth() + 1,
      ano: anoInicial ?? d.getFullYear(),
    }
  })
  const [hoy] = useState(isoDeHoy)
  const [vista, setVista] = useState<Vista>('mes')
  /** Ancla de la vista semanal: null = derivada del mes referido (hoy o día 1). */
  const [ancla, setAncla] = useState<string | null>(null)

  const { mes, ano } = ref
  const anclaEfectiva = ancla ?? anclaDeSemana(mes, ano, hoy)
  const festivos = festivosDelMes(ano, mes)
  const porFecha = new Map<string, Festivo>(festivos.map((f) => [f.fecha, f]))

  // Rejilla: lunes primero ((getUTCDay() + 6) % 7) y días del mes vía UTC.
  const diasPrevios = (new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay() + 6) % 7
  const diasEnMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate()

  // Navegación de mes/año: mantiene la vista actual y ancla la semana al
  // nuevo mes referido (S6: la coherencia vale en las tres vistas).
  const navegarMes = (delta: number) => {
    setRef((r) => {
      const idx = r.mes - 1 + delta
      return {
        mes: ((idx % 12) + 12) % 12 + 1,
        ano: r.ano + Math.floor(idx / 12),
      }
    })
    setAncla(null)
  }

  const navegarAno = (delta: number) => {
    setRef((r) => ({ ...r, ano: r.ano + delta }))
    setAncla(null)
  }

  /** «Hoy»: mes/año actuales y, si se estaba en la vista de año, «Mes». */
  const volverAHoy = () => {
    const d = new Date()
    setRef({ mes: d.getMonth() + 1, ano: d.getFullYear() })
    setAncla(null)
    setVista((v) => (v === 'ano' ? 'mes' : v))
  }

  /** Tarjeta de la vista de año: salta a ese mes en la vista mensual. */
  const elegirMes = (mesElegido: number) => {
    setRef({ mes: mesElegido, ano })
    setAncla(null)
    setVista('mes')
  }

  /** ±7 días desde el ancla; si la semana cruza de mes, el referido la sigue. */
  const navegarSemana = (deltaDias: number) => {
    const nueva = sumarDiasIso(anclaEfectiva, deltaDias)
    setAncla(nueva)
    setRef({ mes: Number(nueva.slice(5, 7)), ano: Number(nueva.slice(0, 4)) })
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => navegarMes(-1)}
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
            onClick={() => navegarMes(1)}
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

      {/* Fila de año (S5): cambiar de año sin caminar mes a mes + selector de vista */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navegarAno(-1)}
            aria-label="Año anterior"
            className="focus-ring min-h-10 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200"
          >
            ‹
          </button>
          <p aria-live="polite" className="ui-title min-w-16 text-center text-sm">
            {ano}
          </p>
          <button
            type="button"
            onClick={() => navegarAno(1)}
            aria-label="Año siguiente"
            className="focus-ring min-h-10 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setVista((v) => (v === 'ano' ? 'mes' : 'ano'))}
            aria-pressed={vista === 'ano'}
            aria-label={vista === 'ano' ? 'Ver el mes' : 'Ver los 12 meses'}
            className={`focus-ring min-h-10 cursor-pointer rounded-lg px-3 text-sm font-medium ${
              vista === 'ano'
                ? 'bg-emerald-600 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200'
            }`}
          >
            {vista === 'ano' ? 'Mes' : '12 meses'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Vista del calendario">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={vista === v.id}
              onClick={() => setVista(v.id)}
              className={`focus-ring min-h-10 cursor-pointer rounded-lg px-3 text-sm font-medium ${
                vista === v.id
                  ? 'bg-emerald-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200'
              }`}
            >
              {v.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {/* Vista de año (S5): 12 tarjetas con mini-rejilla de puntos y salto al mes */}
      {vista === 'ano' && (
        <CalendarioVistaAno
          ano={ano}
          mesSeleccionado={mes}
          hoy={hoy}
          onElegirMes={elegirMes}
        />
      )}

      {/* Vista semanal (S6): lunes→domingo alrededor del ancla */}
      {vista === 'semana' && (
        <CalendarioVistaSemana
          ancla={anclaEfectiva}
          hoy={hoy}
          onNavegarSemana={navegarSemana}
        />
      )}

      {/* Vista de agenda (S6): lista cronológica del mes referido */}
      {vista === 'agenda' && <CalendarioVistaAgenda ano={ano} mes={mes} hoy={hoy} />}

      {/* Rejilla mensual: filas de 7 celdas (lunes primero, semana completa) */}
      {vista === 'mes' && (
        <>
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
                      aria-current={esHoy ? 'date' : undefined}
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
        </>
      )}
    </div>
  )
}
