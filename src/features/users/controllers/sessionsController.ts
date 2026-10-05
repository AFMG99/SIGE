import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/models/prisma'
import { requireAdmin } from '@/shared/models/authz'
import { getSession } from '@/shared/models/auth'
import { logAudit } from '@/shared/models/audit'

// GET /api/users/[id]/sessions — list active sessions of a user (ADMIN_TI only)
export async function listSessions(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json(
        { message: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Only active (non-expired) sessions — expired rows are not "in session".
    const sessions = await prisma.session.findMany({
      where: { userId: params.id, expiresAt: { gt: new Date() } },
      select: { id: true, token: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    })

    // Mark the viewer's own session token (only relevant when viewing yourself).
    const currentSession = await getSession()
    const cookieStore = (await import('next/headers')).cookies()
    const viewerToken = cookieStore.get('auth-token')?.value
    const viewerIsTarget = currentSession?.userId === admin.id && admin.id === params.id

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        current: viewerIsTarget && s.token === viewerToken,
      })),
    })
  } catch (error) {
    console.error('Get sessions error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id]/sessions — force-logout ALL sessions of a user (ADMIN_TI only)
export async function revokeAllSessions(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (params.id === admin.id) {
    return NextResponse.json(
      { message: 'No puedes cerrar todas tus sesiones desde aquí' },
      { status: 400 }
    )
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true },
    })
    if (!user) {
      return NextResponse.json(
        { message: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    const result = await prisma.session.deleteMany({
      where: { userId: params.id },
    })

    await logAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'revoke_all_sessions',
      targetId: user.id,
      targetEmail: user.email,
      detail: `${result.count} sesión(es) cerrada(s) forzosamente`,
    })

    return NextResponse.json({ revoked: result.count })
  } catch (error) {
    console.error('Revoke all sessions error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id]/sessions/[sessionId] — revoke a session (ADMIN_TI only)
export async function revokeSession(
  _request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: params.sessionId },
      select: { id: true, userId: true, token: true },
    })

    if (!session || session.userId !== params.id) {
      return NextResponse.json(
        { message: 'Sesión no encontrada' },
        { status: 404 }
      )
    }

    // Prevent revoking own current session
    const currentSession = await getSession()
    if (currentSession && session.token === (await import('next/headers')).cookies().get('auth-token')?.value) {
      return NextResponse.json(
        { message: 'No puedes revocar tu propia sesión actual' },
        { status: 400 }
      )
    }

    await prisma.session.delete({ where: { id: params.sessionId } })

    // Audit log
    await logAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'session.revoke',
      targetId: session.id,
      targetEmail: params.id, // user ID as target
      detail: `Sesión revocada por administrador`,
    })

    return NextResponse.json({ id: params.sessionId })
  } catch (error) {
    console.error('Revoke session error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
