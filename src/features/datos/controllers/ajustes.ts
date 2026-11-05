'use server'

// Server Actions para eliminar y vaciar los Ajustes Energéticos desde la
// pestaña "Ajustes" del módulo de datos. El catálogo de edificaciones/bloques
// cuenta estos registros como "datos guardados" al bloquear su borrado, así
// que deben poder vaciarse desde la UI para que ese bloqueo sea accionable.

import { prisma } from '@/shared/models/prisma'
import { canWithOverrides, getCurrentUser } from '@/shared/models/authz'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import { resolverModeloLben } from '@/features/datos/models/ajustes'
import type { ResultadoGestion } from '@/features/datos/models/validations'

type AuthCarga = { ok: true } | { ok: false; mensaje: string }

async function autorizarCarga(): Promise<AuthCarga> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
  if (!(await canWithOverrides(user, 'consumption', 'upload'))) {
    return { ok: false, mensaje: 'Su rol no tiene permiso para modificar ajustes energéticos.' }
  }
  return { ok: true }
}

/** Datos del formulario de creación de ajustes (pestaña Carga). */
export type DatosNuevoAjuste = {
  tipo?: string
  bloqueId?: string
  /** Periodo de inicio en formato "YYYY-MM". */
  periodoInicio?: string
  /** Periodo fin en formato "YYYY-MM". */
  periodoFin?: string
  valorAjuste?: number | string
  direccion?: string
  descripcion?: string
  observaciones?: string
}

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function primerDiaDelMes(periodo: string): Date {
  const [ano, mes] = periodo.split('-').map(Number)
  return new Date(ano, mes - 1, 1)
}

function ultimoDiaDelMes(periodo: string): Date {
  const [ano, mes] = periodo.split('-').map(Number)
  return new Date(ano, mes, 0)
}

/**
 * Crea un ajuste energético (Anexo 4 o rutinario) para un bloque.
 * El periodo llega como "YYYY-MM" y se guarda como DateTime (primer y
 * último día del mes); el motor lo vuelve a leer con `toISOString().slice(0, 7)`.
 */
export async function crearAjuste(datos: DatosNuevoAjuste): Promise<ResultadoGestion> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const inicio = String(datos?.periodoInicio ?? '').trim()
    const fin = String(datos?.periodoFin ?? '').trim()
    if (!PERIODO_RE.test(inicio) || !PERIODO_RE.test(fin)) {
      return { estado: 'error', mensaje: 'Periodos inválidos: use el formato YYYY-MM.' }
    }
    if (inicio > fin) {
      return { estado: 'error', mensaje: 'El periodo de inicio no puede ser posterior al de fin.' }
    }

    const valor = Number(datos?.valorAjuste)
    if (!Number.isFinite(valor) || valor <= 0 || valor > 100) {
      return { estado: 'error', mensaje: 'La proporción debe estar entre 0 y 100.' }
    }

    const descripcion = String(datos?.descripcion ?? '').trim()
    if (!descripcion) {
      return { estado: 'error', mensaje: 'Describa la causa del ajuste.' }
    }

    const bloqueId = String(datos?.bloqueId ?? '').trim()
    if (!bloqueId) {
      return { estado: 'error', mensaje: 'Indique el bloque al que aplica el ajuste.' }
    }
    const bloque = await prisma.bloque.findUnique({
      where: { id: bloqueId },
      select: { codigo: true, nombre: true },
    })
    if (!bloque) {
      return { estado: 'error', mensaje: 'El bloque indicado no existe.' }
    }

    const tipo = datos?.tipo === 'RUTINARIO' ? 'RUTINARIO' : 'NO_RUTINARIO'
    const direccion = datos?.direccion === 'incremento' ? 'incremento' : 'reduccion'
    const observaciones = String(datos?.observaciones ?? '').trim() || null

    // Validación de traslape: no puede existir otro ajuste para el mismo bloque
    // cuyo periodo se solape con [inicio, fin].
    const inicioDate = primerDiaDelMes(inicio)
    const finDate = ultimoDiaDelMes(fin)
    const solapados = await prisma.ajusteEnergetico.findMany({
      where: {
        bloqueId,
        AND: [
          { periodoInicio: { lte: finDate } },
          { periodoFin: { gte: inicioDate } },
        ],
      },
      select: { periodoInicio: true, periodoFin: true },
    })
    if (solapados.length > 0) {
      const s = solapados[0]
      return {
        estado: 'error',
        mensaje: `Ya existe un ajuste para este bloque en un periodo solapado (${s.periodoInicio
          .toISOString()
          .slice(0, 7)} a ${s.periodoFin.toISOString().slice(0, 7)}).`,
      }
    }

    // §7.6.2 (UPME 0016 de 2024): `modelo` documenta el modelo de LBEn sobre
    // el que se aplica el ajuste; se registra el de mayor prioridad entre las
    // líneas base guardadas del bloque (null si el bloque aún no tiene).
    const lineasBloque = await prisma.lineaBaseEnergia.findMany({
      where: { bloqueId },
      select: { tipo: true },
    })
    const modelo = resolverModeloLben(lineasBloque.map((l) => l.tipo))

    await prisma.ajusteEnergetico.create({
      data: {
        bloqueId,
        tipo,
        modelo,
        descripcion,
        periodoInicio: primerDiaDelMes(inicio),
        periodoFin: ultimoDiaDelMes(fin),
        valorAjuste: valor,
        direccion,
        observaciones,
      },
    })

    await auditarAccion({
      action: 'ajuste.create',
      targetId: bloqueId,
      detail: `Ajuste ${tipo} ${inicio}–${fin} (${valor}% ${direccion}) en el bloque "${bloque.codigo} — ${bloque.nombre}".`,
    })

    return {
      estado: 'completado',
      eliminadas: 0,
      lineasBaseEliminadas: 0,
      mensaje: `Ajuste ${tipo} creado: ${inicio}–${fin}, ${valor}% (${direccion}).`,
    }
  } catch (error) {
    console.error('Error en crearAjuste:', error)
    return { estado: 'error', mensaje: 'No fue posible crear el ajuste. Intente de nuevo.' }
  }
}

/**
 * Elimina un ajuste energético. El bloque se conserva: solo desaparece
 * este registro de su historial de ajustes.
 */
export async function eliminarAjuste(id: string): Promise<ResultadoGestion> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const idAjuste = String(id ?? '').trim()
    if (!idAjuste) {
      return { estado: 'error', mensaje: 'Debe indicar el ajuste a eliminar.' }
    }

    const ajuste = await prisma.ajusteEnergetico.findUnique({
      where: { id: idAjuste },
      select: {
        id: true,
        tipo: true,
        bloque: { select: { codigo: true, nombre: true } },
      },
    })
    if (!ajuste) {
      return { estado: 'error', mensaje: 'El ajuste indicado ya no existe.' }
    }

    await prisma.ajusteEnergetico.delete({ where: { id: ajuste.id } })

    await auditarAccion({
      action: 'ajuste.delete',
      targetId: ajuste.id,
      detail: `Ajuste ${ajuste.tipo} eliminado del bloque "${ajuste.bloque.codigo} — ${ajuste.bloque.nombre}".`,
    })

    return {
      estado: 'completado',
      eliminadas: 1,
      lineasBaseEliminadas: 0,
      mensaje: `Se eliminó el ajuste ${ajuste.tipo} del bloque "${ajuste.bloque.codigo} — ${ajuste.bloque.nombre}".`,
    }
  } catch (error) {
    console.error('Error en eliminarAjuste:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible eliminar el ajuste. Intente de nuevo.',
    }
  }
}

/**
 * Vacía todos los ajustes energéticos de la institución. Edificaciones,
 * bloques, equipos, variables, facturas y líneas base se conservan.
 */
export async function vaciarAjustes(): Promise<ResultadoGestion> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const ajustes = await prisma.ajusteEnergetico.deleteMany()

    await auditarAccion({
      action: 'ajustes.truncate',
      targetId: 'global',
      detail: `Se eliminaron ${ajustes.count} ajustes energéticos.`,
    })

    return {
      estado: 'completado',
      eliminadas: ajustes.count,
      lineasBaseEliminadas: 0,
      mensaje: `Se eliminaron ${ajustes.count} ajustes energéticos. El resto de los datos se conserva.`,
    }
  } catch (error) {
    console.error('Error en vaciarAjustes:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible vaciar los ajustes energéticos. Intente de nuevo.',
    }
  }
}

/**
 * Edita un ajuste energético existente. Mismas validaciones que `crearAjuste`
 * (periodos, proporción, bloque, traslape — excluyendo el propio registro).
 */
export async function editarAjuste(
  id: string,
  datos: DatosNuevoAjuste
): Promise<ResultadoGestion> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const idAjuste = String(id ?? '').trim()
    if (!idAjuste) return { estado: 'error', mensaje: 'Debe indicar el ajuste a editar.' }

    const existente = await prisma.ajusteEnergetico.findUnique({
      where: { id: idAjuste },
      select: { id: true, bloqueId: true },
    })
    if (!existente) return { estado: 'error', mensaje: 'El ajuste indicado ya no existe.' }

    const inicio = String(datos?.periodoInicio ?? '').trim()
    const fin = String(datos?.periodoFin ?? '').trim()
    if (!PERIODO_RE.test(inicio) || !PERIODO_RE.test(fin)) {
      return { estado: 'error', mensaje: 'Periodos inválidos: use el formato YYYY-MM.' }
    }
    if (inicio > fin) {
      return { estado: 'error', mensaje: 'El periodo de inicio no puede ser posterior al de fin.' }
    }

    const valor = Number(datos?.valorAjuste)
    if (!Number.isFinite(valor) || valor <= 0 || valor > 100) {
      return { estado: 'error', mensaje: 'La proporción debe estar entre 0 y 100.' }
    }

    const descripcion = String(datos?.descripcion ?? '').trim()
    if (!descripcion) {
      return { estado: 'error', mensaje: 'Describa la causa del ajuste.' }
    }

    const bloqueId = String(datos?.bloqueId ?? existente.bloqueId).trim()
    if (!bloqueId) {
      return { estado: 'error', mensaje: 'Indique el bloque al que aplica el ajuste.' }
    }
    const bloque = await prisma.bloque.findUnique({
      where: { id: bloqueId },
      select: { codigo: true, nombre: true },
    })
    if (!bloque) {
      return { estado: 'error', mensaje: 'El bloque indicado no existe.' }
    }

    const tipo = datos?.tipo === 'RUTINARIO' ? 'RUTINARIO' : 'NO_RUTINARIO'
    const direccion = datos?.direccion === 'incremento' ? 'incremento' : 'reduccion'
    const observaciones = String(datos?.observaciones ?? '').trim() || null

    const inicioDate = primerDiaDelMes(inicio)
    const finDate = ultimoDiaDelMes(fin)
    const solapados = await prisma.ajusteEnergetico.findMany({
      where: {
        bloqueId,
        id: { not: idAjuste },
        AND: [
          { periodoInicio: { lte: finDate } },
          { periodoFin: { gte: inicioDate } },
        ],
      },
      select: { periodoInicio: true, periodoFin: true },
    })
    if (solapados.length > 0) {
      const s = solapados[0]
      return {
        estado: 'error',
        mensaje: `Ya existe un ajuste para este bloque en un periodo solapado (${s.periodoInicio.toISOString().slice(0, 7)} a ${s.periodoFin.toISOString().slice(0, 7)}).`,
      }
    }

    const lineasBloque = await prisma.lineaBaseEnergia.findMany({
      where: { bloqueId },
      select: { tipo: true },
    })
    const modelo = resolverModeloLben(lineasBloque.map((l) => l.tipo))

    await prisma.ajusteEnergetico.update({
      where: { id: idAjuste },
      data: {
        bloqueId,
        tipo,
        modelo,
        descripcion,
        periodoInicio: inicioDate,
        periodoFin: finDate,
        valorAjuste: valor,
        direccion,
        observaciones,
      },
    })

    await auditarAccion({
      action: 'ajuste.update',
      targetId: idAjuste,
      detail: `Ajuste ${tipo} ${inicio} a ${fin} (${valor}% ${direccion}) actualizado en el bloque "${bloque.codigo} — ${bloque.nombre}".`,
    })

    return {
      estado: 'completado',
      eliminadas: 0,
      lineasBaseEliminadas: 0,
      mensaje: `Ajuste ${tipo} actualizado: ${inicio} a ${fin}, ${valor}% (${direccion}).`,
    }
  } catch (error) {
    console.error('Error en editarAjuste:', error)
    return { estado: 'error', mensaje: 'No fue posible editar el ajuste. Intente de nuevo.' }
  }
}
