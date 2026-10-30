import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/models/prisma'
import { getSession, hashPassword, verifyPassword } from '@/shared/models/auth'
import { getCurrentUser } from '@/shared/models/authz'
import { logAudit } from '@/shared/models/audit'
import { updateProfileSchema, changePasswordSchema } from '../models/validations'

// GET /api/profile — the authenticated user's own account settings.
// Single endpoint feeding the /dashboard/configuracion page (profile, avatar,
// timezone, notification flags, 2FA state) so the client only needs one fetch.
export async function getProfile() {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })

  try {
    const user = await prisma.user.findUnique({
      where: { id: current.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        timezone: true,
        notificationsEmail: true,
        notificationsInApp: true,
        twoFactorEnabled: true,
        twoFactorRequired: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })
    if (!user) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        ...user,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 })
  }
}

// PATCH /api/profile — update the caller's own profile settings.
// Only the fields the user may change about themselves: name, phone, avatar,
// timezone and notification flags. Email stays admin-only and the password has
// a dedicated endpoint (POST /api/profile/password).
export async function updateProfile(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 })
  }

  const result = updateProfileSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { message: 'Datos inválidos', errors: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const data = result.data
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: 'No hay campos para actualizar' }, { status: 400 })
  }

  try {
    const user = await prisma.user.update({
      where: { id: current.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.notificationsEmail !== undefined && {
          notificationsEmail: data.notificationsEmail,
        }),
        ...(data.notificationsInApp !== undefined && {
          notificationsInApp: data.notificationsInApp,
        }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        timezone: true,
        notificationsEmail: true,
        notificationsInApp: true,
        updatedAt: true,
      },
    })

    await logAudit({
      actorId: current.id,
      actorEmail: current.email,
      action: 'user.profile.update',
      targetId: user.id,
      targetEmail: user.email,
      detail: Object.keys(data).join(', '),
    })

    return NextResponse.json({
      user: { ...user, updatedAt: user.updatedAt.toISOString() },
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST /api/profile/password — change the caller's own password.
// Verifies the current password (proof of presence), re-hashes the new one
// (bcrypt cost 12, same helper as login) and revokes every OTHER session so a
// stolen session cannot survive a password change.
export async function changePassword(request: NextRequest) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Datos inválidos' }, { status: 400 })
  }

  const result = changePasswordSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { message: 'Datos inválidos', errors: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { currentPassword, newPassword } = result.data

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { message: 'La nueva contraseña debe ser distinto a la actual' },
      { status: 400 }
    )
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: current.id },
      select: { id: true, email: true, passwordHash: true },
    })
    if (!user?.passwordHash) {
      return NextResponse.json(
        { message: 'Cuenta pendiente de activación' },
        { status: 400 }
      )
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json(
        { message: 'La contraseña actual es incorrecta' },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    // Revoke every session except the current one (the caller stays logged in).
    const cookieStore = (await import('next/headers')).cookies()
    const currentToken = cookieStore.get('auth-token')?.value
    await prisma.session.deleteMany({
      where: { userId: user.id, ...(currentToken ? { NOT: { token: currentToken } } : {}) },
    })

    await logAudit({
      actorId: current.id,
      actorEmail: current.email,
      action: 'user.password.change',
      targetId: user.id,
      targetEmail: user.email,
      detail: 'Contraseña cambiada por el propio usuario; demás sesiones revocadas',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 })
  }
}

// GET /api/profile/sessions — the caller's own active sessions with device info.
export async function listOwnSessions() {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })

  try {
    const sessions = await prisma.session.findMany({
      where: { userId: current.id, expiresAt: { gt: new Date() } },
      select: { id: true, token: true, userAgent: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    })

    const cookieStore = (await import('next/headers')).cookies()
    const viewerToken = cookieStore.get('auth-token')?.value

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        current: s.token === viewerToken,
      })),
    })
  } catch (error) {
    console.error('List own sessions error:', error)
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE /api/profile/sessions/[sessionId] — revoke one of the caller's own
// sessions (never the current one; logging out of this device is logout).
export async function revokeOwnSession(
  _request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })

  try {
    const session = await prisma.session.findUnique({
      where: { id: params.sessionId },
      select: { id: true, userId: true, token: true },
    })
    if (!session || session.userId !== current.id) {
      return NextResponse.json({ message: 'Sesión no encontrada' }, { status: 404 })
    }

    const cookieStore = (await import('next/headers')).cookies()
    const currentToken = cookieStore.get('auth-token')?.value
    if (session.token === currentToken) {
      return NextResponse.json(
        { message: 'No puedes revocar tu propia sesión actual' },
        { status: 400 }
      )
    }

    await prisma.session.delete({ where: { id: session.id } })

    await logAudit({
      actorId: current.id,
      actorEmail: current.email,
      action: 'session.revoke',
      targetId: session.id,
      targetEmail: current.email,
      detail: 'Sesión revocada por el propio usuario',
    })

    return NextResponse.json({ id: session.id })
  } catch (error) {
    console.error('Revoke own session error:', error)
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE /api/profile/sessions — close every session except the current one
// ("Cerrar sesión en otros dispositivos").
export async function revokeOtherSessions() {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })

  try {
    const cookieStore = (await import('next/headers')).cookies()
    const currentToken = cookieStore.get('auth-token')?.value

    const result = await prisma.session.deleteMany({
      where: {
        userId: current.id,
        ...(currentToken ? { NOT: { token: currentToken } } : {}),
      },
    })

    await logAudit({
      actorId: current.id,
      actorEmail: current.email,
      action: 'session.revoke_all',
      targetId: current.id,
      targetEmail: current.email,
      detail: `${result.count} sesión(es) cerrada(s) en otros dispositivos`,
    })

    return NextResponse.json({ revoked: result.count })
  } catch (error) {
    console.error('Revoke other sessions error:', error)
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 })
  }
}
