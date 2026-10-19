/**
 * Dobles de las server actions del módulo de carga para Storybook.
 *
 * El alias en `.storybook/main.ts` apunta `@/features/datos/controllers/facturas`,
 * `@/features/datos/controllers/equipos`, `@/features/datos/controllers/variables`, `@/features/datos/controllers/edificaciones`,
 * `@/features/datos/controllers/lineasBase` y `@/features/datos/controllers/ajustes` a este módulo: las actions
 * reales importan `@/shared/models/prisma` (y el de línea base además spawnea Python),
 * que no puede compilarse para el navegador fuera de Next.js. Aquí solo se
 * devuelven resultados deterministas.
 */

import type {
  EdicionEquipo,
  EdicionFactura,
  EdicionVariable,
  FilaEnvioEquipos,
  FilaEnvioImportacion,
  FilaEnvioVariables,
  ResultadoGestion,
  ResultadoImportacionEquipos,
  ResultadoImportacionFacturas,
  ResultadoImportacionVariables,
} from '@/features/datos/models/validations'
import type {
  ResultadoActualizacionEdificacion,
  ResultadoCreacionBloque,
  ResultadoCreacionEdificacion,
  ResultadoCreacionEspacio,
} from '@/features/datos/controllers/edificaciones'
import type { ResultadoCalculoGde, Exito } from '@/features/datos/controllers/calendario'
import type { EventoInfo } from '@/features/datos/models/eventos'
import type { DatosNuevoAjuste } from '@/features/datos/controllers/ajustes'
import type {
  CalculoLineaBase,
  ModeloLbenId,
  OrigenShare,
  RespuestaCalculo,
  RespuestaGuardar,
} from '@/features/datos/models/lineasBase'
import { advertenciaMinimos } from '@/features/datos/models/lineasBase'
import { resultadoEquiposDemo, resultadoFacturasDemo, resultadoVariablesDemo } from '../__fixtures__/resultado'
import { bloquesDemo, edificacionesDemo, espaciosDemo } from '../__fixtures__/catalogo'

/**
 * Registros "con datos guardados": la action real los rechaza porque la BD los
 * borraría en cascada. Elegidos para que las stories cubran ambos caminos
 * (bloqueo y borrado limpio) sin necesidad de sembrar la base.
 */
const BLOQUES_CON_DATOS = new Set(['bk-campus-a102-001'])
const EDIFICACIONES_CON_DATOS = new Set(['ed-campus-00000001'])

/**
 * `bloqueIdSchema` exige `/^[A-Za-z0-9_-]{16,}$/` (los cuid reales miden ~25).
 * Los ids generados aquí deben cumplirlo o la siguiente importación quedaría
 * con todas las filas en "con error".
 */
function idCumpleEsquema(base: string): string {
  return base.length >= 16 ? base : base.padEnd(16, '0')
}

function slug(valor: string, prefijo: string): string {
  const limpio = valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return idCumpleEsquema(`${prefijo}-${limpio || 'item'}`)
}

export async function importarFilasFacturas(
  filas: FilaEnvioImportacion[],
  sobrescribir: boolean,
  edificacionId: string
): Promise<ResultadoImportacionFacturas> {
  void filas
  void sobrescribir
  void edificacionId
  return resultadoFacturasDemo
}

export async function importarFilasEquipos(
  edificacionId: string,
  filas: FilaEnvioEquipos[],
  sobrescribir: boolean
): Promise<ResultadoImportacionEquipos> {
  void edificacionId
  void filas
  void sobrescribir
  return resultadoEquiposDemo
}

export async function importarFilasVariables(
  edificacionId: string,
  filas: FilaEnvioVariables[],
  sobrescribir: boolean
): Promise<ResultadoImportacionVariables> {
  void edificacionId
  void filas
  void sobrescribir
  return resultadoVariablesDemo
}

// ---------------------------------------------------------------------------
// Gestión (pestaña "Gestión" de Facturas/Equipos): editar / eliminar / vaciar.
// ---------------------------------------------------------------------------

export async function actualizarFactura(
  id: string,
  datos: EdicionFactura
): Promise<ResultadoGestion> {
  void id
  void datos
  return {
    estado: 'completado',
    eliminadas: 0,
    lineasBaseEliminadas: 0,
    mensaje: 'Factura actualizada correctamente.',
  }
}

export async function eliminarFactura(id: string): Promise<ResultadoGestion> {
  void id
  return {
    estado: 'completado',
    eliminadas: 1,
    lineasBaseEliminadas: 0,
    mensaje: 'Factura eliminada de la base de datos.',
  }
}

export async function vaciarFacturas(): Promise<ResultadoGestion> {
  return {
    estado: 'completado',
    eliminadas: 12,
    lineasBaseEliminadas: 4,
    mensaje: 'Se eliminaron todas las facturas y sus líneas base guardadas.',
  }
}

export async function actualizarEquipo(
  id: string,
  datos: EdicionEquipo
): Promise<ResultadoGestion> {
  void id
  void datos
  return {
    estado: 'completado',
    eliminadas: 0,
    lineasBaseEliminadas: 0,
    mensaje: 'Equipo actualizado correctamente.',
  }
}

export async function eliminarEquipo(id: string): Promise<ResultadoGestion> {
  void id
  return {
    estado: 'completado',
    eliminadas: 1,
    lineasBaseEliminadas: 0,
    mensaje: 'Equipo eliminado del inventario.',
  }
}

export async function vaciarEquipos(): Promise<ResultadoGestion> {
  return {
    estado: 'completado',
    eliminadas: 6,
    lineasBaseEliminadas: 0,
    mensaje: 'Se eliminaron todos los equipos. Edificaciones, bloques y espacios se conservan.',
  }
}

export async function actualizarVariable(
  id: string,
  datos: EdicionVariable
): Promise<ResultadoGestion> {
  void id
  void datos
  return {
    estado: 'completado',
    eliminadas: 0,
    lineasBaseEliminadas: 0,
    mensaje: 'Variable 12/2024 actualizada.',
  }
}

export async function eliminarVariable(id: string): Promise<ResultadoGestion> {
  void id
  return {
    estado: 'completado',
    eliminadas: 1,
    lineasBaseEliminadas: 0,
    mensaje: 'Variable eliminada de la base de datos.',
  }
}

export async function vaciarVariables(): Promise<ResultadoGestion> {
  return {
    estado: 'completado',
    eliminadas: 6,
    lineasBaseEliminadas: 0,
    mensaje:
      'Se eliminaron 6 variables operativas. Facturas y líneas base se conservan.',
  }
}

// ── Ajustes energéticos y líneas base guardadas ─────────────────────────

export async function crearAjuste(datos: DatosNuevoAjuste): Promise<ResultadoGestion> {
  void datos
  return {
    estado: 'completado',
    eliminadas: 0,
    lineasBaseEliminadas: 0,
    mensaje: 'Ajuste NO_RUTINARIO creado: 2024-05–2024-09, 25% (reduccion).',
  }
}

export async function eliminarAjuste(id: string): Promise<ResultadoGestion> {
  void id
  return {
    estado: 'completado',
    eliminadas: 1,
    lineasBaseEliminadas: 0,
    mensaje: 'Se eliminó el ajuste NO_RUTINARIO del bloque "BLOQUE-A-001 — Bloque de Aulas Mayores".',
  }
}

export async function vaciarAjustes(): Promise<ResultadoGestion> {
  return {
    estado: 'completado',
    eliminadas: 3,
    lineasBaseEliminadas: 0,
    mensaje: 'Se eliminaron 3 ajustes energéticos. El resto de los datos se conserva.',
  }
}

export async function eliminarLineaBase(id: string): Promise<ResultadoGestion> {
  void id
  return {
    estado: 'completado',
    eliminadas: 0,
    lineasBaseEliminadas: 1,
    mensaje: 'Se eliminó la línea base guardada del bloque "BLOQUE-A-001 — Bloque de Aulas Mayores".',
  }
}

export async function vaciarLineasBase(): Promise<ResultadoGestion> {
  return {
    estado: 'completado',
    eliminadas: 0,
    lineasBaseEliminadas: 4,
    mensaje: 'Se eliminaron 4 líneas base guardadas. Facturas y variables se conservan.',
  }
}

export async function crearEdificacion(
  nombre: string,
  tipo: string,
  area?: number | string
): Promise<ResultadoCreacionEdificacion> {
  const areaNumerica =
    area === undefined || String(area).trim() === '' ? null : Number(area)
  return {
    estado: 'ok',
    edificacion: {
      id: slug(nombre, 'ed'),
      nombre,
      tipo,
      area: Number.isFinite(areaNumerica as number) ? (areaNumerica as number) : null,
    },
    bloqueUnico: null,
    mensaje: `Edificación "${nombre}" creada.`,
  }
}

export async function actualizarEdificacion(
  id: string,
  datos: { nombre: string; area?: number | string }
): Promise<ResultadoActualizacionEdificacion> {
  const areaNumerica =
    datos.area === undefined || String(datos.area).trim() === ''
      ? null
      : Number(datos.area)
  const edificacion = edificacionesDemo.find((e) => e.id === id)
  return {
    estado: 'ok',
    edificacion: {
      id,
      nombre: datos.nombre,
      tipo: edificacion?.tipo ?? 'OFICINA_PUBLICA',
      area: Number.isFinite(areaNumerica as number) ? (areaNumerica as number) : null,
    },
    mensaje: `Edificación "${datos.nombre}" actualizada.`,
  }
}

export async function crearBloque(
  edificacionId: string,
  codigo: string,
  nombre: string,
  areaUtil?: number | string,
  factorInfraestructura?: number | string
): Promise<ResultadoCreacionBloque> {
  void areaUtil
  void factorInfraestructura
  return {
    estado: 'ok',
    bloque: { id: slug(codigo, 'bk'), codigo, nombre },
    mensaje: `Bloque "${nombre}" creado en ${edificacionId}.`,
  }
}

export async function eliminarBloque(id: string): Promise<ResultadoGestion> {
  const bloque = bloquesDemo.find((b) => b.id === id)
  const etiqueta = bloque ? `${bloque.codigo} — ${bloque.nombre}` : 'seleccionado'

  if (BLOQUES_CON_DATOS.has(id)) {
    return {
      estado: 'error',
      mensaje:
        `No se puede eliminar el bloque "${etiqueta}": tiene 4 equipos, 12 variables ` +
        'y 2 líneas base. Vacíe primero esos módulos (Gestión de Equipos Eléctricos, ' +
        'Gestión de Variables Operativas, Gestión de Facturas › Líneas base guardadas).',
    }
  }

  const vacios = espaciosDemo.filter((s) => s.bloqueId === id).length
  const extras = vacios
    ? ` y ${vacios} ${vacios === 1 ? 'espacio vacío' : 'espacios vacíos'}`
    : ''
  return {
    estado: 'completado',
    eliminadas: 1,
    lineasBaseEliminadas: 0,
    mensaje: `Se eliminó el bloque "${etiqueta}"${extras}.`,
  }
}

export async function crearEspacio(
  bloqueId: string,
  nombre: string
): Promise<ResultadoCreacionEspacio> {
  return {
    estado: 'ok',
    espacio: { id: slug(nombre, 'esp'), bloqueId, nombre },
    mensaje: `Espacio "${nombre}" creado.`,
  }
}

export async function eliminarEspacio(id: string): Promise<ResultadoGestion> {
  void id
  return {
    estado: 'completado',
    eliminadas: 1,
    lineasBaseEliminadas: 0,
    mensaje: 'Se eliminó el espacio.',
  }
}

// ------------------------------------------------------------
// Calendario operativo y GDE (Fase 2)
// ------------------------------------------------------------

type DatosConfigCalendario = {
  horaInicioOperacion: number
  horasOperacionDia: number
  temperaturaBase: number
  lat: number
  lon: number
  ubicacionNombre?: string | null
  /** S2: flags de operatividad de domingos/festivos (default ON). */
  domingosOperativos?: boolean
  festivosOperativos?: boolean
}

/** Última configuración guardada: las stories la leen para assertar el payload. */
export const ultimaConfigGuardada: {
  edificacionId: string | null
  datos: DatosConfigCalendario | null
} = { edificacionId: null, datos: null }

export async function guardarConfigCalendario(
  edificacionId: string,
  datos: DatosConfigCalendario
): Promise<{ estado: 'ok'; mensaje: string } | { estado: 'error'; mensaje: string }> {
  ultimaConfigGuardada.edificacionId = edificacionId
  ultimaConfigGuardada.datos = datos
  // Emula el contrato del servidor (S5): el campus del fixture tiene LBEn
  // calculada y sus flags de fixture son ON/ON — cualquier false = flagueo.
  const flagueoConLben =
    edificacionId === 'ed-campus-00000001' &&
    (datos.domingosOperativos === false || datos.festivosOperativos === false)
  return {
    estado: 'ok',
    mensaje: flagueoConLben
      ? 'Configuración operativa guardada. Este edificio tiene líneas base calculadas: al cambiar la política de operatividad recalcule sus LBEn.'
      : 'Configuración operativa guardada.',
  }
}

export async function agregarRangoCalendario(
  edificacionId: string,
  datos: { fechaInicio: string; fechaFin: string; tipoDia: string; nombre?: string }
): Promise<{ estado: 'ok'; mensaje: string } | { estado: 'error'; mensaje: string }> {
  void edificacionId
  void datos
  return { estado: 'ok', mensaje: 'Rango agregado al calendario.' }
}

export async function eliminarRangoCalendario(
  id: string
): Promise<{ estado: 'ok'; mensaje: string } | { estado: 'error'; mensaje: string }> {
  void id
  return { estado: 'ok', mensaje: 'Rango eliminado del calendario.' }
}

export async function cargarPlantillaCalendario(
  edificacionId: string
): Promise<{ estado: 'ok'; mensaje: string } | { estado: 'error'; mensaje: string }> {
  void edificacionId
  return {
    estado: 'ok',
    mensaje:
      'Plantilla cargada (7 rangos). Revise y ajuste las fechas si difieren de su caso.',
  }
}

/** Resultado determinista para las stories: semestre 2026-1 con Tb = 23 °C. */
export async function calcularGdeMensual(
  edificacionId: string,
  mes: number,
  ano: number
): Promise<Exito<ResultadoCalculoGde>> {
  void edificacionId
  return {
    estado: 'ok',
    resultado: {
      gde: 41.2,
      diasOperativos: 20,
      diasConTemperatura: 18,
      diasSinTemperatura: 2,
      sumaGrados: 41.2,
      detalle: [
        { fecha: '2026-02-09', tp: 25.4, grados: 2.4 },
        { fecha: '2026-02-10', tp: 26.1, grados: 3.1 },
        { fecha: '2026-02-11', tp: 22.8, grados: 0 },
        { fecha: '2026-02-12', tp: null, grados: 0 },
        { fecha: '2026-02-13', tp: 27.9, grados: 4.9 },
      ],
    },
    config: { horaInicioOperacion: 6, horasOperacionDia: 12, temperaturaBase: 23 },
    mes,
    ano,
    fuente: 'Open-Meteo (reanálisis ERA5/Copernicus)',
    mensaje: 'GDE calculada: 41.2 °C·día sobre 20 días operativos.',
  }
}

export async function registrarGdeCalculado(
  edificacionId: string,
  mes: number,
  ano: number,
  gde: number
): Promise<
  | { estado: 'ok'; actualizadas: number; sinRegistro: number; mensaje: string }
  | { estado: 'error'; mensaje: string }
> {
  void edificacionId
  return {
    estado: 'ok',
    actualizadas: 2,
    sinRegistro: 0,
    mensaje: `GDE ${gde} °C·día (${mes}/${ano}) registrada en 2 variables operativas.`,
  }
}

// ------------------------------------------------------------
// Horarios de funcionamiento de equipos (Fase 3)
// ------------------------------------------------------------

export async function crearHorarioEquipo(
  edificacionId: string,
  datos: { nombre: string; diasSemana: string[]; horaInicio: number; horaFin: number }
): Promise<Exito<{ mensaje: string }>> {
  void edificacionId
  void datos
  return { estado: 'ok', mensaje: 'Horario agregado.' }
}

export async function eliminarHorarioEquipo(id: string): Promise<Exito<{ mensaje: string }>> {
  void id
  return { estado: 'ok', mensaje: 'Horario eliminado.' }
}

// ------------------------------------------------------------
// Eventos del calendario (Fase 6 — T7, S7/S8)
// ------------------------------------------------------------

export async function crearEvento(
  edificacionId: string,
  datos: {
    tipo: string
    nombre: string
    descripcion?: string | null
    fechaInicio: string
    fechaFin?: string | null
    ambito?: { bloqueId?: string | null; espacioId?: string | null; equipoId?: string | null }
  }
): Promise<Exito<{ mensaje: string; evento: EventoInfo }>> {
  const ambito = datos?.ambito
  return {
    estado: 'ok',
    mensaje: 'Evento creado.',
    evento: {
      // Id mágico para que las stories distingan la fila creada por el doble.
      id: `ev-mock-${slug(datos.nombre, 'ev')}`,
      edificacionId,
      tipo: datos.tipo,
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      fechaInicio: datos.fechaInicio,
      fechaFin: datos.fechaFin ?? null,
      bloqueId: ambito?.bloqueId ?? null,
      espacioId: ambito?.espacioId ?? null,
      equipoId: ambito?.equipoId ?? null,
    },
  }
}

export async function eliminarEvento(id: string): Promise<Exito<{ mensaje: string }>> {
  void id
  return { estado: 'ok', mensaje: 'Evento eliminado del calendario.' }
}

export async function eliminarEdificacion(id: string): Promise<ResultadoGestion> {
  const edificacion = edificacionesDemo.find((e) => e.id === id)
  const etiqueta = edificacion?.nombre ?? 'seleccionada'

  if (EDIFICACIONES_CON_DATOS.has(id)) {
    return {
      estado: 'error',
      mensaje:
        `No se puede eliminar la edificación "${etiqueta}": tiene 5 equipos, 12 variables ` +
        'y 2 líneas base en sus bloques. Vacíe primero esos módulos (Gestión de Equipos ' +
        'Eléctricos, Gestión de Variables Operativas, Gestión de Facturas › Líneas base guardadas).',
    }
  }

  const bloques = bloquesDemo.filter((b) => b.edificacionId === id)
  const vacios = espaciosDemo.filter((s) => bloques.some((b) => b.id === s.bloqueId)).length
  const partes: string[] = []
  if (bloques.length > 0) {
    partes.push(`${bloques.length} ${bloques.length === 1 ? 'bloque' : 'bloques'}`)
  }
  if (vacios > 0) {
    partes.push(`${vacios} ${vacios === 1 ? 'espacio vacío' : 'espacios vacíos'}`)
  }
  const extra = partes.length > 0 ? ` con ${partes.join(' y ')}` : ''

  return {
    estado: 'completado',
    eliminadas: 1,
    lineasBaseEliminadas: 0,
    mensaje: `Se eliminó la edificación "${etiqueta}"${extra}.`,
  }
}

// ── Línea Base Energética (LBEn) ────────────────────────────────────────

/** Serie mensual determinista (18 meses) para la gráfica del doble. */
const SERIE_LBEN: CalculoLineaBase['serie'] = Array.from(
  { length: 18 },
  (_, i) => {
    const mes = (i % 12) + 1
    const ano = 2023 + Math.floor(i / 12)
    const real =
      Math.round(21500 + 1400 * Math.sin((i / 12) * Math.PI * 2) + i * 45)
    return {
      mes,
      ano,
      real,
      descartado: i === 7,
      // Banda de la LBEn_m del VA (21.527,3679 kWh), espejo del motor.
      banda_inf: 19374.6311,
      banda_sup: 23680.1047,
      estimado: false,
      pred_va: 21527.3679,
      pred_coc: real - 400 + (i % 4) * 120,
      pred_reg: real - 300 + (i % 3) * 150,
      pred_conf: 21543.8679,
    }
  }
)

/** Bandas por mes (§7.5.1) espejo del cálculo del doble. */
const BANDAS_MOCK: CalculoLineaBase['bandas'] = Array.from(
  { length: 12 },
  (_, i) => {
    const mes = i + 1
    const media = Math.round(21500 + 1400 * Math.sin((i / 12) * Math.PI * 2))
    return {
      mes,
      n: 4,
      media,
      limiteInferior: Math.round(media * 0.9 * 100) / 100,
      limiteSuperior: Math.round(media * 1.1 * 100) / 100,
      descartados: mes === 8 ? 1 : 0,
      estimado: false,
    }
  }
)

const BLOQUE_MOCK_ID = 'cmuofv5pw0002p3jxuul4li7m'

/** Media de la factura global en el doble (kWh/mes). */
const MEDIA_CAMPUS_MOCK = 21500

/**
 * Cargas nominales (kWh/mes) de los 4 espacios del bloque. Suman
 * `SHARE_BLOQUE_MOCK × MEDIA_CAMPUS_MOCK` para que el share estimado del
 * bloque sea coherente con la fórmula real `carga ÷ factura media`.
 */
const JERARQUIA_ESPACIOS: { id: string; nombre: string; carga: number }[] = [
  { nombre: 'Pasillo', carga: 4469 },
  { nombre: 'Oficina Administrativa', carga: 754 },
  { nombre: 'Aula Mayor', carga: 268 },
  { nombre: 'Taller de Máquinas', carga: 54 },
].map((e) => ({ ...e, id: `esp-${e.nombre.toLowerCase().replace(/ /g, '-')}` }))

const CARGA_BLOQUE_MOCK = JERARQUIA_ESPACIOS.reduce(
  (s, e) => s + e.carga,
  0
)

/**
 * Bloques del doble sin área útil: la action real conmuta a
 * `modelo_ingenieria` en cuanto falta cobertura de área.
 */
const BLOQUES_SIN_AREA_MOCK = new Set(['bloque-sin-area'])

/**
 * Ids mágicos que disparam cada rama de error de la action real. Las
 * stories los usan como `bloques[].id` para mostrar los mensajes tipados.
 */
const ERRORES_SHARE_MOCK: Record<string, string> = {
  'err-share-indeterminado':
    'Share indeterminado: ningún bloque tiene área útil registrada ni inventario de equipos.',
  'err-sin-inventario':
    'El bloque "BLOQUE-B-002 — Piso 3" no tiene inventario de equipos con consumo: no puede estimarse su share. Importe equipos para este bloque o registre su área útil.',
  'err-share-sobre-100':
    'El share estimado del bloque "BLOQUE-C-001 — Local Técnico" es 402 %: su carga teórica (86.637 kWh/mes) iguala o supera la factura media global (21.500 kWh/mes). Revise la potencia nominal de sus equipos.',
  'err-serie-ceros':
    'La factura media normalizada global es 0: no hay serie de consumo que modelar. Revise las facturas importadas.',
}

const AVISO_ESTIMADO_MOCK =
  'Ninguno de los 1 bloques registrados tiene área útil; share estimado por modelo de ingeniería (carga nominal de equipos ÷ factura media global), no por área. No hay variables operativas: los modelos de cociente y regresión se evaluarán sin referencia poblacional.'

/** Filas de preparación: 49 meses (2021-01 → 2025-01) espejo del dry-run. */
function preparacionMock(share: number): CalculoLineaBase['preparacion'] {
  return Array.from({ length: 49 }, (_, i) => {
    const mes = (i % 12) + 1
    const ano = 2021 + Math.floor(i / 12)
    const normalizado = Math.round(
      21500 + 1400 * Math.sin((i / 12) * Math.PI * 2) + i * 45
    )
    const descartado = i === 19
    return {
      periodo: `${ano}-${String(mes).padStart(2, '0')}`,
      consumoKwh: normalizado,
      diasFacturados: 30,
      costoCop: Math.round(normalizado * 950),
      consumoNormalizado: normalizado,
      share,
      consumoAsignado: Math.round(normalizado * share * 100) / 100,
      descartado,
      motivoDescarte: descartado ? ('banda' as const) : null,
    }
  })
}

/**
 * Serie espejo del dry-run escalada al share del alcance. Con `share = 1`
 * devuelve la serie exacta; en modo estimado baja a la magnitud real del
 * bloque para que la gráfica y la tabla de preparación no se contradigan.
 */
function serieMock(share: number): CalculoLineaBase['serie'] {
  if (share === 1) return SERIE_LBEN
  const k = (v: number | null) => (v === null ? null : Math.round(v * share))
  return SERIE_LBEN.map((p) => ({
    ...p,
    real: k(p.real),
    pred_va: k(p.pred_va),
    pred_coc: k(p.pred_coc),
    pred_reg: k(p.pred_reg),
    pred_conf: k(p.pred_conf),
  }))
}

/** Métricas del dry-run escaladas al share del alcance (× 1 es identidad). */
function resultadosMock(share: number): CalculoLineaBase['resultados'] {
  const k = (v: number) => v * share
  return {
    valor_absoluto: {
      estado: 'ok',
      resultado: {
        tipo: 'VALOR_ABSOLUTO',
        consumo_promedio_mensual: k(21527.3679),
        consumo_mediana: k(21340.2),
        desvio_estandar: k(1520.4),
        rango_confianza_10_pct: [k(19374.6), k(23680.1)],
        intervalo_confianza: [k(18486.6), k(24568.2)],
        coeficientes: { intercepto: k(21527.3679) },
        r2: 1,
        mape: 5.77,
      },
    },
    cociente: {
      estado: 'ok',
      resultado: {
        tipo: 'COCIENTE',
        cociente_estimado: k(23.4652),
        unidad: 'persona',
        variable_referencia_promedio: 917.5,
        consumo_promedio: k(21527.4),
        desvio_estandar: k(2.5231),
        r2: 0.2448,
        mape: 5.08,
      },
    },
    regresion: {
      estado: 'ok',
      resultado: {
        tipo: 'REGRESSION_ESTADISTICA',
        variable_dependiente: 'consumo_normalizado',
        variables_explicativas_usadas: ['grades_dia_enfriamiento'],
        coeficientes: { grades_dia_enfriamiento: k(46.0467) },
        p_values: { grades_dia_enfriamiento: 0 },
        r2: 0.6914,
        r2_ajustado: 0.6847,
        f_statistic: 103.0532,
        mape: 2.85,
        desvio_estandar: k(1520.4),
      },
    },
    confort: {
      estado: 'ok',
      resultado: {
        tipo: 'CONFORT_THERMAL',
        temperatura_promedio: 25,
        en_rango_confort: true,
        modo_operacion: 'CONFORT',
        consumo_base_kwh: k(21527.4),
        energia_virtual_kwh: k(21543.9),
        delta_temperatura: 1.1,
      },
    },
  }
}

function jerarquiaMock(
  origen: OrigenShare,
  nombreGlobal: string,
  criterioGlobal: string
): CalculoLineaBase['jerarquia'] {
  const media = MEDIA_CAMPUS_MOCK
  const esArea = origen === 'facturas_area'
  const shareBloque = esArea ? 1 : CARGA_BLOQUE_MOCK / media
  return [
    {
      nivel: 'global',
      id: null,
      nombre: nombreGlobal,
      codigo: 'GLOBAL',
      padreId: null,
      criterio: criterioGlobal,
      peso: esArea ? 1020 : media,
      share: 1,
      consumoPromedio: media,
    },
    {
      nivel: 'bloque',
      id: BLOQUE_MOCK_ID,
      nombre: 'Bloque de Aulas Mayores',
      codigo: 'BLOQUE-A-001',
      padreId: null,
      criterio: esArea
        ? 'Área útil × factor de infraestructura (m²)'
        : 'Carga nominal ÷ factura media (kWh/mes, estimado)',
      peso: esArea ? 1020 : CARGA_BLOQUE_MOCK,
      share: shareBloque,
      consumoPromedio: media * shareBloque,
    },
    ...JERARQUIA_ESPACIOS.map((e) => ({
      nivel: 'espacio' as const,
      id: e.id,
      nombre: e.nombre,
      codigo: e.nombre,
      padreId: BLOQUE_MOCK_ID,
      criterio: 'Carga nominal de equipos (kWh/mes)',
      peso: e.carga,
      share: shareBloque * (e.carga / CARGA_BLOQUE_MOCK),
      consumoPromedio: (media * shareBloque * e.carga) / CARGA_BLOQUE_MOCK,
    })),
  ]
}

/** Métricas espejo del dry-run real (BD con 49 meses). */
export async function calcularModelosLineaBase(
  solicitud: {
    tipo: 'global' | 'bloque' | 'espacio'
    id?: string | null
    edificacionId?: string | null
  }
): Promise<RespuestaCalculo> {
  const tipo = solicitud?.tipo
  if (tipo !== 'global' && tipo !== 'bloque' && tipo !== 'espacio') {
    return { ok: false, error: 'Alcance inválido.' }
  }
  if (tipo !== 'global' && !solicitud.id) {
    return { ok: false, error: 'Debe seleccionar un bloque o un espacio.' }
  }

  // Ámbito de edificación: null/ausente = todas (paridad con la action real)
  const nombreEdificacion =
    typeof solicitud.edificacionId === 'string' && solicitud.edificacionId
      ? (edificacionesDemo.find((e) => e.id === solicitud.edificacionId)
          ?.nombre ?? null)
      : null
  if (solicitud.edificacionId && !nombreEdificacion) {
    return { ok: false, error: 'La edificación seleccionada ya no existe.' }
  }
  const nombreGlobal = nombreEdificacion ?? 'Todas las edificaciones'
  const criterioGlobal = nombreEdificacion
    ? 'Facturas de energía (de la edificación, kWh/mes)'
    : 'Facturas de energía (todas las edificaciones, kWh/mes)'

  // Ramas de error deterministas (id del bloque seleccionado).
  const errorMock = solicitud.id ? ERRORES_SHARE_MOCK[solicitud.id] : undefined
  if (errorMock) return { ok: false, error: errorMock }

  // ── Criterio de share: mismo árbol de decisión que la action real ──
  const idBloque =
    tipo === 'espacio' ? BLOQUE_MOCK_ID : (solicitud.id ?? BLOQUE_MOCK_ID)
  const origen: OrigenShare = BLOQUES_SIN_AREA_MOCK.has(idBloque)
    ? 'modelo_ingenieria'
    : 'facturas_area'
  const shareBloque =
    origen === 'facturas_area' ? 1 : CARGA_BLOQUE_MOCK / MEDIA_CAMPUS_MOCK

  const aula = JERARQUIA_ESPACIOS.find((e) => e.id === 'esp-aula-mayor')
  const shareEspacio = aula ? aula.carga / CARGA_BLOQUE_MOCK : 0
  const share =
    tipo === 'global'
      ? 1
      : tipo === 'espacio'
        ? shareBloque * shareEspacio
        : shareBloque

  const alcance: CalculoLineaBase['alcance'] =
    tipo === 'global'
      ? {
          tipo: 'global',
          id: null,
          nombre: nombreGlobal,
          codigo: 'GLOBAL',
          bloqueId: null,
          share: 1,
          origen,
        }
      : tipo === 'bloque'
        ? {
            tipo: 'bloque',
            id: solicitud.id ?? BLOQUE_MOCK_ID,
            nombre: 'Bloque de Aulas Mayores',
            codigo: 'BLOQUE-A-001',
            bloqueId: solicitud.id ?? BLOQUE_MOCK_ID,
            share,
            origen,
          }
        : {
            tipo: 'espacio',
            id: solicitud.id ?? null,
            nombre: 'Aula Mayor',
            codigo: 'BLOQUE-A-001 › Aula Mayor',
            bloqueId: BLOQUE_MOCK_ID,
            share,
            origen,
          }

  const calculo: CalculoLineaBase = {
    alcance,
    origen,
    ...(origen === 'modelo_ingenieria' ? { aviso: AVISO_ESTIMADO_MOCK } : {}),
    originales: 49,
    depurados: 48,
    minMeses: 36,
    criterioDepuracion: 'banda_10_pct',
    desvEst: null,
    kIntervalo: null,
    bandas: BANDAS_MOCK,
    mesesInsuficientes: [],
    minValoresMes: 3,
    variablesRegresion: [
      'poblacion_fija',
      'poblacion_flotante',
      'grades_dia_enfriamiento',
    ],
    ajustesAplicados: [],
    resultados: resultadosMock(share),
    serie: serieMock(share),
    preparacion: preparacionMock(share),
    jerarquia: jerarquiaMock(origen, nombreGlobal, criterioGlobal),
    calculadoEn: '2026-10-01T10:00:00.000Z',
  }
  return { ok: true, calculo }
}

export async function guardarLineaBase(input: {
  bloqueId?: string
  edificacionId?: string
  modelo: ModeloLbenId
  resultado: Record<string, unknown>
  depurados?: number
  mesesInsuficientes?: number[]
  origen?: OrigenShare
}): Promise<RespuestaGuardar> {
  if (!input?.bloqueId && !input?.edificacionId) {
    return { ok: false, error: 'Selecciona un bloque o la edificación completa.' }
  }
  // La action real guarda igual con < 36 meses y devuelve `advertencia`.
  const advertencia =
    advertenciaMinimos({
      mesesFacturados: 49,
      depurados: input.depurados ?? 48,
      mesesInsuficientes: input.mesesInsuficientes ?? [],
    }) ?? undefined
  return {
    ok: true,
    mensaje: 'Línea base guardada.',
    ...(advertencia ? { advertencia } : {}),
  }
}
