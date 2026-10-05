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
