import { describe, expect, it } from 'vitest'
import {
  diasOperativosDelMes,
  calcularGde,
  configCalendarioSchema,
  CATALOGO_TIPOS_DIA,
  chipTipoDia,
  CHIPS_TIPOS_DIA,
  mapearUbicaciones,
  TDEA_PLANTILLA,
  tipoDiaEnFecha,
  tipoDiaEsOperativo,
  usoEquiposDelMes,
} from './calendario'
import type { RangoCalendarioInfo } from './calendario'
import { horasDeUsoEnFecha } from './horarios'
import type { HorarioHorasUso } from './horarios'

/** Rangos de prueba: febrero 2026 (28 días), mes de referencia de las pruebas. */
const rangosFebrero: RangoCalendarioInfo[] = [
  // Del 1 al 10 de febrero: vacaciones (no operativo).
  { id: 'r1', fechaInicio: '2026-01-01', fechaFin: '2026-02-10', tipoDia: 'VACACIONES' },
  // Del 11 al 28: actividad académica (operativo).
  { id: 'r2', fechaInicio: '2026-02-11', fechaFin: '2026-02-28', tipoDia: 'LECTIVO' },
]

const config = { horaInicioOperacion: 6, horasOperacionDia: 12, temperaturaBase: 23 }

describe('CATALOGO_TIPOS_DIA', () => {
  it('incluye los cuatro tipos y marca LECTIVO/HABIL como operativos', () => {
    expect(CATALOGO_TIPOS_DIA).toHaveLength(4)
    const operativos = CATALOGO_TIPOS_DIA.filter((t) => t.operativo).map((t) => t.codigo)
    expect(operativos).toEqual(['LECTIVO', 'HABIL'])
  })
})

describe('diasOperativosDelMes', () => {
  it('cuenta solo los días operativos del mes', () => {
    // 11 al 28 de febrero = 18 días operativos.
    expect(diasOperativosDelMes(rangosFebrero, 2, 2026)).toBe(18)
  })

  it('devuelve 0 cuando el mes no tiene rangos', () => {
    expect(diasOperativosDelMes(rangosFebrero, 5, 2026)).toBe(0)
  })

  it('cuenta festivos dentro de un mes lectivo como no operativos', () => {
    const rangos: RangoCalendarioInfo[] = [
      { id: 'r1', fechaInicio: '2026-03-01', fechaFin: '2026-03-31', tipoDia: 'LECTIVO' },
      { id: 'r2', fechaInicio: '2026-03-20', fechaFin: '2026-03-20', tipoDia: 'FESTIVO' },
    ]
    // 31 días de marzo menos el festivo del 20.
    expect(diasOperativosDelMes(rangos, 3, 2026)).toBe(30)
  })

  it('cruza el cambio de año (enero lectivo iniciado en diciembre)', () => {
    const rangos: RangoCalendarioInfo[] = [
      { id: 'r1', fechaInicio: '2025-12-01', fechaFin: '2026-01-15', tipoDia: 'LECTIVO' },
    ]
    expect(diasOperativosDelMes(rangos, 1, 2026)).toBe(15)
  })
})

// ============================================================
// S2 — flags de operatividad por edificación (domingos/festivos)
// ============================================================

describe('flags de operatividad (S2)', () => {
  /** Julio 2026: 31 días, 4 domingos (5, 12, 19, 26) y 2 festivos (13 y 20). */
  const rangosJulio = [
    { fechaInicio: '2026-07-01', fechaFin: '2026-07-31', tipoDia: 'LECTIVO' },
  ]
  /** Marzo 2026: 31 días; festivo Emiliani el 23 (San José trasladado al lunes). */
  const rangosMarzo = [
    { fechaInicio: '2026-03-01', fechaFin: '2026-03-31', tipoDia: 'LECTIVO' },
  ]
  const ambosOn = { domingosOperativos: true, festivosOperativos: true }

  it('con los flags ON (default) conserva el conteo bit a bit del legado', () => {
    expect(diasOperativosDelMes(rangosJulio, 7, 2026)).toBe(31)
    expect(diasOperativosDelMes(rangosJulio, 7, 2026, ambosOn)).toBe(31)
  })

  it('con domingos OFF excluye los 4 domingos de julio 2026', () => {
    expect(
      diasOperativosDelMes(rangosJulio, 7, 2026, {
        domingosOperativos: false,
        festivosOperativos: true,
      })
    ).toBe(27)
  })

  it('con festivos OFF excluye los 2 festivos de julio (13 y 20) y el Emiliani del 23 de marzo', () => {
    const soloFestivos = { domingosOperativos: true, festivosOperativos: false }
    // Jul 2026: 31 − Chiquinquirá (13) − Independencia (20) = 29.
    expect(diasOperativosDelMes(rangosJulio, 7, 2026, soloFestivos)).toBe(29)
    expect(diasOperativosDelMes(rangosMarzo, 3, 2026, soloFestivos)).toBe(30)
  })

  it('con ambos flags OFF excluye domingos y festivos sin solaparse', () => {
    // 31 − 4 domingos − 2 festivos (ninguno cae en domingo) = 25.
    expect(
      diasOperativosDelMes(rangosJulio, 7, 2026, {
        domingosOperativos: false,
        festivosOperativos: false,
      })
    ).toBe(25)
  })

  it('los flags nunca convierten un día no operativo en operativo', () => {
    const vacaciones = [
      { fechaInicio: '2026-07-01', fechaFin: '2026-07-31', tipoDia: 'VACACIONES' },
    ]
    expect(diasOperativosDelMes(vacaciones, 7, 2026, ambosOn)).toBe(0)
  })

  it('usoEquiposDelMes y calcularGde respetan los flags como verdad de calendario', () => {
    const politica = { domingosOperativos: false, festivosOperativos: false }
    const uso = usoEquiposDelMes({
      rangos: rangosJulio,
      config,
      horarios: [],
      usarHorariosXe: false,
      mes: 7,
      ano: 2026,
      politica,
    })
    expect(uso).toEqual({ horasUsoDia: 12, diasUsoMes: 25 })
    const gde = calcularGde({
      rangos: rangosJulio,
      config,
      tempsHorarias: [],
      mes: 7,
      ano: 2026,
      politica,
    })
    expect(gde.diasOperativos).toBe(25)
  })
})

describe('usoEquiposDelMes', () => {
  it('con el interruptor OFF devuelve H fija y los días operativos del mes', () => {
    const res = usoEquiposDelMes({
      rangos: rangosFebrero,
      config,
      horarios: [],
      usarHorariosXe: false,
      mes: 2,
      ano: 2026,
    })
    // 11–28 feb = 18 días operativos a H = 12 h fijas.
    expect(res).toEqual({ horasUsoDia: 12, diasUsoMes: 18 })
  })

  it('con el interruptor ON promedia solo sobre los días en que corre el horario (S3)', () => {
    // Marzo 2026 completo lectivo (31 días) y horario laboral 08–16 de lunes a
    // viernes: el horario corre los 22 días hábiles → 176/22 = 8 h; los días
    // sin horario no cuentan (S3: operativos ∩ días que corre el horario).
    const rangosMarzo: RangoCalendarioInfo[] = [
      { id: 'rm', fechaInicio: '2026-03-01', fechaFin: '2026-03-31', tipoDia: 'LECTIVO' },
    ]
    const horarios: HorarioHorasUso[] = [
      { diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'], horaInicio: 8, horaFin: 16 },
    ]
    const res = usoEquiposDelMes({
      rangos: rangosMarzo,
      config,
      horarios,
      usarHorariosXe: true,
      mes: 3,
      ano: 2026,
    })
    // 176 h sobre los 22 días en que corre = 8 h exactas; diasUsoMes = 22.
    expect(res).toEqual({ horasUsoDia: 8, diasUsoMes: 22 })
  })

  it('devuelve null cuando el mes no tiene ningún día operativo', () => {
    // Mayo no está cubierto por ningún rango.
    expect(
      usoEquiposDelMes({
        rangos: rangosFebrero,
        config,
        horarios: [],
        usarHorariosXe: false,
        mes: 5,
        ano: 2026,
      })
    ).toBeNull()
  })
})

describe('calcularGde', () => {
  /** Crea 24 horas constantes para un día. */
  const dia = (fecha: string, temp: number) => ({ fecha, horas: Array(24).fill(temp) })

  it('aplica (Tp − Tb) solo cuando Tp supera la temperatura base', () => {
    // Día operativo a 27 °C → (27 − 23) = 4; día operativo a 20 °C → 0.
    const temps = [dia('2026-02-11', 27), dia('2026-02-12', 20)]
    const res = calcularGde({ rangos: rangosFebrero, config, tempsHorarias: temps, mes: 2, ano: 2026 })
    expect(res.gde).toBe(4)
    expect(res.diasOperativos).toBe(18)
    // Solo 2 de los 18 días operativos tienen datos de temperatura.
    expect(res.diasConTemperatura).toBe(2)
    expect(res.diasSinTemperatura).toBe(16)
  })

  it('promedia solo las horas del horario operativo [H, H+dur)', () => {
    // Horas 0-5 (fuera del horario 6..17) a 10 °C no deben influir.
    const horas = Array(24).fill(27)
    for (let h = 0; h < 6; h++) horas[h] = 10
    const res = calcularGde({
      rangos: [{ fechaInicio: '2026-02-11', fechaFin: '2026-02-11', tipoDia: 'LECTIVO' }],
      config,
      tempsHorarias: [dia('2026-02-11', 0).horas.map((_, i) => horas[i])].map((h, i) => ({
        fecha: `2026-02-11`,
        horas: h,
      })),
      mes: 2,
      ano: 2026,
    })
    expect(res.gde).toBe(4)
  })

  it('devuelve gde 0 y motivo cuando no hay días operativos', () => {
    const res = calcularGde({
      rangos: [{ fechaInicio: '2026-05-01', fechaFin: '2026-05-31', tipoDia: 'VACACIONES' }],
      config,
      tempsHorarias: [],
      mes: 5,
      ano: 2026,
    })
    expect(res.gde).toBe(0)
    expect(res.diasOperativos).toBe(0)
  })

  it('la plantilla del TdeA produce días operativos coherentes con el semestre 2026-1', () => {
    // Febrero 2026 con la plantilla: lectivo desde el 09/02 (inicio real del período).
    const dias = diasOperativosDelMes(TDEA_PLANTILLA.rangos, 2, 2026)
    expect(dias).toBe(20) // 9 al 28 de febrero
  })
})

// ============================================================
// Fase 6 — configuración operativa: ubicación (S1) + Xe opt-in (S4)
// ============================================================

describe('configCalendarioSchema (ubicación e interruptor Xe)', () => {
  const base = {
    horaInicioOperacion: 6,
    horasOperacionDia: 12,
    temperaturaBase: 23,
    lat: 6.2477,
    lon: -75.5662,
  }

  it('acepta la configuración mínima con defaults (Xe apagado, sin nombre)', () => {
    const res = configCalendarioSchema.safeParse(base)
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.usarHorariosXe).toBe(false)
    expect(res.data.ubicacionNombre).toBe(null)
  })

  it('recorta el nombre de ubicación y conserva el interruptor Xe encendido', () => {
    const res = configCalendarioSchema.safeParse({
      ...base,
      ubicacionNombre: '  Medellín, Antioquia  ',
      usarHorariosXe: true,
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.ubicacionNombre).toBe('Medellín, Antioquia')
    expect(res.data.usarHorariosXe).toBe(true)
  })

  it('rechaza un interruptor no booleano y un nombre demasiado largo', () => {
    expect(configCalendarioSchema.safeParse({ ...base, usarHorariosXe: 'si' }).success).toBe(false)
    expect(
      configCalendarioSchema.safeParse({ ...base, ubicacionNombre: 'x'.repeat(161) }).success
    ).toBe(false)
  })

  it('normaliza los flags de operatividad: ausentes → ON/ON (S2)', () => {
    const porDefecto = configCalendarioSchema.safeParse(base)
    expect(porDefecto.success).toBe(true)
    if (!porDefecto.success) return
    expect(porDefecto.data.domingosOperativos).toBe(true)
    expect(porDefecto.data.festivosOperativos).toBe(true)
  })

  it('conservan los flags apagados explícitos y rechazan valores no booleanos (S2)', () => {
    const apagados = configCalendarioSchema.safeParse({
      ...base,
      domingosOperativos: false,
      festivosOperativos: false,
    })
    expect(apagados.success).toBe(true)
    if (!apagados.success) return
    expect(apagados.data.domingosOperativos).toBe(false)
    expect(apagados.data.festivosOperativos).toBe(false)
    expect(
      configCalendarioSchema.safeParse({ ...base, domingosOperativos: 'si' }).success
    ).toBe(false)
  })
})

// ============================================================
// Fase 6 — geocoding Open-Meteo: mapeo puro de resultados (S1)
// ============================================================

describe('mapearUbicaciones (geocoding de Open-Meteo)', () => {
  it('mapea los campos y normaliza los ausentes a null', () => {
    const res = mapearUbicaciones({
      results: [
        {
          name: 'Medellín',
          latitude: 6.2477,
          longitude: -75.5662,
          admin1: 'Antioquia',
          country: 'Colombia',
          timezone: 'America/Bogota',
        },
        { name: 'Envigado', latitude: 6.1696, longitude: -75.5736 },
      ],
    })
    expect(res).toHaveLength(2)
    expect(res[0]).toEqual({
      nombre: 'Medellín',
      admin1: 'Antioquia',
      pais: 'Colombia',
      lat: 6.2477,
      lon: -75.5662,
      timezone: 'America/Bogota',
    })
    expect(res[1]).toEqual({
      nombre: 'Envigado',
      admin1: null,
      pais: null,
      lat: 6.1696,
      lon: -75.5736,
      timezone: null,
    })
  })

  it('filtra entradas sin nombre, sin coordenadas o fuera de rango', () => {
    const res = mapearUbicaciones({
      results: [
        { name: '   ', latitude: 1, longitude: 2 },
        { name: 'Sin lat', longitude: -75 },
        { name: 'Sin lon', latitude: 6 },
        { name: 'Lat no numérico', latitude: 'x', longitude: 2 },
        { name: 'Lat fuera de rango', latitude: 120, longitude: 0 },
        { name: 'Lon fuera de rango', latitude: 6, longitude: -200 },
        { name: 'Válida', latitude: 6, longitude: -75 },
        'garbage',
        null,
        42,
      ],
    })
    expect(res).toHaveLength(1)
    expect(res[0].nombre).toBe('Válida')
  })

  it('devuelve una lista vacía ante payloads sin resultados', () => {
    expect(mapearUbicaciones({})).toEqual([])
    expect(mapearUbicaciones(null)).toEqual([])
    expect(mapearUbicaciones({ results: null })).toEqual([])
    expect(mapearUbicaciones({ results: [] })).toEqual([])
  })

  it('limita el listado a 8 aunque la fuente devuelva más', () => {
    const results = Array.from({ length: 12 }, (_, i) => ({
      name: `Ciudad ${i}`,
      latitude: 6 + i * 0.01,
      longitude: -75,
    }))
    const res = mapearUbicaciones({ results })
    expect(res).toHaveLength(8)
    expect(res[0].nombre).toBe('Ciudad 0')
  })
})

// ============================================================
// Fase 6 — S4: GDE con Xe opt-in (peso normalizado por duración)
// ============================================================

describe('calcularGde con Xe por horarios (S4)', () => {
  // Febrero 2026: día 1 = domingo → en 11..28 hay 13 hábiles (11,12,13,
  // 16..20, 23..27) y 5 fin de semana (14,15,21,22,28).
  const diasHabiles = ['11', '12', '13', '16', '17', '18', '19', '20', '23', '24', '25', '26', '27']
  const diasFinDeSemana = ['14', '15', '21', '22', '28']
  const isoFeb = (dia: string) => `2026-02-${dia}`

  /** 24 horas constantes (°C) para un día. */
  const dia = (fecha: string, temp: number) => ({ fecha, horas: Array(24).fill(temp) })

  /** Horario fijo LUN–VIE 07:00–13:00 (6 h) sin vigencia (siempre activo). */
  const horarioLaboral: HorarioHorasUso[] = [
    { diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'], horaInicio: 7, horaFin: 13 },
  ]

  /** Mapa fecha→horas de uso calculado con la función pura de horarios. */
  const mapaUsos = (horarios: HorarioHorasUso[]) =>
    new Map(
      [...diasHabiles, ...diasFinDeSemana].map((d) => [
        isoFeb(d),
        horasDeUsoEnFecha(horarios, isoFeb(d)),
      ])
    )

  it('flag OFF (sin mapa) conserva bit a bit el cálculo legado', () => {
    // Perfil con pico el día 11: media de 6..17 = 315/12 = 26.25 → 3.25 grados;
    // los otros 17 días a 27 °C → 4 grados → GDE legado = 3.25 + 68 = 71.25.
    const horas = Array(24).fill(27)
    ;[24, 25, 26, 27, 28, 29, 30, 28, 26, 25, 24, 23].forEach((v, i) => {
      horas[6 + i] = v
    })
    const temps = [dia('2026-02-11', 0), ...diasFinDeSemana.concat(diasHabiles.slice(1)).map((d) => dia(isoFeb(d), 27))]
    temps[0] = { fecha: '2026-02-11', horas }

    const legado = calcularGde({ rangos: rangosFebrero, config, tempsHorarias: temps, mes: 2, ano: 2026 })
    const conOptOut = calcularGde({
      rangos: rangosFebrero,
      config,
      tempsHorarias: temps,
      mes: 2,
      ano: 2026,
      horasUsoPorFecha: null,
    })

    // Expectation codificada del legado (equivalencia bit a bit).
    expect(legado.gde).toBe(71.25)
    expect(legado.sumaGrados).toBe(71.25)
    expect(conOptOut.gde).toBe(legado.gde)
    expect(conOptOut.sumaGrados).toBe(legado.sumaGrados)
    expect(conOptOut.detalle).toEqual(legado.detalle)
    // Xe = H fijo: 18 días operativos × 12 h = 216 h; peso exactamente 1.
    expect(conOptOut.xeTotalHoras).toBe(216)
    expect(conOptOut.usarHorariosXe).toBe(false)
    expect(conOptOut.detalle[0].xe).toBe(12)
  })

  it('flag ON usa las horas de los horarios vigentes por día', () => {
    // Datos climáticos para los 18 días operativos (constante 27 °C).
    const temps = [...diasHabiles, ...diasFinDeSemana].map((d) => dia(isoFeb(d), 27))
    const res = calcularGde({
      rangos: rangosFebrero,
      config,
      tempsHorarias: temps,
      mes: 2,
      ano: 2026,
      horasUsoPorFecha: mapaUsos(horarioLaboral),
    })

    // Hábiles: xe = 6 h → peso 6/12 = 0.5 → 4 × 0.5 = 2 grados × 13 = 26.
    expect(res.usarHorariosXe).toBe(true)
    expect(res.gde).toBe(26)
    expect(res.xeTotalHoras).toBe(78) // 13 hábiles × 6 h; fin de semana = 0.
    const porFecha = new Map(res.detalle.map((d) => [d.fecha, d]))
    expect(porFecha.get('2026-02-11')?.xe).toBe(6) // miércoles
    expect(porFecha.get('2026-02-14')?.xe).toBe(0) // sábado
    expect(porFecha.get('2026-02-11')?.grados).toBe(2)
    expect(porFecha.get('2026-02-14')?.grados).toBe(0)
    // La fórmula no cambia: Tp sigue midiendo la ventana operativa.
    expect(porFecha.get('2026-02-11')?.tp).toBe(27)
  })

  it('flag ON sin horarios registrados aporta 0 (el mes completo no escribe)', () => {
    const temps = [dia(isoFeb('11'), 27), dia(isoFeb('12'), 27)]
    const base = { rangos: rangosFebrero, config, tempsHorarias: temps, mes: 2, ano: 2026 }
    const legado = calcularGde(base)
    const res = calcularGde({ ...base, horasUsoPorFecha: mapaUsos([]) })
    expect(legado.gde).toBe(8) // legado: 2 días × 4 grados
    expect(res.gde).toBe(0)
    expect(res.xeTotalHoras).toBe(0)
    // Tp y los contadores no se afectan: solo cambia la fuente de Xe.
    expect(res.detalle[0].tp).toBe(27)
    expect(res.diasConTemperatura).toBe(legado.diasConTemperatura)
  })

  it('recorta a 24 h un mapa con horas por encima del tope', () => {
    const temps = [dia(isoFeb('11'), 27)]
    const res = calcularGde({
      rangos: [{ fechaInicio: '2026-02-11', fechaFin: '2026-02-11', tipoDia: 'LECTIVO' }],
      config,
      tempsHorarias: temps,
      mes: 2,
      ano: 2026,
      horasUsoPorFecha: new Map([['2026-02-11', 48]]),
    })
    // 48 h → tope 24 → peso 24/12 = 2 → 4 × 2 = 8.
    expect(res.gde).toBe(8)
    expect(res.xeTotalHoras).toBe(24)
    expect(res.detalle[0].xe).toBe(24)
  })
})

// ============================================================
// Fase 6, slice 6c — S9: tipo de día en el calendario
// ============================================================

describe('tipoDiaEnFecha (S9 — superposición en el calendario)', () => {
  it('devuelve null cuando ningún rango cubre la fecha', () => {
    expect(tipoDiaEnFecha([], '2026-02-15')).toBeNull()
    expect(tipoDiaEnFecha(rangosFebrero, '2026-03-05')).toBeNull()
    expect(tipoDiaEnFecha(rangosFebrero, '2025-12-31')).toBeNull()
  })

  it('los límites del rango son inclusivos en ambos extremos', () => {
    expect(tipoDiaEnFecha(rangosFebrero, '2026-02-10')).toBe('VACACIONES')
    expect(tipoDiaEnFecha(rangosFebrero, '2026-02-11')).toBe('LECTIVO')
    expect(tipoDiaEnFecha(rangosFebrero, '2026-02-28')).toBe('LECTIVO')
  })

  it('el último rango que cubre la fecha gana (misma regla que la GDE)', () => {
    const solapados: RangoCalendarioInfo[] = [
      { id: 'a', fechaInicio: '2026-03-01', fechaFin: '2026-03-31', tipoDia: 'LECTIVO' },
      { id: 'b', fechaInicio: '2026-03-15', fechaFin: '2026-03-20', tipoDia: 'VACACIONES' },
      { id: 'c', fechaInicio: '2026-03-18', fechaFin: '2026-03-18', tipoDia: 'FESTIVO' },
    ]
    expect(tipoDiaEnFecha(solapados, '2026-03-10')).toBe('LECTIVO')
    expect(tipoDiaEnFecha(solapados, '2026-03-16')).toBe('VACACIONES')
    expect(tipoDiaEnFecha(solapados, '2026-03-18')).toBe('FESTIVO')
    expect(tipoDiaEnFecha(solapados, '2026-03-21')).toBe('LECTIVO')
  })

  it('mapea LECTIVO/VACACIONES/FESTIVO sin cambiar la operatividad de la GDE', () => {
    const marzo: RangoCalendarioInfo[] = [
      { id: 'r1', fechaInicio: '2026-03-01', fechaFin: '2026-03-31', tipoDia: 'LECTIVO' },
      { id: 'r2', fechaInicio: '2026-03-20', fechaFin: '2026-03-20', tipoDia: 'FESTIVO' },
    ]
    expect(tipoDiaEsOperativo(tipoDiaEnFecha(marzo, '2026-03-10') as string)).toBe(true)
    expect(tipoDiaEsOperativo(tipoDiaEnFecha(marzo, '2026-03-20') as string)).toBe(false)
    expect(tipoDiaEsOperativo(tipoDiaEnFecha(rangosFebrero, '2026-02-05') as string)).toBe(false)
    // La GDE sigue contando exactamente lo mismo que antes de la extracción.
    expect(diasOperativosDelMes(marzo, 3, 2026)).toBe(30)
    expect(diasOperativosDelMes(rangosFebrero, 2, 2026)).toBe(18)
  })
})

describe('CHIPS_TIPOS_DIA (S9 — chips del calendario)', () => {
  it('cubre los cuatro tipos del catálogo con etiqueta corta y color de marca AA', () => {
    expect(CHIPS_TIPOS_DIA.map((c) => c.codigo)).toEqual([
      'LECTIVO', 'HABIL', 'VACACIONES', 'FESTIVO',
    ])
    CHIPS_TIPOS_DIA.forEach((c) => {
      expect(c.etiqueta.length).toBeGreaterThan(0)
      expect(c.punto).toMatch(/^bg-/)
      // Regla dura del repo: emerald-500 nunca en elementos con significado.
      expect(c.punto).not.toContain('emerald-500')
    })
  })

  it('chipTipoDia resuelve por código y devuelve null para uno desconocido', () => {
    expect(chipTipoDia('LECTIVO')?.etiqueta).toBe('Lectivo')
    expect(chipTipoDia('VACACIONES')?.etiqueta).toBe('Vacaciones')
    expect(chipTipoDia('OTRO')).toBeNull()
  })
})
