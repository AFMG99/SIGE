'use server'

// Server Actions para crear y eliminar edificaciones y bloques desde el
// catálogo (Facturas de energía › Edificaciones) y los asistentes de importación
// (SIGE-TdeA).

import { prisma } from '@/shared/models/prisma'
import { canWithOverrides, getCurrentUser } from '@/shared/models/authz'
import { auditarAccion } from '@/features/datos/controllers/auditoria'
import {
  CATALOGO_EDIFICACIONES,
  tipoEdificacionPorCodigo,
  type ResultadoGestion,
} from '@/features/datos/models/validations'

type AuthCarga = { ok: true } | { ok: false; mensaje: string }

export async function autorizarCarga(): Promise<AuthCarga> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, mensaje: 'Sesión expirada. Inicie sesión nuevamente.' }
  if (!(await canWithOverrides(user, 'consumption', 'upload'))) {
    return { ok: false, mensaje: 'Su rol no tiene permiso para crear edificaciones ni bloques.' }
  }
  return { ok: true }
}

export type EdificacionCreada = {
  id: string
  nombre: string
  tipo: string
  /** Área total en m² (UPME §7.3); null cuando aún no se ha registrado. */
  area: number | null
}

export type BloqueCreado = {
  id: string
  codigo: string
  nombre: string
}

export type ResultadoCreacionEdificacion =
  | {
      estado: 'ok'
      edificacion: EdificacionCreada
      /** Bloque automático creado para tipos que no requieren bloque (residencial). */
      bloqueUnico: BloqueCreado | null
      mensaje: string
    }
  | { estado: 'error'; mensaje: string }

export type ResultadoCreacionBloque =
  | { estado: 'ok'; bloque: BloqueCreado; mensaje: string }
  | { estado: 'error'; mensaje: string }

/**
 * Valida el área total en m² (UPME 0016/2024 §7.3). Entrada vacía o
 * `undefined` → null (sin área registrada); cualquier otro valor debe ser un
 * número finito mayor que cero.
 */
function validarArea(area: number | string | undefined): { ok: true; valor: number | null } | { ok: false; mensaje: string } {
  if (area === undefined || area === null || String(area).trim() === '') {
    return { ok: true, valor: null }
  }
  const valor = Number(area)
  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false, mensaje: 'El área debe ser un número mayor que cero (en m²).' }
  }
  return { ok: true, valor }
}

const EDIF_SELECT = { id: true, nombre: true, tipo: true, area: true } as const

/**
 * Crea una edificación con su tipo según CATALOGO_EDIFICACIONES.
 * Si el tipo no requiere bloque, crea en la misma transacción el bloque
 * automático único (invisible en el UI) que sostiene espacios y equipos.
 */
export async function crearEdificacion(
  nombre: string,
  tipo: string,
  area?: number | string
): Promise<ResultadoCreacionEdificacion> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const nombreLimpio = String(nombre ?? '').trim()
    if (nombreLimpio.length < 2) {
      return { estado: 'error', mensaje: 'El nombre debe tener al menos 2 caracteres.' }
    }
    if (nombreLimpio.length > 100) {
      return { estado: 'error', mensaje: 'El nombre no puede superar los 100 caracteres.' }
    }

    const codigoTipo = String(tipo ?? '').trim()
    if (!CATALOGO_EDIFICACIONES.some((t) => t.codigo === codigoTipo)) {
      return { estado: 'error', mensaje: 'Tipo de edificación inválido.' }
    }
    const info = tipoEdificacionPorCodigo(codigoTipo)

    const areaValidada = validarArea(area)
    if (!areaValidada.ok) return { estado: 'error', mensaje: areaValidada.mensaje }

    const creado = await prisma.$transaction(async (tx) => {
      const edificacion = await tx.edificacion.create({
        data: { nombre: nombreLimpio, tipo: codigoTipo, area: areaValidada.valor },
        select: EDIF_SELECT,
      })

      if (info.requiereBloque) {
        return { edificacion, bloqueUnico: null }
      }

      const bloqueUnico = await tx.bloque.create({
        data: {
          codigo: `EDF-${edificacion.id.slice(-8).toUpperCase()}`,
          nombre: `${edificacion.nombre} (bloque único)`,
          areaUtil: 0,
          factorInfraestructura: 1,
          edificacionId: edificacion.id,
        },
        select: { id: true, codigo: true, nombre: true },
      })
      return { edificacion, bloqueUnico }
    })

    await auditarAccion({
      action: 'edificacion.create',
      targetId: creado.edificacion.id,
      detail: creado.bloqueUnico
        ? `Edificación "${creado.edificacion.nombre}" creada con bloque único.`
        : `Edificación "${creado.edificacion.nombre}" creada.`,
    })

    return {
      estado: 'ok',
      edificacion: creado.edificacion,
      bloqueUnico: creado.bloqueUnico,
      mensaje: creado.bloqueUnico
        ? `Edificación "${creado.edificacion.nombre}" creada con su bloque único.`
        : `Edificación "${creado.edificacion.nombre}" creada. Seleccione o cree un bloque.`,
    }
  } catch (error) {
    console.error('Error en crearEdificacion:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible crear la edificación. Intente de nuevo.',
    }
  }
}

const CODIGO_BLOQUE = /^[A-Za-z0-9_-]{2,32}$/

/**
 * Crea un bloque dentro de una edificación (necesario para tipos que
 * requieren bloque: EDUCATIVO_CAMPUS / OFICINA_PUBLICA).
 */
export async function crearBloque(
  edificacionId: string,
  codigo: string,
  nombre: string,
  areaUtil?: number | string,
  factorInfraestructura?: number | string
): Promise<ResultadoCreacionBloque> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const idEdificacion = String(edificacionId ?? '').trim()
    const codigoLimpio = String(codigo ?? '').trim()
    const nombreLimpio = String(nombre ?? '').trim()

    if (!idEdificacion) {
      return { estado: 'error', mensaje: 'Debe indicar la edificación del bloque.' }
    }
    if (!CODIGO_BLOQUE.test(codigoLimpio)) {
      return {
        estado: 'error',
        mensaje: 'El código debe tener entre 2 y 32 caracteres (letras, números, - o _).',
      }
    }
    if (nombreLimpio.length < 2 || nombreLimpio.length > 100) {
      return { estado: 'error', mensaje: 'El nombre del bloque debe tener entre 2 y 100 caracteres.' }
    }

    const area = areaUtil === undefined || String(areaUtil).trim() === '' ? 0 : Number(areaUtil)
    const factor =
      factorInfraestructura === undefined || String(factorInfraestructura).trim() === ''
        ? 1
        : Number(factorInfraestructura)
    if (!Number.isFinite(area) || area < 0) {
      return { estado: 'error', mensaje: 'El área útil debe ser un número mayor o igual a 0.' }
    }
    if (!Number.isFinite(factor) || factor <= 0) {
      return { estado: 'error', mensaje: 'El factor de infraestructura debe ser un número positivo.' }
    }

    const edificacion = await prisma.edificacion.findUnique({
      where: { id: idEdificacion },
      select: { id: true },
    })
    if (!edificacion) {
      return { estado: 'error', mensaje: 'La edificación indicada no existe.' }
    }

    const bloque = await prisma.bloque.create({
      data: {
        codigo: codigoLimpio,
        nombre: nombreLimpio,
        areaUtil: area,
        factorInfraestructura: factor,
        edificacionId: idEdificacion,
      },
      select: { id: true, codigo: true, nombre: true },
    })

    await auditarAccion({
      action: 'bloque.create',
      targetId: bloque.id,
      detail: `Bloque "${bloque.nombre}" creado.`,
    })

    return {
      estado: 'ok',
      bloque,
      mensaje: `Bloque "${bloque.nombre}" creado.`,
    }
  } catch (error) {
    // Colisión de código único (P2002)
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return { estado: 'error', mensaje: 'Ya existe un bloque con ese código.' }
    }
    console.error('Error en crearBloque:', error)
    return { estado: 'error', mensaje: 'No fue posible crear el bloque. Intente de nuevo.' }
  }
}

// ============================================================
// EDICIÓN DEL CATÁLOGO
// ============================================================

export type ResultadoActualizacionEdificacion =
  | { estado: 'ok'; edificacion: EdificacionCreada; mensaje: string }
  | { estado: 'error'; mensaje: string }

/**
 * Actualiza nombre y área de una edificación.
 *
 * El tipo NO es editable: gobierna la estructura bloques/espacios y las
 * identidades `[bloqueId, mes, ano]` de las variables operativas; cambiarlo
 * dejaría equipos y variables huérfanos de su segmentación. Para otro tipo
 * hay que crear una edificación nueva.
 */
export async function actualizarEdificacion(
  id: string,
  datos: { nombre: string; area?: number | string }
): Promise<ResultadoActualizacionEdificacion> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const idEdificacion = String(id ?? '').trim()
    if (!idEdificacion) {
      return { estado: 'error', mensaje: 'Debe indicar la edificación a actualizar.' }
    }

    const nombreLimpio = String(datos?.nombre ?? '').trim()
    if (nombreLimpio.length < 2 || nombreLimpio.length > 100) {
      return { estado: 'error', mensaje: 'El nombre debe tener entre 2 y 100 caracteres.' }
    }

    const areaValidada = validarArea(datos?.area)
    if (!areaValidada.ok) return { estado: 'error', mensaje: areaValidada.mensaje }

    const existente = await prisma.edificacion.findUnique({
      where: { id: idEdificacion },
      select: { id: true, nombre: true },
    })
    if (!existente) {
      return { estado: 'error', mensaje: 'La edificación indicada no existe.' }
    }

    const edificacion = await prisma.edificacion.update({
      where: { id: idEdificacion },
      data: { nombre: nombreLimpio, area: areaValidada.valor },
      select: EDIF_SELECT,
    })

    await auditarAccion({
      action: 'edificacion.update',
      targetId: edificacion.id,
      detail: `Edificación "${edificacion.nombre}" actualizada (nombre/área).`,
    })

    return {
      estado: 'ok',
      edificacion,
      mensaje: `Edificación "${edificacion.nombre}" actualizada.`,
    }
  } catch (error) {
    console.error('Error en actualizarEdificacion:', error)
    return {
      estado: 'error',
      mensaje: 'No fue posible actualizar la edificación. Intente de nuevo.',
    }
  }
}

// ============================================================
// ESPACIOS (cantidad de espacios por bloque — UPME §7.3)
// ============================================================

export type EspacioCreado = { id: string; bloqueId: string; nombre: string }

export type ResultadoCreacionEspacio =
  | { estado: 'ok'; espacio: EspacioCreado; mensaje: string }
  | { estado: 'error'; mensaje: string }

/** Crea un espacio dentro de un bloque (nombre único por bloque). */
export async function crearEspacio(
  bloqueId: string,
  nombre: string
): Promise<ResultadoCreacionEspacio> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const idBloque = String(bloqueId ?? '').trim()
    const nombreLimpio = String(nombre ?? '').trim().replace(/\s+/g, ' ')
    if (!idBloque) {
      return { estado: 'error', mensaje: 'Debe indicar el bloque del espacio.' }
    }
    if (nombreLimpio.length < 2 || nombreLimpio.length > 100) {
      return { estado: 'error', mensaje: 'El nombre del espacio debe tener entre 2 y 100 caracteres.' }
    }

    const bloque = await prisma.bloque.findUnique({
      where: { id: idBloque },
      select: { id: true },
    })
    if (!bloque) {
      return { estado: 'error', mensaje: 'El bloque indicado no existe.' }
    }

    const espacio = await prisma.espacio.create({
      data: { bloqueId: idBloque, nombre: nombreLimpio },
      select: { id: true, bloqueId: true, nombre: true },
    })

    await auditarAccion({
      action: 'espacio.create',
      targetId: espacio.id,
      detail: `Espacio "${espacio.nombre}" creado.`,
    })

    return {
      estado: 'ok',
      espacio,
      mensaje: `Espacio "${espacio.nombre}" creado.`,
    }
  } catch (error) {
    // Colisión de nombre único por bloque (P2002)
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return { estado: 'error', mensaje: 'Ya existe un espacio con ese nombre en este bloque.' }
    }
    console.error('Error en crearEspacio:', error)
    return { estado: 'error', mensaje: 'No fue posible crear el espacio. Intente de nuevo.' }
  }
}

/**
 * Elimina un espacio; se rechaza si tiene equipos registrados, porque
 * `EquipoElectrico.espacio` usa `onDelete: Cascade` y borrarlos destruiría
 * datos sin opción de deshacer.
 */
export async function eliminarEspacio(id: string): Promise<ResultadoGestion> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const idEspacio = String(id ?? '').trim()
    if (!idEspacio) {
      return { estado: 'error', mensaje: 'Debe indicar el espacio a eliminar.' }
    }

    const espacio = await prisma.espacio.findUnique({
      where: { id: idEspacio },
      select: { id: true, nombre: true, _count: { select: { equipos: true } } },
    })
    if (!espacio) {
      return { estado: 'error', mensaje: 'El espacio indicado ya no existe.' }
    }
    if (espacio._count.equipos > 0) {
      return {
        estado: 'error',
        mensaje:
          `No se puede eliminar el espacio "${espacio.nombre}": tiene ` +
          `${espacio._count.equipos === 1 ? '1 equipo' : `${espacio._count.equipos} equipos`} ` +
          'registrados. Vacíelos primero en Gestión de Equipos Eléctricos.',
      }
    }

    await prisma.espacio.delete({ where: { id: espacio.id } })

    await auditarAccion({
      action: 'espacio.delete',
      targetId: espacio.id,
      detail: `Se eliminó el espacio "${espacio.nombre}".`,
    })

    return {
      estado: 'completado',
      eliminadas: 1,
      lineasBaseEliminadas: 0,
      mensaje: `Se eliminó el espacio "${espacio.nombre}".`,
    }
  } catch (error) {
    console.error('Error en eliminarEspacio:', error)
    return { estado: 'error', mensaje: 'No fue posible eliminar el espacio. Intente de nuevo.' }
  }
}

// ============================================================
// ELIMINACIÓN DEL CATÁLOGO
// ============================================================

/**
 * Dependientes de un bloque que sí consideramos "datos guardados". Los
 * `Espacio` vacíos quedan fuera a propósito: `vaciarEquipos` los conserva, así
 * que exigirlos haría el bloque indeleble para siempre. Sí se cuentan para
 * informar qué más se borra en cascada.
 */
const CONTADORES_BLOQUE = {
  espacios: true,
  equipos: true,
  variables: true,
  lineasBase: true,
  ajustes: true,
} as const

type ConteosBloque = {
  espacios: number
  equipos: number
  variables: number
  lineasBase: number
  ajustes: number
}

const plural = (n: number, singular: string, plural_ = `${singular}s`): string =>
  `${n} ${n === 1 ? singular : plural_}`

const listar = (partes: string[]): string => {
  if (partes.length <= 1) return partes[0] ?? ''
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/** Frase con los tipos de dato que impiden el borrado; vacía si no hay ninguno. */
function motivosDeBloqueo(c: ConteosBloque): string[] {
  const partes: string[] = []
  if (c.equipos > 0) partes.push(plural(c.equipos, 'equipo'))
  if (c.variables > 0) partes.push(plural(c.variables, 'variable'))
  if (c.lineasBase > 0) partes.push(plural(c.lineasBase, 'línea base'))
  if (c.ajustes > 0) partes.push(plural(c.ajustes, 'ajuste'))
  return partes
}

/** Dónde vaciar cada tipo de dato que dispara el bloqueo (misma llave que `motivosDeBloqueo`). */
const UBICACIONES_BLOQUEO: Record<keyof Omit<ConteosBloque, 'espacios'>, string> = {
  equipos: 'Gestión de Equipos Eléctricos',
  variables: 'Gestión de Variables Operativas',
  lineasBase: 'Gestión de Facturas › Líneas base guardadas',
  ajustes: 'Ajustes › Gestión',
}

/** Secciones de la UI donde el usuario puede vaciar los datos que bloquean. */
function ubicacionesDeBloqueo(c: ConteosBloque): string[] {
  const partes: string[] = []
  if (c.equipos > 0) partes.push(UBICACIONES_BLOQUEO.equipos)
  if (c.variables > 0) partes.push(UBICACIONES_BLOQUEO.variables)
  if (c.lineasBase > 0) partes.push(UBICACIONES_BLOQUEO.lineasBase)
  if (c.ajustes > 0) partes.push(UBICACIONES_BLOQUEO.ajustes)
  return partes
}

/**
 * Elimina un bloque del catálogo.
 *
 * Se rechaza si el bloque tiene equipos, variables, líneas base o ajustes: la
 * BD borra en cascada esos registros (`onDelete: Cascade`), por lo que
 * permitirlo destruiría datos sin opción de deshacer. Los espacios vacíos sí
 * se eliminan junto con el bloque y se mencionan en la respuesta.
 */
export async function eliminarBloque(id: string): Promise<ResultadoGestion> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const idBloque = String(id ?? '').trim()
    if (!idBloque) {
      return { estado: 'error', mensaje: 'Debe indicar el bloque a eliminar.' }
    }

    const bloque = await prisma.bloque.findUnique({
      where: { id: idBloque },
      select: { id: true, codigo: true, nombre: true, _count: { select: CONTADORES_BLOQUE } },
    })
    if (!bloque) {
      return { estado: 'error', mensaje: 'El bloque indicado ya no existe.' }
    }

    // Pre-check de resultados de uso (T7): `UsoEquipoPeriodo.equipo` es
    // Restrict y `EquipoElectrico → Bloque` es Cascade, así que borrar el
    // bloque estallaría en un P2003 crudo. Se bloquea ANTES de los motivos
    // clásicos porque la existencia de filas de uso implica equipos > 0, y
    // este mensaje es más específico para el usuario.
    const usoBloque = await prisma.usoEquipoPeriodo.count({
      where: { equipo: { bloqueId: bloque.id } },
    })
    if (usoBloque > 0) {
      return {
        estado: 'error',
        mensaje:
          `No se puede eliminar el bloque "${bloque.codigo} — ${bloque.nombre}": ` +
          `existen ${usoBloque === 1 ? '1 cálculo' : `${usoBloque} cálculos`} de uso de horas ` +
          'asociados. Elimínelos o recalcule primero en Cálculo de uso › Resultados.',
      }
    }

    const conteos: ConteosBloque = {
      espacios: bloque._count.espacios,
      equipos: bloque._count.equipos,
      variables: bloque._count.variables,
      lineasBase: bloque._count.lineasBase,
      ajustes: bloque._count.ajustes,
    }
    const motivos = motivosDeBloqueo(conteos)
    if (motivos.length > 0) {
      const ubicaciones = ubicacionesDeBloqueo(conteos)
      return {
        estado: 'error',
        mensaje:
          `No se puede eliminar el bloque "${bloque.codigo} — ${bloque.nombre}": ` +
          `tiene ${listar(motivos)}. Vacíe primero esos módulos (${listar(ubicaciones)}).`,
      }
    }

    await prisma.bloque.delete({ where: { id: bloque.id } })

    const extras =
      conteos.espacios > 0
        ? ` y ${plural(conteos.espacios, 'espacio vacío', 'espacios vacíos')}`
        : ''
    await auditarAccion({
      action: 'bloque.delete',
      targetId: bloque.id,
      detail: `Se eliminó el bloque "${bloque.codigo} — ${bloque.nombre}".`,
    })

    return {
      estado: 'completado',
      eliminadas: 1,
      lineasBaseEliminadas: 0,
      mensaje: `Se eliminó el bloque "${bloque.codigo} — ${bloque.nombre}"${extras}.`,
    }
  } catch (error) {
    console.error('Error en eliminarBloque:', error)
    return { estado: 'error', mensaje: 'No fue posible eliminar el bloque. Intente de nuevo.' }
  }
}

/**
 * Elimina una edificación y, en cascada, todos sus bloques (y los espacios
 * vacíos de esos bloques). Se rechaza si cualquiera de sus bloques tiene
 * datos guardados o si la edificación tiene facturas de energía
 * (`FacturaEnergia.edificacionId` con `onDelete: Restrict`); en ese caso no
 * se borra nada.
 */
export async function eliminarEdificacion(id: string): Promise<ResultadoGestion> {
  try {
    const auth = await autorizarCarga()
    if (!auth.ok) return { estado: 'error', mensaje: auth.mensaje }

    const idEdificacion = String(id ?? '').trim()
    if (!idEdificacion) {
      return { estado: 'error', mensaje: 'Debe indicar la edificación a eliminar.' }
    }

    const edificacion = await prisma.edificacion.findUnique({
      where: { id: idEdificacion },
      select: {
        id: true,
        nombre: true,
        _count: { select: { facturas: true } },
        bloques: {
          select: {
            codigo: true,
            nombre: true,
            _count: { select: CONTADORES_BLOQUE },
          },
        },
      },
    })
    if (!edificacion) {
      return { estado: 'error', mensaje: 'La edificación indicada ya no existe.' }
    }

    // Pre-check de resultados de uso (T7): `UsoPeriodo.edificacionId` es
    // Restrict (directo) y `UsoEquipoPeriodo.equipo` es Restrict mientras
    // `EquipoElectrico → Bloque` es Cascade (cascada vía bloques). Borrar la
    // edificación estallaría en un P2003 crudo; se bloquea ANTES de los
    // motivos clásicos porque la existencia de uso implica equipos > 0.
    const [usoDirecto, usoEnCascada] = await Promise.all([
      prisma.usoPeriodo.count({ where: { edificacionId: edificacion.id } }),
      prisma.usoEquipoPeriodo.count({
        where: { equipo: { bloque: { edificacionId: edificacion.id } } },
      }),
    ])
    const usoTotal = usoDirecto + usoEnCascada
    if (usoTotal > 0) {
      return {
        estado: 'error',
        mensaje:
          `No se puede eliminar la edificación "${edificacion.nombre}": ` +
          `existen ${usoTotal === 1 ? '1 cálculo' : `${usoTotal} cálculos`} de uso de horas ` +
          'asociados. Elimínelos o recalcule primero en Cálculo de uso › Resultados.',
      }
    }

    const total: ConteosBloque = { espacios: 0, equipos: 0, variables: 0, lineasBase: 0, ajustes: 0 }
    for (const b of edificacion.bloques) {
      total.espacios += b._count.espacios
      total.equipos += b._count.equipos
      total.variables += b._count.variables
      total.lineasBase += b._count.lineasBase
      total.ajustes += b._count.ajustes
    }

    const motivos = motivosDeBloqueo(total)
    const facturas = edificacion._count.facturas
    if (facturas > 0) motivos.push(plural(facturas, 'factura'))
    if (motivos.length > 0) {
      const ubicaciones = ubicacionesDeBloqueo(total)
      if (facturas > 0) ubicaciones.push('Facturas de energía › Gestión')
      return {
        estado: 'error',
        mensaje:
          `No se puede eliminar la edificación "${edificacion.nombre}": ` +
          `tiene datos asociados (${listar(motivos)}). ` +
          `Vacíe primero esos módulos (${listar(ubicaciones)}).`,
      }
    }

    // El cascade de BD (Bloque → Espacio) deja la estructura vacía limpia.
    await prisma.edificacion.delete({ where: { id: edificacion.id } })

    const partes: string[] = []
    if (edificacion.bloques.length > 0) partes.push(plural(edificacion.bloques.length, 'bloque'))
    if (total.espacios > 0) {
      partes.push(plural(total.espacios, 'espacio vacío', 'espacios vacíos'))
    }
    const extra = partes.length > 0 ? ` con ${listar(partes)}` : ''

    await auditarAccion({
      action: 'edificacion.delete',
      targetId: edificacion.id,
      detail: `Se eliminó la edificación "${edificacion.nombre}".`,
    })

    return {
      estado: 'completado',
      eliminadas: 1,
      lineasBaseEliminadas: 0,
      mensaje: `Se eliminó la edificación "${edificacion.nombre}"${extra}.`,
    }
  } catch (error) {
    console.error('Error en eliminarEdificacion:', error)
    return { estado: 'error', mensaje: 'No fue posible eliminar la edificación. Intente de nuevo.' }
  }
}
