import { cookies, headers } from 'next/headers'
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

// Creates the session row AND sets the auth cookie. Used by phase-1 login for
// users who do not have 2FA enabled.
export async function createSession(userId: string, email: string, role: string) {
  const token = await createToken({ userId, email, role })
  await persistSession(userId, token)
  await setAuthCookie(token)
  return token
}

// Persists a session row for an already-issued JWT. Used by the 2FA verify
// step, which mints the token only after the second factor succeeds.
// The User-Agent is captured here (single choke point for every login path)
// so the user's own session list can show which device each session belongs to.
export async function persistSession(userId: string, token: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  const userAgent = (await headers()).get('user-agent')
  await prisma.session.create({
    data: { userId, token, expiresAt, userAgent: userAgent?.slice(0, 255) ?? null },
  })
}

// Sets the auth cookie for a token whose DB row already exists.
export async function setAuthCookie(token: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const cookieStore = await cookies()
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
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