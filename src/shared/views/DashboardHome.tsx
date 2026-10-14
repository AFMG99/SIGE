'use client'

import Link from 'next/link'
import { ROLE_BADGES, ROLE_LABELS, type Role } from '@/shared/models/permissions'
import { NAV_ITEMS, isItemVisible } from './ModuleNav'

export interface HomeAccount {
  id: string
  name: string | null
  email: string
  role: Role
  /** ISO-8601 creation date of the user row. */
  createdAt: string
}

/**
 * Cheap, honest aggregates. The server only fills this for users that can
 * access the `consumption` module — counts and the latest registered period,
 * never estimates, savings percentages or projections.
 */
export interface EnergySummary {
  facturas: number
  ultimoPeriodo: string | null
  edificaciones: number
  bloques: number
}

/** Short card copy keyed by NAV_ITEMS id (the home never links to itself). */
const DESCRIPTIONS: Record<string, string> = {
  users: 'Cuentas, roles y permisos de acceso.',
  consumption: 'Facturas EPM, equipos, variables y catálogos.',
  analisis: 'Tendencias y comparaciones del histórico de consumo.',
  alertas: 'Avisos y notificaciones del sistema.',
  estimates: 'Modelos y estimaciones de consumo.',
  reports: 'Reportes y exportaciones autorizadas.',
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
 * Landing view of the authenticated area: account identity (all fields the
 * dashboard already showed), one card per module the role can see and — only
 * when the server authorized it — a real, cheap energy summary.
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

      {energy && (
        <section aria-labelledby="home-resumen" className="ui-panel space-y-4">
          <div>
            <h2 id="home-resumen" className="ui-title text-lg">
              Resumen energético
            </h2>
            <p className="text-sm ui-muted">
              Recuento directo de los registros de SIGE al abrir esta página — sin
              estimaciones ni proyecciones.
            </p>
          </div>

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
              <dd className="ui-title mt-1 text-2xl">{energy.bloques}</dd>
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
