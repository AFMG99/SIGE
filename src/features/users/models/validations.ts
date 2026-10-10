import { z } from 'zod'
import { ROLES } from '@/shared/models/permissions'

// Shared password strength rule (admin user management)
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: passwordSchema,
})

// 2FA TOTP — a user-submitted code is exactly 6 digits.
export const totpCodeSchema = z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos')

// Second-phase login: a short-lived step token plus the TOTP code.
export const verifyTwoFactorSchema = z.object({
  stepToken: z.string().min(10, 'Token de sesión inválido'),
  code: totpCodeSchema,
})

// Admin user management (POST /api/users)
export const createUserSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().email('Email inválido'),
  password: passwordSchema,
  role: z.enum(ROLES),
})

// Admin user management (PATCH /api/users/[id]) — every field optional
export const updateUserSchema = createUserSchema.partial()

// Phone validation (loose regex for international formats)
export const phoneSchema = z.string().regex(/^[\d\s\-+()]{7,20}$/, 'Formato de teléfono inválido').optional().nullable()

export type LoginInput = z.infer<typeof loginSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
