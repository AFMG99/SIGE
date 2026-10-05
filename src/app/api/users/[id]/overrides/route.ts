import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'
import { logAudit } from '@/lib/audit'
import { MODULES, MODULE_ACTIONS, roleHasAction, type ModuleId } from '@/lib/permissions'

function isValidModule(value: unknown): value is ModuleId {
  return MODULES.some((m) => m.id === value)
}

function isValidAction(moduleId: ModuleId, value: unknown): value is string {
  return typeof value === 'string' && (MODULE_ACTIONS[moduleId] as readonly string[]).includes(value)
}

// GET /api/users/[id]/overrides — active permission overrides, temporal and permanent (ADMIN_TI only)
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
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 })
    }

    const overrides = await prisma.userPermissionOverride.findMany({
      where: { userId: params.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { expiresAt: 'asc' },
    })

    return NextResponse.json({
      overrides: overrides.map((o) => ({
        id: o.id,
        moduleId: o.moduleId,
        action: o.action,
        expiresAt: o.expiresAt?.toISOString() ?? null,
        permanent: o.expiresAt === null,
        grantedBy: o.grantedBy,
        grantedByEmail: o.grantedByEmail,
        createdAt: o.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Get overrides error:', error)
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST /api/users/[id]/overrides — grant a permission exception (ADMIN_TI only)
// Body: { moduleId, action, expiresInHours? (1–720), permanent?, acknowledgeRoleConflict? }
// permanent: true → expiresAt = null (never expires); otherwise expiresInHours is required.
// Returns 409 role_conflict when the target role does NOT include the action
// and the client did not explicitly acknowledge the exception.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { moduleId, action, expiresInHours, acknowledgeRoleConflict, permanent } = body ?? {}

    if (!isValidModule(moduleId)) {
      return NextResponse.json({ message: 'Módulo inválido' }, { status: 400 })
    }
    if (moduleId === 'users') {
      // Policy: user management is reserved for ADMIN_TI and never accepts
      // overrides (nav and guards filter it as defense in depth).
      return NextResponse.json(
        { message: 'El módulo Usuarios está reservado a ADMIN_TI y no admite permisos excepcionales' },
        { status: 400 }
      )
    }
    if (!isValidAction(moduleId, action)) {
      return NextResponse.json({ message: 'Acción inválida para este módulo' }, { status: 400 })
    }
    const isPermanent = permanent === true
    let hours = 0
    if (!isPermanent) {
      hours = Number(expiresInHours)
      if (!Number.isFinite(hours) || hours < 1 || hours > 720) {
        return NextResponse.json({ message: 'Duración inválida (mín. 1 hora, máx. 720)' }, { status: 400 })
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, role: true },
    })
    if (!user) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 })
    }

    const roleConflict = !roleHasAction(user.role, moduleId, action)
    if (roleConflict && acknowledgeRoleConflict !== true) {
      return NextResponse.json(
        {
          code: 'role_conflict',
          roleConflict: true,
          message: `El rol del usuario no incluye este permiso. Confirma la excepción para otorgarlo.`,
        },
        { status: 409 }
      )
    }

    const expiresAt = isPermanent ? null : new Date(Date.now() + hours * 60 * 60 * 1000)
    const override = await prisma.userPermissionOverride.upsert({
      where: {
        userId_moduleId_action: { userId: user.id, moduleId, action },
      },
      create: {
        userId: user.id,
        moduleId,
        action,
        expiresAt,
        grantedBy: admin.id,
        grantedByEmail: admin.email,
      },
      update: {
        expiresAt,
        grantedBy: admin.id,
        grantedByEmail: admin.email,
      },
    })

    await logAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: isPermanent ? 'grant_permanent_permission' : 'grant_temp_permission',
      targetId: user.id,
      targetEmail: user.email,
      detail: `${moduleId}:${action} ${isPermanent ? '(permanente)' : `hasta ${override.expiresAt?.toISOString() ?? ''}`}${roleConflict ? ' (excepción fuera del rol)' : ''}`,
    })

    return NextResponse.json({
      override: {
        id: override.id,
        moduleId: override.moduleId,
        action: override.action,
        expiresAt: override.expiresAt?.toISOString() ?? null,
        permanent: override.expiresAt === null,
        grantedBy: override.grantedBy,
        grantedByEmail: override.grantedByEmail,
        createdAt: override.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Grant override error:', error)
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE /api/users/[id]/overrides?moduleId=&action= — revoke a permission exception
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const moduleId = request.nextUrl.searchParams.get('moduleId')
    const action = request.nextUrl.searchParams.get('action')

    if (!isValidModule(moduleId) || !isValidAction(moduleId, action)) {
      return NextResponse.json({ message: 'Parámetros inválidos' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true },
    })
    if (!user) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 })
    }

    const existing = await prisma.userPermissionOverride.findFirst({
      where: { userId: user.id, moduleId, action },
      select: { expiresAt: true },
    })

    const result = await prisma.userPermissionOverride.deleteMany({
      where: { userId: user.id, moduleId, action },
    })

    if (result.count > 0) {
      await logAudit({
        actorId: admin.id,
        actorEmail: admin.email,
        action: existing?.expiresAt === null ? 'revoke_permanent_permission' : 'revoke_temp_permission',
        targetId: user.id,
        targetEmail: user.email,
        detail: `${moduleId}:${action}`,
      })
    }

    return NextResponse.json({ revoked: result.count })
  } catch (error) {
    console.error('Revoke override error:', error)
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 })
  }
}
