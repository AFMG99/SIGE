// Server-side authorization guards.
// Role checks MUST run server-side on every page and API route; hiding UI
// links is cosmetic only.

import { getSession } from './auth'
import { prisma } from './prisma'
import { can, type ModuleId, type Role } from './permissions'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: Role
}

/**
 * Loads the current user from the database.
 * The role ALWAYS comes from the DB row — never from the JWT payload, which
 * can carry stale enum values from sessions created before a role migration.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession()
  if (!session) return null

  // Validar que session.userId existe y es una string válida
  /*if (!session.userId || typeof session.userId !== 'string') {
    logger.error('getCurrentUser: session.userId is missing or invalid', { session })
    return null
  }*/

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true },
  })
  if (!user) return null

  return { id: user.id, email: user.email, name: user.name, role: user.role }
}

/**
 * ADMIN_TI only (user management is restricted to Administrador (TI)).
 * Returns null when unauthenticated or not an admin — pages then
 * `redirect('/dashboard')` and API routes return 403.
 */
export async function requireAdmin(): Promise<AuthUser | null> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN_TI') return null
  return user
}

/**
 * True when `userId` holds an active override granting `action` (or any
 * action when omitted) on `moduleId`. Active = permanent (expiresAt null)
 * or not yet expired.
 *
 * Policy: 'users' never accepts overrides (defense in depth — the grant API
 * rejects it and getEffectiveExtraModules filters it).
 */
export async function hasActiveOverride(
  userId: string,
  moduleId: ModuleId,
  action?: string
): Promise<boolean> {
  if (moduleId === 'users') return false

  const override = await prisma.userPermissionOverride.findFirst({
    where: {
      userId,
      moduleId,
      ...(action ? { action } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  })
  return override !== null
}

/**
 * Action-level check: static role matrix OR an active temporary override.
 * This is THE entry point for action gates — `can()` alone ignores overrides.
 *
 * Order matters: the static matrix is checked first so users whose role
 * already grants the action never pay the DB round-trip.
 */
export async function canWithOverrides(
  user: { id: string; role: Role },
  moduleId: ModuleId,
  action?: string
): Promise<boolean> {
  if (moduleId === 'users') return can(user.role, moduleId, action)
  if (can(user.role, moduleId, action)) return true
  return hasActiveOverride(user.id, moduleId, action)
}

/** Active temporary action ids granted to a user on a module (UI display). */
export async function getOverrideActions(userId: string, moduleId: ModuleId): Promise<string[]> {
  const overrides = await getActiveOverrides(userId)
  return overrides.filter((o) => o.moduleId === moduleId).map((o) => o.action)
}

/**
 * Generic module/action guard for future feature modules.
 * Honours temporary overrides (see canWithOverrides).
 */
export async function requirePermission(
  moduleId: ModuleId,
  action?: string
): Promise<AuthUser | null> {
  const user = await getCurrentUser()
  if (!user || !(await canWithOverrides(user, moduleId, action))) return null
  return user
}

/**
 * Returns active permission overrides for a user (permanent or not expired).
 * Ordered by expiresAt ascending (permanent rows last in PostgreSQL).
 */
export async function getActiveOverrides(userId: string) {
  return prisma.userPermissionOverride.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { expiresAt: 'asc' },
  })
}

/**
 * Returns distinct moduleIds from a user's active overrides.
 * Used to show extra navigation items for temporarily granted modules.
 * NOTE: 'users' is excluded by policy — user management stays ADMIN_TI-only
 * regardless of any override row (defense in depth; the grant API also rejects it).
 */
export async function getEffectiveExtraModules(userId: string): Promise<ModuleId[]> {
  const overrides = await getActiveOverrides(userId)
  const moduleIds = new Set<ModuleId>()
  for (const o of overrides) {
    if (o.moduleId === 'users') continue
    moduleIds.add(o.moduleId as ModuleId)
  }
  return Array.from(moduleIds)
}

/**
 * Module visibility guard — returns user only when the role has *some* access
 * to the module (i.e. module appears in visibleModules) OR the user has an
 * active temporary override for that module.
 * Redirects to /dashboard when access is denied (caller must handle the redirect).
 * Use for pages where the navigation entry itself is gated by the permission
 * matrix (consumption, estimates, reports, plans).
 */
export async function requireModuleAccess(moduleId: ModuleId): Promise<AuthUser | null> {
  const user = await getCurrentUser()
  if (!user) return null

  // Static role-based check
  const { visibleModules } = await import('./permissions')
  if (visibleModules(user.role).includes(moduleId)) return user

  // Fallback: check active temporary overrides
  if (await hasActiveOverride(user.id, moduleId)) return user

  return null
}
