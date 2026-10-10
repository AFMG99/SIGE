import { createHash, randomBytes } from 'node:crypto'
import { prisma } from './prisma'

// Single-use 2FA recovery codes. Only the SHA-256 hash is stored; the
// plaintext is returned to the user exactly once at generation and never
// persisted. 8 codes, each 10 hex chars (40 bits of entropy, plenty for a
// code the user keeps offline).

const CANTIDAD = 8

function normalizar(code: string): string {
  return code.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function hashear(code: string): string {
  return createHash('sha256').update(normalizar(code)).digest('hex')
}

// Generates a fresh set, replacing any previous codes. Returns plaintext codes
// for one-time display. Only call this after a user has PROVEN control of the
// account (password or a valid TOTP code).
export async function generarBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: CANTIDAD }, () => randomBytes(5).toString('hex'))

  await prisma.$transaction([
    prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
    prisma.twoFactorBackupCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashear(code) })),
    }),
  ])

  return codes
}

// Consumes a backup code. Returns true on first use, false if it was already
// used or does not exist (single-use, fail closed). Hashes before lookup so
// the plaintext never touches a query.
export async function consumirBackupCode(userId: string, code: string): Promise<boolean> {
  const codeHash = hashear(code)
  const result = await prisma.twoFactorBackupCode.updateMany({
    where: { userId, codeHash, usedAt: null },
    data: { usedAt: new Date() },
  })
  return result.count === 1
}
