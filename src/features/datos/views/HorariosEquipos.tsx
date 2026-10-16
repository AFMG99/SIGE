'use client'

/**
 * Trazabilidad de horarios en «Equipos Eléctricos» (S3): por cada equipo del
 * inventario muestra (1) los horarios que le aplican — declarando el nivel de
 * cada uno (equipo / espacio / bloque / edificación) con su franja, días y
 * vigencia, sin filtrar por vigencia porque la sección es de trazabilidad — y
 * (2) las horas de uso derivadas «esta semana»: unión de franjas por día,
 * calculada solo con los horarios vigentes durante la semana en curso
 * (`resumenHorasUsoDeSemana` → `horasDeUsoEnFecha`).
 *
 * La captura de horarios NO vive aquí: sigue en el drawer «Calendario
 * operativo» (sección Edificaciones). Todo dato entra por props y el cálculo
 * es puro (sin fetch ni server actions en render).
 */

import {
  CATALOGO_DIAS,
  formatearDias,
  formatearFranja,
  formatearVigenciaCorta,
  horariosAplicablesAEquipo,
  resumenHorasUsoDeSemana,
  type CodigoAmbito,
} from '../models/horarios'
import type { HorarioEquipoInfo } from './useCatalogoEdificaciones'
import type { EquipoExistente } from './existencias'

type HorariosEquiposProps = {
  /** Filas del inventario con su contexto (edificación / bloque / espacio). */
  equipos: EquipoExistente[]
  /** Horarios guardados (todas las edificaciones; el matching es por ids exactos). */
  horarios: HorarioEquipoInfo[]
}

const NIVEL_ETIQUETA: Record<CodigoAmbito, string> = {
  EQUIPO: 'Equipo',
  ESPACIO: 'Espacio',
  BLOQUE: 'Bloque',
  EDIFICACION: 'Edificación',
}

/**
 * Nombre del objetivo de un horario aplicable: la coincidencia es por id
 * exacto del nivel, así que los ids del horario SON los del equipo y su
 * nombre ya viene resuelto en la fila del inventario (sin lookups de catálogo).
 */
const nombreObjetivo = (nivel: CodigoAmbito, equipo: EquipoExistente): string => {
  if (nivel === 'EQUIPO') return `${equipo.tipo} · ${equipo.espacio}`
  if (nivel === 'ESPACIO') return equipo.espacio
  if (nivel === 'BLOQUE') return `${equipo.bloqueCodigo} — ${equipo.bloqueNombre}`
  return equipo.edificacion
}

const fmtHoras = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })

const abrevDia = (codigo: string): string =>
  CATALOGO_DIAS.find((d) => d.codigo === codigo)?.abrev ?? codigo

const BADGE_NIVEL =
  'inline-flex max-w-full items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300'

const CHIP_DIA =
  'inline-flex items-baseline gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900'

export function HorariosEquipos({ equipos, horarios }: HorariosEquiposProps) {
  if (equipos.length === 0) return null

  return (
    <section aria-labelledby="horarios-equipos-titulo" className="space-y-4">
      <div>
        <h3 id="horarios-equipos-titulo" className="ui-title text-sm">
          Horarios aplicables y horas de uso
        </h3>
        <p className="ui-muted text-xs">
          Por equipo, con el nivel de cada horario (equipo, espacio, bloque o edificación) y las
          horas de uso de los horarios vigentes durante la semana en curso.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {equipos.map((equipo) => {
          const contexto = {
            edificacionId: equipo.edificacionId,
            bloqueId: equipo.bloqueId,
            espacioId: equipo.espacioId,
            equipoId: equipo.id,
          }
          const aplicables = horariosAplicablesAEquipo(horarios, contexto)
          const resumen = resumenHorasUsoDeSemana(aplicables.map((a) => a.horario))

          return (
            <article key={equipo.id} className="ui-card space-y-3 p-4">
              <header className="space-y-0.5">
                <h4 className="ui-title text-sm">{equipo.tipo}</h4>
                <p className="ui-muted break-words text-xs">
                  {equipo.edificacion} · {equipo.bloqueCodigo} — {equipo.bloqueNombre} ·{' '}
                  {equipo.espacio}
                </p>
              </header>

              {aplicables.length === 0 ? (
                <div className="ui-empty">
                  <p className="ui-title text-sm">Este equipo aún no tiene horarios asociados.</p>
                  <p className="max-w-md text-xs">
                    Créelos en «Calendario operativo» (sección Edificaciones) y asócielos a este
                    equipo, su espacio, su bloque o su edificación.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="ui-label text-xs">Horas de uso · esta semana</p>
                      <p className="text-xs">
                        <span className="font-semibold text-gray-800 dark:text-gray-100">
                          Total semanal {fmtHoras.format(resumen.total)} h
                        </span>{' '}
                        <span className="ui-muted">(esta semana)</span>
                      </p>
                    </div>
                    <ul className="flex flex-wrap gap-1.5">
                      {resumen.dias.map((d) => (
                        <li
                          key={d.codigo}
                          className={`${CHIP_DIA} tabular-nums ${d.horas > 0 ? '' : 'opacity-60'}`}
                        >
                          {`${abrevDia(d.codigo)} ${fmtHoras.format(d.horas)} h`}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="ui-label text-xs">Horarios aplicables ({aplicables.length})</p>
                    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-slate-800 dark:border-slate-700">
                      {aplicables.map(({ horario, nivel }) => (
                        <li key={horario.id} className="space-y-1 px-3 py-2">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span data-nivel={nivel} className={BADGE_NIVEL}>
                              {NIVEL_ETIQUETA[nivel]} · {nombreObjetivo(nivel, equipo)}
                            </span>
                            <span className="break-words text-sm font-medium text-gray-800 dark:text-gray-100">
                              {horario.nombre}
                            </span>
                          </p>
                          <p className="ui-muted break-words text-xs">
                            {formatearDias(horario.diasSemana)} ·{' '}
                            {formatearFranja(horario.horaInicio, horario.horaFin)} ·{' '}
                            {formatearVigenciaCorta(horario.desde ?? null, horario.hasta ?? null)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
