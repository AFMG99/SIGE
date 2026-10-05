'use client'

/**
 * Catálogo compartido de edificaciones y bloques del módulo Gestión de Datos.
 *
 * Una sola fuente de verdad: vive en `DatosContent` y se pasa por props.
 * La creación/eliminación de EDIFICACIONES es responsabilidad del modo
 * «Edificaciones» de la sección Facturas de energía; los importadores de Equipos y
 * Variables heredan la lista y solo crean/eliminan bloques. Así, lo creado
 * en una sección es visible al instante en las demás (antes cada importador
 * guardaba su propia copia en `useState` y se desincronizaba).
 */

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  crearBloque as crearBloqueAction,
  crearEdificacion as crearEdificacionAction,
  eliminarBloque as eliminarBloqueAction,
  eliminarEdificacion as eliminarEdificacionAction,
} from '@/actions/edificaciones'
import type {
  ResultadoCreacionBloque,
  ResultadoCreacionEdificacion,
} from '@/actions/edificaciones'
import type { ResultadoGestion } from '@/lib/validations/energia'

export interface EdificacionInfo {
  id: string
  nombre: string
  tipo: string
}

export interface BloqueInfo {
  id: string
  codigo: string
  nombre: string
  edificacionId: string
}

export interface EspacioInfo {
  id: string
  bloqueId: string
  nombre: string
}

/** Crea la edificación (y su bloque único automático si el tipo lo requiere). */
export type CrearEdificacion = (
  nombre: string,
  tipo: string
) => Promise<ResultadoCreacionEdificacion>

/** Elimina una edificación; se rechaza si tiene datos guardados. */
export type EliminarEdificacion = (id: string) => Promise<ResultadoGestion>

/** Crea un bloque dentro de la edificación indicada. */
export type CrearBloque = (
  edificacionId: string,
  codigo: string,
  nombre: string,
  area?: string,
  factor?: string
) => Promise<ResultadoCreacionBloque>

/** Elimina un bloque vacío; se rechaza si tiene datos guardados. */
export type EliminarBloque = (id: string) => Promise<ResultadoGestion>

export function useCatalogoEdificaciones(
  edificacionesInicial: EdificacionInfo[],
  bloquesInicial: BloqueInfo[]
) {
  const router = useRouter()
  const [edificaciones, setEdificaciones] = useState<EdificacionInfo[]>(edificacionesInicial)
  const [bloques, setBloques] = useState<BloqueInfo[]>(bloquesInicial)

  const crearEdificacion: CrearEdificacion = useCallback(
    async (nombre, tipo) => {
      const res = await crearEdificacionAction(nombre, tipo)
      if (res.estado === 'ok') {
        const bloqueUnico = res.bloqueUnico
        setEdificaciones((prev) => [...prev, res.edificacion])
        if (bloqueUnico) {
          setBloques((prev) => [
            ...prev,
            { ...bloqueUnico, edificacionId: res.edificacion.id },
          ])
        }
        router.refresh()
      }
      return res
    },
    [router]
  )

  const eliminarEdificacion: EliminarEdificacion = useCallback(
    async (id) => {
      const res = await eliminarEdificacionAction(id)
      if (res.estado === 'completado') {
        setEdificaciones((prev) => prev.filter((e) => e.id !== id))
        setBloques((prev) => prev.filter((b) => b.edificacionId !== id))
        router.refresh()
      }
      return res
    },
    [router]
  )

  const crearBloque: CrearBloque = useCallback(
    async (edificacionId, codigo, nombre, area, factor) => {
      const res = await crearBloqueAction(edificacionId, codigo, nombre, area, factor)
      if (res.estado === 'ok') {
        setBloques((prev) => [...prev, { ...res.bloque, edificacionId }])
        router.refresh()
      }
      return res
    },
    [router]
  )

  const eliminarBloque: EliminarBloque = useCallback(
    async (id) => {
      const res = await eliminarBloqueAction(id)
      if (res.estado === 'completado') {
        setBloques((prev) => prev.filter((b) => b.id !== id))
        router.refresh()
      }
      return res
    },
    [router]
  )

  return {
    edificaciones,
    bloques,
    crearEdificacion,
    eliminarEdificacion,
    crearBloque,
    eliminarBloque,
  }
}

export type CatalogoEdificaciones = ReturnType<typeof useCatalogoEdificaciones>
