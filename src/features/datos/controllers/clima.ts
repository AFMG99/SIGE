/**
 * Fuente climática de la GDE — adaptador intercambiable.
 *
 * Implementación primaria: Open-Meteo (API `archive-api.open-meteo.com`,
 * reanálisis ERA5/Copernicus). Sin API key, histórico horario desde 1940 y
 * cobertura global — decisión del usuario (log L3/L5 del feature). Si se
 * necesita otra fuente (p. ej. IDEAM vía datos.gov.co), se agrega aquí otro
 * módulo que devuelva `TempDia[]` sin tocar el cálculo de la GDE.
 */

import type { TempDia } from '@/features/datos/models/calendario'

/** Zona horaria con la que se alinean las horas operativas de la edificación. */
const TIMEZONE = 'America/Bogota'

export class ClimaFuenteError extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ClimaFuenteError'
  }
}

/**
 * Descarga la serie horaria de temperatura de un mes para una coordenada y la
 * agrupa por día (`TempDia`: 24 horas, índice 0-23, en hora local Bogotá).
 * Lanza `ClimaFuenteError` con mensaje amigable ante fallos de red o de la API.
 */
export async function obtenerTempsHorarias(
  lat: number,
  lon: number,
  mes: number,
  ano: number
): Promise<TempDia[]> {
  const diaInicio = new Date(Date.UTC(ano, mes - 1, 1)).toISOString().slice(0, 10)
  const diaFin = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10)

  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('start_date', diaInicio)
  url.searchParams.set('end_date', diaFin)
  url.searchParams.set('hourly', 'temperature_2m')
  url.searchParams.set('timezone', TIMEZONE)

  const control = new AbortController()
  const temporizador = setTimeout(() => control.abort(), 20_000)

  try {
    const respuesta = await fetch(url, { signal: control.signal })
    if (!respuesta.ok) {
      throw new ClimaFuenteError(
        `La fuente climática respondió ${respuesta.status}. Intente de nuevo más tarde.`
      )
    }
    const datos = (await respuesta.json()) as {
      hourly?: { time?: string[]; temperature_2m?: (number | null)[] }
    }
    const tiempos = datos.hourly?.time ?? []
    const temps = datos.hourly?.temperature_2m ?? []
    if (tiempos.length === 0 || temps.length !== tiempos.length) {
      throw new ClimaFuenteError(
        'La fuente climática no devolvió datos horarios para ese periodo.'
      )
    }

    const porFecha = new Map<string, (number | null)[]>()
    for (let i = 0; i < tiempos.length; i++) {
      // Formato "2026-02-09T00:00" → fecha "2026-02-09", hora local 0-23.
      const fecha = String(tiempos[i]).slice(0, 10)
      const hora = Number(String(tiempos[i]).slice(11, 13))
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isInteger(hora) || hora < 0 || hora > 23) {
        continue
      }
      let horas = porFecha.get(fecha)
      if (!horas) {
        horas = Array.from({ length: 24 }, () => null)
        porFecha.set(fecha, horas)
      }
      horas[hora] = temps[i]
    }

    return Array.from(porFecha, ([fecha, horas]) => ({
      fecha,
      horas: horas.map((t) => (typeof t === 'number' ? t : Number.NaN)),
    }))
  } catch (error) {
    if (error instanceof ClimaFuenteError) throw error
    throw new ClimaFuenteError(
      'No fue posible consultar la fuente climática (Open-Meteo). Verifique la conexión o intente de nuevo.'
    )
  } finally {
    clearTimeout(temporizador)
  }
}
