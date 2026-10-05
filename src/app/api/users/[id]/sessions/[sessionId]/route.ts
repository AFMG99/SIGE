import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// DELETE /api/users/[id]/sessions/[sessionId] — revoke a session (ADMIN_TI only)
export async function DELETE(
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