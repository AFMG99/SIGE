import { describe, it, expect } from 'vitest'
import {
  isTwoFactorRequired,
  isTwoFactorRequiredForRole,
  TWO_FACTOR_REQUIRED_ROLES,
} from './twoFactorPolicy'

describe('twoFactorPolicy', () => {
  it('requires 2FA for ADMIN_TI', () => {
    expect(isTwoFactorRequiredForRole('ADMIN_TI')).toBe(true)
  })

  it('requires 2FA for GESTOR_ENERGETICO', () => {
    expect(isTwoFactorRequiredForRole('GESTOR_ENERGETICO')).toBe(true)
  })

  it('does not require 2FA for COORD_INFRAESTRUCTURA', () => {
    expect(isTwoFactorRequiredForRole('COORD_INFRAESTRUCTURA')).toBe(false)
  })

  it('does not require 2FA for DIRECTIVO', () => {
    expect(isTwoFactorRequiredForRole('DIRECTIVO')).toBe(false)
  })

  it('does not require 2FA for COMUNIDAD_UNIVERSITARIA', () => {
    expect(isTwoFactorRequiredForRole('COMUNIDAD_UNIVERSITARIA')).toBe(false)
  })

  it('exposes the mandatory roles list', () => {
    expect(TWO_FACTOR_REQUIRED_ROLES).toContain('ADMIN_TI')
    expect(TWO_FACTOR_REQUIRED_ROLES).toContain('GESTOR_ENERGETICO')
    expect(TWO_FACTOR_REQUIRED_ROLES).toHaveLength(2)
  })

  describe('isTwoFactorRequired (role OR admin-forced flag)', () => {
    it('requires 2FA for a mandatory role even without the flag', () => {
      expect(isTwoFactorRequired({ role: 'ADMIN_TI', twoFactorRequired: false })).toBe(true)
    })

    it('requires 2FA for an optional role when the admin flag is on', () => {
      expect(
        isTwoFactorRequired({ role: 'COMUNIDAD_UNIVERSITARIA', twoFactorRequired: true })
      ).toBe(true)
    })

    it('does not require 2FA for an optional role without the flag', () => {
      expect(
        isTwoFactorRequired({ role: 'COORD_INFRAESTRUCTURA', twoFactorRequired: false })
      ).toBe(false)
    })

    it('keeps DIRECTIVO optional when only the role is checked', () => {
      expect(isTwoFactorRequired({ role: 'DIRECTIVO', twoFactorRequired: false })).toBe(false)
    })
  })
})
