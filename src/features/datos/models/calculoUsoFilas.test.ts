import { describe, expect, it } from 'vitest'
import {
  calcularCambiosPromedio,
  calcularCambiosUso,
  calcularParUso,
  etiquetaMes,
  mesActual,
  mesesDesdePeriodos,
  parCambia,
  promedioParUso,
} from './calculoUsoFilas'
import type { ContextoCalculoFilas } from './calculoUsoFilas'
import type { RangoFechas } from './calendario'

// ============================================================
// Cálculo de uso por fila del importador de Equipos (paso
// «Cálculos opcionales» rediseñado). Ancla a la semántica
// histórica documentada en `calculoUsoImportador.test.ts`:
// ámbito SIN equipoId, política `?? true`, fuente = GDE.
// ============================================================

const EDIFICACION_ID = 'edi-1'

const CONFIG_USO = { horaInicioOperacion: 6, horasOperacionDia: 12 }

/** Todo marzo 2024 (21 hábiles LUN–VIE, 10 fin de semana). */
const RANGOS_MARZO: RangoFechas[] = [
  { fechaInicio: '2024-03-01', fechaFin: '2024-03-31', tipoDia: 'LECTIVO' },
]

/** Abril 2024 operativo solo la primera quincena (1–15): 11 hábiles LUN–VIE. */
const RANGOS_ABRIL_Q1: RangoFechas[] = [
  { fechaInicio: '2024-04-01', fechaFin: '2024-04-15', tipoDia: 'LECTIVO' },
]

/** Marzo completo + abril parcial: dos meses con cálculo distinto. */
const RANGOS_MARZO_ABRIL: RangoFechas[] = [...RANGOS_MARZO, ...RANGOS_ABRIL_Q1]

const horarioEdificacion = {
  edificacionId: EDIFICACION_ID,
  nombre: 'Jornada de edificación',
  diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
  horaInicio: 8,
  horaFin: 18,
}

/** Horario de nivel EQUIPO (14:00–18:00): el importador lo IGNORA. */
const horarioEquipo = {
  edificacionId: EDIFICACION_ID,
  equipoId: 'eq-1',
  nombre: 'Turno tarde eq-1',
  diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
  horaInicio: 14,
  horaFin: 18,
}

const horarioEspacio = {
  edificacionId: EDIFICACION_ID,
  bloqueId: 'blo-1',
  espacioId: 'esp-1',
  nombre: 'Jornada del aula',
  diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
  horaInicio: 7,
  horaFin: 9,
}

const baseContexto = (
  sobrescribir: Partial<ContextoCalculoFilas> = {}
): ContextoCalculoFilas => ({
  edificacionId: EDIFICACION_ID,
  horarios: [horarioEdificacion, horarioEquipo],
  rangos: RANGOS_MARZO,
  config: CONFIG_USO,
  usarHorariosXe: true,
  politica: { domingosOperativos: true, festivosOperativos: true },
  ...sobrescribir,
})

describe('mesesDesdePeriodos', () => {
  it('deduplica, ignora formatos inválidos y ordena ascendentemente', () => {
    const meses = mesesDesdePeriodos([
      '2025-03',
      '2024-12',
      '2024-03',
      '2025-03',
      '2024-13',
      'abc',
      '',
      '  2024-05  ',
    ])

    expect(meses.map((m) => m.etiqueta)).toEqual([
      'marzo 2024',
      'mayo 2024',
      'diciembre 2024',
      'marzo 2025',
    ])
    expect(meses[0]).toMatchObject({ mes: 3, ano: 2024 })
  })

  it('devuelve vacío sin periodos válidos', () => {
    expect(mesesDesdePeriodos([])).toEqual([])
    expect(mesesDesdePeriodos(['x', '2024-00'])).toEqual([])
  })
})

describe('etiquetaMes / mesActual', () => {
  it('etiqueta el mes en español', () => {
    expect(etiquetaMes(1, 2024)).toBe('enero 2024')
    expect(etiquetaMes(12, 2024)).toBe('diciembre 2024')
  })

  it('mesActual produce un periodo válido del año en curso', () => {
    const actual = mesActual()
    expect(actual.mes).toBeGreaterThanOrEqual(1)
    expect(actual.mes).toBeLessThanOrEqual(12)
    expect(actual.ano).toBe(new Date().getFullYear())
  })
})

describe('calcularParUso (ámbito por fila, sin equipoId)', () => {
  it('ancla al replay documentado: edificación gana → 10 h / 21 días en marzo 2024', () => {
    const par = calcularParUso({ bloqueId: 'blo-1', espacioId: 'esp-1' }, { mes: 3, ano: 2024 }, baseContexto())

    // 8–18 = 10 h; con Xe ON solo cuentan los 21 días LUN–VIE con horario.
    expect(par).toEqual({ horasUsoDia: '10', diasUsoMes: '21' })
  })

  it('el horario de nivel EQUIPO no manda (divergencia documentada del importador)', () => {
    // Mismo contexto que la caracterización: el núcleo daría 4 h (equipo 14–18),
    // el importador da 10 h (edificación 8–18).
    const par = calcularParUso({ bloqueId: 'blo-1', espacioId: 'esp-1' }, { mes: 3, ano: 2024 }, baseContexto())

    expect(par?.horasUsoDia).toBe('10')
  })

  it('el espacio más específico gana sobre la edificación', () => {
    const par = calcularParUso(
      { bloqueId: 'blo-1', espacioId: 'esp-1' },
      { mes: 3, ano: 2024 },
      baseContexto({ horarios: [horarioEdificacion, horarioEspacio] })
    )

    // 7–9 = 2 h sobre los 21 días LUN–VIE.
    expect(par).toEqual({ horasUsoDia: '2', diasUsoMes: '21' })
  })

  it('sin horario vigente devuelve null (la UI conserva el valor manual)', () => {
    const par = calcularParUso({}, { mes: 3, ano: 2024 }, baseContexto({ horarios: [] }))

    expect(par).toBeNull()
  })

  it('la política de domingos respeta la configuración del calendario', () => {
    const horarioTodoElDia = { ...horarioEdificacion, diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'] }

    const conDomingos = calcularParUso({}, { mes: 3, ano: 2024 }, baseContexto({
      horarios: [horarioTodoElDia],
      politica: { domingosOperativos: true, festivosOperativos: true },
    }))
    const sinDomingos = calcularParUso({}, { mes: 3, ano: 2024 }, baseContexto({
      horarios: [horarioTodoElDia],
      politica: { domingosOperativos: false, festivosOperativos: true },
    }))

    // Marzo 2024: 31 días operativos; sin domingos quedan 26 (5 domingos).
    expect(conDomingos).toEqual({ horasUsoDia: '10', diasUsoMes: '31' })
    expect(sinDomingos).toEqual({ horasUsoDia: '10', diasUsoMes: '26' })
  })

  it('el rango del calendario acota los días del mes', () => {
    const par = calcularParUso({}, { mes: 4, ano: 2024 }, baseContexto({ rangos: RANGOS_ABRIL_Q1 }))

    // 1–15 de abril 2024 = 11 hábiles LUN–VIE.
    expect(par).toEqual({ horasUsoDia: '10', diasUsoMes: '11' })
  })
})

describe('calcularCambiosUso / parCambia', () => {
  const filas = [
    { id: 'f1', horasUsoDia: '', diasUsoMes: '', ambito: { bloqueId: 'blo-1' } },
    { id: 'f2', horasUsoDia: '12', diasUsoMes: '22', ambito: { bloqueId: 'blo-1' } },
    { id: 'f3', horasUsoDia: '10', diasUsoMes: '21', ambito: { bloqueId: 'blo-1' } },
    { id: 'f4', horasUsoDia: '12', diasUsoMes: '', ambito: {} },
  ]

  it('produce el diff antes→después de todas las filas (solo el llamador filtra)', () => {
    const cambios = calcularCambiosUso(filas, { mes: 3, ano: 2024 }, baseContexto())

    expect(cambios).toHaveLength(4)
    expect(cambios[0]).toMatchObject({
      antes: { horasUsoDia: '', diasUsoMes: '' },
      despues: { horasUsoDia: '10', diasUsoMes: '21' },
    })
    // f4 no tiene horario para su ámbito ({} cae a la edificación… aquí sí hay):
    expect(cambios[3].despues).toEqual({ horasUsoDia: '10', diasUsoMes: '21' })
  })

  it('marca sin cálculo cuando el ámbito no tiene horario vigente', () => {
    const cambios = calcularCambiosUso(filas, { mes: 3, ano: 2024 }, baseContexto({ horarios: [] }))

    expect(cambios.every((c) => c.despues === null)).toBe(true)
  })

  it('parCambia solo es true cuando el par difiere realmente', () => {
    expect(parCambia({ horasUsoDia: '', diasUsoMes: '' }, { horasUsoDia: '10', diasUsoMes: '21' })).toBe(true)
    expect(parCambia({ horasUsoDia: '10 ', diasUsoMes: '21' }, { horasUsoDia: '10', diasUsoMes: '21' })).toBe(false)
    expect(parCambia({ horasUsoDia: '12', diasUsoMes: '22' }, null)).toBe(false)
  })
})

// ============================================================
// Promedio de la serie: el valor general que queda en
// `EquipoElectrico` debe ser representativo del año, no el de un
// mes aislado (vacaciones, festivos, etc.).
// ============================================================

describe('promedioParUso', () => {
  it('promedia horas y días de todos los meses y redondea al entero', () => {
    const par = promedioParUso([
      { horasUsoDia: '10', diasUsoMes: '21' },
      { horasUsoDia: '12', diasUsoMes: '22' },
      { horasUsoDia: '11', diasUsoMes: '21' },
    ])

    // (10+12+11)/3 = 11 · (21+22+21)/3 = 21.33 → 21
    expect(par).toEqual({ horasUsoDia: '11', diasUsoMes: '21' })
  })

  it('redondea hacia arriba el medio punto', () => {
    expect(
      promedioParUso([
        { horasUsoDia: '10', diasUsoMes: '21' },
        { horasUsoDia: '11', diasUsoMes: '21' },
      ])
    ).toEqual({ horasUsoDia: '11', diasUsoMes: '21' })
  })

  it('ignora los meses sin cálculo posible (null) y promedia el resto', () => {
    expect(
      promedioParUso([
        null,
        { horasUsoDia: '10', diasUsoMes: '21' },
        null,
        { horasUsoDia: '12', diasUsoMes: '31' },
      ])
    ).toEqual({ horasUsoDia: '11', diasUsoMes: '26' })
  })

  it('devuelve null si ningún mes aporta cálculo (la fila queda intacta)', () => {
    expect(promedioParUso([])).toBeNull()
    expect(promedioParUso([null, null])).toBeNull()
  })
})

describe('calcularCambiosPromedio', () => {
  const filas = [
    { id: 'f1', horasUsoDia: '', diasUsoMes: '', ambito: { bloqueId: 'blo-1' } },
    { id: 'f2', horasUsoDia: '12', diasUsoMes: '22', ambito: { bloqueId: 'blo-1' } },
    { id: 'f3', horasUsoDia: '10', diasUsoMes: '21', ambito: { bloqueId: 'blo-1' } },
  ]

  it('aplica el promedio de la serie completa a cada fila', () => {
    const contexto = baseContexto({ rangos: RANGOS_MARZO_ABRIL })
    const cambios = calcularCambiosPromedio(filas, [{ mes: 3, ano: 2024 }, { mes: 4, ano: 2024 }], contexto)

    // Marzo = 10 h / 21 días; abril (1–15) = 10 h / 11 días → 10 h / 16 días.
    expect(cambios).toHaveLength(3)
    expect(cambios[0].despues).toEqual({ horasUsoDia: '10', diasUsoMes: '16' })
    expect(cambios[2].despues).toEqual({ horasUsoDia: '10', diasUsoMes: '16' })
    expect(cambios[2]).toMatchObject({ antes: { horasUsoDia: '10', diasUsoMes: '21' } })
  })

  it('los meses sin cálculo no contaminan el promedio', () => {
    const contexto = baseContexto({ rangos: RANGOS_MARZO })
    const cambios = calcularCambiosPromedio(
      filas,
      [{ mes: 3, ano: 2024 }, { mes: 4, ano: 2024 }],
      contexto
    )

    // Solo marzo aporta → el promedio es el par de marzo.
    expect(cambios[0].despues).toEqual({ horasUsoDia: '10', diasUsoMes: '21' })
  })

  it('sin ningún mes con cálculo posible la fila conserva su valor', () => {
    const cambios = calcularCambiosPromedio(filas, [{ mes: 3, ano: 2024 }], baseContexto({ horarios: [] }))

    expect(cambios.every((c) => c.despues === null)).toBe(true)
    expect(cambios.every((c) => parCambia(c.antes, c.despues) === false)).toBe(true)
  })
})
