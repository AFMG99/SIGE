'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import { normalizarPiso, validarDimensiones } from '@/features/datos/models/geometria'
import { canWithOverrides, getCurrentUser } from '@/shared/models/authz'
import { prisma } from '@/shared/models/prisma'

const entradaImportacionSchema = z.object({
  bloqueId: z.string().trim().min(1).max(100),
  espacios: z
    .array(
      z.object({
        espacioId: z.string().trim().min(1).max(100),
        piso: z.string().max(60),
        largoM: z.number().finite().positive().max(10_000),
        anchoM: z.number().finite().positive().max(10_000),
        areaM2: z.number().finite().positive().max(100_000_000),
      })
    )
    .min(1)
    .max(200),
})

type EntradaImportacion = z.infer<typeof entradaImportacionSchema>

class ImportacionCadError extends Error {}

export type ResultadoImportacionCad =
  | { estado: 'ok'; mensaje: string; cantidad: number }
  | { estado: 'error'; mensaje: string }

export async function confirmarImportacionCad(
  input: EntradaImportacion
): Promise<ResultadoImportacionCad> {
  const parsed = entradaImportacionSchema.safeParse(input)
  if (!parsed.success) {
    return { estado: 'error', mensaje: 'Revise las medidas y asociaciones del plano antes de importar.' }
  }

  const { bloqueId, espacios } = parsed.data
  let user: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    user = await getCurrentUser()
  } catch (error) {
    console.error('Error al verificar la sesión para importar CAD:', error)
    return { estado: 'error', mensaje: 'No fue posible verificar la sesión. Intente de nuevo.' }
  }
  if (!user) {
    return { estado: 'error', mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
  }
  try {
    if (!(await canWithOverrides(user, 'plans', 'modify'))) {
      return { estado: 'error', mensaje: 'Su rol no tiene permiso para importar medidas de planos.' }
    }
  } catch (error) {
    console.error('Error al verificar permisos para importar CAD:', error)
    return { estado: 'error', mensaje: 'No fue posible verificar sus permisos. Intente de nuevo.' }
  }

  const ids = espacios.map((espacio) => espacio.espacioId)
  if (new Set(ids).size !== ids.length) {
    return { estado: 'error', mensaje: 'Cada contorno debe asociarse a un espacio diferente.' }
  }

  const preparados: Array<{
    espacioId: string
    piso: string
    largoM: number | null
    anchoM: number | null
    areaCalculadaM2: number | null
  }> = []
  for (const espacio of espacios) {
    const piso = normalizarPiso(espacio.piso)
    const dimensiones = validarDimensiones(espacio)
    if (!piso) {
      return { estado: 'error', mensaje: 'El nombre de piso no puede superar los 60 caracteres.' }
    }
    if (!dimensiones.ok) {
      return { estado: 'error', mensaje: dimensiones.mensaje }
    }
    preparados.push({
      espacioId: espacio.espacioId,
      piso,
      largoM: dimensiones.valor.largoM,
      anchoM: dimensiones.valor.anchoM,
      areaCalculadaM2: espacio.areaM2,
    })
  }

  try {
    const cantidad = await prisma.$transaction(async (tx) => {
      const objetivos = await tx.espacio.findMany({
        where: { id: { in: ids }, bloqueId },
        select: { id: true, nombre: true },
      })
      if (objetivos.length !== ids.length) {
        throw new ImportacionCadError('Uno o más espacios no pertenecen al bloque seleccionado.')
      }

      const existentes = await tx.espacio.findMany({
        where: { bloqueId },
        select: { id: true, nombre: true, piso: true },
      })
      const objetivoIds = new Set(ids)
      const nombresAsignados = new Set<string>()

      for (const objetivo of objetivos) {
        const importacion = preparados.find((item) => item.espacioId === objetivo.id)
        if (!importacion) continue
        const nombreClave = `${importacion.piso.toLocaleLowerCase('es-CO')}|${objetivo.nombre.trim().toLocaleLowerCase('es-CO')}`
        if (nombresAsignados.has(nombreClave)) {
          throw new ImportacionCadError('Dos espacios quedarían con el mismo nombre en el mismo piso.')
        }
        nombresAsignados.add(nombreClave)

        const conflicto = existentes.find(
          (espacio) =>
            !objetivoIds.has(espacio.id) &&
            espacio.nombre.trim().toLocaleLowerCase('es-CO') ===
              objetivo.nombre.trim().toLocaleLowerCase('es-CO') &&
            (normalizarPiso(espacio.piso) ?? espacio.piso).toLocaleLowerCase('es-CO') ===
              importacion.piso.toLocaleLowerCase('es-CO')
        )
        if (conflicto) {
          throw new ImportacionCadError(
            `El espacio "${objetivo.nombre}" ya existe en el piso "${importacion.piso}".`
          )
        }
      }

      await Promise.all(
        preparados.map((espacio) =>
          tx.espacio.update({
            where: { id: espacio.espacioId },
            data: {
              piso: espacio.piso,
              largoM: espacio.largoM,
              anchoM: espacio.anchoM,
              areaCalculadaM2: espacio.areaCalculadaM2,
            },
          })
        )
      )

      return preparados.length
    })

    await auditarAccion({
      action: 'espacio.cad_import',
      targetId: bloqueId,
      detail: `${cantidad} espacio(s) actualizado(s) desde una importación CAD validada.`,
    })
    revalidatePath('/dashboard/espacial')

    return {
      estado: 'ok',
      cantidad,
      mensaje: `Se actualizaron ${cantidad} espacio(s) del bloque seleccionado.`,
    }
  } catch (error) {
    if (error instanceof ImportacionCadError) {
      return { estado: 'error', mensaje: error.message }
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return { estado: 'error', mensaje: 'La importación produciría espacios duplicados en el mismo piso.' }
    }
    console.error('Error en confirmarImportacionCad:', error)
    return { estado: 'error', mensaje: 'No fue posible guardar las medidas del plano.' }
  }
}
