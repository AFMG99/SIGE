import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/models/prisma'
import { Prisma } from '@prisma/client'
import { getCurrentUser, canWithOverrides } from '@/shared/models/authz'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: { modeloId: string } }

async function autorizar(modeloId: string, modificar = false) {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ message: 'No autenticado' }, { status: 401 }) }
  if (!(await canWithOverrides(user, 'plans', modificar ? 'modify' : undefined))) {
    return { error: NextResponse.json({ message: 'No tiene permiso para consultar o modificar asociaciones' }, { status: 403 }) }
  }
  const modelo = await prisma.modeloArquitectonico.findFirst({
    where: { id: modeloId, estado: 'LISTO', activo: true },
    select: { id: true, edificacionId: true, bloqueId: true },
  })
  if (!modelo) return { error: NextResponse.json({ message: 'Modelo no encontrado o inactivo' }, { status: 404 }) }
  return { modelo }
}

export async function GET(_request: NextRequest, { params }: Context) {
  const auth = await autorizar(params.modeloId)
  if ('error' in auth) return auth.error

  const [espacios, elementos] = await Promise.all([
    prisma.espacio.findMany({
      where: {
        bloque: {
          edificacionId: auth.modelo.edificacionId,
          ...(auth.modelo.bloqueId ? { id: auth.modelo.bloqueId } : {}),
        },
      },
      select: {
        id: true, nombre: true, piso: true, bloqueId: true,
        bloque: { select: { codigo: true, nombre: true } },
      },
      orderBy: [{ bloque: { codigo: 'asc' } }, { piso: 'asc' }, { nombre: 'asc' }],
    }),
    prisma.elementoModelo3D.findMany({
      where: { modeloId: auth.modelo.id },
      select: { id: true, nodeKey: true, nodeName: true, nodePath: true, espacioId: true, dimensiones: true },
    }),
  ])

  return NextResponse.json({ espacios, elementos })
}

export async function PUT(request: NextRequest, { params }: Context) {
  const auth = await autorizar(params.modeloId, true)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null) as {
    nodeKey?: string
    nodeName?: string
    nodePath?: string | null
    espacioId?: string | null
    dimensiones?: unknown
  } | null

  const dimensionesValidas = Array.isArray(body?.dimensiones) && body.dimensiones.length === 3 &&
    body.dimensiones.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
  if (!body || typeof body.nodeKey !== 'string' || !body.nodeKey.trim() ||
      body.nodeKey.length > 1500 || typeof body.nodeName !== 'string' ||
      !body.nodeName.trim() || body.nodeName.length > 300 ||
      (body.espacioId !== null && typeof body.espacioId !== 'string') ||
      (body.dimensiones !== undefined && !dimensionesValidas)) {
    return NextResponse.json({ message: 'Datos de asociación inválidos' }, { status: 400 })
  }

  if (body.espacioId) {
    const espacio = await prisma.espacio.findFirst({
      where: {
        id: body.espacioId,
        bloque: {
          edificacionId: auth.modelo.edificacionId,
          ...(auth.modelo.bloqueId ? { id: auth.modelo.bloqueId } : {}),
        },
      },
      select: { id: true },
    })
    if (!espacio) {
      return NextResponse.json({ message: 'El espacio no pertenece a la edificación o bloque del modelo' }, { status: 400 })
    }
  }

  const elemento = await prisma.elementoModelo3D.upsert({
    where: { modeloId_nodeKey: { modeloId: auth.modelo.id, nodeKey: body.nodeKey } },
    create: {
      modeloId: auth.modelo.id,
      nodeKey: body.nodeKey,
      nodeName: body.nodeName.trim().slice(0, 300),
      nodePath: typeof body.nodePath === 'string' ? body.nodePath.slice(0, 1500) : null,
      espacioId: body.espacioId ?? null,
      ...(body.dimensiones && typeof body.dimensiones === 'object'
        ? { dimensiones: body.dimensiones as Prisma.InputJsonValue }
        : {}),
    },
    update: {
      nodeName: body.nodeName.trim().slice(0, 300),
      nodePath: typeof body.nodePath === 'string' ? body.nodePath.slice(0, 1500) : null,
      espacioId: body.espacioId ?? null,
      ...(body.dimensiones && typeof body.dimensiones === 'object'
        ? { dimensiones: body.dimensiones as object }
        : {}),
    },
    select: { id: true, nodeKey: true, nodeName: true, espacioId: true },
  })

  return NextResponse.json({ elemento })
}
