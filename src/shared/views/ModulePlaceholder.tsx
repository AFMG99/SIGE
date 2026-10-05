'use client'

import { moduleAccess, type ModuleId, type Role } from '@/shared/models/permissions'

interface ModulePlaceholderProps {
  title: string
  moduleId?: ModuleId
  role: Role | null
  /** Action ids granted through active temporary permission overrides. */
  temporalActions?: string[]
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Crear',
  edit: 'Editar',
  configure_origin: 'Configurar origen',
  analyze: 'Analizar',
  download: 'Descargar',
  evaluate: 'Evaluar',
  read: 'Solo lectura',
  view_macro: 'Visualizar (Gráficos macro)',
  view_impact: 'Visualizar (Impacto/Ahorro)',
  upload: 'Cargar',
  modify: 'Modificar',
  register: 'Registrar',
  update: 'Actualizar',
  design: 'Diseñar',
  generate: 'Generar',
  download_reports: 'Descargar informes',
  download_public: 'Descargar reportes públicos',
}

const MODULE_OVERRIDES: Partial<Record<ModuleId, Record<string, string>>> = {
  estimates: { create: 'Crear' },
}

export function ModulePlaceholder({
  title,
  moduleId,
  role,
  temporalActions = [],
}: ModulePlaceholderProps) {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center dark:bg-emerald-500/15">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{title.charAt(0)}</span>
          </div>
          <div>
            <h2 className="ui-title text-2xl">{title}</h2>
            <p className="ui-muted mt-1 text-sm">Módulo en construcción</p>
          </div>
        </div>

        {moduleId && role && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl dark:bg-slate-800/60">
            <h3 className="ui-label mb-3">
              Acciones disponibles para tu rol ({role}):
            </h3>
            {temporalActions.length > 0 && (
              <p className="-mt-2 mb-3 text-xs font-medium text-amber-700 dark:text-amber-400">
                Incluye permisos temporales activos
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {(() => {
                const access = moduleAccess(role, moduleId)
                const base = access.visible ? access.can : []
                const temporal = temporalActions.filter((action) => !base.includes(action))
                if (base.length === 0 && temporal.length === 0) {
                  return (
                    <span className="text-sm text-gray-500 italic dark:text-gray-400">
                      Sin acciones disponibles en este módulo
                    </span>
                  )
                }
                return (
                  <>
                    {base.map((action) => (
                      <span
                        key={action}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:border-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-400"
                      >
                        {MODULE_OVERRIDES[moduleId]?.[action] ?? ACTION_LABELS[action] ?? action}
                      </span>
                    ))}
                    {temporal.map((action) => (
                      <span
                        key={action}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-300"
                      >
                        {MODULE_OVERRIDES[moduleId]?.[action] ?? ACTION_LABELS[action] ?? action}
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide">
                          temporal
                        </span>
                      </span>
                    ))}
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {!moduleId && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl dark:bg-slate-800/60">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Este módulo está disponible para todos los roles.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}