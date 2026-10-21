'use client'

/**
 * Sección «Cálculo de uso» (spec §5/§6, T5) dentro del módulo Datos.
 *
 * Tres bloques props-driven (DV-1: sección cliente, no sub-ruta; el guard
 * `requireModuleAccess('consumption')` ya cubre la página y DatosContent solo
 * la monta con `puedeCargar`):
 *
 * 1. Selectores: edificación (ListboxSelect) + periodo individual + intervalo
 *    de vista previa (spec §6.1).
 * 2. Cálculo individual (`calcularUsoIndividual`): detalle por equipo, desglose
 *    por fecha, consolidaciones display-only (D2), advertencias (BR5: el equipo
 *    sin horario NUNCA es fila en ceros) y trazabilidad del horario ganador.
 * 3. Vista previa del intervalo (`prepararCalculoMasivo`, solo lectura, AC4):
 *    contadores + tabla con la clasificación BR4 en español (AC5).
 *
 * El loop de ejecución masiva y el recálculo explícito llegan en T6/T7; la
 * columna «Factura» es solo referencia (R3: nunca gatea periodos).
 */

import { ListboxSelect } from '@/shared/views/ui/ListboxSelect'
import { clavePeriodo } from '@/features/datos/models/calculoUso'
import type {
  Consolidaciones,
  DetalleEquipo,
  PeriodoRef,
  ResultadoPeriodo,
  VistaPrevia,
} from '@/features/datos/models/calculoUso'
import { ANOS_UI, MESES, etiquetaClasificacion, useCalculoMasivo } from './useCalculoMasivo'
import type { EdificacionInfo } from './useCatalogoEdificaciones'

export type CalculoUsoProps = {
  edificaciones: EdificacionInfo[]
  /** DatosContent solo monta la sección con permiso de carga; el server revalida. */
  puedeCargar: boolean
}

/** Tono de la insignia de clasificación de la vista previa (spec §6.2). */
const TONO_CLASIFICACION: Record<string, string> = {
  Existente: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
  Pendiente: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30',
  Desactualizado: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30',
  Fallido: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30',
  Revisar: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
  Nuevo: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
}

function Insignia({ texto }: { texto: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONO_CLASIFICACION[texto] ?? TONO_CLASIFICACION.Nuevo}`}
    >
      {texto}
    </span>
  )
}

/** Estado vacío del resultado individual (spec §6.6), según la advertencia. */
function vacioDelResultado(advertencias: string[]): string {
  if (advertencias.includes('Sin equipos registrados')) {
    return 'No hay equipos registrados en la edificación seleccionada.'
  }
  if (advertencias.includes('Sin horario vigente')) {
    return 'Sin horario vigente para calcular este periodo. Revise la configuración del calendario.'
  }
  return 'Todavía no hay resultados de uso para este periodo.'
}

type ResultadoOk = {
  detalle: DetalleEquipo[]
  porFecha: { equipoId: string; fecha: string; horas: number }[]
  consolidaciones: Consolidaciones
  advertencias: string[]
  trazabilidad: ResultadoPeriodo['trazabilidad']
  periodo: { estado: string }
  conservado?: boolean
}

/** Resultado del cálculo individual: conservado, vacío o tablas de trazabilidad. */
function ResultadoIndividual({
  resultado,
  clave,
}: {
  resultado: ResultadoOk
  clave: string
}) {
  if (resultado.conservado) {
    return (
      <div className="ui-callout ui-callout-info" role="status">
        Resultado existente conservado: el periodo {clave} ya estaba calculado con integridad
        completa y no se modificó.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {resultado.advertencias.length > 0 && (
        <div className="ui-callout ui-callout-warn" role="status">
          <p className="font-medium">Advertencias del cálculo</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {resultado.advertencias.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {resultado.detalle.length === 0 ? (
        <div className="ui-empty">{vacioDelResultado(resultado.advertencias)}</div>
      ) : (
        <>
          <div>
            <h4 className="ui-title text-sm">Detalle por equipo</h4>
            <div className="ui-table-shell mt-2">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th scope="col">Equipo</th>
                    <th scope="col">Horas por día</th>
                    <th scope="col">Días por mes</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Horario ganador</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.detalle.map((d) => (
                    <tr key={d.equipoId}>
                      <td>{d.equipoId}</td>
                      <td>{d.horasUsoDia}</td>
                      <td>{d.diasUsoMes}</td>
                      <td>{d.estado}</td>
                      <td>{d.horarioGanador ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="ui-title text-sm">Desglose por fecha</h4>
            <div className="ui-table-shell mt-2">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th scope="col">Equipo</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.porFecha.map((f) => (
                    <tr key={`${f.equipoId}-${f.fecha}`}>
                      <td>{f.equipoId}</td>
                      <td>{f.fecha}</td>
                      <td>{f.horas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="ui-title text-sm">Consolidaciones (solo visualización)</h4>
            <div className="ui-table-shell mt-2">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th scope="col">Nivel</th>
                    <th scope="col">Equipos</th>
                    <th scope="col">Horas por día</th>
                    <th scope="col">Días por mes</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.consolidaciones.espacios.map((n) => (
                    <tr key={n.espacioId}>
                      <td>Espacio · {n.espacioId}</td>
                      <td>{n.equipos}</td>
                      <td>{n.horasUsoDia}</td>
                      <td>{n.diasUsoMes}</td>
                    </tr>
                  ))}
                  {resultado.consolidaciones.bloques.map((n) => (
                    <tr key={n.bloqueId}>
                      <td>Bloque · {n.bloqueId}</td>
                      <td>{n.equipos}</td>
                      <td>{n.horasUsoDia}</td>
                      <td>{n.diasUsoMes}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Edificación</td>
                    <td>{resultado.consolidaciones.edificacion.equipos}</td>
                    <td>{resultado.consolidaciones.edificacion.horasUsoDia}</td>
                    <td>{resultado.consolidaciones.edificacion.diasUsoMes}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="ui-title text-sm">Trazabilidad del horario ganador</h4>
            <div className="ui-table-shell mt-2">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th scope="col">Equipo</th>
                    <th scope="col">Nivel ganador</th>
                    <th scope="col">Vigencia</th>
                    <th scope="col">Aportes</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.trazabilidad.map((t) => (
                    <tr key={t.equipoId}>
                      <td>{t.equipoId}</td>
                      <td>{t.nivelGanador}</td>
                      <td>{t.vigencia}</td>
                      <td>{t.aportes.length > 0 ? t.aportes.join(' · ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Tabla de la vista previa: una fila por periodo del intervalo (spec §6.2). */
function TablaVistaPrevia({ vistaPrevia }: { vistaPrevia: VistaPrevia }) {
  return (
    <div className="ui-table-shell mt-2">
      <table className="ui-table">
        <thead>
          <tr>
            <th scope="col">Periodo</th>
            <th scope="col">Estado</th>
            <th scope="col">Equipos (calculados / esperados)</th>
            <th scope="col">Factura</th>
            <th scope="col">Advertencias</th>
          </tr>
        </thead>
        <tbody>
          {vistaPrevia.periodos.map((p) => (
            <tr key={p.clave}>
              <td>{p.clave}</td>
              <td>
                <Insignia texto={etiquetaClasificacion(p.clasificacion)} />
              </td>
              <td>
                {p.equiposCalculados} / {p.equiposEsperados}
              </td>
              <td className={p.conFactura ? undefined : 'text-gray-500 dark:text-slate-400'}>
                {p.conFactura ? 'Con factura' : 'Sin factura'}
              </td>
              <td>{p.advertencias.length > 0 ? p.advertencias.join(' · ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CalculoUso({ edificaciones }: CalculoUsoProps) {
  const {
    edificacionId,
    cambiarEdificacion,
    mes,
    setMes,
    ano,
    setAno,
    mesInicial,
    setMesInicial,
    anoInicial,
    setAnoInicial,
    mesFinal,
    setMesFinal,
    anoFinal,
    setAnoFinal,
    vistaPrevia,
    previaCargando,
    previsualizar,
    resultado,
    calculando,
    calcular,
  } = useCalculoMasivo()

  const clave = clavePeriodo({ mes, ano } satisfies PeriodoRef)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="ui-title text-lg">Cálculo de uso</h2>
        <p className="ui-muted text-sm">
          Calcule las horas y días de uso de un periodo o revise la vista previa de un
          intervalo antes de ejecutar el cálculo masivo.
        </p>
      </div>

      <div className="ui-field sm:max-w-md">
        <label htmlFor="calculo-uso-edificacion" className="ui-label">
          Edificación
        </label>
        <ListboxSelect
          id="calculo-uso-edificacion"
          value={edificacionId}
          onChange={cambiarEdificacion}
          options={edificaciones.map((e) => ({ value: e.id, label: e.nombre }))}
          placeholder="Seleccione una edificación"
          className="ui-input min-h-10"
        />
      </div>

      {!edificacionId ? (
        <div className="ui-empty">Seleccione una edificación para calcular las horas de uso.</div>
      ) : (
        <>
          {/* Cálculo individual de un periodo (spec §5 «Cálculo individual»). */}
          <section className="ui-card" aria-labelledby="calculo-uso-individual">
            <h3 id="calculo-uso-individual" className="ui-title text-sm">
              Cálculo individual
            </h3>
            <p className="ui-muted mt-1 text-xs">
              Calcula horas y días de uso por equipo del periodo elegido, con su desglose
              por fecha, consolidaciones y trazabilidad del horario ganador.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="calculo-uso-mes" className="ui-label">
                  Mes
                </label>
                <select
                  id="calculo-uso-mes"
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                  className="ui-input mt-1 min-h-10"
                >
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="calculo-uso-ano" className="ui-label">
                  Año
                </label>
                <select
                  id="calculo-uso-ano"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                  className="ui-input mt-1 min-h-10"
                >
                  {ANOS_UI.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={calcular}
                disabled={calculando}
                className="ui-btn ui-btn-primary min-h-10"
              >
                Calcular
              </button>
              {calculando && (
                <p role="status" className="ui-muted basis-full text-xs">
                  Calculando horas de uso del periodo {clave}…
                </p>
              )}
            </div>

            {resultado && !calculando && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="ui-title text-sm">Resultado · periodo {clave}</h4>
                  <Insignia texto={resultado.periodo.estado} />
                </div>
                <ResultadoIndividual resultado={resultado} clave={clave} />
              </div>
            )}
          </section>

          {/* Vista previa del intervalo (AC4) — solo lectura, sin escrituras. */}
          <section className="ui-card" aria-labelledby="calculo-uso-vista-previa">
            <h3 id="calculo-uso-vista-previa" className="ui-title text-sm">
              Vista previa de un intervalo
            </h3>
            <p className="ui-muted mt-1 text-xs">
              Muestra qué periodos del intervalo ya tienen resultado, cuáles se
              calcularían y si tienen factura, antes de ejecutar ningún cálculo.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="calculo-uso-mes-inicial" className="ui-label">
                  Mes inicial
                </label>
                <select
                  id="calculo-uso-mes-inicial"
                  value={mesInicial}
                  onChange={(e) => setMesInicial(Number(e.target.value))}
                  className="ui-input mt-1 min-h-10"
                >
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="calculo-uso-ano-inicial" className="ui-label">
                  Año inicial
                </label>
                <select
                  id="calculo-uso-ano-inicial"
                  value={anoInicial}
                  onChange={(e) => setAnoInicial(Number(e.target.value))}
                  className="ui-input mt-1 min-h-10"
                >
                  {ANOS_UI.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="calculo-uso-mes-final" className="ui-label">
                  Mes final
                </label>
                <select
                  id="calculo-uso-mes-final"
                  value={mesFinal}
                  onChange={(e) => setMesFinal(Number(e.target.value))}
                  className="ui-input mt-1 min-h-10"
                >
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="calculo-uso-ano-final" className="ui-label">
                  Año final
                </label>
                <select
                  id="calculo-uso-ano-final"
                  value={anoFinal}
                  onChange={(e) => setAnoFinal(Number(e.target.value))}
                  className="ui-input mt-1 min-h-10"
                >
                  {ANOS_UI.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={previsualizar}
                disabled={previaCargando}
                className="ui-btn ui-btn-secondary min-h-10"
              >
                Vista previa
              </button>
              {previaCargando && (
                <p role="status" className="ui-muted basis-full text-xs">
                  Generando la vista previa del intervalo…
                </p>
              )}
            </div>

            {vistaPrevia && !previaCargando && (
              <div className="mt-4 space-y-3">
                <p className="ui-muted text-xs">
                  Intervalo: {clavePeriodo(vistaPrevia.intervalo.desde)} –{' '}
                  {clavePeriodo(vistaPrevia.intervalo.hasta)}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="ui-stat">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Meses en el intervalo: {vistaPrevia.intervalo.cantidadMeses}
                    </p>
                  </div>
                  <div className="ui-stat">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Resultados existentes: {vistaPrevia.conteos.existentes}
                    </p>
                  </div>
                  <div className="ui-stat">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Periodos pendientes: {vistaPrevia.conteos.pendientes}
                    </p>
                  </div>
                  <div className="ui-stat">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Con factura: {vistaPrevia.conteos.conFactura} de{' '}
                      {vistaPrevia.intervalo.cantidadMeses}
                    </p>
                  </div>
                </div>

                {vistaPrevia.conteos.existentes === 0 && (
                  <div className="ui-empty">
                    Todavía no hay resultados de uso para este intervalo.
                  </div>
                )}

                <TablaVistaPrevia vistaPrevia={vistaPrevia} />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
