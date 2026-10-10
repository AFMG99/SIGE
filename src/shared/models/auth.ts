import { cookies } from 'next/headers'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { createToken, verifyToken, type JWTPayload } from './jwt'

// La criptografía JWT vive en ./jwt (módulo sin dependencias de Node);
// aquí se re-exporta para mantener el API público de la app sin cambios.
export { createToken, verifyToken }
export type { JWTPayload }

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function createSession(userId: string, email: string, role: string) {
  const token = await createToken({ userId, email, role })
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  })
  
  const cookieStore = await cookies()
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
  
  return token
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  
  if (token) {
    await prisma.session.deleteMany({ where: { token } })
    cookieStore.delete('auth-token')
  }
}

export async function requireAuth(): Promise<JWTPayload> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}