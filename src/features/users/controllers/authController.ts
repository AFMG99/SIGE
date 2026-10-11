import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/models/prisma'
import { verifyPassword, createSession, destroySession } from '@/shared/models/auth'
import { createLoginStepToken } from '@/shared/models/jwt'
import { isTwoFactorRequiredForRole } from '@/shared/models/twoFactorPolicy'
import { loginSchema } from '@/features/users/models/validations'

// POST /api/auth/login
//
// Phase 1 of login. When the user has 2FA enabled — or has it mandated by
// policy but not yet enrolled — this returns a short-lived step token instead
// of a session. The client exchanges it at /api/auth/2fa/verify (enabled) or
// must enrol first (mandated-but-not-enrolled).
export async function login(request: NextRequest) {
  try {
    const body = await request.json()

    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Datos inválidos', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, password } = result.data

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json({ message: 'Credenciales inválidas' }, { status: 401 })
    }

    if (user.status === 'INACTIVE') {
      return NextResponse.json({ message: 'Cuenta suspendida' }, { status: 403 })
    }

    if (!user.passwordHash) {
      return NextResponse.json({ message: 'Cuenta pendiente de activación' }, { status: 401 })
    }

    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json({ message: 'Credenciales inválidas' }, { status: 401 })
    }

    // 2FA gate. Two distinct cases:
    //
    // 1. 2FA enabled → require the TOTP/backup code before issuing a session.
    // 2. Policy mandates 2FA but the user has not enrolled yet → issue the
    //    session NOW and send them straight to /twofa/setup. The dashboard
    //    layout still enforces the enrolment redirect as a safety net, so the
    //    session exists only long enough to complete setup.
    //
    // The old flow asked for a TOTP code in case 2, which was impossible —
    // the user had no authenticator app yet. That was a dead end.
    const policyRequires = isTwoFactorRequiredForRole(user.role)
    if (policyRequires && !user.twoFactorEnabled) {
      await createSession(user.id, user.email, user.role)
      prisma.user
        .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        .catch(() => {})
      return NextResponse.json({ needsEnrollment: true })
    }

    if (user.twoFactorEnabled) {
      const stepToken = await createLoginStepToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      })
      return NextResponse.json({ twoFactorRequired: true, stepToken })
    }

    // No 2FA — full session immediately.
    await createSession(user.id, user.email, user.role)

    prisma.user
      .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch(() => {})

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST /api/auth/logout
export async function logout() {
  try {
    await destroySession()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ message: 'Error al cerrar sesión' }, { status: 500 })
  }
}
