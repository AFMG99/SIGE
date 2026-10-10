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
