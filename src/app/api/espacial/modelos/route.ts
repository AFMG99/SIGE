import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/models/prisma'
import { getCurrentUser, canWithOverrides } from '@/shared/models/authz'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_FILE_BYTES = 100 * 1024 * 1024
const CHUNK_BYTES = 3 * 1024 * 1024

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
  if (!(await canWithOverrides(user, 'plans'))) {
    return NextResponse.json({ message: 'No tiene permiso para consultar modelos' }, { status: 403 })
  }

  const edificacionId = request.nextUrl.searchParams.get('edificacionId')
  if (!edificacionId) return NextResponse.json({ message: 'edificacionId es obligatorio' }, { status: 400 })

  const modelos = await prisma.modeloArquitectonico.findMany({
    where: { edificacionId, estado: 'LISTO', activo: true },
    select: {
      id: true, edificacionId: true, bloqueId: true, nombre: true,
      contentType: true, version: true, unidad: true, escala: true,
      tamanoBytes: true, cantidadPartes: true, createdAt: true,
    },
    orderBy: { version: 'desc' },
  })
  return NextResponse.json({ modelos, chunkBytes: CHUNK_BYTES })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
  if (!(await canWithOverrides(user, 'plans', 'modify'))) {
    return NextResponse.json({ message: 'No tiene permiso para cargar modelos' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as {
    edificacionId?: string; bloqueId?: string | null; nombre?: string
    tamanoBytes?: number; unidad?: string; escala?: number
  } | null
  if (!body?.edificacionId || !body.nombre?.trim() ||
      !Number.isInteger(body.tamanoBytes) || !body.tamanoBytes ||
      body.tamanoBytes < 1 || body.tamanoBytes > MAX_FILE_BYTES ||
      (body.unidad !== 'METERS' && body.unidad !== 'CENTIMETERS' && body.unidad !== 'MILLIMETERS') ||
      !Number.isFinite(body.escala) || !body.escala || body.escala <= 0 || body.escala > 1000) {
    return NextResponse.json({ message: 'Metadatos inválidos o archivo superior a 100 MB' }, { status: 400 })
  }

  const edificacion = await prisma.edificacion.findUnique({
    where: { id: body.edificacionId },
    select: { id: true },
  })
  if (!edificacion) return NextResponse.json({ message: 'Edificación no encontrada' }, { status: 404 })

  if (body.bloqueId) {
    const bloque = await prisma.bloque.findFirst({
      where: { id: body.bloqueId, edificacionId: body.edificacionId },
      select: { id: true },
    })
    if (!bloque) return NextResponse.json({ message: 'El bloque no pertenece a la edificación' }, { status: 400 })
  }

  const cantidadPartes = Math.ceil(body.tamanoBytes / CHUNK_BYTES)
  const version = await prisma.modeloArquitectonico.aggregate({
    where: { edificacionId: body.edificacionId }, _max: { version: true },
  }).then((result) => (result._max.version ?? 0) + 1)

  const modelo = await prisma.modeloArquitectonico.create({
    data: {
      edificacionId: body.edificacionId,
      bloqueId: body.bloqueId ?? null,
      nombre: body.nombre.trim().slice(0, 180),
      tamanoBytes: body.tamanoBytes,
      cantidadPartes,
      unidad: body.unidad,
      escala: body.escala,
      version,
      estado: 'CARGANDO',
      activo: false,
    },
    select: { id: true, cantidadPartes: true },
  })
  return NextResponse.json({ modelo, chunkBytes: CHUNK_BYTES }, { status: 201 })
}
