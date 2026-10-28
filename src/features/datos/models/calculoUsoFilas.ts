/**
 * Cálculo de «horas de uso por día» / «días de uso por mes» para las filas del
 * importador de Equipos (paso «Cálculos opcionales» rediseñado como tabla).
 *
 * Réplica de la semántica histórica del importador (anclada en
 * `calculoUsoImportador.test.ts`): el ámbito por fila se resuelve SIN
 * `equipoId` —los horarios de nivel EQUIPO no mandan aquí— y la fuente es la
 * MISMA que la GDE (`usoEquiposDelMes`), con la política de operatividad del
 * calendario (`?? true` en ambos flags, igual que `controllers/calculoUso.ts`).
 * Difiere del núcleo `calcularPeriodo` en el tratamiento documentado del
 * horario de EQUIPO.
 *
 * Puro y sin I/O: los periodos con facturas llegan como strings `YYYY-MM`
 * desde el servidor y la UI decide qué mes se aplica antes de escribir nada.
 */
import { usoEquiposDelMes } from './calendario'
import type { PoliticaOperatividad, RangoFechas } from './calendario'
import { horariosDelNivelGanador } from './horarios'
import type { HorarioHorasUso } from './horarios'

/** Meses en minúscula para etiquetas («marzo 2024»). */
export const MESES_ETIQUETA = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

/**
 * Forma estructural de un horario para el cálculo por fila: `HorarioHorasUso`
 * más el ámbito jerárquico. `HorarioEquipoInfo` (vista) y los rows de BD la
 * cumplen estructuralmente.
 */
export type HorarioConContexto = HorarioHorasUso & {
  edificacionId: string
  bloqueId?: string | null
  espacioId?: string | null
  equipoId?: string | null
}

/** Ámbito resoluble de una fila: ids jerárquicos SIN equipoId (semántica del importador). */
export interface AmbitoFila {
  bloqueId?: string | null
  espacioId?: string | null
}

export interface ContextoCalculoFilas {
  edificacionId: string
  /** Horarios de la edificación (todos los ámbitos; la jerarquía resuelve el ganador). */
  horarios: HorarioConContexto[]
  /** Rangos del calendario (días LECTIVO/HABIL/FESTIVO en `YYYY-MM-DD`). */
  rangos: RangoFechas[]
  config: { horaInicioOperacion: number; horasOperacionDia: number }
  usarHorariosXe: boolean
  politica: PoliticaOperatividad
}

/** Par calculado; los strings son el formato exacto del payload de importación. */
export interface ParUso {
  horasUsoDia: string
  diasUsoMes: string
}

export interface PeriodoUso {
  mes: number
  ano: number
  etiqueta: string
}

/** Etiqueta de mes en español («marzo 2024»). */
export function etiquetaMes(mes: number, ano: number): string {
  return `${MESES_ETIQUETA[mes - 1] ?? ''} ${ano}`.trim()
}

/**
 * Periodos `YYYY-MM` distintos → meses ordenados ascendentemente. Formatos
 * inválidos (`2024-13`, basura) se ignoran y los repetidos se deduplican.
 */
export function mesesDesdePeriodos(periodos: string[]): PeriodoUso[] {
  const vistos = new Set<string>()
  const salida: PeriodoUso[] = []
  for (const crudo of periodos) {
    const texto = String(crudo ?? '').trim()
    const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(texto)
    if (!m || vistos.has(texto)) continue
    vistos.add(texto)
    const mes = Number(m[2])
    salida.push({ mes, ano: Number(m[1]), etiqueta: etiquetaMes(mes, Number(m[1])) })
  }
  salida.sort((a, b) => a.ano - b.ano || a.mes - b.mes)
  return salida
}

/** Mes corriente (zona local) — fallback cuando la edificación no tiene facturas. */
export function mesActual(): PeriodoUso {
  const ahora = new Date()
  const mes = ahora.getMonth() + 1
  return { mes, ano: ahora.getFullYear(), etiqueta: etiquetaMes(mes, ahora.getFullYear()) }
}

/**
 * Par horas/días de UNA fila para el mes dado. `null` = sin cálculo posible
 * (sin horario vigente en el mes, o el mes no tiene días operativos): la UI
 * conserva entonces el valor manual de la fila.
 */
export function calcularParUso(
  ambito: AmbitoFila,
  periodo: { mes: number; ano: number },
  contexto: ContextoCalculoFilas
): ParUso | null {
  const horariosFila = horariosDelNivelGanador(
    contexto.horarios,
    {
      edificacionId: contexto.edificacionId,
      // ContextoEquipo exige string: `''` = sin ámbito (nunca iguala un id real,
      // igual que el `?? ''` del importador histórico).
      bloqueId: ambito.bloqueId ?? '',
      espacioId: ambito.espacioId ?? '',
    },
    { mes: periodo.mes, ano: periodo.ano }
  )
  const calc = usoEquiposDelMes({
    rangos: contexto.rangos,
    config: contexto.config,
    horarios: horariosFila,
    usarHorariosXe: contexto.usarHorariosXe,
    mes: periodo.mes,
    ano: periodo.ano,
    politica: contexto.politica,
  })
  if (!calc) return null
  return { horasUsoDia: String(calc.horasUsoDia), diasUsoMes: String(calc.diasUsoMes) }
}

/** Fila en su forma mínima para el cálculo (el llamador ya filtró descartadas). */
export interface FilaCalculo {
  id: string
  horasUsoDia: string
  diasUsoMes: string
  ambito: AmbitoFila
}

export interface CambioUso {
  id: string
  antes: ParUso
  /** `null` = sin cálculo posible para el mes (la fila queda intacta). */
  despues: ParUso | null
}

/** ¿Cambia el par horas/días al aplicar `despues`? (espacios no cuentan) */
export function parCambia(antes: ParUso, despues: ParUso | null): boolean {
  if (!despues) return false
  return (
    antes.horasUsoDia.trim() !== despues.horasUsoDia ||
    antes.diasUsoMes.trim() !== despues.diasUsoMes
  )
}

/**
 * Diff antes→después de aplicar el mes dado a las filas elegibles. Devuelve
 * TODAS las filas recibidas (incluidas las que no cambian o no tienen cálculo):
 * la vista de cambios decide qué mostrar y qué aplicar.
 */
export function calcularCambiosUso(
  filas: FilaCalculo[],
  periodo: { mes: number; ano: number },
  contexto: ContextoCalculoFilas
): CambioUso[] {
  return filas.map((fila) => ({
    id: fila.id,
    antes: { horasUsoDia: fila.horasUsoDia.trim(), diasUsoMes: fila.diasUsoMes.trim() },
    despues: calcularParUso(fila.ambito, periodo, contexto),
  }))
}
