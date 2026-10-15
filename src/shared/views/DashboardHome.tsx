'use client'

import Link from 'next/link'
import * as React from 'react'
import { ROLE_BADGES, ROLE_LABELS, type Role } from '@/shared/models/permissions'
import { NAV_ITEMS, isItemVisible } from './ModuleNav'
import { BarList, SeriesChart, Sparkline } from './charts'
import {
  construirResumen,
  etiquetaPeriodoCorta,
  formatoCop,
  formatoDelta,
  formatoKwh,
  type EnergySummary,
} from './dashboardModel'

export type { EnergySummary }

export interface HomeAccount {
  id: string
  name: string | null
  email: string
  role: Role
  /** ISO-8601 creation date of the user row. */
  createdAt: string
}

/** Short card copy keyed by NAV_ITEMS id (the home never links to itself). */
const DESCRIPTIONS: Record<string, string> = {
  users: 'Cuentas, roles y permisos de acceso.',
  consumption: 'Facturas EPM, equipos, variables y catálogos.',
  analisis: 'Tendencias y comparaciones del histórico de consumo.',
  alertas: 'Avisos y notificaciones del sistema.',
  estimates: 'Modelos y estimaciones de consumo.',
  reports: 'Reportes y exportaciones autorizados.',
  plans: 'Planos y representación espacial de la universidad.',
}

const STAT_LABEL = 'text-xs font-medium uppercase tracking-wide ui-muted'

function PersonIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-emerald-600 dark:text-emerald-400"
    >
      <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
      <path d="M12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="ml-auto shrink-0 self-center text-gray-300 transition-colors group-hover:text-emerald-600 dark:text-slate-600 dark:group-hover:text-emerald-400"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

/**
 * Variación con semántica correcta: en consumo/costo, BAJAR es bueno
 * (`positivoEsBueno: false`); en ahorro, subir es bueno.
 */
function DeltaTexto({
  pct,
  positivoEsBueno,
  sufijo = 'vs mes anterior',
}: {
  pct: number | null
  positivoEsBueno: boolean
  sufijo?: string
}) {
  if (pct === null) {
    return (
      <p className="mt-1 text-xs ui-muted">
        Sin período anterior comparable
      </p>
    )
  }
  const bueno = positivoEsBueno ? pct >= 0 : pct <= 0
  return (
    <p
      className={`mt-1 text-xs font-medium ${
        bueno ? 'text-uv-forest dark:text-uv-soft' : 'text-rose-600 dark:text-rose-400'
      }`}
    >
      <span aria-hidden>{pct < 0 ? '▼' : '▲'}</span> {formatoDelta(pct)}{' '}
      <span className="font-normal ui-muted">{sufijo}</span>
    </p>
  )
}

function BadgeCobertura({ conLineaBase }: { conLineaBase: boolean }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
        conLineaBase
          ? 'bg-uv-forest/10 text-uv-forest dark:bg-uv-soft/15 dark:text-uv-soft'
          : 'bg-uv-mid/25 text-uv-ink/70 dark:bg-slate-700 dark:text-slate-300'
      }`}
    >
      {conLineaBase ? 'Con LBEn' : 'Sin LBEn'}
    </span>
  )
}

/**
 * Landing view of the authenticated area: account identity (all fields the
 * dashboard already showed), one card per module the role can see and — only
 * when the server authorized it — a real energy overview in dashboard style:
 * KPIs with deltas, «consumo vs línea base», distribution, recent invoices
 * and the ahorro leaderboard (T2 of the redesign, S1–S5).
 */
export function DashboardHome({
  account,
  extraModules = [],
  energy = null,
}: {
  account: HomeAccount
  extraModules?: string[]
  energy?: EnergySummary | null
}) {
  const memberSince = new Date(account.createdAt).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
  })

  // Same gating as ModuleNav: visibleModules(role) + extraModules, shared
  // through the exported isItemVisible — never a parallel permission check.
  const cards = NAV_ITEMS.filter(
    (item) => item.id !== 'dashboard' && isItemVisible(account.role, item, extraModules)
  )

  const conDatos = energy !== null && energy.facturas > 0
  const resumen = React.useMemo(
    () => (energy ? construirResumen(energy) : null),
    [energy]
  )

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-12 sm:px-6 lg:px-8">
      <header className="ui-panel space-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/15"
          >
            <PersonIcon />
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide ui-muted">Vista de inicio</p>
            <h1 className="ui-title truncate text-2xl">{account.name || 'Usuario'}</h1>
            <p className="truncate text-sm ui-muted">{account.email}</p>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="ui-stat">
            <dt className={STAT_LABEL}>Rol</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${ROLE_BADGES[account.role]}`}
              >
                {ROLE_LABELS[account.role]}
              </span>
            </dd>
          </div>
          <div className="ui-stat">
            <dt className={STAT_LABEL}>Miembro desde</dt>
            <dd className="ui-title mt-1 text-sm">{memberSince}</dd>
          </div>
          <div className="ui-stat">
            <dt className={STAT_LABEL}>ID</dt>
            <dd className="ui-title mt-1 font-mono text-sm">
              {account.id.slice(0, 12)}...
            </dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="home-modulos" className="space-y-4">
        <div>
          <h2 id="home-modulos" className="ui-title text-lg">
            Módulos
          </h2>
          <p className="text-sm ui-muted">Accesos disponibles según tu rol.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="ui-card focus-ring group flex min-h-10 items-start gap-3 transition-colors hover:border-emerald-300 hover:shadow-md dark:hover:border-emerald-700"
            >
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
              >
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="ui-title block text-sm">{item.fullLabel}</span>
                <span className="mt-0.5 block text-xs ui-muted">
                  {DESCRIPTIONS[item.id]}
                </span>
              </span>
              <Chevron />
            </Link>
          ))}
        </div>
      </section>

      {energy && resumen && (
        <section aria-labelledby="home-resumen" className="ui-panel space-y-6">
          <div>
            <h2 id="home-resumen" className="ui-title text-lg">
              Resumen energético
            </h2>
            <p className="text-sm ui-muted">
              Datos reales de SIGE al abrir esta página: facturas EPM normalizadas a
              30 días y líneas base guardadas (modelo de mejor R² por bloque) — sin
              estimaciones ni proyecciones.
            </p>
          </div>

          {conDatos && resumen.periodoActual && (
            <>
              {/* KPIs (estilo referencia: valor + delta vs mes anterior) */}
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="ui-card-stat p-4">
                  <dt className={STAT_LABEL}>
                    Consumo · {etiquetaPeriodoCorta(resumen.periodoActual)}
                  </dt>
                  <dd className="mt-1 flex items-end justify-between gap-2">
                    <span className="ui-title text-2xl tabular-nums">
                      {resumen.consumo.valor !== null
                        ? formatoKwh(resumen.consumo.valor)
                        : '—'}
                    </span>
                    <Sparkline
                      valores={resumen.serie.map((p) => p.consumo)}
                      ancho={96}
                      alto={32}
                    />
                  </dd>
                  <dd>
                    <DeltaTexto pct={resumen.consumo.deltaPct} positivoEsBueno={false} />
                  </dd>
                </div>

                <div className="ui-card-stat p-4">
                  <dt className={STAT_LABEL}>
                    Costo · {etiquetaPeriodoCorta(resumen.periodoActual)}
                  </dt>
                  <dd className="mt-1 flex items-end justify-between gap-2">
                    <span className="ui-title text-2xl tabular-nums">
                      {resumen.costo.valor !== null ? formatoCop(resumen.costo.valor) : '—'}
                    </span>
                    <Sparkline
                      valores={resumen.serie.map((p) => p.costo)}
                      ancho={96}
                      alto={32}
                      color="sky"
                    />
                  </dd>
                  <dd>
                    <DeltaTexto pct={resumen.costo.deltaPct} positivoEsBueno={false} />
                  </dd>
                </div>

                <div className="ui-card-stat p-4">
                  <dt className={STAT_LABEL}>Ahorro vs línea base</dt>
                  {resumen.ahorro ? (
                    <>
                      <dd className="ui-title mt-1 text-2xl tabular-nums">
                        {formatoKwh(resumen.ahorro.kwh)}
                      </dd>
                      <dd>
                        <DeltaTexto
                          pct={resumen.ahorro.pct}
                          positivoEsBueno
                          sufijo="por debajo de la LBEn"
                        />
                      </dd>
                    </>
                  ) : (
                    <dd className="mt-1 text-sm ui-muted">
                      Sin línea base guardada. Calcula una LBEn en Datos para ver el
                      ahorro aquí.
                    </dd>
                  )}
                </div>

                <div className="ui-card-stat p-4">
                  <dt className={STAT_LABEL}>Cobertura LBEn</dt>
                  <dd className="ui-title mt-1 text-2xl tabular-nums">
                    {resumen.cobertura.bloquesConLb} / {resumen.cobertura.bloquesTotales}
                  </dd>
                  <dd className="mt-1 text-xs ui-muted">
                    {resumen.cobertura.bloquesTotales > 0
                      ? `${Math.round(
                          (resumen.cobertura.bloquesConLb / resumen.cobertura.bloquesTotales) * 100
                        )} % de los bloques con línea base guardada`
                      : 'Sin bloques registrados'}
                  </dd>
                </div>
              </dl>

              {/* Serie real vs «target» (LBEn) + distribución por edificación */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="ui-card p-4 lg:col-span-2">
                  <h3 className="ui-title mb-3 text-sm">
                    Consumo mensual contra línea base
                  </h3>
                  <SeriesChart
                    titulo="Consumo mensual contra línea base"
                    etiquetas={resumen.serie.map((p) => etiquetaPeriodoCorta(p.periodo))}
                    series={[
                      {
                        clave: 'real',
                        nombre: 'Consumo real (kWh/30 d)',
                        valores: resumen.serie.map((p) => p.consumo),
                        tipo: 'area',
                      },
                      {
                        clave: 'lb',
                        nombre: 'Línea base (mejor R²)',
                        valores: resumen.serieLb,
                        tipo: 'linea',
                        color: 'deep',
                      },
                    ]}
                    formatoValor={(v) => formatoKwh(v)}
                    sinDatos="Aún no hay facturas suficientes para graficar."
                  />
                </div>
                <div className="ui-card p-4">
                  <h3 className="ui-title mb-3 text-sm">
                    Consumo por edificación · {resumen.periodoActual}
                  </h3>
                  <BarList
                    titulo="Distribución del consumo por edificación"
                    datos={resumen.distribucion}
                    vacio="Registra facturas para ver la distribución."
                    deltaPositivoEsBueno={false}
                  />
                </div>
              </div>

              {/* Actividad reciente + ranking de ahorro */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="ui-card p-4 lg:col-span-2">
                  <h3 className="ui-title mb-3 text-sm">Últimas facturas</h3>
                  <div className="ui-table-shell">
                    <table className="ui-table">
                      <caption className="sr-only">
                        Últimas facturas EPM registradas con su estado de línea base
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Período</th>
                          <th scope="col">Edificación</th>
                          <th scope="col" className="text-right">
                            kWh (30 d)
                          </th>
                          <th scope="col" className="text-right">
                            Costo
                          </th>
                          <th scope="col">Línea base</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumen.facturas.map((f) => (
                          <tr key={f.id}>
                            <td className="whitespace-nowrap tabular-nums">{f.periodo}</td>
                            <td className="max-w-[10rem] truncate">
                              {f.edificacionNombre}
                            </td>
                            <td className="whitespace-nowrap text-right tabular-nums">
                              {formatoKwh(f.consumoNormalizado)}
                            </td>
                            <td className="whitespace-nowrap text-right tabular-nums">
                              {formatoCop(f.costoCop)}
                            </td>
                            <td>
                              <BadgeCobertura conLineaBase={f.conLineaBase} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="ui-card p-4">
                  <h3 className="ui-title mb-1 text-sm">Top ahorros</h3>
                  <p className="mb-3 text-xs ui-muted">
                    Edificaciones por ahorro vs su línea base · costo del período
                  </p>
                  {resumen.ranking.length > 0 ? (
                    <ol
                      aria-label="Ranking de ahorro por edificación"
                      className="space-y-3"
                    >
                      {resumen.ranking.map((f, i) => (
                        <li key={f.clave} className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-uv-lime/20 text-sm font-bold text-uv-forest dark:bg-uv-lime/10 dark:text-uv-soft"
                          >
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-uv-ink dark:text-slate-200">
                              {f.nombre}
                            </p>
                            <p className="truncate text-xs ui-muted tabular-nums">
                              {formatoCop(f.costoCop)} · costo
                            </p>
                          </div>
                          <div className="shrink-0 text-right tabular-nums">
                            <p
                              className={`text-sm font-semibold ${
                                f.ahorroKwh >= 0
                                  ? 'text-uv-forest dark:text-uv-soft'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {formatoKwh(f.ahorroKwh)}
                            </p>
                            <p className="text-xs ui-muted">{formatoDelta(f.ahorroPct)}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="ui-empty">
                      <p className="text-sm">
                        Guarda líneas base en Datos para construir el ranking de
                        ahorro.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Inventario: recuento directo (sin estimaciones) */}
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="ui-stat">
              <dt className={STAT_LABEL}>Facturas registradas</dt>
              <dd className="ui-title mt-1 text-2xl">{energy.facturas}</dd>
            </div>
            <div className="ui-stat">
              <dt className={STAT_LABEL}>Último periodo</dt>
              {energy.ultimoPeriodo ? (
                <dd className="ui-title mt-1 text-2xl">{energy.ultimoPeriodo}</dd>
              ) : (
                <dd className="mt-1 text-base ui-muted">Sin registros</dd>
              )}
            </div>
            <div className="ui-stat">
              <dt className={STAT_LABEL}>Edificaciones</dt>
              <dd className="ui-title mt-1 text-2xl">{energy.edificaciones}</dd>
            </div>
            <div className="ui-stat">
              <dt className={STAT_LABEL}>Bloques</dt>
              <dd className="ui-title mt-1 text-2xl">{energy.bloques.length}</dd>
            </div>
          </dl>

          {energy.facturas === 0 && (
            <div className="ui-empty">
              <p className="ui-title text-sm">Aún no hay facturas registradas</p>
              <p>
                Carga la primera factura EPM en el módulo de datos para que el
                resumen de consumo aparezca aquí.
              </p>
              <Link href="/dashboard/datos" className="ui-btn ui-btn-primary">
                Ir a Gestión de datos
              </Link>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
