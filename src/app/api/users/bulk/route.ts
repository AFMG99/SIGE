import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'
import { ROLES } from '@/lib/permissions'
import { UserStatus } from '@prisma/client'

const bulkSchema = z.object({
  action: z.enum(['suspend', 'activate', 'delete', 'setRole']),
  ids: z.array(z.string()).min(1),
  role: z.enum(ROLES).optional(),
})

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const result = bulkSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Datos inválidos', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { action, ids, role } = result.data

    // Self-protection: remove admin's own ID from the list
    const filteredIds = ids.filter((id) => id !== admin.id)
    if (filteredIds.length !== ids.length) {
      // Still process others, but note the self-protection
    }

    if (filteredIds.length === 0) {
      return NextResponse.json(
        { message: 'No se pueden aplicar acciones a tu propia cuenta' },
        { status: 400 }
      )
    }

    // Validate role for setRole action
    if (action === 'setRole' && !role) {
      return NextResponse.json(
        { message: 'El rol es obligatorio para la acción setRole' },
        { status: 400 }
      )
    }

    // Fetch target users for audit logging
    const targetUsers = await prisma.user.findMany({
      where: { id: { in: filteredIds } },
      select: { id: true, email: true, status: true, role: true },
    })

    if (targetUsers.length === 0) {
      return NextResponse.json(
        { message: 'No se encontraron usuarios válidos' },
        { status: 404 }
      )
    }

    let updateData: Record<string, unknown> = {}
    let auditAction = ''

    switch (action) {
      case 'suspend':
        updateData = { status: 'INACTIVE' as UserStatus }
        auditAction = 'user.suspend'
        break
      case 'activate':
        updateData = { status: 'ACTIVE' as UserStatus }
        auditAction = 'user.activate'
        break
      case 'setRole':
        updateData = { role }
        auditAction = 'user.update'
        break
      case 'delete':
        // Delete is handled separately
        break
    }

    if (action === 'delete') {
      await prisma.user.deleteMany({ where: { id: { in: filteredIds } } })
    } else {
      await prisma.user.updateMany({
        where: { id: { in: filteredIds } },
        data: updateData,
      })
    }

    // Audit log - one entry per user
    for (const user of targetUsers) {
      await logAudit({
        actorId: admin.id,
        actorEmail: admin.email,
        action: auditAction,
        targetId: user.id,
        targetEmail: user.email,
        detail: action === 'setRole' ? `Rol cambiado a ${role}` : undefined,
      })
    }

    return NextResponse.json({
      processed: filteredIds.length,
      action,
      ...(action === 'setRole' && { role }),
    })
  } catch (error) {
    console.error('Bulk user action error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}