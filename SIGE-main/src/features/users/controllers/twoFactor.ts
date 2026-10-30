import { prisma } from '@/shared/models/prisma'
import {
  generarSecreto,
  cifrarSecreto,
  descifrarSecreto,
  construirUriProvisionamiento,
  verificarCodigo,
  pasoDeTiempo,
} from '@/shared/models/totp'
import {
  generarBackupCodes,
  consumirBackupCode,
} from '@/shared/models/twoFactorBackupCodes'

// Enrolment and verification orchestration for TOTP 2FA. All crypto lives in
// totp.ts; this module only wires it to the DB and enforces the state machine.

export interface EstadoUsuario2FA {
  twoFactorEnabled: boolean
  totpPending: boolean
  totpConfirmed: boolean
}

export async function consultarEstado2FA(userId: string): Promise<EstadoUsuario2FA | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      twoFactorEnabled: true,
      totpSecretEnc: true,
      totpPendingAt: true,
      totpConfirmedAt: true,
    },
  })
  if (!user) return null
  return {
    twoFactorEnabled: user.twoFactorEnabled,
    totpPending: user.totpPendingAt !== null && user.totpConfirmedAt === null,
    totpConfirmed: user.totpConfirmedAt !== null,
  }
}

// Starts (or restarts) enrolment: generates a fresh secret and stores it
// pending. 2FA stays OFF until the first code is confirmed.
export async function iniciarEnrolamiento(userId: string, email: string) {
  const secreto = await generarSecreto()
  const ahora = new Date()

  await prisma.user.update({
    where: { id: userId },
    data: { totpSecretEnc: cifrarSecreto(secreto), totpPendingAt: ahora, totpConfirmedAt: null },
  })

  return {
    secret: secreto,
    otpauthUri: construirUriProvisionamiento(email, secreto),
  }
}

// Confirms enrolment by verifying the first code, then activates 2FA and
// issues one-time backup codes. Fails closed on a bad code.
export async function confirmarEnrolamiento(userId: string, codigo: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecretEnc: true, totpPendingAt: true },
  })
  if (!user?.totpSecretEnc || !user.totpPendingAt) {
    return { ok: false as const, error: 'No hay un enrolamiento pendiente' }
  }

  const secreto = descifrarSecreto(user.totpSecretEnc)
  const resultado = await verificarCodigo(secreto, codigo)
  if (!resultado.valido || resultado.delta === null) {
    return { ok: false as const, error: 'Código incorrecto' }
  }

  const ahora = new Date()
  const pasoActual = pasoDeTiempo(Math.floor(ahora.getTime() / 1000), resultado.delta)

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      totpConfirmedAt: ahora,
      totpPendingAt: null,
      totpLastUsedStep: pasoActual,
    },
  })

  const backupCodes = await generarBackupCodes(userId)
  return { ok: true as const, backupCodes }
}

export type ResultadoVerificacionTOTP =
  | { ok: true; metodo: 'totp' }
  | { ok: true; metodo: 'backup'; restantes: number }
  | { ok: false; error: string; motivo: 'invalido' | 'replay' }

// Verifies a TOTP code (or a backup code) during login phase 2. Enforces
// replay protection via totpLastUsedStep, persisting the newly accepted step
// on success so the same code can never be replayed.
export async function verificarCodigo2FA(
  userId: string,
  codigo: string,
  esBackupCode = false
): Promise<ResultadoVerificacionTOTP> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecretEnc: true, twoFactorEnabled: true, totpLastUsedStep: true },
  })
  if (!user?.twoFactorEnabled || !user.totpSecretEnc) {
    return { ok: false, error: '2FA no está activo en esta cuenta', motivo: 'invalido' }
  }

  if (esBackupCode) {
    const consumido = await consumirBackupCode(userId, codigo)
    if (!consumido) {
      return { ok: false, error: 'Código de respaldo inválido o ya usado', motivo: 'invalido' }
    }
    const restantes = await prisma.twoFactorBackupCode.count({
      where: { userId, usedAt: null },
    })
    return { ok: true, metodo: 'backup', restantes }
  }

  const secreto = descifrarSecreto(user.totpSecretEnc)
  const ahoraEpoch = Math.floor(Date.now() / 1000)
  const resultado = await verificarCodigo(secreto, codigo, ahoraEpoch)
  if (!resultado.valido || resultado.delta === null) {
    return { ok: false, error: 'Código incorrecto', motivo: 'invalido' }
  }

  const paso = pasoDeTiempo(ahoraEpoch, resultado.delta)
  if (user.totpLastUsedStep !== null && paso <= user.totpLastUsedStep) {
    return { ok: false, error: 'Código ya usado', motivo: 'replay' }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { totpLastUsedStep: paso },
  })
  return { ok: true, metodo: 'totp' }
}

// Disables 2FA. The caller must have already verified the password AND a
// current TOTP code (or backup code) — this function only flips the state.
export async function deshabilitar2FA(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      totpSecretEnc: null,
      totpPendingAt: null,
      totpConfirmedAt: null,
      totpLastUsedStep: null,
      twoFactorFailedAttempts: 0,
      twoFactorLockedUntil: null,
    },
  })
  await prisma.twoFactorBackupCode.deleteMany({ where: { userId } })
}
