'use server'

// Server Actions del calendario operativo por edificación y del cálculo de la
// GDE (Resolución UPME 0016/2024, §7.1/§7.3). El núcleo de cálculo puro vive en
// `models/calendario.ts`; la fuente climática, en `controllers/clima.ts`.

import { prisma } from '@/shared/models/prisma'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import { autorizarCarga } from '@/features/datos/controllers/edificaciones'
import {
  ClimaFuenteError,
  obtenerTempsHorarias,
} from '@/features/datos/controllers/clima'
import {
  TDEA_PLANTILLA,
  calcularGde,
  configCalendarioSchema,
  consultaGdeSchema,
  rangoCalendarioSchema,
} from '@/features/datos/models/calendario'
import type { ConfigCalendario, ResultadoGde } from '@/features/datos/models/calendario'

export type ConfigCalendarioUI = ConfigCalendario

export type Exito<T> = ({ estado: 'ok' } & T) | { estado: 'error'; mensaje: string }

const FUENTE_CLIMA = 'Open-Meteo (reanálisis ERA5/Copernicus)'

// ============================================================
// Configuración operativa (H, Tb) + coordenadas de la edificación
// ============================================================

export async function guardarConfigCalendario(
  edificacionId: string,
  datos: {
    horaInicioOperacion: number
    horasOperacionDia: number
    temperaturaBase: number
    lat: number
    lon: number
  }
): Promise<Exito<{ mensaje: string }>> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const id = String(edificacionId ?? '').trim()
    if (!id) return { estado: 'error', mensaje: 'Debe indicar la edificación.' }

    const parseo = configCalendarioSchema.safeParse(datos)
    if (!parseo.success) {
      return {
        estado: 'error',
        mensaje: parseo.error.issues[0]?.message ?? 'Configuración inválida.',
      }
    }

    const edificacion = await prisma.edificacion.findUnique({
      where: { id },
      select: { id: true, nombre: true },
    })
    if (!edificacion) {
      return { estado: 'error', mensaje: 'La edificación indicada no existe.' }
    }

    await prisma.$transaction([
      prisma.calendarioOperativo.upsert({
        where: { edificacionId: id },
        create: { edificacionId: id, ...parseo.data },
        update: {
          horaInicioOperacion: parseo.data.horaInicioOperacion,
          horasOperacionDia: parseo.data.horasOperacionDia,
          temperaturaBase: parseo.data.temperaturaBase,
        },
      }),
      prisma.edificacion.update({
        where: { id },
        data: { lat: parseo.data.lat, lon: parseo.data.lon },
      }),
    ])

    await auditarAccion({
      action: 'calendario.config',
      targetId: id,
      detail: `Configuración operativa de "${edificacion.nombre}" actualizada (Tb ${parseo.data.temperaturaBase} °C, ${parseo.data.horasOperacionDia} h/día).`,
    })

    return { estado: 'ok', mensaje: 'Configuración operativa guardada.' }
  } catch (error) {
    console.error('Error en guardarConfigCalendario:', error)
    return { estado: 'error', mensaje: 'No fue posible guardar la configuración. Intente de nuevo.' }
  }
}

// ============================================================
// Rangos del calendario
// ============================================================

export async function agregarRangoCalendario(
  edificacionId: string,
  datos: { fechaInicio: string; fechaFin: string; tipoDia: string; nombre?: string }
): Promise<Exito<{ mensaje: string }>> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const parseo = rangoCalendarioSchema.safeParse(datos)
    if (!parseo.success) {
      return {
        estado: 'error',
        mensaje: parseo.error.issues[0]?.message ?? 'Rango inválido.',
      }
    }

    const calendario = await prisma.calendarioOperativo.findUnique({
      where: { edificacionId },
      select: { id: true },
    })
    if (!calendario) {
      return {
        estado: 'error',
        mensaje: 'Guarde primero la configuración operativa (horario y temperatura base).',
      }
    }

    await prisma.rangoCalendario.create({
      data: {
        calendarioId: calendario.id,
        fechaInicio: new Date(`${parseo.data.fechaInicio}T00:00:00Z`),
        fechaFin: new Date(`${parseo.data.fechaFin}T00:00:00Z`),
        tipoDia: parseo.data.tipoDia,
        nombre: parseo.data.nombre || null,
      },
    })

    await auditarAccion({
      action: 'calendario.rango.create',
      targetId: edificacionId,
      detail: `Rango ${parseo.data.fechaInicio} → ${parseo.data.fechaFin} (${parseo.data.tipoDia}).`,
    })

    return { estado: 'ok', mensaje: 'Rango agregado al calendario.' }
  } catch (error) {
    console.error('Error en agregarRangoCalendario:', error)
    return { estado: 'error', mensaje: 'No fue posible agregar el rango. Intente de nuevo.' }
  }
}

export async function eliminarRangoCalendario(id: string): Promise<Exito<{ mensaje: string }>> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const rango = await prisma.rangoCalendario.findUnique({
      where: { id: String(id ?? '').trim() },
      select: { id: true, calendarioId: true },
    })
    if (!rango) {
      return { estado: 'error', mensaje: 'El rango indicado ya no existe.' }
    }

    await prisma.rangoCalendario.delete({ where: { id: rango.id } })

    await auditarAccion({
      action: 'calendario.rango.delete',
      targetId: rango.calendarioId,
      detail: `Rango ${id} eliminado del calendario.`,
    })

    return { estado: 'ok', mensaje: 'Rango eliminado del calendario.' }
  } catch (error) {
    console.error('Error en eliminarRangoCalendario:', error)
    return { estado: 'error', mensaje: 'No fue posible eliminar el rango. Intente de nuevo.' }
  }
}

/**
 * Carga la plantilla del TdeA (datos iniciales tomados de los PDF de `docs/`;
 * sin fechas fijas en la lógica). Solo aplica si la edificación ya tiene
 * configuración y aún no tiene rangos.
 */
export async function cargarPlantillaCalendario(
  edificacionId: string
): Promise<Exito<{ mensaje: string }>> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const calendario = await prisma.calendarioOperativo.findUnique({
      where: { edificacionId },
      select: { id: true, rangos: { select: { id: true } } },
    })
    if (!calendario) {
      return {
        estado: 'error',
        mensaje: 'Guarde primero la configuración operativa (horario y temperatura base).',
      }
    }
    if (calendario.rangos.length > 0) {
      return {
        estado: 'error',
        mensaje:
          'Esta edificación ya tiene rangos. Elimínelos uno a uno si desea cargar la plantilla en su lugar.',
      }
    }

    await prisma.$transaction(
      TDEA_PLANTILLA.rangos.map((r) =>
        prisma.rangoCalendario.create({
          data: {
            calendarioId: calendario.id,
            fechaInicio: new Date(`${r.fechaInicio}T00:00:00Z`),
            fechaFin: new Date(`${r.fechaFin}T00:00:00Z`),
            tipoDia: r.tipoDia,
            nombre: r.nombre ?? null,
          },
        })
      )
    )

    await auditarAccion({
      action: 'calendario.plantilla',
      targetId: edificacionId,
      detail: `Plantilla "${TDEA_PLANTILLA.nombre}" cargada (${TDEA_PLANTILLA.rangos.length} rangos).`,
    })

    return {
      estado: 'ok',
      mensaje: `Plantilla cargada (${TDEA_PLANTILLA.rangos.length} rangos). Revise y ajuste las fechas si difieren de su caso.`,
    }
  } catch (error) {
    console.error('Error en cargarPlantillaCalendario:', error)
    return { estado: 'error', mensaje: 'No fue posible cargar la plantilla. Intente de nuevo.' }
  }
}

// ============================================================
// Cálculo y registro de la GDE
// ============================================================

export type ResultadoCalculoGde = {
  resultado: ResultadoGde
  config: ConfigCalendario
  mes: number
  ano: number
  fuente: string
  mensaje: string
}

export async function calcularGdeMensual(
  edificacionId: string,
  mes: number,
  ano: number
): Promise<Exito<ResultadoCalculoGde>> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const consulta = consultaGdeSchema.safeParse({ mes, ano })
    if (!consulta.success) {
      return { estado: 'error', mensaje: 'Periodo inválido (mes 1-12, año válido).' }
    }

    const edificacion = await prisma.edificacion.findUnique({
      where: { id: String(edificacionId ?? '').trim() },
      select: { id: true, nombre: true, lat: true, lon: true, calendario: true },
    })
    if (!edificacion) {
      return { estado: 'error', mensaje: 'La edificación indicada no existe.' }
    }
    if (!edificacion.calendario) {
      return {
        estado: 'error',
        mensaje:
          'Esta edificación no tiene configuración operativa. Complete horario, temperatura base y coordenadas.',
      }
    }
    if (edificacion.lat == null || edificacion.lon == null) {
      return {
        estado: 'error',
        mensaje:
          'Esta edificación no tiene coordenadas registradas (requeridas para la fuente climática).',
      }
    }

    const rangos = await prisma.rangoCalendario.findMany({
      where: { calendario: { edificacionId: edificacion.id } },
      orderBy: { fechaInicio: 'asc' },
      select: { id: true, fechaInicio: true, fechaFin: true, tipoDia: true, nombre: true },
    })
    if (rangos.length === 0) {
      return {
        estado: 'error',
        mensaje:
          'Esta edificación no tiene rangos en el calendario. Agregue rangos o cargue la plantilla.',
      }
    }

    const config: ConfigCalendario = {
      horaInicioOperacion: edificacion.calendario.horaInicioOperacion,
      horasOperacionDia: edificacion.calendario.horasOperacionDia,
      temperaturaBase: edificacion.calendario.temperaturaBase,
    }

    const tempsHorarias = await obtenerTempsHorarias(
      edificacion.lat,
      edificacion.lon,
      consulta.data.mes,
      consulta.data.ano
    )

    const resultado = calcularGde({
      rangos: rangos.map((r) => ({
        id: r.id,
        fechaInicio: r.fechaInicio.toISOString().slice(0, 10),
        fechaFin: r.fechaFin.toISOString().slice(0, 10),
        tipoDia: r.tipoDia,
        nombre: r.nombre,
      })),
      config,
      tempsHorarias,
      mes: consulta.data.mes,
      ano: consulta.data.ano,
    })

    if (resultado.diasOperativos === 0) {
      return {
        estado: 'error',
        mensaje:
          'El calendario no marca ningún día operativo en ese periodo. Revise los rangos del mes.',
      }
    }

    return {
      estado: 'ok',
      resultado,
      config,
      mes: consulta.data.mes,
      ano: consulta.data.ano,
      fuente: FUENTE_CLIMA,
      mensaje: `GDE calculada: ${resultado.gde} °C·día sobre ${resultado.diasOperativos} días operativos.`,
    }
  } catch (error) {
    if (error instanceof ClimaFuenteError) {
      return { estado: 'error', mensaje: error.message }
    }
    console.error('Error en calcularGdeMensual:', error)
    return { estado: 'error', mensaje: 'No fue posible calcular la GDE. Intente de nuevo.' }
  }
}

/**
 * Registra la GDE calculada en las variables operativas existentes de los
 * bloques de la edificación (solo actualiza filas ya creadas: el resto de los
 * campos — población, días clase — siguen siendo responsabilidad del importador
 * de variables; no se crean filas parciales desde aquí).
 */
export async function registrarGdeCalculado(
  edificacionId: string,
  mes: number,
  ano: number,
  gde: number
): Promise<Exito<{ actualizadas: number; sinRegistro: number; mensaje: string }>> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const consulta = consultaGdeSchema.safeParse({ mes, ano })
    if (!consulta.success) {
      return { estado: 'error', mensaje: 'Periodo inválido (mes 1-12, año válido).' }
    }
    if (!Number.isFinite(gde) || gde < 0) {
      return { estado: 'error', mensaje: 'La GDE a registrar no es válida.' }
    }

    const bloques = await prisma.bloque.findMany({
      where: { edificacionId: String(edificacionId ?? '').trim() },
      select: { id: true },
    })
    if (bloques.length === 0) {
      return { estado: 'error', mensaje: 'Esta edificación no tiene bloques registrados.' }
    }

    const ids = bloques.map((b) => b.id)
    const actualizadas = await prisma.variableOperativa.updateMany({
      where: { bloqueId: { in: ids }, mes: consulta.data.mes, ano: consulta.data.ano },
      data: { gradesDiaEnfriamiento: gde },
    })

    const sinRegistro = ids.length - actualizadas.count

    await auditarAccion({
      action: 'gde.registrar',
      targetId: String(edificacionId),
      detail: `GDE ${gde} °C·día registrada para ${consulta.data.ano}-${String(consulta.data.mes).padStart(2, '0')} en ${actualizadas.count} de ${ids.length} bloques.`,
    })

    return {
      estado: 'ok',
      actualizadas: actualizadas.count,
      sinRegistro,
      mensaje:
        sinRegistro > 0
          ? `GDE registrada en ${actualizadas.count} ${actualizadas.count === 1 ? 'variable' : 'variables'}; ${sinRegistro} ${sinRegistro === 1 ? 'bloque no tiene' : 'bloques no tienen'} variables operativas de ese periodo (cree la fila con el importador de variables).`
          : `GDE registrada en ${actualizadas.count} ${actualizadas.count === 1 ? 'variable' : 'variables'} operativas.`,
    }
  } catch (error) {
    console.error('Error en registrarGdeCalculado:', error)
    return { estado: 'error', mensaje: 'No fue posible registrar la GDE. Intente de nuevo.' }
  }
}
