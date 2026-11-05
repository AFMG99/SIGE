import { NextResponse } from 'next/server'
import { prisma } from '@/shared/models/prisma'
import { getCurrentUser, canWithOverrides } from '@/shared/models/authz'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: { modeloId: string } }

export async function POST(_request: Request, { params }: Context) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
  if (!(await canWithOverrides(user, 'plans', 'modify'))) {
    return NextResponse.json({ message: 'No tiene permiso para finalizar cargas' }, { status: 403 })
  }

  const modelo = await prisma.modeloArquitectonico.findUnique({
    where: { id: params.modeloId },
    select: { id: true, edificacionId: true, cantidadPartes: true, tamanoBytes: true, estado: true },
  })
  if (!modelo || modelo.estado !== 'CARGANDO') {
    return NextResponse.json({ message: 'Modelo no disponible para finalizar' }, { status: 404 })
  }

  const partes = await prisma.parteArchivoModelo.findMany({
    where: { modeloId: modelo.id },
    orderBy: { indice: 'asc' },
    select: { indice: true, tamanoBytes: true, contenido: true },
  })
  if (partes.length !== modelo.cantidadPartes ||
      partes.some((parte, index) => parte.indice !== index) ||
      partes.reduce((sum, parte) => sum + parte.tamanoBytes, 0) !== modelo.tamanoBytes) {
    return NextResponse.json({ message: 'La carga está incompleta. Vuelva a intentar los fragmentos faltantes.' }, { status: 409 })
  }

  const magic = Buffer.from(partes[0].contenido).subarray(0, 4).toString('ascii')
  if (magic !== 'glTF') {
    await prisma.modeloArquitectonico.update({ where: { id: modelo.id }, data: { estado: 'FALLIDO' } })
    return NextResponse.json({ message: 'El archivo no tiene una cabecera GLB válida.' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.modeloArquitectonico.updateMany({
      where: { edificacionId: modelo.edificacionId, activo: true },
      data: { activo: false },
    }),
    prisma.modeloArquitectonico.update({
      where: { id: modelo.id },
      data: { estado: 'LISTO', activo: true },
    }),
  ])
  return NextResponse.json({ ok: true, modeloId: modelo.id })
}
