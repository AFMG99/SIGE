import { describe, expect, it } from 'vitest'
import { usoEquiposDelMes } from './calendario'
import type { PoliticaOperatividad, RangoFechas } from './calendario'
import { horariosDelNivelGanador } from './horarios'
import { calcularPeriodo } from './calculoUso'
import type { ContextoPeriodo, HorarioContexto } from './calculoUso'

// ============================================================
// Caracterización del importador (design #590 §2.3)
//
// `completarUsoDesdeCalendario` (ImportadorEquipos.tsx:660-717) tiene diff
// CERO: este archivo replica SU secuencia sobre las funciones del dominio
// (horarios.ts / calendario.ts, también sin cambios) y lo ancla contra el
// núcleo `calcularPeriodo`. Cubre: (1) solo rellena celdas vacías (manual
// manda, descartadas intactas), (2) equivalencia núcleo ≡ importador cuando
// no hay horario de nivel EQUIPO, (3) la DIVERGENCIA DOCUMENTADA (el
// importador resuelve el horario sin equipoId e ignora EQUIPO; el núcleo sí
// lo pasa) y (4) el modo con equipoId omitido del núcleo ≡ replay exacto.
// ============================================================

const EDIFICACION_ID = 'edi-1'
const MES = 3
const ANO = 2024

const CONFIG_USO = { horaInicioOperacion: 6, horasOperacionDia: 12 }

/** Todo marzo 2024 operativo: 31 días (21 hábiles LUN–VIE, 10 de fin de semana). */
const RANGOS_MARZO: RangoFechas[] = [
  { fechaInicio: '2024-03-01', fechaFin: '2024-03-31', tipoDia: 'LECTIVO' },
]

/** Misma política que el importador resuelve con `?? true` en ambos flags. */
const POLITICA: PoliticaOperatividad = { domingosOperativos: true, festivosOperativos: true }

const HORARIO_EDIFICACION: HorarioContexto = {
  edificacionId: EDIFICACION_ID,
  nombre: 'Jornada de edificación',
  diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
  horaInicio: 8,
  horaFin: 18,
}

/** Horario de nivel EQUIPO para eq-1 (14:00–18:00): el importador lo IGNORA. */
const HORARIO_EQUIPO: HorarioContexto = {
  edificacionId: EDIFICACION_ID,
  equipoId: 'eq-1',
  nombre: 'Turno tarde eq-1',
  diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
  horaInicio: 14,
  horaFin: 18,
}

/** Fila de trabajo del importador (solo los campos que `completarUsoDesdeCalendario` toca). */
interface FilaUso {
  id: string
  descartada?: boolean
  horasUsoDia: string
  diasUsoMes: string
  bloqueId: string
  espacioId: string
}

const filaVacia = (id: string, espacioId: string): FilaUso => ({
  id,
  horasUsoDia: '',
  diasUsoMes: '',
  bloqueId: 'blo-1',
  espacioId,
})

interface BaseImportador {
  horarios: HorarioContexto[]
  rangos: RangoFechas[]
  config: { horaInicioOperacion: number; horasOperacionDia: number }
  usarHorariosXe: boolean
  politica: PoliticaOperatividad
}

const baseImportador = (sobrescribir: Partial<BaseImportador> = {}): BaseImportador => ({
  horarios: [HORARIO_EDIFICACION, HORARIO_EQUIPO],
  rangos: RANGOS_MARZO,
  config: CONFIG_USO,
  usarHorariosXe: true,
  politica: POLITICA,
  ...sobrescribir,
})

/**
 * Réplica fiel de la secuencia de `completarUsoDesdeCalendario`
 * (ImportadorEquipos.tsx:663-704): descartadas intactas → solo celdas
 * vacías → `horariosDelNivelGanador` SIN equipoId → `usoEquiposDelMes` →
 * el valor manual siempre manda → sin cálculo = sin tocar la fila.
 */
const completarComoImportador = (
  filas: FilaUso[],
  base: BaseImportador
): { filas: FilaUso[]; completadas: number } => {
  let completadas = 0
  const nuevas = filas.map((fila) => {
    if (fila.descartada) return fila
    const faltaHoras = !fila.horasUsoDia.trim()
    const faltaDias = !fila.diasUsoMes.trim()
    if (!faltaHoras && !faltaDias) return fila
    const horariosFila = horariosDelNivelGanador(
      base.horarios,
      { edificacionId: EDIFICACION_ID, bloqueId: fila.bloqueId, espacioId: fila.espacioId },
      { mes: MES, ano: ANO }
    )
    const calc = usoEquiposDelMes({
      rangos: base.rangos,
      config: base.config,
      horarios: horariosFila,
      usarHorariosXe: base.usarHorariosXe,
      mes: MES,
      ano: ANO,
      politica: base.politica,
    })
    if (!calc) return fila
    const siguiente = { ...fila }
    if (faltaHoras) siguiente.horasUsoDia = String(calc.horasUsoDia)
    if (faltaDias) siguiente.diasUsoMes = String(calc.diasUsoMes)
    completadas += 1
    return siguiente
  })
  return { filas: nuevas, completadas }
}

/** Contexto del núcleo para eq-1/esp-1 (mismas entradas que el replay). */
const contextoNucleo = (sobrescribir: Partial<ContextoPeriodo> = {}): ContextoPeriodo => ({
  equipos: [{ id: 'eq-1', bloqueId: 'blo-1', espacioId: 'esp-1' }],
  rangos: RANGOS_MARZO,
  config: CONFIG_USO,
  usarHorariosXe: true,
  politica: POLITICA,
  horarios: [HORARIO_EDIFICACION, HORARIO_EQUIPO],
  ...sobrescribir,
})

const calcularNucleo = (contexto: ContextoPeriodo, incluirHorarioDeEquipo = true) =>
  calcularPeriodo({
    edificacionId: EDIFICACION_ID,
    mes: MES,
    ano: ANO,
    contexto,
    incluirHorarioDeEquipo,
  })

describe('caracterización: completarUsoDesdeCalendario (ImportadorEquipos.tsx:660-717)', () => {
  it('solo rellena celdas vacías: el valor manual manda y las filas descartadas quedan intactas', () => {
    const entrada: FilaUso[] = [
      filaVacia('f1', 'esp-1'), // ambas vacías → las dos se rellenan
      { id: 'f2', horasUsoDia: '12', diasUsoMes: '22', bloqueId: 'blo-1', espacioId: 'esp-2' },
      { id: 'f3', horasUsoDia: '12', diasUsoMes: '', bloqueId: 'blo-1', espacioId: 'esp-2' },
      { ...filaVacia('f4', 'esp-1'), descartada: true },
    ]

    const { filas, completadas } = completarComoImportador(entrada, baseImportador())

    expect(completadas).toBe(2)
    expect(filas[0]).toMatchObject({ horasUsoDia: '10', diasUsoMes: '21' })
    expect(filas[1]).toMatchObject({ horasUsoDia: '12', diasUsoMes: '22' })
    expect(filas[2]).toMatchObject({ horasUsoDia: '12', diasUsoMes: '21' })
    expect(filas[3]).toMatchObject({ horasUsoDia: '', diasUsoMes: '' })
  })

  it('sin cálculo posible (sin horario vigente) no se completa ninguna celda', () => {
    const { filas, completadas } = completarComoImportador(
      [filaVacia('f1', 'esp-1')],
      baseImportador({ horarios: [] })
    )

    expect(completadas).toBe(0)
    expect(filas[0]).toMatchObject({ horasUsoDia: '', diasUsoMes: '' })
  })

  it('el replay equivale a calcularPeriodo cuando no existe horario de nivel EQUIPO', () => {
    const horarios = [HORARIO_EDIFICACION]
    const { filas } = completarComoImportador([filaVacia('f1', 'esp-1')], baseImportador({ horarios }))
    const r = calcularNucleo(contextoNucleo({ horarios }))

    expect(r.detalle).toHaveLength(1)
    expect(filas[0].horasUsoDia).toBe(String(r.detalle[0].horasUsoDia))
    expect(filas[0].diasUsoMes).toBe(String(r.detalle[0].diasUsoMes))
    expect(r.detalle[0].horarioGanador).toBe('EDIFICACION/Jornada de edificación')
  })

  it('divergencia documentada (design §2.3): el importador ignora el horario EQUIPO y el núcleo lo respeta', () => {
    const { filas } = completarComoImportador([filaVacia('f1', 'esp-1')], baseImportador())
    const r = calcularNucleo(contextoNucleo())

    // Importador: sin equipoId en el contexto, gana la edificación (8–18 = 10 h).
    expect(filas[0].horasUsoDia).toBe('10')
    // Núcleo: pasa equipoId, gana el horario de EQUIPO (14–18 = 4 h).
    expect(r.detalle[0]).toMatchObject({
      horasUsoDia: 4,
      diasUsoMes: 21,
      horarioGanador: 'EQUIPO/Turno tarde eq-1',
    })
    expect(filas[0].horasUsoDia).not.toBe(String(r.detalle[0].horasUsoDia))
  })

  it('calcularPeriodo con equipoId omitido reproduce exactamente la semántica del importador', () => {
    const { filas } = completarComoImportador([filaVacia('f1', 'esp-1')], baseImportador())
    const r = calcularNucleo(contextoNucleo(), false)

    expect(r.detalle[0]).toMatchObject({
      horasUsoDia: 10,
      diasUsoMes: 21,
      horarioGanador: 'EDIFICACION/Jornada de edificación',
    })
    expect(String(r.detalle[0].horasUsoDia)).toBe(filas[0].horasUsoDia)
    expect(String(r.detalle[0].diasUsoMes)).toBe(filas[0].diasUsoMes)
  })
})
