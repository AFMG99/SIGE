/**
 * Horarios de funcionamiento de equipos por edificación
 * (Resolución UPME 0016/2024, §7.1/§7.3: horarios de operación).
 *
 * Un horario = un grupo de equipos (nombre libre) + días de la semana +
 * una franja horaria diaria. La UI y el servidor comparten este catálogo
 * y estas validaciones.
 */

import { z } from 'zod'

// ============================================================
// Catálogo de días
// ============================================================

export interface DiaInfo {
  codigo: string
  etiqueta: string
  abrev: string
}

export const CATALOGO_DIAS: DiaInfo[] = [
  { codigo: 'LUN', etiqueta: 'Lunes', abrev: 'Lun' },
  { codigo: 'MAR', etiqueta: 'Martes', abrev: 'Mar' },
  { codigo: 'MIE', etiqueta: 'Miércoles', abrev: 'Mié' },
  { codigo: 'JUE', etiqueta: 'Jueves', abrev: 'Jue' },
  { codigo: 'VIE', etiqueta: 'Viernes', abrev: 'Vie' },
  { codigo: 'SAB', etiqueta: 'Sábado', abrev: 'Sáb' },
  { codigo: 'DOM', etiqueta: 'Domingo', abrev: 'Dom' },
]

const CODIGOS = CATALOGO_DIAS.map((d) => d.codigo) as [
  'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM',
]

// ============================================================
// Validación (server + client)
// ============================================================

export const horarioEquipoSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(80, 'El nombre no puede superar los 80 caracteres'),
    diasSemana: z
      .array(z.enum(CODIGOS))
      .min(1, 'Seleccione al menos un día'),
    horaInicio: z.number().int().min(0).max(23),
    horaFin: z.number().int().min(1).max(24),
  })
  .refine((v) => v.horaFin > v.horaInicio, {
    message: 'La hora final debe ser posterior a la inicial (sin cruce de medianoche)',
    path: ['horaFin'],
  })

export type HorarioEquipoInput = z.infer<typeof horarioEquipoSchema>

// ============================================================
// Presentación
// ============================================================

const abrev = (codigo: string): string =>
  CATALOGO_DIAS.find((d) => d.codigo === codigo)?.abrev ?? codigo

/**
 * Formatea los días en orden canónico. Bloques corridos de 3+ días se
 * abrevian como rango ("Lun–Vie"); bloques de 1 o 2 días se listan
 * ("Sáb, Dom").
 */
export function formatearDias(codigos: string[]): string {
  const orden = CATALOGO_DIAS.map((d) => d.codigo)
  const seleccionados = orden.filter((c) => codigos.includes(c))
  if (seleccionados.length === 0) return '—'

  const grupos: string[][] = []
  for (const codigo of seleccionados) {
    const ultimo = grupos[grupos.length - 1]
    const esCorrido =
      ultimo && orden.indexOf(codigo) === orden.indexOf(ultimo[ultimo.length - 1]) + 1
    if (esCorrido) {
      ultimo.push(codigo)
    } else {
      grupos.push([codigo])
    }
  }

  return grupos
    .map((g) =>
      g.length >= 3
        ? `${abrev(g[0])}–${abrev(g[g.length - 1])}`
        : g.map(abrev).join(', ')
    )
    .join(', ')
}

/** Franja horaria en formato 24h: `06:00–18:00`. */
export function formatearFranja(horaInicio: number, horaFin: number): string {
  const dos = (h: number) => String(h).padStart(2, '0')
  return `${dos(horaInicio)}:00–${dos(horaFin)}:00`
}
