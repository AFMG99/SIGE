import { prisma } from './prisma'

// TOTP verification rate limiter — stored in the DB so it is safe across
// serverless replicas (no in-memory state). Fails closed: when in doubt,
// treat as locked.

const MAX_INTENTOS = 5
const BLOQUEO_MINUTOS = 15

export interface EstadoRateLimit {
  bloqueado: boolean
  restantes: number
  reintentoEnMs: number | null
}

export async function consultarRateLimit(userId: string): Promise<EstadoRateLimit> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorFailedAttempts: true, twoFactorLockedUntil: true },
  })
  if (!user) return { bloqueado: true, restantes: 0, reintentoEnMs: null }

  const ahora = new Date()
  if (user.twoFactorLockedUntil && user.twoFactorLockedUntil > ahora) {
    return {
      bloqueado: true,
      restantes: 0,
      reintentoEnMs: user.twoFactorLockedUntil.getTime() - ahora.getTime(),
    }
  }

  return {
    bloqueado: false,
    restantes: Math.max(0, MAX_INTENTOS - user.twoFactorFailedAttempts),
    reintentoEnMs: null,
  }
}

// Returns true when the attempt is allowed. Resets the counter (and lock)
// when the user is not currently locked. Callers must only invoke this AFTER
// a successful password check — never for anonymous traffic.
export async function abrirVentanaIntentos(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorLockedUntil: true },
  })
  if (!user) return false

  const ahora = new Date()
  if (user.twoFactorLockedUntil && user.twoFactorLockedUntil > ahora) return false

  // Fresh window: clear any stale counter/lock from a previous round.
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorFailedAttempts: 0, twoFactorLockedUntil: null },
  })
  return true
}

// Records a failed TOTP attempt. Returns the updated state so the caller can
// report whether the account is now locked.
export async function registrarFallo(userId: string): Promise<EstadoRateLimit> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { twoFactorFailedAttempts: { increment: 1 } },
    select: { twoFactorFailedAttempts: true },
  })

  if (user.twoFactorFailedAttempts >= MAX_INTENTOS) {
    const lockedUntil = new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000)
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorLockedUntil: lockedUntil, twoFactorFailedAttempts: 0 },
    })
    return { bloqueado: true, restantes: 0, reintentoEnMs: BLOQUEO_MINUTOS * 60 * 1000 }
  }

  return {
    bloqueado: false,
    restantes: MAX_INTENTOS - user.twoFactorFailedAttempts,
    reintentoEnMs: null,
  }
}

// Clears the counter after a successful verification.
export async function limpiarIntentos(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorFailedAttempts: 0, twoFactorLockedUntil: null },
  })
}
