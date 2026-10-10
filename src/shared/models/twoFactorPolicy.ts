import type { Role } from './permissions'

// ==========================================
// 2FA policy — single source of truth
// ==========================================
//
// Hybrid policy: TOTP 2FA is MANDATORY for roles whose access can compromise
// system-wide information (users, energy data, infrastructure), and OPTIONAL
// for the rest. Adding a role here is the only change needed to extend the
// policy — every server guard derives from this list.

export const TWO_FACTOR_REQUIRED_ROLES: readonly Role[] = [
  'ADMIN_TI',
  'GESTOR_ENERGETICO',
]

export function isTwoFactorRequiredForRole(role: Role): boolean {
  return (TWO_FACTOR_REQUIRED_ROLES as readonly string[]).includes(role)
}
