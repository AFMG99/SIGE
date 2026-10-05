'use server'

// Server Actions para eliminar y vaciar los Ajustes Energéticos desde la
// pestaña "Ajustes" del módulo de datos. El catálogo de edificaciones/bloques
// cuenta estos registros como "datos guardados" al bloquear su borrado, así
// que deben poder vaciarse desde la UI para que ese bloqueo sea accionable.

import { prisma } from '@/lib/prisma'
import { canWithOverrides, getCurrentUser } from '@/lib/authz'
import type { ResultadoGestion } from '@/lib/validations/energia'

type AuthCarga = { ok: true } | { ok: false; mensaje: string }

async function autorizarCarga(): Promise<AuthCarga> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
  if (!(await canWithOverrides(user, 'consumption', 'upload'))) {
    return { ok: false, mensaje: 'Su rol no tiene permiso para modificar ajustes energéticos.' }
  }
  return { ok: true }
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
