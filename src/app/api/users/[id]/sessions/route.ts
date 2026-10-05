import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// GET /api/users/[id]/sessions — list active sessions of a user (ADMIN_TI only)
export async function GET(
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
export async function DELETE(
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
