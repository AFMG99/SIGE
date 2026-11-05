'use client'

/**
 * Vista «Calendario» de la sección Edificaciones (Fase 4, slice mínimo — S11;
 * ampliada en la Fase 6 con S5/S6 y el contexto de edificación de S9).
 *
 * Tres vistas navegables —«Mes» (rejilla + lista), «Semana» (lunes→domingo
 * alrededor de un ancla) y «Agenda» (lista cronológica del mes)— más la vista
 * de año («12 meses») para elegir el año y saltar a cualquier mes de un clic
 * (S5). Los festivos nacionales de Colombia salen del catálogo determinista
 * de `models/festivos.ts` (Ley Emiliani, Pascua y la Ley 2578/2026): sin
 * requests ni API externas, cero impacto en el tiempo de respuesta del
 * despliegue serverless en Vercel. Semana de lunes a domingo.
 *
 * Con contexto de edificación (S9, selección COMPARTIDA con el panel de
 * eventos) se superponen: eventos visibles de todo el árbol (herencia S8),
 * chip de tipo de día de los rangos — MISMA regla que la GDE, el último
 * rango que cubre gana —, resumen «N días lectivos · M festivos · K eventos»
 * (solo display; no consume nadie más) y horas de uso por día en la vista
 * semanal. Sin selección el calendario sigue siendo de festivos, con una
 * pista de contexto.
 */

import { useEffect, useState } from 'react'
import {
  anclaDeSemana,
  etiquetaDeTipoEvento,
  eventosPorFecha,
  isoDeHoy,
  puntoDeTipoEvento,
  sumarDiasIso,
  type EventoAgenda,
  type ItemFechaEvento,
} from '../models/calendarioVista'
import { festivosDelMes, type Festivo } from '../models/festivos'
import { chipTipoDia, tipoDiaEnFecha } from '../models/calendario'
import { etiquetaAmbitoDeEvento, eventosVisiblesPara, type EventoInfo } from '../models/eventos'
import { codigoDiaDeFecha, formatearDias, formatearFranja, horasDeUsoEnFecha } from '../models/horarios'
import { etiquetaAmbitoDeHorario } from './ambitos'
import type {
  BloqueInfo,
  CalendarioInfo,
  EspacioInfo,
  HorarioEquipoInfo,
  RangoCalendarioUI,
} from './useCatalogoEdificaciones'
import type { EquipoExistente } from './existencias'
import { CalendarioVistaAgenda } from './CalendarioVistaAgenda'
import { CalendarioVistaAno } from './CalendarioVistaAno'
import { CalendarioVistaSemana } from './CalendarioVistaSemana'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Nombres completos por `getUTCDay()` (0 = domingo), para el detalle del día. */
const DIAS_COMPLETOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

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
  /**
   * Edificación seleccionada (S9): contexto COMPARTIDO con el panel de
   * eventos (el `useState` vive en el wrapper de `DatosContent`). Vacío =
   * solo festivos nacionales + la pista de contexto.
   */
  edificacionId?: string
  /** Configuración operativa por edificación (mapea cada rango a su edificio). */
  calendarios?: CalendarioInfo[]
  /** Rangos con tipo de día de todos los calendarios. */
  rangos?: RangoCalendarioUI[]
  /** Horarios por edificación (badge «N h» en la vista semanal). */
  horarios?: HorarioEquipoInfo[]
  /** Eventos de todas las edificaciones (la herencia S8 se aplica en cliente). */
  eventos?: EventoInfo[]
  /** Bloques/espacios/equipos: resuelven nombres en el detalle del día (6d3). */
  bloques?: BloqueInfo[]
  espacios?: EspacioInfo[]
  equipos?: EquipoExistente[]
  /**
   * «Crear ajuste desde este evento» (opcional): por cada evento del detalle
   * del día se ofrece la acción, que notifica el `EventoInfo` completo al
   * padre (`DatosContent` abre el modal de `AjustesSection` precargado). Sin
   * callback no se renderiza nada (p. ej. roles sin permiso de carga).
   */
  onCrearAjusteDesdeEvento?: (evento: EventoInfo) => void
}

export function CalendarioFestivos({
  mesInicial,
  anoInicial,
  edificacionId = '',
  calendarios = [],
  rangos = [],
  horarios = [],
  eventos = [],
  bloques = [],
  espacios = [],
  equipos = [],
  onCrearAjusteDesdeEvento,
}: CalendarioFestivosProps = {}) {
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
  /** Día expandido en la rejilla mensual (S4/6d3); null = sin detalle. */
  const [diaExpandido, setDiaExpandido] = useState<string | null>(null)

  const { mes, ano } = ref

  // El detalle pertenece a un mes/edificación concretos: al cambiar, se pliega.
  useEffect(() => {
    setDiaExpandido(null)
  }, [mes, ano, edificacionId])
  const anclaEfectiva = ancla ?? anclaDeSemana(mes, ano, hoy)
  const festivos = festivosDelMes(ano, mes)
  const porFecha = new Map<string, Festivo>(festivos.map((f) => [f.fecha, f]))

  // Rejilla: lunes primero ((getUTCDay() + 6) % 7) y días del mes vía UTC.
  const diasPrevios = (new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay() + 6) % 7
  const diasEnMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate()

  // ---------------- Contexto de edificación (S9) ----------------
  // Sin selección el calendario es exactamente el de festivos (S6).
  const conContexto = edificacionId !== ''
  const calendarioDeEdif = calendarios.find((c) => c.edificacionId === edificacionId) ?? null
  const rangosDeEdif = calendarioDeEdif
    ? rangos.filter((r) => r.calendarioId === calendarioDeEdif.id)
    : []
  const horariosDeEdif = conContexto
    ? horarios.filter((h) => h.edificacionId === edificacionId)
    : []
  // Herencia S8 a la vista del calendario: TODO el árbol de la edificación
  // (bloques, espacios y equipos), no solo el ámbito edificación.
  const eventosVisibles = conContexto
    ? eventosVisiblesPara(eventos, { edificacionId }, { incluirDescendencia: true })
    : []
  const mapaEventos: Map<string, ItemFechaEvento[]> = conContexto
    ? eventosPorFecha(eventosVisibles)
    : new Map()
  const eventosAgenda: EventoAgenda[] = conContexto
    ? eventosVisibles.map((ev) => ({ ...ev, ambito: etiquetaAmbitoDeEvento(ev) }))
    : []

  // Resumen del mes (S9): días cuyo tipo resuelto es LECTIVO + festivos +
  // eventos que tocan el mes. SOLO display: nada más consume esta derivación
  // (guardrail L8: `RegistroCli.dias_lectivos` no cambia de fuente).
  let diasLectivosMes = 0
  if (conContexto) {
    for (let d = 1; d <= diasEnMes; d++) {
      if (tipoDiaEnFecha(rangosDeEdif, celdaFecha(ano, mes, d)) === 'LECTIVO') {
        diasLectivosMes++
      }
    }
  }
  const primerDiaMes = `${ano}-${pad(mes)}-01`
  const ultimoDiaMes = `${ano}-${pad(mes)}-${pad(diasEnMes)}`
  const eventosDelMes = eventosVisibles.filter((ev) => {
    const fin = ev.fechaFin && ev.fechaFin > ev.fechaInicio ? ev.fechaFin : ev.fechaInicio
    return ev.fechaInicio <= ultimoDiaMes && fin >= primerDiaMes
  })
  const plural = (n: number, uno: string, muchos: string) => `${n} ${n === 1 ? uno : muchos}`

  // ---------------- Detalle del día clicado (S4/6d3) ----------------
  // Vigencia inclusiva: el horario cuenta para la fecha si su rango la cubre.
  const vigenteEnFecha = (h: HorarioEquipoInfo, fecha: string): boolean =>
    (!h.desde || h.desde <= fecha) && (!h.hasta || h.hasta >= fecha)
  const codigoDeLaFecha = diaExpandido ? codigoDiaDeFecha(diaExpandido) : null
  const horariosDeLaFecha =
    diaExpandido && codigoDeLaFecha
      ? horariosDeEdif.filter(
          (h) => vigenteEnFecha(h, diaExpandido) && h.diasSemana.includes(codigoDeLaFecha)
        )
      : []
  const horasUsoDeLaFecha = diaExpandido
    ? horasDeUsoEnFecha(
        horariosDeEdif.filter((h) => vigenteEnFecha(h, diaExpandido)),
        diaExpandido
      )
    : 0
  const fechaLargaDe = (iso: string): string => {
    const [a, m, d] = iso.split('-')
    return `${DIAS_COMPLETOS[new Date(`${iso}T00:00:00Z`).getUTCDay()]}, ${Number(d)} de ${
      MESES[Number(m) - 1]
    } de ${a}`
  }

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

      {/* Pista de contexto (S9): sin edificación el calendario es festivos-only */}
      {!conContexto && (
        <div className="ui-callout ui-callout-info mt-3" role="status">
          Selecciona una edificación para ver eventos, tipo de día y horas de uso.
        </div>
      )}

      {/* Resumen del mes (S9, solo display): lectivos de los rangos + festivos + eventos */}
      {conContexto && (
        <p className="ui-muted mt-3 text-xs">
          {plural(diasLectivosMes, 'día lectivo', 'días lectivos')} ·{' '}
          {plural(festivos.length, 'festivo', 'festivos')} ·{' '}
          {plural(eventosDelMes.length, 'evento', 'eventos')}
        </p>
      )}

      {/* Vista de año (S5): 12 tarjetas con mini-rejilla de puntos y salto al mes */}
      {vista === 'ano' && (
        <CalendarioVistaAno
          ano={ano}
          mesSeleccionado={mes}
          hoy={hoy}
          onElegirMes={elegirMes}
        />
      )}

      {/* Vista semanal (S6): lunes→domingo alrededor del ancla (+ contexto S9) */}
      {vista === 'semana' && (
        <CalendarioVistaSemana
          ancla={anclaEfectiva}
          hoy={hoy}
          onNavegarSemana={navegarSemana}
          rangos={rangosDeEdif}
          horarios={horariosDeEdif}
          eventosPorFecha={mapaEventos}
        />
      )}

      {/* Vista de agenda (S6): lista cronológica del mes (+ eventos S9) */}
      {vista === 'agenda' && (
        <CalendarioVistaAgenda ano={ano} mes={mes} hoy={hoy} eventos={eventosAgenda} />
      )}

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
                  // S9: tipo de día de los rangos (chip/subrayado) y eventos (dots).
                  const tipoDia = conContexto ? tipoDiaEnFecha(rangosDeEdif, fecha) : null
                  const chip = tipoDia ? chipTipoDia(tipoDia) : null
                  const eventosDelDia = conContexto ? (mapaEventos.get(fecha) ?? []) : []
                  // Nombre accesible completo: festivo, tipo de día y cantidad de eventos.
                  const etiquetas = [`${dia} de ${MESES[mes - 1]}`]
                  if (festivo) etiquetas.push(`festivo: ${festivo.nombre}`)
                  if (chip) etiquetas.push(`día ${chip.etiqueta.toLowerCase()}`)
                  if (eventosDelDia.length > 0) {
                    etiquetas.push(
                      `${eventosDelDia.length} ${eventosDelDia.length === 1 ? 'evento' : 'eventos'}`
                    )
                  }
                  const titulos = [festivo?.nombre, ...eventosDelDia.map((e) => e.nombre)]
                    .filter((t): t is string => Boolean(t))
                    .join(' · ')
                  const abierto = diaExpandido === fecha
                  return (
                    <div
                      key={fecha}
                      role="gridcell"
                      aria-current={esHoy ? 'date' : undefined}
                      aria-label={etiquetas.join(', ')}
                      aria-expanded={abierto}
                      aria-controls="detalle-dia"
                      title={titulos || undefined}
                      onClick={() => setDiaExpandido(abierto ? null : fecha)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setDiaExpandido(abierto ? null : fecha)
                        }
                      }}
                      tabIndex={0}
                      className={[
                        'flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1',
                        'focus-ring',
                        finDeSemana && !festivo
                          ? 'border-transparent bg-gray-50 dark:bg-slate-800/50'
                          : 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800/40',
                        festivo
                          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50'
                          : '',
                        esHoy ? 'ring-2 ring-uv-lime' : '',
                        abierto ? 'outline-2 outline-emerald-600' : '',
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
                      {/* Subrayado del tipo de día (decorativo; el tipo también va en aria-label) */}
                      {chip && (
                        <span
                          className={`h-1 w-5 shrink-0 rounded-full ${chip.punto}`}
                          aria-hidden="true"
                        />
                      )}
                      {/* Puntos de los eventos: máximo 3 (el resto en title/aria-label) */}
                      {eventosDelDia.length > 0 && (
                        <span
                          className="flex shrink-0 items-center justify-center gap-0.5"
                          aria-hidden="true"
                        >
                          {eventosDelDia.slice(0, 3).map((ev) => (
                            <span
                              key={ev.id}
                              className={`h-1.5 w-1.5 rounded-full ${puntoDeTipoEvento(ev.tipo)}`}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Detalle del día (S4/6d3): tipo, festivo, eventos, horarios
              vigentes y horas de uso de la fecha clicada. Se pliega al clicar
              otra vez, cambiar de mes o de edificación. */}
          {diaExpandido && (
            <section
              id="detalle-dia"
              aria-label={`Detalle del ${fechaLargaDe(diaExpandido)}`}
              className="ui-card mt-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="ui-title text-sm">{fechaLargaDe(diaExpandido)}</h4>
                  <p className="ui-muted mt-1 text-xs">
                    {conContexto
                      ? 'Tipo de día, festivo, eventos y horarios vigentes de esta fecha.'
                      : 'Sin edificación seleccionada solo se resuelven los festivos nacionales.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDiaExpandido(null)}
                  aria-label="Cerrar detalle del día"
                  className="ui-btn ui-btn-ghost ui-btn-sm focus-ring"
                >
                  Cerrar
                </button>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="ui-label">Tipo de día</dt>
                  <dd className="mt-1 text-sm">
                    {conContexto ? (
                      (() => {
                        const tipo = tipoDiaEnFecha(rangosDeEdif, diaExpandido)
                        const c = tipo ? chipTipoDia(tipo) : null
                        return c ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className={`h-2 w-2 rounded-full ${c.punto}`}
                            />
                            {c.etiqueta}
                          </span>
                        ) : (
                          <span className="ui-muted">Sin rangos para esta fecha</span>
                        )
                      })()
                    ) : (
                      <span className="ui-muted">Requiere edificación seleccionada</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="ui-label">Festivo nacional</dt>
                  <dd className="mt-1 text-sm">
                    {porFecha.get(diaExpandido) ? (
                      <span className="text-emerald-800 dark:text-emerald-300">
                        {porFecha.get(diaExpandido)!.nombre}
                      </span>
                    ) : (
                      <span className="ui-muted">No aplica</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="ui-label">Horas de uso (Xe)</dt>
                  <dd className="mt-1 text-sm">
                    {conContexto ? `${horasUsoDeLaFecha} h` : <span className="ui-muted">—</span>}
                  </dd>
                </div>
                <div>
                  <dt className="ui-label">Horarios vigentes</dt>
                  <dd className="mt-1 text-sm">
                    {!conContexto || horariosDeLaFecha.length === 0 ? (
                      <span className="ui-muted">
                        {conContexto ? 'Ninguno este día' : 'Requiere edificación seleccionada'}
                      </span>
                    ) : (
                      <ul className="space-y-1">
                        {horariosDeLaFecha.map((h) => (
                          <li key={h.id}>
                            {h.nombre}{' '}
                            <span className="ui-muted text-xs">
                              ({etiquetaAmbitoDeHorario(h, bloques, espacios, equipos)} ·{' '}
                              {formatearDias(h.diasSemana)} ·{' '}
                              {formatearFranja(h.horaInicio, h.horaFin)})
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="ui-label">Eventos del día</dt>
                  <dd className="mt-1 text-sm">
                    {(() => {
                      const delDia = conContexto ? (mapaEventos.get(diaExpandido) ?? []) : []
                      if (delDia.length === 0) {
                        return (
                          <span className="ui-muted">
                            {conContexto ? 'Sin eventos' : 'Requiere edificación seleccionada'}
                          </span>
                        )
                      }
                      return (
                        <ul className="space-y-1">
                          {delDia.map((ev) => (
                            <li key={ev.id} className="flex flex-wrap items-center gap-1.5">
                              <span
                                aria-hidden="true"
                                className={`h-2 w-2 shrink-0 rounded-full ${puntoDeTipoEvento(ev.tipo)}`}
                              />
                              {ev.nombre}
                              <span className="ui-muted text-xs">
                                ({etiquetaDeTipoEvento(ev.tipo)})
                              </span>
                              {/* Acción hacia el pre-fill del modal de Ajustes:
                                  se resuelve el `EventoInfo` completo (con
                                  bloque/edificación) por id del item del día. */}
                              {onCrearAjusteDesdeEvento &&
                                (() => {
                                  const completo = eventosVisibles.find((e) => e.id === ev.id)
                                  if (!completo) return null
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => onCrearAjusteDesdeEvento(completo)}
                                      aria-label={`Crear ajuste desde ${ev.nombre}`}
                                      className="focus-ring ml-auto min-h-10 rounded px-2 text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 lg:min-h-0"
                                    >
                                      Crear ajuste
                                    </button>
                                  )
                                })()}
                            </li>
                          ))}
                        </ul>
                      )
                    })()}
                  </dd>
                </div>
              </dl>
            </section>
          )}

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
