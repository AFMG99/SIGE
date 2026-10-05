// Platform roles and per-module permission matrix.
// This file is the SINGLE SOURCE OF TRUTH for roles, module access and the
// Spanish matrix rendered by the admin UI (MATRIX_ROWS). Server guards
// (src/shared/models/authz.ts) and the navigation UI both derive from it.

// ==========================================
// Roles
// ==========================================

export const ROLES = [
  'ADMIN_TI',
  'GESTOR_ENERGETICO',
  'COORD_INFRAESTRUCTURA',
  'DIRECTIVO',
  'COMUNIDAD_UNIVERSITARIA',
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN_TI: 'Administrador (TI)',
  GESTOR_ENERGETICO: 'Gestor Energético',
  COORD_INFRAESTRUCTURA: 'Coord. Infraestructura',
  DIRECTIVO: 'Directivo',
  COMUNIDAD_UNIVERSITARIA: 'Comunidad Universitaria',
}

// ==========================================
// User Status
// ==========================================

export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  PENDING: 'Pendiente',
}

export const STATUS_BADGES: Record<UserStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  INACTIVE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

/**
 * Role badges styled with the brand palette (globals.css @theme).
 * Backgrounds are solid brand colors; text is chosen for WCAG AA contrast
 * on each background (white on deep/purple, ink on light colors).
 */
export const ROLE_BADGES: Record<Role, string> = {
  ADMIN_TI: 'bg-uv-deep text-white',
  GESTOR_ENERGETICO: 'bg-uv-soft text-uv-ink',
  COORD_INFRAESTRUCTURA: 'bg-uv-turquoise text-uv-ink',
  DIRECTIVO: 'bg-uv-purple text-white',
  COMUNIDAD_UNIVERSITARIA: 'bg-uv-sky text-uv-ink',
}

// ==========================================
// Modules
// ==========================================

export const MODULES = [
  { id: 'users', label: 'Gestión de Usuarios' },
  { id: 'consumption', label: 'Registro de Consumo' },
  { id: 'estimates', label: 'Estimaciones y Modelos' },
  { id: 'plans', label: 'Planos de la Universidad' },
  { id: 'inventory', label: 'Inventario de Equipos' },
  { id: 'reports', label: 'Generación de Reportes' },
] as const

export type ModuleId = (typeof MODULES)[number]['id']

// ==========================================
// Access model
// ==========================================

export interface ModuleAccess {
  /** false → "No accede": menu hidden, all API/page access denied. */
  visible: boolean
  /** snake_case action ids matching the permission matrix words. */
  can: string[]
  /** Human-readable note (Spanish), used for the matrix cell text. */
  note?: string
  /**
   * "Oculto (Por seguridad)": the module is deliberately hidden from the
   * role. Enforcement is identical to `visible: false` — the flag only keeps
   * the security-driven distinction visible to readers of the matrix.
   */
  hidden?: boolean
}

const allow = (...can: string[]): ModuleAccess => ({ visible: true, can })

const deny = (): ModuleAccess => ({ visible: false, can: [] })

const hide = (note: string): ModuleAccess => ({ visible: false, can: [], hidden: true, note })

// ==========================================
// Matrix (role × module)
// ==========================================

export const PERMISSIONS: Record<Role, Record<ModuleId, ModuleAccess>> = {
  ADMIN_TI: {
    users: allow('create', 'edit'),
    consumption: allow('configure_origin'),
    estimates: deny(),
    plans: allow('read'),
    inventory: deny(),
    reports: deny(),
  },
  GESTOR_ENERGETICO: {
    users: deny(),
    consumption: allow('upload', 'analyze', 'download'),
    estimates: allow('create', 'evaluate'),
    plans: allow('read'),
    inventory: allow('read'),
    reports: allow('design', 'generate'),
  },
  COORD_INFRAESTRUCTURA: {
    users: deny(),
    consumption: allow('read'),
    estimates: allow('read'),
    plans: allow('upload', 'modify'),
    inventory: allow('register', 'update'),
    reports: allow('read'),
  },
  DIRECTIVO: {
    users: deny(),
    consumption: allow('read'),
    estimates: allow('read'),
    plans: allow('read'),
    inventory: allow('read'),
    reports: allow('download_reports'),
  },
  COMUNIDAD_UNIVERSITARIA: {
    users: deny(),
    consumption: deny(),
    estimates: allow('view_impact'),
    plans: hide('Oculto (Por seguridad)'),
    inventory: hide('Oculto'),
    reports: deny(),
  },
}

// ==========================================
// Helpers
// ==========================================

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function moduleAccess(role: Role, moduleId: ModuleId): ModuleAccess {
  return PERMISSIONS[role][moduleId]
}

/**
 * `can(role, module)` → any access at all (module visible).
 * `can(role, module, action)` → specific action allowed.
 */
export function can(role: Role, moduleId: ModuleId, action?: string): boolean {
  const access = moduleAccess(role, moduleId)
  if (!access.visible) return false
  return action === undefined || access.can.includes(action)
}

export function visibleModules(role: Role): ModuleId[] {
  return MODULES.filter((module) => moduleAccess(role, module.id).visible).map(
    (module) => module.id
  )
}

// ==========================================
// Matrix rows for the admin UI
// ==========================================

/** Spanish cell text per action id (matrix wording). */
const ACTION_TEXT: Record<string, string> = {
  create: 'Crear',
  edit: 'Editar',
  configure_origin: 'Configura origen',
  analyze: 'Analiza',
  download: 'Descarga',
  evaluate: 'Evalúa',
  read: 'Solo lectura',
  view_macro: 'Visualiza (Gráficos macro)',
  view_impact: 'Visualiza (Impacto/Ahorro)',
  upload: 'Carga',
  modify: 'Modifica',
  register: 'Registra',
  update: 'Actualiza',
  design: 'Diseña',
  generate: 'Genera',
  download_reports: 'Descarga informes',
  download_public: 'Descarga reportes públicos',
}

// Module-specific wording where the generic action label does not fit
// ("Crea / Evalúa" instead of "Crear / Evalúa" for estimates).
const ACTION_TEXT_OVERRIDES: Partial<Record<ModuleId, Record<string, string>>> = {
  estimates: { create: 'Crea' },
}

function cellText(role: Role, moduleId: ModuleId): string {
  const access = moduleAccess(role, moduleId)
  if (!access.visible) {
    if (access.hidden) return access.note ?? 'Oculto'
    return 'No accede'
  }
  const overrides = ACTION_TEXT_OVERRIDES[moduleId]
  return access.can
    .map((action) => overrides?.[action] ?? ACTION_TEXT[action] ?? action)
    .join(' / ')
}

export interface MatrixRow {
  moduleId: ModuleId
  moduleLabel: string
  cells: Record<Role, string>
}

/** Full role × module matrix (rows = modules, cols = ROLES), in Spanish. */
export const MATRIX_ROWS: MatrixRow[] = MODULES.map((module) => {
  const cells = {} as Record<Role, string>
  for (const role of ROLES) {
    cells[role] = cellText(role, module.id)
  }
  return { moduleId: module.id, moduleLabel: module.label, cells }
})

// ==========================================
// Derived helpers for overrides / grants
// ==========================================

/** All actions any role has for a given module (union across roles). Computed from PERMISSIONS. */
export const MODULE_ACTIONS: Record<ModuleId, readonly string[]> = (() => {
  const map: Record<string, Set<string>> = {}
  for (const mod of MODULES) {
    map[mod.id] = new Set()
  }
  for (const role of ROLES) {
    for (const mod of MODULES) {
      const access = PERMISSIONS[role][mod.id]
      if (access.visible) {
        for (const action of access.can) {
          map[mod.id].add(action)
        }
      }
    }
  }
  const result: Record<string, readonly string[]> = {}
  for (const mod of MODULES) {
    result[mod.id] = Array.from(map[mod.id]).sort()
  }
  return result as Record<ModuleId, readonly string[]>
})()

/** Human-readable Spanish labels for every action that appears in PERMISSIONS. */
export const ACTION_LABELS: Record<string, string> = {
  create: 'Crear',
  edit: 'Editar',
  configure_origin: 'Configura origen',
  analyze: 'Analiza',
  download: 'Descarga',
  evaluate: 'Evalúa',
  read: 'Solo lectura',
  view_macro: 'Visualiza (Gráficos macro)',
  view_impact: 'Visualiza (Impacto/Ahorro)',
  upload: 'Cargar',
  modify: 'Modificar',
  register: 'Registrar',
  update: 'Actualizar',
  design: 'Diseñar',
  generate: 'Generar',
  download_reports: 'Descargar informes',
  download_public: 'Descargar reportes públicos',
}

/** Thin wrapper over `can()` for explicit action checks. */
export function roleHasAction(role: Role, moduleId: ModuleId, action: string): boolean {
  return can(role, moduleId, action)
}
