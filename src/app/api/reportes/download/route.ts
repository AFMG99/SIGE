import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canWithOverrides } from '@/shared/models/authz'
import { obtenerDatosReporte } from '@/features/reportes/controllers/reportesController'
import { generarDocumentoDocxBuffer } from '@/features/reportes/controllers/generadorDocx'
import { generarDocumentoPdfBuffer } from '@/features/reportes/controllers/generadorPdf'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import { solicitudDescargaReporteSchema } from '@/features/reportes/models/reportes'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
  }

  const tienePermiso = await Promise.all([
    canWithOverrides(user, 'reports', 'generate'),
    canWithOverrides(user, 'reports', 'download_reports'),
  ]).then((acts) => acts.some(Boolean))

  if (!tienePermiso) {
    return NextResponse.json(
      { message: 'No tiene permiso para descargar reportes institucionales' },
      { status: 403 }
    )
  }

  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ message: 'El cuerpo JSON no es válido' }, { status: 400 })
    }

    const validacion = solicitudDescargaReporteSchema.safeParse(body)
    if (!validacion.success) {
      return NextResponse.json(
        {
          message: 'Datos inválidos',
          errors: validacion.error.errors.map((error) => error.message),
        },
        { status: 400 }
      )
    }

    const { formato, ...filtros } = validacion.data

    const resultado = await obtenerDatosReporte(filtros)
    if (resultado.estado === 'error') {
      return NextResponse.json({ message: resultado.mensaje }, { status: 400 })
    }

    const { datos } = resultado
    const fechaStr = new Date().toISOString().slice(0, 10)
    const scopeStr = datos.generalidades.bloqueCodigo
      ? `Bloque_${datos.generalidades.bloqueCodigo}`
      : datos.generalidades.edificacionNombre.replace(/\s+/g, '_')

    await auditarAccion({
      targetId: filtros.edificacionId ?? 'general',
      action: 'reporte.descargado',
      detail: `Descarga de reporte UPME en formato ${formato.toUpperCase()} para ${scopeStr}`,
    })

    if (formato === 'docx') {
      const buffer = await generarDocumentoDocxBuffer(datos)
      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="Reporte_UPME_0016_${scopeStr}_${fechaStr}.docx"`,
        },
      })
    } else {
      const buffer = generarDocumentoPdfBuffer(datos)
      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Reporte_UPME_0016_${scopeStr}_${fechaStr}.pdf"`,
        },
      })
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error interno al generar archivo'
    return NextResponse.json({ message: mensaje }, { status: 500 })
  }
}
