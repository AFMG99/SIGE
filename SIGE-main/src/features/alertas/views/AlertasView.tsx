'use client'

/**
 * Módulo 4 — Alertas de consumo inusual (HU-08).
 *
 * Bandeja de triage: qué períodos superan la banda de confianza de su mes, en
 * qué edificación, con qué severidad y en qué estado va la revisión. Todo dato
 * entra por props (los lee la página server); las mutaciones pasan por las
 * server actions del módulo.
 *
 * Dos decisiones de producto se ven en la pantalla:
 *   · El alcance por defecto es TODO el campus. Un aviso suelto sin saber en qué
 *     bloque ocurre no es accionable; la edificación se elige para recalcular su
 *     bandeja o ajustar su umbral, no para ver si hay algo pendiente.
 *   · El recálculo es MANUAL y por edificación (decisión de la HU): ejecuta el
 *     motor estadístico en Python, tarda segundos y por eso nunca se dispara
 *     solo. Mientras una bandeja esté desactualizada se dice explícitamente, en
 *     vez de recalcular a espaldas del usuario.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  UMBRAL_K_MAX,
  UMBRAL_K_MIN,
  UMBRAL_K_PASO,
  UMBRAL_PCT_MAX,
  UMBRAL_PCT_MIN,
  etiquetaPeriodo,
  formatoKwh,
  formatoNumero,
  formatoPct,
} from '@/features/analisis/models/analisis'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'
import { ListboxSelect } from '@/shared/views/ui/ListboxSelect'
import { useToast } from '@/shared/views/ui/ToastProvider'
// Ruta ABSOLUTA a propósito: Storybook sustituye este módulo por el doble
// determinista vía `resolve.alias` de `.storybook/main.ts`, y los alias de Vite
// se aplican al especificador del import, no al archivo ya resuelto. Una ruta
// relativa se saltaría el alias y traería el controlador real (Prisma + motor).
import {
  cambiarEstadoAlerta,
  generarAlertas,
  guardarConfigAlerta,
} from '@/features/alertas/controllers/alertas'
import {
  CLASE_BADGE,
  CONFIG_ALERTA_POR_DEFECTO,
  ESTADO_ALERTA_LABEL,
  ESTADO_BADGE,
  SEVERIDAD_ALERTA_LABEL,
  SEVERIDAD_BADGE,
  resumirAlertas,
  type AlertaVista,
  type ConfigAlerta,
  type EstadoAlerta,
  type EvaluacionVista,
  type SeveridadAlerta,
} from '../models/alertas'

export interface EdificacionOpcion {
  id: string
  nombre: string
}

export interface AlertasViewProps {
  edificaciones: EdificacionOpcion[]
  /** Alertas vigentes de todas las edificaciones visibles. */
  alertas: AlertaVista[]
  configs: Record<string, ConfigAlerta>
  evaluaciones: Record<string, EvaluacionVista>
  /** `alerts:evaluate` — recalcular exige el motor estadístico. */
  puedeEvaluar: boolean
  /** `alerts:config` — fijar el umbral de la edificación. */
  puedeConfigurar: boolean
}

/** Alcance «todas las edificaciones» del selector (valor centinela, nunca un id). */
const TODAS = '__todas__'

const OPCIONES_ESTADO: { valor: 'todas' | EstadoAlerta; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'nueva', etiqueta: 'Nuevas' },
  { valor: 'leida', etiqueta: 'Leídas' },
  { valor: 'descartada', etiqueta: 'Descartadas' },
]

const OPCIONES_SEVERIDAD: { valor: 'todas' | SeveridadAlerta; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Toda severidad' },
  { valor: 'alta', etiqueta: 'Alta' },
  { valor: 'media', etiqueta: 'Media' },
  { valor: 'baja', etiqueta: 'Baja' },
]

/** Punto de severidad de la fila (el tono vive en JSX, como manda el .ui-table). */
const PUNTO_SEVERIDAD: Record<SeveridadAlerta, string> = {
  alta: 'bg-rose-500',
  media: 'bg-amber-500',
  baja: 'bg-sky-500',
}

/** Fecha/hora en la zona del campus, con formato corto. */
function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  })
}

export function AlertasView({
  edificaciones,
  alertas,
  configs,
  evaluaciones,
  puedeEvaluar,
  puedeConfigurar,
}: AlertasViewProps) {
  const router = useRouter()
  const { showToast } = useToast()

  // Con una sola edificación el alcance «todas» no aporta nada: se entra directo
  // a ella y el selector desaparece.
  const [edificacionId, setEdificacionId] = useState(() =>
    edificaciones.length > 1 ? TODAS : (edificaciones[0]?.id ?? TODAS)
  )
  const [filtroEstado, setFiltroEstado] = useState<'todas' | EstadoAlerta>('todas')
  const [filtroSeveridad, setFiltroSeveridad] = useState<'todas' | SeveridadAlerta>('todas')
  const [aDescartar, setADescartar] = useState<AlertaVista | null>(null)
  const [recalculando, setRecalculando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const alcanceTodas = edificacionId === TODAS

  const enAlcance = useMemo(
    () =>
      alcanceTodas
        ? alertas
        : alertas.filter((alerta) => alerta.edificacionId === edificacionId),
    [alertas, edificacionId, alcanceTodas]
  )

  const visibles = useMemo(
    () =>
      enAlcance.filter(
        (alerta) =>
          (filtroEstado === 'todas' || alerta.estado === filtroEstado) &&
          (filtroSeveridad === 'todas' || alerta.severidad === filtroSeveridad)
      ),
    [enAlcance, filtroEstado, filtroSeveridad]
  )

  const resumen = useMemo(() => resumirAlertas(enAlcance), [enAlcance])

  const edificacionesConAlertas = useMemo(
    () => new Set(enAlcance.map((alerta) => alerta.edificacionId)).size,
    [enAlcance]
  )

  /** Salud de las bandejas del alcance: al día / desactualizada / sin evaluar. */
  const salud = useMemo(() => {
    let alDia = 0
    let desactualizadas = 0
    let sinEvaluar = 0
    let periodosEvaluables = 0
    const pendientes: string[] = []
    for (const edificacion of edificaciones) {
      const evaluacion = evaluaciones[edificacion.id]
      if (!evaluacion || evaluacion.evaluadoEn === null) {
        sinEvaluar += 1
        pendientes.push(edificacion.nombre)
        continue
      }
      periodosEvaluables += evaluacion.periodosEvaluables
      if (evaluacion.desactualizada) {
        desactualizadas += 1
        pendientes.push(edificacion.nombre)
      } else {
        alDia += 1
      }
    }
    return { alDia, desactualizadas, sinEvaluar, pendientes, periodosEvaluables }
  }, [edificaciones, evaluaciones])

  const evaluacion = alcanceTodas ? undefined : evaluaciones[edificacionId]
  const config = alcanceTodas
    ? CONFIG_ALERTA_POR_DEFECTO
    : (configs[edificacionId] ?? CONFIG_ALERTA_POR_DEFECTO)
  const edificacion = alcanceTodas
    ? undefined
    : edificaciones.find((e) => e.id === edificacionId)

  const opcionesEdificacion = useMemo(
    () => [
      ...(edificaciones.length > 1
        ? [{ value: TODAS, label: 'Todas las edificaciones' }]
        : []),
      ...edificaciones.map((e) => ({ value: e.id, label: e.nombre })),
    ],
    [edificaciones]
  )

  async function recalcular() {
    if (!edificacionId || alcanceTodas) return
    setRecalculando(true)
    try {
      const resultado = await generarAlertas({ edificacionId })
      if (resultado.estado === 'error') {
        showToast(resultado.mensaje, 'error')
        return
      }
      showToast(resultado.mensaje, 'success')
      router.refresh()
    } catch {
      showToast('No fue posible evaluar las alertas. Intente de nuevo.', 'error')
    } finally {
      setRecalculando(false)
    }
  }

  async function cambiarEstado(
    alerta: AlertaVista,
    estado: EstadoAlerta,
    nota?: string
  ) {
    const resultado = await cambiarEstadoAlerta({ id: alerta.id, estado, nota })
    if (resultado.estado === 'error') {
      showToast(resultado.mensaje, 'error')
      return
    }
    showToast(resultado.mensaje, 'success')
    router.refresh()
  }

  async function guardarConfig(nueva: ConfigAlerta) {
    if (!edificacionId || alcanceTodas) return
    setGuardando(true)
    try {
      const resultado = await guardarConfigAlerta({ edificacionId, ...nueva })
      if (resultado.estado === 'error') {
        showToast(resultado.mensaje, 'error')
        return
      }
      showToast(resultado.mensaje, 'success')
      router.refresh()
    } catch {
      showToast('No fue posible guardar el umbral. Intente de nuevo.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  /**
   * Frescura de la bandeja del alcance. Es el aviso que decide si la tabla de
   * abajo es confiable, así que se redacta una sola vez, en texto y tono.
   */
  function avisoDeEvaluacion(): { tono: string; texto: string } {
    if (alcanceTodas) {
      if (salud.pendientes.length === 0) {
        return {
          tono: 'ui-callout-success',
          texto: `Bandejas al día: las ${edificaciones.length} edificaciones se evaluaron con los datos vigentes y suman ${formatoNumero(salud.periodosEvaluables, 0)} períodos comparados con el umbral.`,
        }
      }
      const detalle = [
        salud.desactualizadas > 0 ? `${salud.desactualizadas} con datos cambiados` : null,
        salud.sinEvaluar > 0 ? `${salud.sinEvaluar} sin evaluar nunca` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      return {
        tono: 'ui-callout-warn',
        texto: `${salud.pendientes.length} ${salud.pendientes.length === 1 ? 'bandeja' : 'bandejas'} sin recalcular (${detalle}): ${salud.pendientes.join(', ')}. Elija la edificación en el selector para recalcular su bandeja.`,
      }
    }

    const evaluadoEn = evaluacion?.evaluadoEn ?? null
    if (!evaluacion || evaluadoEn === null) {
      return {
        tono: 'ui-callout-info',
        texto:
          'Esta edificación aún no se ha evaluado. Pulse «Recalcular alertas» para generar la bandeja.',
      }
    }
    if (evaluacion.desactualizada) {
      return {
        tono: 'ui-callout-warn',
        texto: `Bandeja desactualizada: los datos cambiaron después de la evaluación del ${fechaCorta(evaluadoEn)}. Lo que ve corresponde a ese momento; pulse «Recalcular alertas» para aplicar los datos y el umbral vigentes.`,
      }
    }
    return {
      tono: 'ui-callout-success',
      texto: `Bandeja vigente: evaluada el ${fechaCorta(evaluadoEn)} · ${formatoNumero(evaluacion.periodosEvaluables, 0)} períodos comparados con el umbral.`,
    }
  }

  const aviso = avisoDeEvaluacion()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="space-y-6">
          {/* Encabezado: qué es esto, qué mirar y la única acción que lo cambia */}
          <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                Módulo 4 · Alertas
              </p>
              <h1 className="ui-title text-3xl">Alertas de consumo</h1>
              <p className="ui-muted max-w-2xl text-sm leading-relaxed">
                Períodos cuyo consumo supera la banda de confianza de su mes calendario (±10 %
                o ±{UMBRAL_K_MIN}–{UMBRAL_K_MAX}·DesvEst, según la Resolución UPME 0016). La
                bandeja se calcula bajo demanda: los datos cambian con cada factura cargada, así
                que el aviso de «desactualizada» es parte del resultado.
              </p>
            </div>

            {edificaciones.length > 0 && (
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end lg:flex-col lg:items-stretch">
                <div className="ui-field sm:min-w-64">
                  <label htmlFor="alertas-edificacion" className="ui-label">
                    Edificación
                  </label>
                  <ListboxSelect
                    id="alertas-edificacion"
                    value={edificacionId}
                    onChange={setEdificacionId}
                    options={opcionesEdificacion}
                    className="ui-input min-h-10 w-full"
                  />
                </div>
                <button
                  type="button"
                  className="ui-btn ui-btn-primary focus-ring w-full sm:w-auto lg:w-full"
                  onClick={recalcular}
                  disabled={!puedeEvaluar || recalculando || !edificacionId || alcanceTodas}
                >
                  {recalculando ? 'Recalculando…' : 'Recalcular alertas'}
                </button>
              </div>
            )}
          </header>

          {edificaciones.length === 0 ? (
            <div className="ui-empty py-12">
              <p className="ui-title text-sm">Sin edificaciones registradas</p>
              <p className="max-w-md text-xs">
                Las alertas se evalúan por edificación. Registre el catálogo y las facturas del
                módulo de datos antes de usar este módulo.
              </p>
            </div>
          ) : (
            <>
              {/* Estado del alcance: lo primero que hay que saber antes de leer la tabla */}
              <section aria-labelledby="titulo-evaluacion" className="ui-panel space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="titulo-evaluacion" className="ui-title text-sm">
                    Estado de la evaluación
                  </h2>
                  <p className="ui-muted text-xs">
                    {alcanceTodas
                      ? `${edificaciones.length} ${edificaciones.length === 1 ? 'edificación' : 'edificaciones'} en el alcance`
                      : (edificacion?.nombre ?? 'Edificación')}
                  </p>
                </div>

                {alcanceTodas
                  ? salud.pendientes.length === 0
                    ? (
                        <p className="ui-callout ui-callout-success" role="status">
                          Bandejas al día: las {edificaciones.length} edificaciones se evaluaron
                          con los datos vigentes y suman{' '}
                          {formatoNumero(salud.periodosEvaluables, 0)} períodos comparados con el
                          umbral.
                        </p>
                      )
                    : (
                        <p className="ui-callout ui-callout-warn" role="status">
                          {salud.pendientes.length}{' '}
                          {salud.pendientes.length === 1 ? 'bandeja' : 'bandejas'} sin recalcular (
                          {salud.desactualizadas > 0 &&
                            `${salud.desactualizadas} con datos cambiados`}
                          {salud.desactualizadas > 0 && salud.sinEvaluar > 0 && ' · '}
                          {salud.sinEvaluar > 0 && `${salud.sinEvaluar} sin evaluar nunca`}):{' '}
                          {salud.pendientes.join(', ')}. Elija la edificación en el selector para
                          recalcular su bandeja.
                        </p>
                      )
                  : (
                      <p className={`ui-callout ${aviso.tono}`} role="status">
                        {aviso.texto}
                      </p>
                    )}

                {!puedeEvaluar && (
                  <p className="ui-callout ui-callout-info">
                    Su rol puede consultar las alertas, pero recalcularlas ejecuta el mismo motor
                    estadístico que el módulo de Análisis y requiere el permiso «Analizar
                    consumo».
                  </p>
                )}
              </section>

              {/* KPIs del alcance */}
              <section
                aria-label={
                  alcanceTodas
                    ? 'Resumen de alertas de todas las edificaciones'
                    : `Resumen de alertas de ${edificacion?.nombre ?? 'la edificación'}`
                }
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <Indicador etiqueta="Alertas vigentes" valor={resumen.total} />
                <Indicador etiqueta="Sin revisar" valor={resumen.nuevas} tono="atencion" />
                <Indicador etiqueta="Severidad alta" valor={resumen.altas} tono="alerta" />
                {alcanceTodas ? (
                  <Indicador
                    etiqueta="Edificaciones con alertas"
                    valor={edificacionesConAlertas}
                    ayuda={`de ${formatoNumero(edificaciones.length, 0)}`}
                  />
                ) : (
                  <Indicador
                    etiqueta="Meses sin banda"
                    valor={evaluacion?.noEvaluables ?? 0}
                    ayuda={
                      evaluacion
                        ? `${formatoNumero(evaluacion.periodosEvaluables, 0)} períodos evaluables`
                        : 'Sin evaluar'
                    }
                  />
                )}
              </section>

              {/* Bandeja */}
              <section aria-labelledby="titulo-bandeja" className="ui-panel space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <h2 id="titulo-bandeja" className="ui-title text-sm">
                      {alcanceTodas
                        ? 'Bandeja de todas las edificaciones'
                        : `Bandeja de ${edificacion?.nombre ?? 'la edificación'}`}
                    </h2>
                    <p className="ui-muted text-xs tabular-nums">
                      {formatoNumero(enAlcance.length, 0)} alertas vigentes
                      {alcanceTodas && edificacionesConAlertas > 0
                        ? ` en ${formatoNumero(edificacionesConAlertas, 0)} ${edificacionesConAlertas === 1 ? 'edificación' : 'edificaciones'}`
                        : ''}
                      {visibles.length !== enAlcance.length
                        ? ` · ${formatoNumero(visibles.length, 0)} con los filtros actuales`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <GrupoFiltro
                      etiqueta="Estado"
                      opciones={OPCIONES_ESTADO}
                      valor={filtroEstado}
                      onChange={(valor) => setFiltroEstado(valor as 'todas' | EstadoAlerta)}
                    />
                    <GrupoFiltro
                      etiqueta="Severidad"
                      opciones={OPCIONES_SEVERIDAD}
                      valor={filtroSeveridad}
                      onChange={(valor) => setFiltroSeveridad(valor as 'todas' | SeveridadAlerta)}
                    />
                  </div>
                </div>

                {enAlcance.length === 0 ? (
                  <div className="ui-empty py-10">
                    <p className="ui-title text-sm">
                      {alcanceTodas
                        ? 'Sin alertas en las edificaciones visibles'
                        : 'Sin alertas para esta edificación'}
                    </p>
                    <p className="max-w-md text-xs">
                      {alcanceTodas
                        ? 'Ningún período de ninguna edificación supera su umbral con los datos actuales.'
                        : evaluacion && evaluacion.evaluadoEn !== null
                          ? 'Ningún período supera el umbral con los datos actuales.'
                          : 'Evalúe la edificación para saber si algún período supera el umbral.'}
                    </p>
                  </div>
                ) : visibles.length === 0 ? (
                  <div className="ui-empty py-10">
                    <p className="ui-title text-sm">Sin alertas con estos filtros</p>
                    <p className="max-w-md text-xs">
                      Hay {formatoNumero(enAlcance.length, 0)} alertas en la bandeja; ajuste el
                      estado o la severidad para verlas.
                    </p>
                  </div>
                ) : (
                  <div className="ui-table-shell">
                    <table className="ui-table">
                      <caption className="sr-only">
                        Períodos que superan la banda de confianza de su mes
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Período</th>
                          {alcanceTodas && <th scope="col">Edificación</th>}
                          <th scope="col">Consumo</th>
                          <th scope="col">Banda esperada</th>
                          <th scope="col">Desviación</th>
                          <th scope="col">Severidad</th>
                          <th scope="col">Estado</th>
                          <th scope="col">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibles.map((alerta) => (
                          <tr key={alerta.id}>
                            <td className="whitespace-nowrap">
                              <span className="flex items-center gap-2">
                                <span
                                  aria-hidden
                                  className={`h-2 w-2 shrink-0 rounded-full ${PUNTO_SEVERIDAD[alerta.severidad]}`}
                                />
                                <span className="font-medium">
                                  {etiquetaPeriodo(alerta.mes, alerta.ano)}
                                </span>
                              </span>
                              <span className="ui-muted mt-1 block text-xs tabular-nums">
                                {alerta.periodo} · umbral ±{alerta.umbralPct} % /{' '}
                                {formatoNumero(alerta.umbralK, 1)} σ
                              </span>
                            </td>
                            {alcanceTodas && (
                              <td className="whitespace-nowrap">{alerta.edificacionNombre}</td>
                            )}
                            <td className="whitespace-nowrap tabular-nums">
                              {formatoKwh(alerta.consumoKwh)}
                            </td>
                            <td className="whitespace-nowrap tabular-nums">
                              {formatoKwh(alerta.bandaInf)} – {formatoKwh(alerta.bandaSup)}
                            </td>
                            <td className="whitespace-nowrap">
                              <span className="font-medium tabular-nums text-rose-700 dark:text-rose-300">
                                {formatoPct(alerta.desviacionPct)}
                              </span>
                              <MedidorBanda alerta={alerta} />
                            </td>
                            <td>
                              <span
                                className={`${CLASE_BADGE} ${SEVERIDAD_BADGE[alerta.severidad]}`}
                              >
                                {SEVERIDAD_ALERTA_LABEL[alerta.severidad]}
                              </span>
                            </td>
                            <td>
                              <span className={`${CLASE_BADGE} ${ESTADO_BADGE[alerta.estado]}`}>
                                {ESTADO_ALERTA_LABEL[alerta.estado]}
                              </span>
                              {alerta.nota && (
                                <span className="ui-muted mt-1 block max-w-56 text-xs">
                                  {alerta.nota}
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="flex flex-wrap gap-2">
                                {alerta.estado !== 'leida' && (
                                  <button
                                    type="button"
                                    className="ui-btn ui-btn-secondary ui-btn-sm focus-ring"
                                    onClick={() => cambiarEstado(alerta, 'leida')}
                                  >
                                    Marcar leída
                                  </button>
                                )}
                                {alerta.estado !== 'nueva' && (
                                  <button
                                    type="button"
                                    className="ui-btn ui-btn-ghost ui-btn-sm focus-ring"
                                    onClick={() => cambiarEstado(alerta, 'nueva')}
                                  >
                                    Restaurar
                                  </button>
                                )}
                                {alerta.estado !== 'descartada' && (
                                  <button
                                    type="button"
                                    className="ui-btn ui-btn-danger-outline ui-btn-sm focus-ring"
                                    onClick={() => setADescartar(alerta)}
                                  >
                                    Descartar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Umbral: sólo tiene sentido sobre una edificación concreta */}
              {alcanceTodas ? (
                <section aria-labelledby="titulo-umbral-alcance" className="ui-panel space-y-3">
                  <h2 id="titulo-umbral-alcance" className="ui-title text-sm">
                    Umbral por edificación
                  </h2>
                  <p className="ui-muted max-w-3xl text-xs leading-relaxed">
                    El umbral se fija por edificación: el criterio normativo es ±10 % de la media
                    del mes (ec. 3) y ±2·DesvEst para los meses con muestra suficiente (ec. 4-5).
                    Cambiarlo NO recalcula la bandeja: la marca como desactualizada y cada alerta
                    conserva el umbral con el que se disparó.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {edificaciones.map((edificacionOpcion) => {
                      const suya = configs[edificacionOpcion.id]
                      const normativa =
                        !suya ||
                        (suya.pct === CONFIG_ALERTA_POR_DEFECTO.pct &&
                          suya.k === CONFIG_ALERTA_POR_DEFECTO.k)
                      return (
                        <div key={edificacionOpcion.id} className="ui-stat min-w-48">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {edificacionOpcion.nombre}
                          </p>
                          <p className="ui-muted mt-1 text-xs tabular-nums">
                            {suya
                              ? `±${suya.pct} % / ${formatoNumero(suya.k, 1)} σ${suya.activo ? '' : ' · generación apagada'}`
                              : 'Sin configurar (norma)'}
                          </p>
                          <p className="ui-muted mt-0.5 text-[11px]">
                            {normativa ? 'Umbral normativo' : 'Umbral personalizado'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                  <p className="ui-callout ui-callout-info">
                    Elija una edificación en el selector para ajustar su umbral.
                  </p>
                </section>
              ) : (
                <PanelConfig
                  key={edificacionId}
                  inicial={config}
                  puedeConfigurar={puedeConfigurar}
                  guardando={guardando}
                  onGuardar={guardarConfig}
                  desactualizada={evaluacion?.desactualizada ?? true}
                />
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={aDescartar !== null}
        onClose={() => setADescartar(null)}
        onConfirm={() => {
          const alerta = aDescartar
          setADescartar(null)
          if (alerta) void cambiarEstado(alerta, 'descartada')
        }}
        title="Descartar alerta"
        description={
          aDescartar
            ? `La alerta de ${etiquetaPeriodo(aDescartar.mes, aDescartar.ano)} quedará marcada como descartada. Seguirá siendo un período inusual (no se borra) y no volverá a «nueva» mientras siga superando el umbral.`
            : ''
        }
        confirmText="Descartar"
        variant="destructive"
      />
    </div>
  )
}

// ============================================================
// Piezas locales
// ============================================================

function Indicador({
  etiqueta,
  valor,
  ayuda,
  tono = 'neutro',
}: {
  etiqueta: string
  valor: number
  ayuda?: string
  tono?: 'neutro' | 'atencion' | 'alerta'
}) {
  const color =
    valor === 0
      ? 'text-gray-900 dark:text-gray-100'
      : tono === 'alerta'
        ? 'text-rose-700 dark:text-rose-300'
        : tono === 'atencion'
          ? 'text-amber-700 dark:text-amber-300'
          : 'text-gray-900 dark:text-gray-100'
  return (
    <div className="ui-card-stat">
      <p className="ui-muted text-xs">{etiqueta}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${color}`}>
        {formatoNumero(valor, 0)}
      </p>
      {ayuda && <p className="ui-muted mt-1 text-xs tabular-nums">{ayuda}</p>}
    </div>
  )
}

/**
 * Micro-medidor de la fila: dónde cayó la lectura respecto de la banda esperada.
 * Decorativo a propósito (`aria-hidden`): los números de la fila ya lo dicen y
 * un lector de pantalla no necesita una segunda lectura peor.
 */
function MedidorBanda({ alerta }: { alerta: AlertaVista }) {
  const inf = alerta.bandaInf
  const sup = Math.max(alerta.bandaSup, alerta.consumoKwh)
  const margen = Math.max((sup - inf) * 0.25, 1)
  const min = Math.max(0, inf - margen)
  const max = sup + margen
  const ancho = max - min || 1
  const pct = (valor: number) =>
    `${Math.min(100, Math.max(0, ((valor - min) / ancho) * 100))}%`

  return (
    <span
      aria-hidden
      className="relative mt-2 block h-1.5 w-full max-w-40 rounded-full bg-gray-200 dark:bg-slate-700"
    >
      <span
        className="absolute inset-y-0 rounded-full bg-emerald-600/25 dark:bg-emerald-500/30"
        style={{ left: pct(alerta.bandaInf), right: `calc(100% - ${pct(alerta.bandaSup)})` }}
      />
      <span
        className={`absolute top-1/2 h-3 w-[3px] -translate-y-1/2 rounded-full ${PUNTO_SEVERIDAD[alerta.severidad]}`}
        style={{ left: `calc(${pct(alerta.consumoKwh)} - 1.5px)` }}
      />
    </span>
  )
}

function GrupoFiltro<T extends string>({
  etiqueta,
  opciones,
  valor,
  onChange,
}: {
  etiqueta: string
  opciones: { valor: T; etiqueta: string }[]
  valor: T
  onChange: (valor: T) => void
}) {
  return (
    <div role="group" aria-label={`Filtrar por ${etiqueta.toLowerCase()}`} className="flex flex-wrap gap-1.5">
      {opciones.map((opcion) => {
        const activo = opcion.valor === valor
        return (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(opcion.valor)}
            className={`ui-btn ui-btn-sm focus-ring ${
              activo ? 'ui-btn-primary' : 'ui-btn-ghost'
            }`}
          >
            {opcion.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

function PanelConfig({
  inicial,
  puedeConfigurar,
  guardando,
  desactualizada,
  onGuardar,
}: {
  inicial: ConfigAlerta
  puedeConfigurar: boolean
  guardando: boolean
  desactualizada: boolean
  onGuardar: (config: ConfigAlerta) => void
}) {
  const [pct, setPct] = useState(inicial.pct)
  const [k, setK] = useState(inicial.k)
  const [activo, setActivo] = useState(inicial.activo)

  const sucio = pct !== inicial.pct || k !== inicial.k || activo !== inicial.activo

  return (
    <section aria-labelledby="titulo-umbral" className="ui-panel space-y-4">
      <h2 id="titulo-umbral" className="ui-title text-sm">
        Umbral de la edificación
      </h2>
      <p className="ui-muted max-w-3xl text-xs leading-relaxed">
        El criterio normativo es ±10 % de la media del mes (ec. 3) y ±2·DesvEst para los meses
        con muestra suficiente (ec. 4-5). Cambiarlo NO recalcula la bandeja: la marca como
        desactualizada y cada alerta conserva el umbral con el que se disparó.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="ui-field">
          <label htmlFor="alerta-pct" className="ui-label flex items-center gap-2">
            Umbral porcentual (ec. 3)
            <code className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs tabular-nums dark:bg-slate-800">
              ±{pct} %
            </code>
          </label>
          <input
            id="alerta-pct"
            type="range"
            min={UMBRAL_PCT_MIN}
            max={UMBRAL_PCT_MAX}
            step={1}
            value={pct}
            disabled={!puedeConfigurar}
            aria-valuetext={`± ${pct} por ciento`}
            onChange={(e) => setPct(Number(e.target.value))}
            className="h-10 w-full max-w-xs accent-uv-forest focus-ring"
          />
          <p className="ui-muted mt-1 text-xs">Aplica a los meses con muestra insuficiente.</p>
        </div>
        <div className="ui-field">
          <label htmlFor="alerta-k" className="ui-label flex items-center gap-2">
            Múltiplo de DesvEst (ec. 4-5)
            <code className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs tabular-nums dark:bg-slate-800">
              ±{formatoNumero(k, 1)} σ
            </code>
          </label>
          <input
            id="alerta-k"
            type="range"
            min={UMBRAL_K_MIN}
            max={UMBRAL_K_MAX}
            step={UMBRAL_K_PASO}
            value={k}
            disabled={!puedeConfigurar}
            aria-valuetext={`± ${formatoNumero(k, 1)} desviaciones estándar`}
            onChange={(e) => setK(Number(e.target.value))}
            className="h-10 w-full max-w-xs accent-uv-forest focus-ring"
          />
          <p className="ui-muted mt-1 text-xs">
            Aplica a los meses con muestra suficiente (el motor usa 2,0 σ).
          </p>
        </div>
      </div>

      <label className="inline-flex min-h-10 items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={activo}
          disabled={!puedeConfigurar}
          onChange={(e) => setActivo(e.target.checked)}
          className="size-4 accent-uv-forest focus-ring"
        />
        Generar alertas para esta edificación
      </label>

      {!activo && (
        <p className="ui-callout ui-callout-warn">
          Con la generación desactivada, un recálculo no crea ni borra alertas: la bandeja
          actual se conserva tal cual.
        </p>
      )}

      {puedeConfigurar ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="ui-btn ui-btn-primary focus-ring"
            disabled={!sucio || guardando}
            onClick={() => onGuardar({ pct, k, activo })}
          >
            {guardando ? 'Guardando…' : 'Guardar umbral'}
          </button>
          {sucio && (
            <span className="ui-muted text-xs">Cambios sin guardar.</span>
          )}
          {!sucio && desactualizada && (
            <span className="ui-muted text-xs">
              Recuerde recalcular para aplicar el umbral.
            </span>
          )}
        </div>
      ) : (
        <p className="ui-callout ui-callout-info">
          Su rol puede consultar el umbral, pero configurarlo requiere el permiso «Configurar
          umbral».
        </p>
      )}
    </section>
  )
}
