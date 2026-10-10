import { SignJWT, jwtVerify } from 'jose'

/**
 * Módulo JWT edge-safe: sólo `jose`, sin Prisma ni bcryptjs.
 *
 * El middleware corre en el runtime Edge (Vercel) y no puede importar
 * `auth.ts`, que arrastra `prisma` y `bcryptjs`. La firma y verificación
 * viven aquí; `auth.ts` re-exporta para mantener el API público de la app.
 */

const SECRETO_RESERVA_DEV = 'fallback-secret-change-in-production-min-32-chars-long'

export interface JWTPayload {
  userId: string
  email: string
  role: string
}

// Short-lived token handed out after the password check when 2FA is required.
// It is NOT a session — it only proves "password already verified" and must be
// exchanged for a real session at /api/auth/2fa/verify. `purpose` scopes it so
// a step token can never be mistaken for a session token.
export interface LoginStepPayload extends JWTPayload {
  purpose: 'login-step'
}

export const LOGIN_STEP_TTL = '5m'

function secretoJwt(): Uint8Array {
  const secreto = process.env.JWT_SECRET
  if (!secreto) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET no está definido. Configure la variable de entorno en producción.'
      )
    }
    // Sólo en desarrollo local; en producción el secreto es obligatorio.
    return new TextEncoder().encode(SECRETO_RESERVA_DEV)
  }
  return new TextEncoder().encode(secreto)
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || '7d')
    .sign(secretoJwt())
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretoJwt())
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function createLoginStepToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload, purpose: 'login-step' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(LOGIN_STEP_TTL)
    .sign(secretoJwt())
}

// Returns the payload only when the token is a genuine login-step token.
// A real session token (no `purpose`) is rejected — the two are never
// interchangeable.
export async function verifyLoginStepToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretoJwt())
    if (payload.purpose !== 'login-step') return null
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}
