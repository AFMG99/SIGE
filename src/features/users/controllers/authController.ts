import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/models/prisma'
import { verifyPassword, createSession, hashPassword, destroySession } from '@/shared/models/auth'
import { loginSchema } from '@/features/users/models/validations'

// POST /api/auth/login
export async function login(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Datos inválidos', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    
    const { email, password } = result.data
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    
    if (!user) {
      return NextResponse.json(
        { message: 'Credenciales inválidas' },
        { status: 401 }
      )
    }
    
    // Check user status before password verification
    if (user.status === 'INACTIVE') {
      return NextResponse.json(
        { message: 'Cuenta suspendida' },
        { status: 403 }
      )
    }
    
    if (!user.passwordHash) {
      return NextResponse.json(
        { message: 'Cuenta pendiente de activación' },
        { status: 401 }
      )
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { message: 'Credenciales inválidas' },
        { status: 401 }
      )
    }
    
    // Create session
    await createSession(user.id, user.email, user.role)
    
    // Best-effort update of lastLoginAt - never break login
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {})
    
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
    return NextResponse.json(
      { message: 'Error al cerrar sesión' },
      { status: 500 }
    )
  }
}

