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

// Admin-forced 2FA requirement (POST /api/users/[id]/2fa/require)
export const setTwoFactorRequiredSchema = z.object({
  required: z.boolean(),
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

// Self-service account settings (PATCH /api/profile). Email is deliberately
// NOT editable here (identity field, admin-only change) and the password has
// its own dedicated endpoint.
export const updateProfileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100).optional(),
  phone: phoneSchema,
  avatarUrl: z
    .string()
    .max(300_000, 'La imagen es demasiado grande; usa una de hasta 256px')
    .regex(/^data:image\/(webp|png|jpeg);base64,/, 'Formato de imagen no soportado')
    .optional()
    .nullable(),
  timezone: z.string().min(1).max(64).optional(),
  notificationsEmail: z.boolean().optional(),
  notificationsInApp: z.boolean().optional(),
})

// Self-service password change (POST /api/profile/password)
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
  newPassword: passwordSchema,
})

export type LoginInput = z.infer<typeof loginSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
