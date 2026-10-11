import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/models/prisma'
import { createToken, persistSession, setAuthCookie, verifyPassword } from '@/shared/models/auth'
import { verifyLoginStepToken } from '@/shared/models/jwt'
import { logAudit } from '@/shared/models/audit'
import { getCurrentUser, requireAdmin } from '@/shared/models/authz'
import {
  consultarEstado2FA,
  iniciarEnrolamiento,
  confirmarEnrolamiento,
  verificarCodigo2FA,
  deshabilitar2FA,
} from './twoFactor'
import { generarBackupCodes } from '@/shared/models/twoFactorBackupCodes'
import {
  consultarRateLimit,
  abrirVentanaIntentos,
  registrarFallo,
  limpiarIntentos,
} from '@/shared/models/twoFactorRateLimit'
import { verifyTwoFactorSchema, totpCodeSchema, setTwoFactorRequiredSchema } from '../models/validations'

// A backup code is 10 lowercase hex chars (see twoFactorBackupCodes.ts). The
// TOTP code is exactly 6 digits, so the shapes are unambiguous.
const BACKUP_CODE_RE = /^[a-f0-9]{10}$/

// GET /api/auth/2fa — current user's 2FA state (requires session).
export async function estado2FA() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })

  const estado = await consultarEstado2FA(user.id)
  if (!estado) return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 })
  return NextResponse.json(estado)
}

// POST /api/auth/2fa/setup — start (or restart) enrolment. Requires session.
export async function setup2FA() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })

  try {
    const { secret, otpauthUri } = await iniciarEnrolamiento(user.id, user.email)
    // The plaintext secret is returned once so users who cannot scan the QR can
    // enter it manually. It is stored encrypted and never logged.
    return NextResponse.json({ secret, otpauthUri })
  } catch (error) {
    console.error('2FA setup error:', error)
    return NextResponse.json({ message: 'Error al iniciar la configuración' }, { status: 500 })
  }
}

// POST /api/auth/2fa/confirm — verify first code, activate 2FA. Requires session.
export async function confirm2FA(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })

  const parsed = totpCodeSchema.safeParse((await request.json()).code)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Código inválido' }, { status: 400 })
  }

  try {
    const resultado = await confirmarEnrolamiento(user.id, parsed.data)
    if (!resultado.ok) {
      return NextResponse.json({ message: resultado.error }, { status: 400 })
    }

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: '2fa.enabled',
      targetId: user.id,
      targetEmail: user.email,
      detail: '2FA TOTP activado',
    })

    return NextResponse.json({ backupCodes: resultado.backupCodes })
  } catch (error) {
    console.error('2FA confirm error:', error)
    return NextResponse.json({ message: 'Error al confirmar' }, { status: 500 })
  }
}

// POST /api/auth/2fa/verify — login phase 2. Exchanges step token + TOTP (or
// backup) code for a real session. Rate-limited per user, fail-closed.
export async function verify2FA(request: NextRequest) {
  const body = await request.json()
  const parsed = verifyTwoFactorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 })
  }

  const { stepToken, code } = parsed.data

  const step = await verifyLoginStepToken(stepToken)
  if (!step) {
    return NextResponse.json({ message: 'Sesión de acceso inválida o expirada' }, { status: 401 })
  }

  const rateLimit = await consultarRateLimit(step.userId)
  if (rateLimit.bloqueado) {
    return NextResponse.json(
      {
        message: 'Demasiados intentos. Intenta de nuevo más tarde.',
        reintentoEnMs: rateLimit.reintentoEnMs,
      },
      { status: 429 }
    )
  }

  if (!(await abrirVentanaIntentos(step.userId))) {
    return NextResponse.json({ message: 'Cuenta bloqueada temporalmente' }, { status: 429 })
  }

  const esBackupCode = BACKUP_CODE_RE.test(code)
  const resultado = await verificarCodigo2FA(step.userId, code, esBackupCode)

  if (!resultado.ok) {
    const estado = await registrarFallo(step.userId)
    await logAudit({
      actorId: step.userId,
      actorEmail: step.email,
      action: '2fa.failed',
      targetId: step.userId,
      targetEmail: step.email,
      detail: resultado.motivo,
    })
    return NextResponse.json(
      {
        message: estado.bloqueado
          ? 'Demasiados intentos fallidos. Cuenta bloqueada temporalmente.'
          : resultado.error,
        restantes: estado.restantes,
      },
      { status: 401 }
    )
  }

  await limpiarIntentos(step.userId)

  const token = await createToken({
    userId: step.userId,
    email: step.email,
    role: step.role,
  })
  await persistSession(step.userId, token)
  await setAuthCookie(token)

  prisma.user
    .update({ where: { id: step.userId }, data: { lastLoginAt: new Date() } })
    .catch(() => {})

  await logAudit({
    actorId: step.userId,
    actorEmail: step.email,
    action: '2fa.login',
    targetId: step.userId,
    targetEmail: step.email,
    detail: `Login completado vía ${resultado.metodo}`,
  })

  const user = await prisma.user.findUnique({
    where: { id: step.userId },
    select: { id: true, email: true, name: true, role: true },
  })

  return NextResponse.json({
    user,
    ...(resultado.metodo === 'backup' && { backupCodesRemaining: resultado.restantes }),
  })
}

// POST /api/auth/2fa/disable — requires password AND a current TOTP/backup code.
export async function disable2FA(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const passwordOk = typeof body.password === 'string'
  const parsedCode = totpCodeSchema.safeParse(body.code)
  if (!passwordOk || !parsedCode.success) {
    return NextResponse.json(
      { message: 'Se requieren la contraseña y un código de 6 dígitos' },
      { status: 400 }
    )
  }

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, twoFactorEnabled: true },
  })
  if (!full?.twoFactorEnabled) {
    return NextResponse.json({ message: '2FA no está activo' }, { status: 400 })
  }
  if (!full.passwordHash || !(await verifyPassword(body.password, full.passwordHash))) {
    return NextResponse.json({ message: 'Contraseña incorrecta' }, { status: 401 })
  }

  const rateLimit = await consultarRateLimit(user.id)
  if (rateLimit.bloqueado) {
    return NextResponse.json({ message: 'Cuenta bloqueada temporalmente' }, { status: 429 })
  }

  const resultado = await verificarCodigo2FA(user.id, parsedCode.data)
  if (!resultado.ok) {
    await registrarFallo(user.id)
    return NextResponse.json({ message: resultado.error }, { status: 401 })
  }

  await limpiarIntentos(user.id)
  await deshabilitar2FA(user.id)

  await logAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: '2fa.disabled',
    targetId: user.id,
    targetEmail: user.email,
    detail: '2FA TOTP desactivado',
  })

  return NextResponse.json({ success: true })
}

// POST /api/users/[id]/2fa/reset — fully reset a user's 2FA enrolment
// (ADMIN_TI only). Clears the TOTP secret, pending/confirmed timestamps,
// replay counter, and rate-limit state, and deletes all backup codes. The
// user must re-enrol from scratch on next login (the dashboard layout gate
// will redirect them). Use this when the user has lost their authenticator
// app and has no backup codes.
export async function reset2FA(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, twoFactorEnabled: true },
    })
    if (!target) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 })
    }
    if (!target.twoFactorEnabled) {
      return NextResponse.json(
        { message: 'El usuario no tiene 2FA activo' },
        { status: 400 }
      )
    }

    await deshabilitar2FA(target.id)

    await logAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: '2fa.reset',
      targetId: target.id,
      targetEmail: target.email,
      detail: '2FA deshabilitado y enrolamiento reiniciado por administrador',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset 2FA error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST /api/users/[id]/2fa/backup-codes — regenerate a user's backup codes
// (ADMIN_TI only). The plaintext codes are returned exactly once so the admin
// can hand them over out-of-band; they are never persisted or logged. Only
// meaningful when the target already has 2FA enabled — a user without a TOTP
// secret has nothing to recover.
export async function resetBackupCodes(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, twoFactorEnabled: true },
    })
    if (!target) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 })
    }
    if (!target.twoFactorEnabled) {
      return NextResponse.json(
        { message: 'El usuario no tiene 2FA activo' },
        { status: 400 }
      )
    }

    const backupCodes = await generarBackupCodes(target.id)

    await logAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: '2fa.backup_codes.reset',
      targetId: target.id,
      targetEmail: target.email,
      detail: 'Códigos de respaldo de 2FA regenerados por administrador',
    })

    return NextResponse.json({ backupCodes })
  } catch (error) {
    console.error('Reset backup codes error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST /api/users/[id]/2fa/require — toggle the admin-forced 2FA requirement
// for any user (ADMIN_TI only). Turning it ON forces the target to enrol at
// next login/session (dashboard layout + login policy treat the flag like a
// mandatory role); turning it OFF restores the optional behaviour for that
// user. Does not touch twoFactorEnabled — an already-enrolled user keeps 2FA
// either way (use reset2FA to remove it).
export async function setTwoFactorRequirement(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 })
  }

  const parsed = setTwoFactorRequiredSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Datos inválidos', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { required } = parsed.data

  try {
    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, role: true, twoFactorRequired: true },
    })
    if (!target) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 })
    }

    if (target.twoFactorRequired === required) {
      return NextResponse.json({ success: true, twoFactorRequired: required })
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { twoFactorRequired: required },
    })

    await logAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: required ? '2fa.require.enable' : '2fa.require.disable',
      targetId: target.id,
      targetEmail: target.email,
      detail: required
        ? 'Exigencia de 2FA activada por administrador; el usuario deberá enrolarse en su próximo acceso'
        : 'Exigencia de 2FA desactivada por administrador; el 2FA del usuario queda opcional',
    })

    return NextResponse.json({ success: true, twoFactorRequired: required })
  } catch (error) {
    console.error('Set 2FA requirement error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
