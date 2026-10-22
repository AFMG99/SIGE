/**
 * Datos deterministas de la sección «Cálculo de uso» (T5, spec §6).
 *
 * Alimenta los dobles de `views/__mocks__/serverActions.ts` (Storybook y
 * tests responsivos aliadan las actions del módulo a ese archivo). Cada
 * edificación del catálogo demo activa una rama distinta del resultado
 * individual, de modo que las stories cubran todos los estados sin BD:
 *
 * - Campus Bloque A (`ed-campus-00000001`): resultado mixto — 2 equipos
 *   calculados + 1 sin horario vigente (advertencia, nunca fila en ceros,
 *   BR5). Enero del año en curso devuelve `conservado: true` (AC5).
 * - Administración Principal (`ed-oficina-000001`): ningún equipo tiene
 *   horario vigente ⇒ detalle vacío + «Sin horario vigente».
 * - Vivienda 1 (`ed-vivienda-00001`): sin equipos registrados (BR2).
 * - Sede en pruebas (`ed-error-0000001`): fallo simulado de la action.
 *
 * La vista previa recorre las SIX clasificaciones del BR4 por posición en el
 * intervalo (patrón cíclico) y reparte la factura en posiciones pares.
 *
 * T6: las tablas de resultado muestran el NOMBRE visible del equipo
 * (`nombreEquipo`, compuesto «TIPO · Espacio» igual que en el módulo de
 * horarios) como texto principal; el `equipoId` queda como dato secundario.
 */

import {
  clavePeriodo,
  expandirIntervalo,
} from '@/features/datos/models/calculoUso'
import type {
  Clasificacion,
  Consolidaciones,
  DetalleEquipo,
  PeriodoRef,
  PeriodoVistaPrevia,
  ResultadoPeriodo,
  VistaPrevia,
} from '@/features/datos/models/calculoUso'
import type { Exito } from '@/features/datos/controllers/calendario'

import type { EdificacionInfo } from '../useCatalogoEdificaciones'
import { edificacionesDemo } from './catalogo'

export const EDIFICACION_CAMPUS = 'ed-campus-00000001'
export const EDIFICACION_OFICINA = 'ed-oficina-000001'
export const EDIFICACION_VIVIENDA = 'ed-vivienda-00001'
/** Edificación solo presente en el catálogo de la sección: fallo simulado. */
export const EDIFICACION_SIN_CONEXION = 'ed-error-0000001'

/** Catálogo de la sección: las tres demo + la del fallo simulado. */
export const edificacionesCalculoDemo: EdificacionInfo[] = [
  ...edificacionesDemo,
  {
    id: EDIFICACION_SIN_CONEXION,
    nombre: 'Sede en pruebas (fallo simulado)',
    tipo: 'OFICINA_PUBLICA',
    area: null,
  },
]

/** Payload «ok» de `calcularUsoIndividual` (estructura idéntica a la action real). */
export type ResultadoIndividualDemo = {
  detalle: (DetalleEquipo & { nombreEquipo: string })[]
  porFecha: { equipoId: string; nombreEquipo: string; fecha: string; horas: number }[]
  consolidaciones: Consolidaciones
  advertencias: string[]
  trazabilidad: (ResultadoPeriodo['trazabilidad'][number] & { nombreEquipo: string })[]
  periodo: { estado: string }
  conservado?: boolean
}

const CONSOLIDACIONES_VACIAS: Consolidaciones = {
  espacios: [],
  bloques: [],
  edificacion: { equipos: 0, horasUsoDia: 0, diasUsoMes: 0 },
}

/**
 * Clasificaciones fijas por posición en el intervalo: las seis del BR4 en
 * orden, para que una vista previa de seis meses muestre el catálogo completo.
 */
const PATRON_CLASIFICACION: Clasificacion[] = [
  'existente-intacto',
  'pendiente',
  'desactualizado',
  'fallido',
  'revisar',
  'nuevo',
]

const ANO_ACTUAL_DEMO = new Date().getFullYear()

/** Vista previa demo: mismo reparto de conteos que la action real (spec §5.2). */
export function vistaPreviaDemo(
  edificacionId: string,
  desde: PeriodoRef,
  hasta: PeriodoRef
): VistaPrevia {
  const periodos = expandirIntervalo(desde, hasta)
  const esCampus = edificacionId === EDIFICACION_CAMPUS

  const filas: PeriodoVistaPrevia[] = periodos.map((p, i) => {
    const clasificacion: Clasificacion = esCampus
      ? PATRON_CLASIFICACION[i % PATRON_CLASIFICACION.length]
      : 'nuevo'
    const conFactura = esCampus && i % 2 === 0
    const estado =
      clasificacion === 'existente-intacto' || clasificacion === 'desactualizado'
        ? 'CALCULADO'
        : clasificacion === 'fallido'
          ? 'FALLIDO'
          : clasificacion === 'revisar'
            ? 'REVISAR'
            : null
    const advertencias =
      clasificacion === 'fallido'
        ? ['No fue posible calcular el periodo']
        : clasificacion === 'revisar'
          ? ['Sin horario vigente']
          : []
    return {
      clave: clavePeriodo(p),
      estado,
      clasificacion,
      equiposEsperados: 3,
      equiposCalculados:
        clasificacion === 'existente-intacto' ? 3 : clasificacion === 'desactualizado' ? 2 : 0,
      conFactura,
      advertencias,
    }
  })

  const conteos = { existentes: 0, pendientes: 0, fallidos: 0, revisar: 0, conFactura: 0 }
  for (const f of filas) {
    if (f.clasificacion === 'existente-intacto') conteos.existentes += 1
    else conteos.pendientes += 1
    if (f.clasificacion === 'fallido') conteos.fallidos += 1
    if (f.clasificacion === 'revisar') conteos.revisar += 1
    if (f.conFactura) conteos.conFactura += 1
  }

  return {
    intervalo: { desde, hasta, cantidadMeses: periodos.length },
    periodos: filas,
    conteos,
    seEscribiran: filas
      .filter((f) => f.clasificacion !== 'existente-intacto')
      .map((f) => f.clave),
  }
}

/** Resultado individual demo, ramificado por edificación (ver cabecera). */
export function resultadoIndividualDemo(
  edificacionId: string,
  mes: number,
  ano: number
): Exito<ResultadoIndividualDemo> {
  if (edificacionId === EDIFICACION_SIN_CONEXION) {
    return {
      estado: 'error',
      mensaje: 'No fue posible conectar con el servicio de cálculo. Intente de nuevo.',
    }
  }

  // Rama «conservado»: enero del año en curso ya está calculado e íntegro (AC5).
  if (edificacionId === EDIFICACION_CAMPUS && mes === 1 && ano === ANO_ACTUAL_DEMO) {
    return {
      estado: 'ok',
      detalle: [],
      porFecha: [],
      consolidaciones: CONSOLIDACIONES_VACIAS,
      advertencias: [],
      trazabilidad: [],
      periodo: { estado: 'CALCULADO' },
      conservado: true,
    }
  }

  if (edificacionId === EDIFICACION_OFICINA) {
    return {
      estado: 'ok',
      detalle: [],
      porFecha: [],
      consolidaciones: CONSOLIDACIONES_VACIAS,
      advertencias: ['Sin horario vigente'],
      trazabilidad: [
        {
          equipoId: 'eq-admin-hvac-01',
          nombreEquipo: 'HVAC · Dirección',
          nivelGanador: 'SIN_HORARIO',
          vigencia: '—',
          aportes: [],
        },
      ],
      periodo: { estado: 'REVISAR' },
    }
  }

  if (edificacionId === EDIFICACION_VIVIENDA) {
    return {
      estado: 'ok',
      detalle: [],
      porFecha: [],
      consolidaciones: CONSOLIDACIONES_VACIAS,
      advertencias: ['Sin equipos registrados'],
      trazabilidad: [],
      periodo: { estado: 'CALCULADO' },
    }
  }

  // Campus (por defecto): 3 equipos en alcance, 2 calculados y 1 sin horario
  // vigente ⇒ advertencia + estado REVISAR (BR5: jamás fila en ceros).
  const clave = `${ano}-${String(mes).padStart(2, '0')}`
  const f1 = `${clave}-01`
  const f2 = `${clave}-02`
  const detalle: ResultadoIndividualDemo['detalle'] = [
    {
      equipoId: 'eq-campus-hvac-01',
      nombreEquipo: 'HVAC · Laboratorio 101',
      horasUsoDia: 14,
      diasUsoMes: 21,
      estado: 'CALCULADO',
      horarioGanador: 'EDIFICACION/Período académico',
      porFecha: [
        { fecha: f1, horas: 14 },
        { fecha: f2, horas: 14 },
      ],
    },
    {
      equipoId: 'eq-campus-ilum-02',
      nombreEquipo: 'ILUMINACION · Aula 102',
      horasUsoDia: 16,
      diasUsoMes: 20,
      estado: 'CALCULADO',
      horarioGanador: 'BLOQUE/Ala Norte extendida',
      porFecha: [
        { fecha: f1, horas: 16 },
        { fecha: f2, horas: 16 },
      ],
    },
  ]
  return {
    estado: 'ok',
    detalle,
    porFecha: [
      { equipoId: 'eq-campus-hvac-01', nombreEquipo: 'HVAC · Laboratorio 101', fecha: f1, horas: 14 },
      { equipoId: 'eq-campus-hvac-01', nombreEquipo: 'HVAC · Laboratorio 101', fecha: f2, horas: 14 },
      { equipoId: 'eq-campus-ilum-02', nombreEquipo: 'ILUMINACION · Aula 102', fecha: f1, horas: 16 },
      { equipoId: 'eq-campus-ilum-02', nombreEquipo: 'ILUMINACION · Aula 102', fecha: f2, horas: 16 },
    ],
    consolidaciones: {
      espacios: [
        { espacioId: 'sp-campus-101-0001', equipos: 2, horasUsoDia: 30, diasUsoMes: 41 },
      ],
      bloques: [
        { bloqueId: 'bk-campus-a101-001', equipos: 2, horasUsoDia: 30, diasUsoMes: 41 },
      ],
      edificacion: { equipos: 2, horasUsoDia: 30, diasUsoMes: 41 },
    },
    advertencias: ['Sin horario vigente'],
    trazabilidad: [
      {
        equipoId: 'eq-campus-hvac-01',
        nombreEquipo: 'HVAC · Laboratorio 101',
        nivelGanador: 'EDIFICACION',
        vigencia: 'abierta',
        aportes: ['Lun–Vie · 06:00–22:00'],
      },
      {
        equipoId: 'eq-campus-ilum-02',
        nombreEquipo: 'ILUMINACION · Aula 102',
        nivelGanador: 'BLOQUE',
        vigencia: '01/02/2024 – abierta',
        aportes: ['Lun–Vie · 07:00–19:00'],
      },
      {
        equipoId: 'eq-campus-lab-03',
        nombreEquipo: 'MOTORES · Taller de máquinas',
        nivelGanador: 'SIN_HORARIO',
        vigencia: '—',
        aportes: [],
      },
    ],
    periodo: { estado: 'REVISAR' },
  }
}
