import { describe, expect, it } from 'vitest'
import {
  CATALOGO_DIAS,
  horarioEquipoSchema,
  horariosAplicablesAEquipo,
  horariosDelNivelGanador,
  horariosVigentesEnSemana,
  horasDeUsoEnFecha,
  formatearDias,
  formatearFranja,
  formatearVigencia,
  formatearVigenciaCorta,
  claveAmbito,
  hayConflictoHorario,
  lunesDeSemana,
  resumenHorasUsoDeSemana,
  type ContextoEquipo,
  type HorarioComparable,
  type HorarioConAmbito,
  type HorarioHorasUso,
} from './horarios'

describe('CATALOGO_DIAS', () => {
  it('incluye los 7 días con su orden canónico', () => {
    expect(CATALOGO_DIAS.map((d) => d.codigo)).toEqual([
      'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM',
    ])
  })
})

describe('horarioEquipoSchema (validación de entrada)', () => {
  const valido = {
    nombre: 'HVAC administración',
    diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
    horaInicio: 6,
    horaFin: 18,
  }

  it('acepta un horario completo', () => {
    expect(horarioEquipoSchema.safeParse(valido).success).toBe(true)
  })

  it('rechaza sin días de la semana', () => {
    expect(horarioEquipoSchema.safeParse({ ...valido, diasSemana: [] }).success).toBe(false)
  })

  it('rechaza un código de día inexistente', () => {
    expect(
      horarioEquipoSchema.safeParse({ ...valido, diasSemana: ['LUN', 'FOO'] }).success
    ).toBe(false)
  })

  it('rechaza cuando la hora final no es posterior a la inicial', () => {
    expect(horarioEquipoSchema.safeParse({ ...valido, horaInicio: 18, horaFin: 6 }).success).toBe(false)
    expect(horarioEquipoSchema.safeParse({ ...valido, horaInicio: 8, horaFin: 8 }).success).toBe(false)
  })

  it('rechaza nombre vacío o demasiado largo', () => {
    expect(horarioEquipoSchema.safeParse({ ...valido, nombre: '' }).success).toBe(false)
    expect(horarioEquipoSchema.safeParse({ ...valido, nombre: 'x'.repeat(81) }).success).toBe(false)
  })
})

describe('formatearDias / formatearFranja (presentación)', () => {
  it('enumera días seleccionados en orden canónico y abrevía bloques corridos', () => {
    expect(formatearDias(['LUN', 'MAR', 'MIE', 'JUE', 'VIE'])).toBe('Lun–Vie')
    expect(formatearDias(['SAB', 'DOM'])).toBe('Sáb, Dom')
    expect(formatearDias(['MIE', 'VIE'])).toBe('Mié, Vie')
  })

  it('formatea la franja en 24h con dos dígitos', () => {
    expect(formatearFranja(6, 18)).toBe('06:00–18:00')
    expect(formatearFranja(9, 13)).toBe('09:00–13:00')
  })
})

// ============================================================
// Fase 5 — ámbito jerárquico, vigencia y conflictos (S12)
// ============================================================

describe('horarioEquipoSchema: ámbito jerárquico y vigencia', () => {
  const base = {
    nombre: 'Laboratorio 201',
    diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
    horaInicio: 7,
    horaFin: 17,
  }

  it('acepta el horario de edificación sin ámbito (retrocompatible)', () => {
    expect(horarioEquipoSchema.safeParse(base).success).toBe(true)
    expect(
      horarioEquipoSchema.safeParse({ ...base, ambito: {}, desde: null, hasta: null }).success
    ).toBe(true)
  })

  it('acepta la cascada completa y los niveles intermedios', () => {
    expect(
      horarioEquipoSchema.safeParse({
        ...base,
        ambito: { bloqueId: 'blo-1', espacioId: 'esp-1', equipoId: 'eq-1' },
        desde: '2026-08-01',
        hasta: '2026-12-15',
      }).success
    ).toBe(true)
    expect(
      horarioEquipoSchema.safeParse({ ...base, ambito: { bloqueId: 'blo-1' } }).success
    ).toBe(true)
    expect(
      horarioEquipoSchema.safeParse({
        ...base,
        ambito: { bloqueId: 'blo-1', espacioId: 'esp-1' },
      }).success
    ).toBe(true)
  })

  it('rechaza la cascada rota: equipo sin espacio ni bloque, espacio sin bloque', () => {
    expect(
      horarioEquipoSchema.safeParse({ ...base, ambito: { equipoId: 'eq-1' } }).success
    ).toBe(false)
    expect(
      horarioEquipoSchema.safeParse({
        ...base,
        ambito: { espacioId: 'esp-1', equipoId: 'eq-1' },
      }).success
    ).toBe(false)
    expect(
      horarioEquipoSchema.safeParse({ ...base, ambito: { espacioId: 'esp-1' } }).success
    ).toBe(false)
  })

  it('rechaza vigencia invertida y acepta la vigencia abierta', () => {
    expect(
      horarioEquipoSchema.safeParse({
        ...base,
        desde: '2026-12-15',
        hasta: '2026-08-01',
      }).success
    ).toBe(false)
    expect(
      horarioEquipoSchema.safeParse({ ...base, desde: '2026-08-01', hasta: null }).success
    ).toBe(true)
  })
})

describe('claveAmbito (identidad del ámbito para conflictos)', () => {
  it('distingue los cuatro niveles por el más específico', () => {
    expect(claveAmbito({})).toBe('edificacion')
    expect(claveAmbito({ bloqueId: 'blo-1' })).toBe('bloque:blo-1')
    expect(claveAmbito({ bloqueId: 'blo-1', espacioId: 'esp-1' })).toBe('espacio:esp-1')
    expect(
      claveAmbito({ bloqueId: 'blo-1', espacioId: 'esp-1', equipoId: 'eq-1' })
    ).toBe('equipo:eq-1')
    // Un equipo de otro bloque no se confunde: la cascada es la del equipo.
    expect(claveAmbito({ equipoId: 'eq-1' })).toBe('equipo:eq-1')
  })
})

describe('hayConflictoHorario (S12: mismo ámbito + días + franja + vigencia)', () => {
  const h = (extra: Partial<HorarioComparable>): HorarioComparable => ({
    edificacionId: 'edi-1',
    ambito: {},
    diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
    horaInicio: 8,
    horaFin: 12,
    desde: null,
    hasta: null,
    ...extra,
  })

  it('detecta conflicto cuando coinciden ámbito, día, franja y vigencia', () => {
    expect(
      hayConflictoHorario(h({}), h({ horaInicio: 10, horaFin: 16 }))
    ).toBe(true)
  })

  it('no hay conflicto entre ámbitos distintos (edificación vs bloque)', () => {
    expect(
      hayConflictoHorario(h({}), h({ ambito: { bloqueId: 'blo-1' } }))
    ).toBe(false)
  })

  it('no hay conflicto si los días no se solapan', () => {
    expect(
      hayConflictoHorario(h({ diasSemana: ['LUN'] }), h({ diasSemana: ['SAB'] }))
    ).toBe(false)
  })

  it('no hay conflicto con franjas que se tocan por un borde (semicerradas)', () => {
    expect(hayConflictoHorario(h({}), h({ horaInicio: 12, horaFin: 18 }))).toBe(false)
    expect(hayConflictoHorario(h({}), h({ horaInicio: 4, horaFin: 8 }))).toBe(false)
  })

  it('no hay conflicto con vigencias disjuntas ni entre edificaciones distintas', () => {
    expect(
      hayConflictoHorario(
        h({ hasta: '2026-06-30' }),
        h({ desde: '2026-07-01' })
      )
    ).toBe(false)
    expect(
      hayConflictoHorario(h({}), h({ edificacionId: 'edi-2' }))
    ).toBe(false)
  })

  it('la vigencia se solapa en un borde compartido (mismo día activo)', () => {
    expect(
      hayConflictoHorario(h({ hasta: '2026-06-30' }), h({ desde: '2026-06-30' }))
    ).toBe(true)
    // Y una vigencia abierta siempre se solapa con cualquier otra.
    expect(hayConflictoHorario(h({ hasta: null }), h({ desde: '2030-01-01' }))).toBe(true)
  })

  it('ignora el nombre: dos grupos distintos en el mismo ámbito chocan igual', () => {
    expect(
      hayConflictoHorario(h({}), h({ horaInicio: 8, horaFin: 10 }))
    ).toBe(true)
  })
})

describe('formatearVigencia (presentación)', () => {
  it('formatea los cuatro casos en es-CO', () => {
    expect(formatearVigencia(null, null)).toBe('Sin vigencia registrada')
    expect(formatearVigencia('2026-08-01', null)).toBe('Desde 01/08/2026')
    expect(formatearVigencia(null, '2027-06-30')).toBe('Hasta 30/06/2027')
    expect(formatearVigencia('2026-08-01', '2026-12-15')).toBe('01/08/2026 → 15/12/2026')
  })
})

// ============================================================
// Fase 6 — horas de uso por fecha (S4: origen de Xe en la GDE)
// ============================================================

describe('horasDeUsoEnFecha (unión de franjas con vigencia)', () => {
  // 2026-10-19 es lunes y 2026-10-20 martes (2026-10-16 es viernes).
  const lunes = '2026-10-19'
  const martes = '2026-10-20'

  const h = (extra: Partial<HorarioHorasUso> = {}): HorarioHorasUso => ({
    diasSemana: ['LUN'],
    horaInicio: 8,
    horaFin: 18,
    desde: null,
    hasta: null,
    ...extra,
  })

  it('sin horarios devuelve 0', () => {
    expect(horasDeUsoEnFecha([], lunes)).toBe(0)
  })

  it('un horario 08–18 en su día devuelve 10', () => {
    expect(horasDeUsoEnFecha([h()], lunes)).toBe(10)
  })

  it('franjas solapadas 08–12 y 10–14 suman 6 (unión, sin doble conteo)', () => {
    expect(
      horasDeUsoEnFecha([h({ horaFin: 12 }), h({ horaInicio: 10, horaFin: 14 })], lunes)
    ).toBe(6)
  })

  it('franjas contiguas 08–12 y 12–16 suman 8 una sola vez', () => {
    expect(
      horasDeUsoEnFecha([h({ horaFin: 12 }), h({ horaInicio: 12, horaFin: 16 })], lunes)
    ).toBe(8)
  })

  it('la vigencia es inclusiva en el día inicial y en el final', () => {
    expect(horasDeUsoEnFecha([h({ desde: lunes, hasta: lunes })], lunes)).toBe(10)
    expect(horasDeUsoEnFecha([h({ desde: '2026-10-05', hasta: lunes })], lunes)).toBe(10)
    expect(horasDeUsoEnFecha([h({ desde: lunes, hasta: '2026-10-26' })], lunes)).toBe(10)
  })

  it('fuera de la vigencia devuelve 0 (extremos nulos = infinito)', () => {
    expect(horasDeUsoEnFecha([h({ hasta: '2026-10-12' })], lunes)).toBe(0)
    expect(horasDeUsoEnFecha([h({ desde: '2026-10-26' })], lunes)).toBe(0)
    expect(horasDeUsoEnFecha([h({ desde: null, hasta: null })], lunes)).toBe(10)
  })

  it('los días fuera de diasSemana no aportan horas', () => {
    expect(horasDeUsoEnFecha([h()], martes)).toBe(0)
    expect(
      horasDeUsoEnFecha([h({ diasSemana: ['DOM'], horaInicio: 9, horaFin: 13 })], '2026-10-18')
    ).toBe(4)
  })

  it('nunca supera las 24 horas de un día', () => {
    expect(
      horasDeUsoEnFecha(
        [h({ horaInicio: 0, horaFin: 24 }), h({ horaInicio: 8, horaFin: 12 })],
        lunes
      )
    ).toBe(24)
  })
})

// ============================================================
// Fase 6 — trazabilidad de horarios por equipo (S3)
// ============================================================

describe('horariosAplicablesAEquipo (S3: qué horarios aplican a un equipo)', () => {
  const contexto: ContextoEquipo = {
    edificacionId: 'edi-1',
    bloqueId: 'blo-1',
    espacioId: 'esp-1',
    equipoId: 'eq-1',
  }

  const fila = (
    extra: Partial<HorarioConAmbito> & { nombre?: string } = {}
  ): HorarioConAmbito & { nombre: string } => ({
    nombre: 'Horario',
    edificacionId: 'edi-1',
    bloqueId: null,
    espacioId: null,
    equipoId: null,
    ...extra,
  })

  it('coincide solo por id exacto en cada nivel (ids equivocados no aplican)', () => {
    const horarios = [
      fila({ nombre: 'bloque equivocado', bloqueId: 'blo-OTRO' }),
      fila({ nombre: 'espacio equivocado', bloqueId: 'blo-1', espacioId: 'esp-OTRO' }),
      fila({
        nombre: 'equipo equivocado',
        bloqueId: 'blo-1',
        espacioId: 'esp-1',
        equipoId: 'eq-OTRO',
      }),
      fila({ nombre: 'edificación equivocada', edificacionId: 'edi-OTRA' }),
    ]
    expect(horariosAplicablesAEquipo(horarios, contexto)).toEqual([])
  })

  it('un horario de equipo ajeno no aplica aunque su cascada coincida', () => {
    const horarios = [fila({ bloqueId: 'blo-1', espacioId: 'esp-1', equipoId: 'eq-2' })]
    expect(horariosAplicablesAEquipo(horarios, contexto)).toEqual([])
  })

  it('los cuatro niveles coinciden con su id exacto', () => {
    const horarios = [
      fila({ nombre: 'por edificación' }),
      fila({ nombre: 'por bloque', bloqueId: 'blo-1' }),
      fila({ nombre: 'por espacio', bloqueId: 'blo-1', espacioId: 'esp-1' }),
      fila({
        nombre: 'por equipo',
        bloqueId: 'blo-1',
        espacioId: 'esp-1',
        equipoId: 'eq-1',
      }),
    ]
    const aplicables = horariosAplicablesAEquipo(horarios, contexto)
    expect(aplicables).toHaveLength(4)
    // Los cuatro niveles casan con su id exacto (el orden lo fija la prueba
    // de especificidad; aquí importa que aparecen las cuatro filas).
    expect(aplicables.map((a) => a.nivel).sort()).toEqual([
      'BLOQUE',
      'EDIFICACION',
      'EQUIPO',
      'ESPACIO',
    ])
    expect(aplicables.map((a) => a.horario.nombre).sort()).toEqual([
      'por bloque',
      'por edificación',
      'por equipo',
      'por espacio',
    ])
  })

  it('ordena por especificidad: equipo → espacio → bloque → edificación', () => {
    const horarios = [
      fila({ nombre: 'edificación' }),
      fila({ nombre: 'equipo', bloqueId: 'blo-1', espacioId: 'esp-1', equipoId: 'eq-1' }),
      fila({ nombre: 'bloque', bloqueId: 'blo-1' }),
      fila({ nombre: 'espacio', bloqueId: 'blo-1', espacioId: 'esp-1' }),
    ]
    const aplicables = horariosAplicablesAEquipo(horarios, contexto)
    expect(aplicables.map((a) => a.nivel)).toEqual([
      'EQUIPO',
      'ESPACIO',
      'BLOQUE',
      'EDIFICACION',
    ])
    expect(aplicables.map((a) => a.horario.nombre)).toEqual([
      'equipo',
      'espacio',
      'bloque',
      'edificación',
    ])
  })

  it('sin coincidencias devuelve []', () => {
    expect(horariosAplicablesAEquipo([], contexto)).toEqual([])
  })
})

describe('horariosDelNivelGanador (S1: el más específico manda por nivel)', () => {
  const contexto: ContextoEquipo = {
    edificacionId: 'edi-1',
    bloqueId: 'blo-1',
    espacioId: 'esp-1',
  }

  type Fila = HorarioConAmbito & {
    nombre: string
    desde?: string | null
    hasta?: string | null
  }

  const fila = (extra: Partial<Fila> = {}): Fila => ({
    nombre: 'Horario',
    edificacionId: 'edi-1',
    bloqueId: null,
    espacioId: null,
    equipoId: null,
    ...extra,
  })

  it('si el espacio tiene horario manda él; bloque y edificación no suman', () => {
    const horarios = [
      fila({ nombre: 'edificación' }),
      fila({ nombre: 'bloque', bloqueId: 'blo-1' }),
      fila({ nombre: 'espacio', bloqueId: 'blo-1', espacioId: 'esp-1' }),
    ]
    expect(horariosDelNivelGanador(horarios, contexto).map((h) => h.nombre)).toEqual(['espacio'])
  })

  it('espacio sin horario → hereda del bloque; bloque sin horario → de la edificación', () => {
    expect(
      horariosDelNivelGanador(
        [fila({ nombre: 'edificación' }), fila({ nombre: 'bloque', bloqueId: 'blo-1' })],
        contexto
      ).map((h) => h.nombre)
    ).toEqual(['bloque'])
    expect(
      horariosDelNivelGanador([fila({ nombre: 'edificación' })], contexto).map((h) => h.nombre)
    ).toEqual(['edificación'])
  })

  it('dentro del nivel ganador se conservan todos sus horarios', () => {
    const horarios = [
      fila({ nombre: 'edificación' }),
      fila({ nombre: 'espacio tarde', bloqueId: 'blo-1', espacioId: 'esp-1' }),
      fila({ nombre: 'espacio mañana', bloqueId: 'blo-1', espacioId: 'esp-1' }),
    ]
    expect(horariosDelNivelGanador(horarios, contexto).map((h) => h.nombre)).toEqual([
      'espacio tarde',
      'espacio mañana',
    ])
  })

  it('con ventana solo cuenta como «tiene horario» lo vigente ese mes', () => {
    // El horario del espacio está vencido en julio 2026 → manda el bloque.
    const horarios = [
      fila({ nombre: 'edificación' }),
      fila({ nombre: 'bloque', bloqueId: 'blo-1' }),
      fila({
        nombre: 'espacio vencido',
        bloqueId: 'blo-1',
        espacioId: 'esp-1',
        hasta: '2026-06-30',
      }),
    ]
    expect(
      horariosDelNivelGanador(horarios, contexto, { mes: 7, ano: 2026 }).map((h) => h.nombre)
    ).toEqual(['bloque'])
    // Sin ventana (trazabilidad) el más específico sigue siendo el espacio.
    expect(horariosDelNivelGanador(horarios, contexto).map((h) => h.nombre)).toEqual([
      'espacio vencido',
    ])
  })

  it('sin horarios en ningún nivel devuelve []', () => {
    expect(horariosDelNivelGanador([], contexto)).toEqual([])
    expect(
      horariosDelNivelGanador(
        [fila({ nombre: 'otra edificación', edificacionId: 'edi-2' })],
        contexto
      )
    ).toEqual([])
  })
})

describe('lunesDeSemana (ancla de la semana en curso)', () => {
  it('normaliza cualquier día de la semana a su lunes', () => {
    expect(lunesDeSemana('2026-10-16')).toBe('2026-10-12') // viernes
    expect(lunesDeSemana('2026-10-19')).toBe('2026-10-19') // ya es lunes
    expect(lunesDeSemana('2026-10-18')).toBe('2026-10-12') // domingo
  })
})

describe('resumenHorasUsoDeSemana (S3: horas de uso «esta semana»)', () => {
  // 2026-10-19 es lunes y 2026-10-25 el domingo de esa misma semana.
  const lunes = '2026-10-19'

  const h = (extra: Partial<HorarioHorasUso> = {}): HorarioHorasUso => ({
    diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
    horaInicio: 8,
    horaFin: 18,
    desde: null,
    hasta: null,
    ...extra,
  })

  it('devuelve los 7 días de la semana (lunes a domingo) con sus fechas', () => {
    const r = resumenHorasUsoDeSemana([], lunes)
    expect(r.dias.map((d) => d.codigo)).toEqual(['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'])
    expect(r.dias.map((d) => d.fecha)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
    expect(r.total).toBe(0)
  })

  it('un horario vigente aporta sus horas por día y el total semanal', () => {
    const r = resumenHorasUsoDeSemana([h()], lunes)
    expect(r.dias.map((d) => d.horas)).toEqual([10, 10, 10, 10, 10, 0, 0])
    expect(r.total).toBe(50)
  })

  it('la vigencia que termina a mitad de semana cuenta solo los días cubiertos', () => {
    const r = resumenHorasUsoDeSemana([h({ hasta: '2026-10-21' })], lunes)
    expect(r.dias.map((d) => d.horas)).toEqual([10, 10, 10, 0, 0, 0, 0])
    expect(r.total).toBe(30)
  })

  it('la vigencia fuera de la semana lo excluye del resumen pero no de la aplicabilidad', () => {
    const contexto: ContextoEquipo = {
      edificacionId: 'edi-1',
      bloqueId: 'blo-1',
      espacioId: 'esp-1',
      equipoId: 'eq-1',
    }
    const vencido: HorarioConAmbito & HorarioHorasUso & { nombre: string } = {
      nombre: 'Vencido',
      edificacionId: 'edi-1',
      bloqueId: null,
      espacioId: null,
      equipoId: null,
      diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
      horaInicio: 8,
      horaFin: 18,
      desde: null,
      hasta: '2026-10-11', // termina el domingo anterior a la semana ancla
    }

    // Trazabilidad: el horario aplicable se muestra aunque esté vencido…
    const aplicables = horariosAplicablesAEquipo([vencido], contexto)
    expect(aplicables).toHaveLength(1)

    // …pero no aporta horas al resumen de la semana en curso.
    const r = resumenHorasUsoDeSemana(
      aplicables.map((a) => a.horario),
      lunes
    )
    expect(r.dias.every((d) => d.horas === 0)).toBe(true)
    expect(r.total).toBe(0)
  })

  it('dos horarios aplicables solapados se unen sin doble conteo', () => {
    const r = resumenHorasUsoDeSemana(
      [
        h({ diasSemana: ['LUN'], horaInicio: 8, horaFin: 12 }),
        h({ diasSemana: ['LUN'], horaInicio: 10, horaFin: 14 }),
      ],
      lunes
    )
    expect(r.dias[0].horas).toBe(6)
    expect(r.total).toBe(6)
  })
})

describe('horariosVigentesEnSemana (filtro de vigencia previo al nivel ganador)', () => {
  // 2026-10-19 es lunes y 2026-10-25 el domingo de esa misma semana.
  const lunes = '2026-10-19'

  const fila = (desde: string | null, hasta: string | null) => ({ desde, hasta })

  it('conserva abiertas y vigentes en la semana; descarta vencidas y futuras', () => {
    const abierta = fila(null, null)
    const vencida = fila(null, '2026-10-18') // domingo anterior
    const futura = fila('2026-10-26', null) // lunes siguiente
    const dentro = fila('2026-10-21', '2026-10-22')

    expect(horariosVigentesEnSemana([abierta, vencida, futura, dentro], lunes)).toEqual([
      abierta,
      dentro,
    ])
  })

  it('la vigencia es inclusiva en los dos bordes de la semana', () => {
    const terminaElLunes = fila(null, '2026-10-19')
    const empiezaElDomingo = fila('2026-10-25', null)

    expect(horariosVigentesEnSemana([terminaElLunes, empiezaElDomingo], lunes)).toEqual([
      terminaElLunes,
      empiezaElDomingo,
    ])
  })

  it('ancla cualquier fecha a la semana que la contiene', () => {
    const soloElViernes = fila('2026-10-23', '2026-10-23')

    expect(horariosVigentesEnSemana([soloElViernes], '2026-10-23')).toEqual([soloElViernes])
    expect(horariosVigentesEnSemana([soloElViernes], '2026-10-26')).toEqual([])
  })

  it('sin fecha ancla a la semana en curso sin romperse', () => {
    expect(horariosVigentesEnSemana([fila(null, null)])).toHaveLength(1)
  })
})

describe('regresión Aula 202 (TdeA › Bloque-5): manda el nivel, no la suma entre niveles', () => {
  const lunes = '2026-10-19'

  const contexto: ContextoEquipo = {
    edificacionId: 'edi-tdea',
    bloqueId: 'bloque-5',
    espacioId: 'aula-202',
    equipoId: 'eq-aula-202',
  }

  type FilaAula = HorarioConAmbito & HorarioHorasUso & { nombre: string }

  const fila = (extra: Partial<FilaAula>): FilaAula => ({
    nombre: 'Horario',
    edificacionId: 'edi-tdea',
    bloqueId: null,
    espacioId: null,
    equipoId: null,
    diasSemana: [],
    horaInicio: 0,
    horaFin: 0,
    desde: null,
    hasta: null,
    ...extra,
  })

  // Datos reales cargados en BD para el Aula 202.
  const espacio = [
    fila({ nombre: 'Lun 14–16', espacioId: 'aula-202', diasSemana: ['LUN'], horaInicio: 14, horaFin: 16 }),
    fila({ nombre: 'Lun/Vie 18–22', espacioId: 'aula-202', diasSemana: ['LUN', 'VIE'], horaInicio: 18, horaFin: 22 }),
    fila({ nombre: 'Mar 16–22', espacioId: 'aula-202', diasSemana: ['MAR'], horaInicio: 16, horaFin: 22 }),
    fila({ nombre: 'Mié/Jue 10–22', espacioId: 'aula-202', diasSemana: ['MIE', 'JUE'], horaInicio: 10, horaFin: 22 }),
    fila({ nombre: 'Sáb 6–18', espacioId: 'aula-202', diasSemana: ['SAB'], horaInicio: 6, horaFin: 18 }),
  ]
  const bloque = [
    fila({
      nombre: 'Bloque L–V 7–22',
      bloqueId: 'bloque-5',
      diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
      horaInicio: 7,
      horaFin: 22,
    }),
    fila({
      nombre: 'Bloque Sáb 6–18',
      bloqueId: 'bloque-5',
      diasSemana: ['SAB'],
      horaInicio: 6,
      horaFin: 18,
    }),
  ]
  const edificacion = [
    fila({
      nombre: 'Edificación L–V 6–20',
      diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
      horaInicio: 6,
      horaFin: 20,
    }),
  ]

  const horarios = [...edificacion, ...bloque, ...espacio]

  const ganadoresDeLaSemana = () =>
    horariosDelNivelGanador(horariosVigentesEnSemana(horarios, lunes), contexto)

  it('el lunes son 6 h del espacio, no 15 h de la unión con el bloque', () => {
    const ganadores = ganadoresDeLaSemana()
    expect(ganadores.every((h) => h.espacioId === 'aula-202')).toBe(true)
    expect(resumenHorasUsoDeSemana(ganadores, lunes).dias[0].horas).toBe(6)
  })

  it('el total semanal del aula es 52 h, no 87 h', () => {
    const r = resumenHorasUsoDeSemana(ganadoresDeLaSemana(), lunes)
    expect(r.dias.map((d) => d.horas)).toEqual([6, 6, 12, 12, 4, 12, 0])
    expect(r.total).toBe(52)
  })

  it('una fila de espacio vencida no tapa el horario vigente del bloque', () => {
    const vencida = fila({
      nombre: 'Espacio vencido',
      espacioId: 'aula-202',
      diasSemana: ['LUN'],
      horaInicio: 14,
      horaFin: 16,
      hasta: '2026-10-11',
    })

    const ganadores = horariosDelNivelGanador(
      horariosVigentesEnSemana([...bloque, vencida], lunes),
      contexto
    )

    // Sin el filtro semanal la fila vencida ganaría y taparía el bloque; con él
    // manda el bloque (L–V 7–22 = 15 h), que sí está vigente.
    expect(ganadores.every((h) => h.bloqueId === 'bloque-5')).toBe(true)
    expect(resumenHorasUsoDeSemana(ganadores, lunes).dias[0].horas).toBe(15)
  })
})

describe('formatearVigenciaCorta (S3: desde–hasta o «abierta»)', () => {
  it('formatea el rango acotado y los extremos abiertos', () => {
    expect(formatearVigenciaCorta('2026-08-01', '2026-12-15')).toBe('01/08/2026 – 15/12/2026')
    expect(formatearVigenciaCorta('2026-08-01', null)).toBe('01/08/2026 – abierta')
    expect(formatearVigenciaCorta(null, '2027-06-30')).toBe('abierta – 30/06/2027')
    expect(formatearVigenciaCorta(null, null)).toBe('abierta')
  })
})
