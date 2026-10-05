import { z } from 'zod'
import { ROLES } from './permissions'

// Shared password strength rule (register + admin user management)
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: passwordSchema,
})

// Public self-registration: no role field. The server always assigns
// COMUNIDAD_UNIVERSITARIA and ignores anything the client sends.
const registerBaseSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().email('Email inválido'),
  password: passwordSchema,
  confirmPassword: z.string(),
})

export const registerSchema = registerBaseSchema.refine(
  (data) => data.password === data.confirmPassword,
  { message: 'Las contraseñas no coinciden', path: ['confirmPassword'] }
)

// Exportar shape para validación individual de campos
export const registerFieldSchemas = registerBaseSchema.shape

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
export type RegisterInput = z.infer<typeof registerSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
