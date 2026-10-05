import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { requireAdmin } from '@/lib/authz'
import { updateUserSchema } from '@/lib/validations'
import { logAudit } from '@/lib/audit'
import { UserStatus } from '@prisma/client'
import { z } from 'zod'
import { ROLES } from '@/lib/permissions'

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  phone: true,
  lastLoginAt: true,
  twoFactorEnabled: true,
  createdAt: true,
  updatedAt: true,
}

// GET /api/users/[id] — get user with sessions and audit logs (ADMIN_TI only)
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
      select: userSelect,
    })

    if (!user) {
      return NextResponse.json(
        { message: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Fetch sessions
    const sessions = await prisma.session.findMany({
      where: { userId: params.id },
      select: { id: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch audit logs for this user
    const auditLogs = await prisma.auditLog.findMany({
      where: { targetId: params.id },
      select: { id: true, actorId: true, actorEmail: true, action: true, detail: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      user: {
        ...user,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      sessions: sessions.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
      auditLogs: auditLogs.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PATCH /api/users/[id] — update a user (ADMIN_TI only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()

    // Extended schema for admin update
    const extendedUpdateSchema = updateUserSchema.extend({
      phone: z.string().optional().nullable(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(),
      twoFactorEnabled: z.boolean().optional(),
    })

    const result = extendedUpdateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Datos inválidos', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = result.data
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { message: 'No hay campos para actualizar' },
        { status: 400 }
      )
    }

    // Never let an admin lock themselves out by changing their own role
    if (params.id === admin.id && data.role !== undefined && data.role !== admin.role) {
      return NextResponse.json(
        { message: 'No puedes cambiar tu propio rol' },
        { status: 400 }
      )
    }

    // Never let an admin deactivate/suspend themselves
    if (params.id === admin.id && data.status !== undefined && data.status === 'INACTIVE') {
      return NextResponse.json(
        { message: 'No puedes suspender tu propia cuenta' },
        { status: 400 }
      )
    }

    const targetUser = await prisma.user.findUnique({ where: { id: params.id } })
    if (!targetUser) {
      return NextResponse.json(
        { message: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    if (data.email !== undefined) {
      const normalizedEmail = data.email.toLowerCase()
      const emailTaken = await prisma.user.findFirst({
        where: { email: normalizedEmail, NOT: { id: params.id } },
      })
      if (emailTaken) {
        return NextResponse.json(
          { message: 'Este correo ya está registrado' },
          { status: 409 }
        )
      }
    }

    const passwordHash =
      data.password !== undefined ? await hashPassword(data.password) : undefined

    // Determine audit action based on status change
    let auditAction = 'user.update'
    if (data.status !== undefined && data.status !== targetUser.status) {
      if (data.status === 'INACTIVE') auditAction = 'user.suspend'
      else if (data.status === 'ACTIVE') auditAction = 'user.activate'
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email.toLowerCase() }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.status !== undefined && { status: data.status as UserStatus }),
        ...(data.twoFactorEnabled !== undefined && { twoFactorEnabled: data.twoFactorEnabled }),
        ...(passwordHash !== undefined && { passwordHash }),
      },
      select: userSelect,
    })

    // Audit log
    await logAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: auditAction,
      targetId: user.id,
      targetEmail: user.email,
      detail: Object.keys(data).join(', '),
    })

    return NextResponse.json({
      user: {
        ...user,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id] — delete a user (ADMIN_TI only, never yourself)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    if (params.id === admin.id) {
      return NextResponse.json(
        { message: 'No puedes eliminar tu propia cuenta' },
        { status: 400 }
      )
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true },
    })
    if (!targetUser) {
      return NextResponse.json(
        { message: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    await prisma.user.delete({ where: { id: params.id } })

    // Audit log
    await logAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'user.delete',
      targetId: targetUser.id,
      targetEmail: targetUser.email,
    })

    return NextResponse.json({ id: params.id })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}