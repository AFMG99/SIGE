import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/models/prisma'
import { getCurrentUser, canWithOverrides } from '@/shared/models/authz'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: { modeloId: string } }

export async function GET(request: NextRequest, { params }: Context) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
  if (!(await canWithOverrides(user, 'plans'))) {
    return NextResponse.json({ message: 'No tiene permiso para consultar el modelo espacial' }, { status: 403 })
  }

  const mes = Number(request.nextUrl.searchParams.get('mes'))
  const ano = Number(request.nextUrl.searchParams.get('ano'))
  if (!Number.isInteger(mes) || mes < 1 || mes > 12 ||
      !Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return NextResponse.json({ message: 'Indique un mes y año válidos para consultar la energía.' }, { status: 400 })
  }

  const modelo = await prisma.modeloArquitectonico.findFirst({
    where: { id: params.modeloId, estado: 'LISTO', activo: true },
    select: { id: true, edificacionId: true, bloqueId: true },
  })
  if (!modelo) return NextResponse.json({ message: 'Modelo no encontrado o inactivo' }, { status: 404 })

  const [periodo, elementos] = await Promise.all([
    prisma.usoPeriodo.findUnique({
      where: { edificacionId_mes_ano: { edificacionId: modelo.edificacionId, mes, ano } },
      select: { estado: true, equiposEsperados: true, equiposCalculados: true, equiposRevisar: true, calculadoEn: true },
    }),
    prisma.elementoModelo3D.findMany({
      where: {
        modeloId: modelo.id,
        espacioId: { not: null },
        ...(modelo.bloqueId ? { espacio: { bloqueId: modelo.bloqueId } } : {}),
      },
      select: {
        nodeKey: true,
        nodeName: true,
        espacio: {
          select: {
            id: true,
            nombre: true,
            piso: true,
            bloque: { select: { id: true, codigo: true, nombre: true } },
            equipos: {
              where: { usenIndicador: 'ACTIVO' },
              orderBy: { tipo: 'asc' },
              select: {
                id: true,
                tipo: true,
                cantidad: true,
                potenciaNominal: true,
                horasUsoDia: true,
                diasUsoMes: true,
                usoPeriodos: {
                  where: { mes, ano },
                  select: { horasUsoDia: true, diasUsoMes: true, estado: true, motivoRevision: true },
                },
              },
            },
          },
        },
      },
    }),
  ])

  const periodoCalculado = periodo?.estado === 'CALCULADO' || periodo?.estado === 'REVISAR'
  const resultados = elementos.flatMap((elemento) => {
    const espacio = elemento.espacio
    if (!espacio) return []
    const equipos = espacio.equipos.map((equipo) => {
      const uso = equipo.usoPeriodos[0]
      const usarConfiguracion = !periodo
      // Un equipo sin fila de uso en un periodo calculado/revisado no equivale a cero:
      // el motor puede haberlo dejado sin horario o días operativos.
      const horasUsoDia = periodoCalculado ? (uso?.horasUsoDia ?? null) : usarConfiguracion ? equipo.horasUsoDia : null
      const diasUsoMes = periodoCalculado ? (uso?.diasUsoMes ?? null) : usarConfiguracion ? equipo.diasUsoMes : null
      const kwh = horasUsoDia === null || diasUsoMes === null
        ? null
        : (equipo.cantidad * equipo.potenciaNominal * horasUsoDia * diasUsoMes) / 1000

      return {
        id: equipo.id,
        tipo: equipo.tipo,
        cantidad: equipo.cantidad,
        potenciaW: equipo.potenciaNominal,
        horasUsoDia,
        diasUsoMes,
        consumoKwh: kwh === null ? null : Number(kwh.toFixed(3)),
        estadoUso: uso?.estado ?? (periodoCalculado ? 'SIN_USO_REGISTRADO' : usarConfiguracion ? 'CONFIGURACION_BASE' : 'SIN_RESULTADO'),
        motivoRevision: uso?.motivoRevision ?? null,
      }
    })

    const validos = equipos.filter((equipo) => equipo.consumoKwh !== null)
    const consumoKwh = validos.reduce((total, equipo) => total + (equipo.consumoKwh ?? 0), 0)
    const sinResultado = equipos.some((equipo) => equipo.consumoKwh === null)

    return [{
      nodeKey: elemento.nodeKey,
      nodeName: elemento.nodeName,
      espacio: {
        id: espacio.id,
        nombre: espacio.nombre,
        piso: espacio.piso,
        bloque: espacio.bloque,
      },
      equipos,
      cantidadEquipos: equipos.length,
      consumoKwh: sinResultado ? null : Number(consumoKwh.toFixed(3)),
      fuente: periodoCalculado ? 'USO_PERIODO' : periodo ? 'SIN_RESULTADO' : 'CONFIGURACION_BASE',
    }]
  })

  const totalKwh = resultados.reduce((total, item) => total + (item.consumoKwh ?? 0), 0)
  return NextResponse.json({
    periodo: { mes, ano, estado: periodo?.estado ?? 'SIN_CALCULO', calculadoEn: periodo?.calculadoEn ?? null },
    resumen: {
      elementosAsociados: resultados.length,
      espaciosAsociados: new Set(resultados.map((item) => item.espacio.id)).size,
      consumoTotalKwh: Number(totalKwh.toFixed(3)),
      equipos: resultados.reduce((total, item) => total + item.cantidadEquipos, 0),
    },
    elementos: resultados,
  })
}
