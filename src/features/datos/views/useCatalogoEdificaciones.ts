'use client'

/**
 * Catálogo compartido de edificaciones y bloques del módulo Gestión de Datos.
 *
 * Una sola fuente de verdad: vive en `DatosContent` y se pasa por props.
 * La creación/edición/eliminación de EDIFICACIONES es responsabilidad de la
 * sección de primer nivel «Edificaciones»; los importadores de Facturas,
 * Equipos y Variables heredan la lista y solo crean/eliminan bloques. Así,
 * lo creado en una sección es visible al instante en las demás (antes cada
 * importador guardaba su propia copia en `useState` y se desincronizaba).
 */

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  crearBloque as crearBloqueAction,
  crearEdificacion as crearEdificacionAction,
  crearEspacio as crearEspacioAction,
  actualizarEdificacion as actualizarEdificacionAction,
  eliminarBloque as eliminarBloqueAction,
  eliminarEdificacion as eliminarEdificacionAction,
  eliminarEspacio as eliminarEspacioAction,
} from '@/features/datos/controllers/edificaciones'
import type {
  ResultadoActualizacionEdificacion,
  ResultadoCreacionBloque,
  ResultadoCreacionEdificacion,
  ResultadoCreacionEspacio,
} from '@/features/datos/controllers/edificaciones'
import type { ResultadoGestion } from '@/features/datos/models/validations'

export interface EdificacionInfo {
  id: string
  nombre: string
  tipo: string
  /** Área total en m² (UPME §7.3); ausente o null si aún no está registrada. */
  area?: number | null
  /** Coordenadas para la fuente climática (GDE); null si aún no están. */
  lat?: number | null
  lon?: number | null
  /** Nombre visible de la ubicación elegida por ciudad/zona (S1, geocoding). */
  ubicacionNombre?: string | null
}

/** Configuración operativa de la edificación (horario H y Tb — UPME §7.1/§7.3). */
export interface CalendarioInfo {
  id: string
  edificacionId: string
  horaInicioOperacion: number
  horasOperacionDia: number
  temperaturaBase: number
  /** Opt-in S4: usar las horas de los horarios vigentes como Xe en la GDE. */
  usarHorariosXe?: boolean | null
  /** S2: domingos y festivos de Colombia operativos (default ON = legado). */
  domingosOperativos?: boolean | null
  festivosOperativos?: boolean | null
}

/** Rango de fechas con tipo de día (fechas ISO `YYYY-MM-DD`). */
export interface RangoCalendarioUI {
  id: string
  calendarioId: string
  fechaInicio: string
  fechaFin: string
  tipoDia: string
  nombre: string | null
}

/** Horario de funcionamiento de un grupo de equipos (UPME §7.1/§7.3). */
export interface HorarioEquipoInfo {
  id: string
  edificacionId: string
  /** Ámbito jerárquico (S12): vacío/null = edificación completa. */
  bloqueId?: string | null
  espacioId?: string | null
  equipoId?: string | null
  nombre: string
  /** Códigos de día: LUN..DOM (CATALOGO_DIAS). */
  diasSemana: string[]
  /** Hora de inicio (0-23) y final (1-24), sin cruce de medianoche. */
  horaInicio: number
  horaFin: number
  /** Vigencia (fechas ISO `YYYY-MM-DD`); `hasta` null = abierta. */
  desde?: string | null
  hasta?: string | null
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
  tipo: string,
  area?: number | string
) => Promise<ResultadoCreacionEdificacion>

/** Actualiza nombre y área de una edificación (el tipo no es editable). */
export type ActualizarEdificacion = (
  id: string,
  datos: { nombre: string; area?: number | string }
) => Promise<ResultadoActualizacionEdificacion>

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

/** Crea un espacio dentro de un bloque (cantidad de espacios — UPME §7.3). */
export type CrearEspacio = (bloqueId: string, nombre: string) => Promise<ResultadoCreacionEspacio>

/** Elimina un espacio sin equipos; se rechaza si tiene equipos registrados. */
export type EliminarEspacio = (id: string) => Promise<ResultadoGestion>

export function useCatalogoEdificaciones(
  edificacionesInicial: EdificacionInfo[],
  bloquesInicial: BloqueInfo[],
  espaciosInicial: EspacioInfo[]
) {
  const router = useRouter()
  const [edificaciones, setEdificaciones] = useState<EdificacionInfo[]>(edificacionesInicial)
  const [bloques, setBloques] = useState<BloqueInfo[]>(bloquesInicial)
  const [espacios, setEspacios] = useState<EspacioInfo[]>(espaciosInicial)

  const crearEdificacion: CrearEdificacion = useCallback(
    async (nombre, tipo, area) => {
      const res = await crearEdificacionAction(nombre, tipo, area)
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

  const actualizarEdificacion: ActualizarEdificacion = useCallback(
    async (id, datos) => {
      const res = await actualizarEdificacionAction(id, datos)
      if (res.estado === 'ok') {
        setEdificaciones((prev) => prev.map((e) => (e.id === id ? res.edificacion : e)))
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

  const crearEspacio: CrearEspacio = useCallback(
    async (bloqueId, nombre) => {
      const res = await crearEspacioAction(bloqueId, nombre)
      if (res.estado === 'ok') {
        setEspacios((prev) => [...prev, res.espacio])
        router.refresh()
      }
      return res
    },
    [router]
  )

  const eliminarEspacio: EliminarEspacio = useCallback(
    async (id) => {
      const res = await eliminarEspacioAction(id)
      if (res.estado === 'completado') {
        setEspacios((prev) => prev.filter((s) => s.id !== id))
        router.refresh()
      }
      return res
    },
    [router]
  )

  return {
    edificaciones,
    bloques,
    espacios,
    crearEdificacion,
    actualizarEdificacion,
    eliminarEdificacion,
    crearBloque,
    eliminarBloque,
    crearEspacio,
    eliminarEspacio,
  }
}

export type CatalogoEdificaciones = ReturnType<typeof useCatalogoEdificaciones>
