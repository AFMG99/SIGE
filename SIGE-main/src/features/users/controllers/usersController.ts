import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/models/prisma'
import { hashPassword } from '@/shared/models/auth'
import { requireAdmin } from '@/shared/models/authz'
import { createUserSchema, passwordSchema } from '@/features/users/models/validations'
import { logAudit } from '@/shared/models/audit'
import { UserStatus } from '@prisma/client'
import { z } from 'zod'
import { ROLES } from '@/shared/models/permissions'

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  phone: true,
  lastLoginAt: true,
  createdAt: true,
}

// GET /api/users — list users with search, filter, sort, pagination (ADMIN_TI only)
export async function listUsers(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() || ''
  const role = searchParams.get('role')
  const status = searchParams.get('status')
  const sort = searchParams.get('sort') || 'createdAt'
  const order = searchParams.get('order') || 'desc'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)))

  // Build where clause
  const where: Record<string, unknown> = {}

  if (search) {
    // Accent- and case-insensitive search on name, email, phone
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (role && ROLES.includes(role as typeof ROLES[number])) {
    where.role = role
  }

  if (status && ['ACTIVE', 'INACTIVE', 'PENDING'].includes(status)) {
    where.status = status as UserStatus
  }

  // Build orderBy
  const validSortFields = ['name', 'email', 'role', 'status', 'lastLoginAt', 'createdAt']
  const sortField = validSortFields.includes(sort) ? sort : 'createdAt'
  const sortOrder = order === 'asc' ? 'asc' : 'desc'

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: userSelect,
      where,
      orderBy: { [sortField]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ])

  // Fetch active sessions for this page's users in a single query (no N+1)
  const userIds = users.map((u) => u.id)
  const activeSessions = await prisma.session.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds },
      expiresAt: { gt: new Date() },
    },
    _count: true,
  })
  const activeSessionUserIds = new Set(activeSessions.map((s) => s.userId))

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      hasActiveSession: activeSessionUserIds.has(user.id),
    })),
    total,
    page,
    pageSize,
  })
}

// POST /api/users — create a user (ADMIN_TI only)
export async function createUser(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()

    // Extended schema for admin create with invitation support.
    // password becomes optional here so the invitation flow (sendInvitation
    // with no password) validates; the explicit check below still requires
    // it when no invitation is sent.
    const extendedCreateSchema = createUserSchema.extend({
      password: passwordSchema.optional(),
      phone: z.string().optional().nullable(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(),
      sendInvitation: z.boolean().optional(),
    })

    const result = extendedCreateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Datos inválidos', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, email, password, role, phone, status, sendInvitation } = result.data
    const normalizedEmail = email.toLowerCase()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })
    if (existingUser) {
      return NextResponse.json(
        { message: 'Este correo ya está registrado' },
        { status: 409 }
      )
    }

    // Determine status and passwordHash based on invitation
    const isInvitation = sendInvitation === true
    const finalStatus = isInvitation ? 'PENDING' : (status || 'ACTIVE')
    const passwordHash = isInvitation ? null : await hashPassword(password!)

    // Validate password is provided when not sending invitation
    if (!isInvitation && !password) {
      return NextResponse.json(
        { message: 'La contraseña es obligatoria cuando no se envía invitación' },
        { status: 400 }
      )
    }

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role,
        status: finalStatus,
        phone: phone ?? null,
      },
      select: userSelect,
    })

    // Audit log
    await logAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'user.create',
      targetId: user.id,
      targetEmail: user.email,
      detail: isInvitation ? 'Usuario invitado (sin contraseña)' : 'Usuario creado con contraseña',
    })

    return NextResponse.json({ user: { ...user, createdAt: user.createdAt.toISOString() } }, { status: 201 })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

const bulkSchema = z.object({
  action: z.enum(['suspend', 'activate', 'delete', 'setRole']),
  ids: z.array(z.string()).min(1),
  role: z.enum(ROLES).optional(),
})

// POST /api/users/bulk — suspend/activate/delete/setRole on many users (ADMIN_TI only)
export async function bulkUsers(request: NextRequest) {
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
