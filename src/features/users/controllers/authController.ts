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

    // 2FA gate: enabled always requires the second factor. Mandated roles that
    // have not enrolled yet are sent to enrolment rather than straight in —
    // policy would otherwise be trivially bypassed by never enabling 2FA.
    const policyRequires = isTwoFactorRequiredForRole(user.role)
    if (user.twoFactorEnabled || policyRequires) {
      const stepToken = await createLoginStepToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      })
      return NextResponse.json({
        twoFactorRequired: true,
        enrollmentRequired: !user.twoFactorEnabled,
        stepToken,
      })
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
