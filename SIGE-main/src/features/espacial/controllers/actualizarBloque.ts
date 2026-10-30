'use server'

import { prisma } from '@/shared/models/prisma'
import { revalidatePath } from 'next/cache'

export async function actualizarAreaBloque(
  bloqueId: string,
  areaUtil: number
): Promise<{ estado: 'ok' | 'error'; mensaje: string }> {
  try {
    const id = String(bloqueId ?? '').trim()
    const area = Number(areaUtil)

    if (!id) {
      return { estado: 'error', mensaje: 'Identificador de bloque no válido.' }
    }
    if (!Number.isFinite(area) || area < 0) {
      return { estado: 'error', mensaje: 'El área debe ser un número mayor o igual a 0.' }
    }

    await prisma.bloque.update({
      where: { id },
      data: { areaUtil: area },
    })

    revalidatePath('/dashboard/espacial')
    return { estado: 'ok', mensaje: `Área útil actualizada a ${area} m²` }
  } catch (error) {
    console.error('Error en actualizarAreaBloque:', error)
    return { estado: 'error', mensaje: 'No fue posible actualizar el área del bloque.' }
  }
}
