import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/models/prisma'
import { getCurrentUser, canWithOverrides } from '@/shared/models/authz'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CHUNK_BYTES = 3 * 1024 * 1024

type Context = { params: { modeloId: string; indice: string } }

export async function PUT(request: NextRequest, { params }: Context) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
  if (!(await canWithOverrides(user, 'plans', 'modify'))) {
    return NextResponse.json({ message: 'No tiene permiso para cargar modelos' }, { status: 403 })
  }

  const indice = Number(params.indice)
  if (!Number.isInteger(indice) || indice < 0) return NextResponse.json({ message: 'Índice inválido' }, { status: 400 })

  const modelo = await prisma.modeloArquitectonico.findUnique({
    where: { id: params.modeloId },
    select: { id: true, cantidadPartes: true, tamanoBytes: true, estado: true },
  })
  if (!modelo || modelo.estado !== 'CARGANDO') return NextResponse.json({ message: 'Carga no disponible' }, { status: 404 })
  if (indice >= modelo.cantidadPartes) return NextResponse.json({ message: 'Índice fuera de rango' }, { status: 400 })

  const expected = indice === modelo.cantidadPartes - 1
    ? modelo.tamanoBytes - indice * CHUNK_BYTES
    : CHUNK_BYTES
  const contentLength = Number(request.headers.get('content-length'))
  if (!Number.isFinite(contentLength) || contentLength !== expected || contentLength > CHUNK_BYTES) {
    return NextResponse.json({ message: 'El tamaño de la solicitud no corresponde al fragmento esperado' }, { status: 413 })
  }
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength !== expected) {
    return NextResponse.json({ message: 'Tamaño de fragmento incorrecto' }, { status: 400 })
  }

  await prisma.parteArchivoModelo.upsert({
    where: { modeloId_indice: { modeloId: modelo.id, indice } },
    create: { modeloId: modelo.id, indice, contenido: Buffer.from(bytes), tamanoBytes: bytes.byteLength },
    update: { contenido: Buffer.from(bytes), tamanoBytes: bytes.byteLength },
  })
  return NextResponse.json({ ok: true, indice })
}

export async function GET(_request: NextRequest, { params }: Context) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
  if (!(await canWithOverrides(user, 'plans'))) {
    return NextResponse.json({ message: 'No tiene permiso para consultar modelos' }, { status: 403 })
  }

  const indice = Number(params.indice)
  if (!Number.isInteger(indice) || indice < 0) return NextResponse.json({ message: 'Índice inválido' }, { status: 400 })
  const parte = await prisma.parteArchivoModelo.findFirst({
    where: { modeloId: params.modeloId, indice, modelo: { estado: 'LISTO', activo: true } },
    select: { contenido: true, tamanoBytes: true },
  })
  if (!parte) return NextResponse.json({ message: 'Fragmento no encontrado' }, { status: 404 })

  return new NextResponse(Buffer.from(parte.contenido) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(parte.tamanoBytes),
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
