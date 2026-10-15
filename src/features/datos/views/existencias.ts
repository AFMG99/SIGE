/**
 * Datos ya almacenados en PostgreSQL que se muestran en la pestaña
 * "Visualización" de Facturas/Equipos (`VistaDatos`) y que alimentan
 * Variables Operativas y Líneas Base.
 *
 * En producción los construye `page.tsx` con Prisma; en Storybook se usan los
 * fixtures de `__fixtures__/existencias.ts`. Los builders de este archivo
 * convierten los datos de dominio en el view-model puro (incluido el bloque
 * `grafico`) sin React, para que el componente sea solo presentación.
 */

export type FacturaExistente = {
  /** Id de la factura en BD; lo usa la pestaña "Gestión" para editar/eliminar. */
  id: string
  periodo: string
  diasFacturados: number
  consumoKwh: number
  costoCop: number
  /** Nombre de la edificación a la que pertenece la factura (FK requerida). */
  edificacion: string
}

export type FacturasExistentes = {
  /** Total de registros guardados en la base de datos. */
  total: number
  consumoTotalKwh: number
  costoTotalCop: number
  ultimoPeriodo: string | null
  /** Hasta las 50 filas más recientes. */
  filas: FacturaExistente[]
}

export type EquipoExistente = {
  id: string
  edificacion: string
  bloqueCodigo: string
  bloqueNombre: string
  espacio: string
  tipo: string
  cantidad: number
  potenciaNominal: number
}

export type EquiposExistentes = {
  /** Total de registros guardados en la base de datos. */
  total: number
  potenciaTotalKw: number
  edificacionesConInventario: number
  bloquesConInventario: number
  /** Hasta las 50 filas más recientes. */
  filas: EquipoExistente[]
}

/** Variable operativa guardada, con el periodo y el bloque ya resueltos. */
export type VariableExistente = {
  /** Id del registro en BD; lo usa la pestaña "Gestión" para editar/eliminar. */
  id: string
  periodo: string
  bloqueCodigo: string
  bloqueNombre: string
  poblacionFija: number
  poblacionFlotante: number
  diasLectivosLaborales: number
  gradesDiaEnfriamiento: number
}

export type VariablesExistentes = {
  /** Total de registros guardados en la base de datos. */
  total: number
  ultimoPeriodo: string | null
  /** Promedio de población flotante por registro. */
  poblacionFlotantePromedio: number
  /** Promedio del GDE (Grados Día de Enfriamiento) de los registros. */
  gradesDiaEnfriamientoPromedio: number
  /** Hasta las 50 filas más recientes. */
  filas: VariableExistente[]
}

/** Gráfico de barras animado de la vista de visualización. */
export type GraficoVM = {
  tipo: 'barras' | 'barrasH'
  titulo: string
  datos: { etiqueta: string; valor: number; tooltip: string }[]
}

/** Ajuste energético guardado, con bloque y edificación ya resueltos. */
export type AjusteExistente = {
  /** Id del registro en BD; lo usa la pestaña "Gestión" para eliminarlo. */
  id: string
  bloqueCodigo: string
  bloqueNombre: string
  edificacion: string
  /** `AjusteEnergetico.tipo`: RUTINARIO | NO_RUTINARIO. */
  tipo: string
  /** Periodo cubierto por el ajuste, `YYYY-MM-DD` → `YYYY-MM-DD`. */
  periodo: string
  /** Variación en porcentaje (p. ej. 8.5 = 8,5 %). */
  valorAjuste: number
  observaciones: string | null
}

export type AjustesExistentes = {
  /** Total de registros guardados en la base de datos. */
  total: number
  /** Bloques distintos con al menos un ajuste. */
  bloquesConAjustes: number
  /** Promedio del valor de ajuste (%). */
  valorAjustePromedio: number
  /** Desglose por tipo: rutinarios / no rutinarios. */
  rutinarios: number
  noRutinarios: number
  /** Hasta las 50 filas más recientes. */
  filas: AjusteExistente[]
}

/** Línea base guardada (bloque o edificación + modelo) para la tabla de gestión. */
export type LineaBaseExistente = {
  /** Id del registro en BD; lo usa "Gestión de Facturas" para eliminarlo. */
  id: string
  /** Código del bloque; `null` cuando la línea base es de la edificación completa. */
  bloqueCodigo: string | null
  bloqueNombre: string | null
  /** Nombre de la edificación completa (solo en filas sin bloque). */
  edificacionNombre: string | null
  /** `LineaBaseEnergia.tipo` en BD (VALOR_ABSOLUTO, COCIENTE, …). */
  tipo: string
  r2: number | null
  /** Fecha de guardado `YYYY-MM-DD`. */
  guardadaEn: string
}

/** View-model puro que consume el componente `VistaDatos`. */
export type PanelDatosVM = {
  tono: 'emerald' | 'amber' | 'sky' | 'purple'
  titulo: string
  descripcion: string
  total: number
  chips: { etiqueta: string; valor: string }[]
  grafico: GraficoVM
  columnas: { id: string; etiqueta: string; derecha?: boolean }[]
  filas: { id: string; celdas: string[] }[]
  nota: string
  vacio: { titulo: string; descripcion: string }
}

const fmtEntero = new Intl.NumberFormat('es-CO')
const fmtDecimal2 = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const fmtKw = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })

/** Fecha `Date` → `YYYY-MM-DD` (sin depender de la zona horaria del servidor). */
const fechaCorta = (fecha: Date | string): string => new Date(fecha).toISOString().slice(0, 10)

export function construirPanelFacturas(existentes: FacturasExistentes): PanelDatosVM {
  return {
    tono: 'emerald',
    titulo: 'Datos en la base de datos',
    descripcion: 'Facturas de energía guardadas que alimentan el histórico de consumo',
    total: existentes.total,
    chips: [
      { etiqueta: 'Registros guardados', valor: fmtEntero.format(existentes.total) },
      { etiqueta: 'Último periodo', valor: existentes.ultimoPeriodo ?? '—' },
      { etiqueta: 'Consumo total (kWh)', valor: fmtEntero.format(existentes.consumoTotalKwh) },
      {
        etiqueta: 'Costo acumulado (COP)',
        valor: `$ ${fmtEntero.format(existentes.costoTotalCop)}`,
      },
    ],
    grafico: {
      tipo: 'barras',
      titulo: 'Consumo mensual (kWh)',
      datos: [...existentes.filas].reverse().map((f) => ({
        etiqueta: f.periodo.slice(5),
        valor: f.consumoKwh,
        tooltip: `${f.periodo} · ${fmtDecimal2.format(f.consumoKwh)} kWh`,
      })),
    },
    columnas: [
      { id: 'periodo', etiqueta: 'Periodo' },
      { id: 'edificacion', etiqueta: 'Edificación' },
      { id: 'dias', etiqueta: 'Días facturados', derecha: true },
      { id: 'consumo', etiqueta: 'Consumo (kWh)', derecha: true },
      { id: 'costo', etiqueta: 'Costo (COP)', derecha: true },
    ],
    filas: existentes.filas.map((f) => ({
      id: f.periodo,
      celdas: [
        f.periodo,
        f.edificacion,
        String(f.diasFacturados),
        fmtDecimal2.format(f.consumoKwh),
        `$ ${fmtEntero.format(f.costoCop)}`,
      ],
    })),
    nota: 'La serie de periodos guardada es el consumo histórico que alimenta el diseño de las Líneas Base (Valor absoluto · Cociente · Regresión).',
    vacio: {
      titulo: 'Aún no hay facturas guardadas',
      descripcion:
        'Importe la primera factura de energía para iniciar el histórico de consumo de la institución.',
    },
  }
}

export function construirPanelEquipos(existentes: EquiposExistentes): PanelDatosVM {
  return {
    tono: 'amber',
    titulo: 'Datos en la base de datos',
    descripcion: 'Inventario guardado que estructura bloques, espacios y cargas',
    total: existentes.total,
    chips: [
      { etiqueta: 'Equipos registrados', valor: fmtEntero.format(existentes.total) },
      { etiqueta: 'Potencia instalada (kW)', valor: fmtKw.format(existentes.potenciaTotalKw) },
      {
        etiqueta: 'Edificaciones con inventario',
        valor: fmtEntero.format(existentes.edificacionesConInventario),
      },
      {
        etiqueta: 'Bloques con inventario',
        valor: fmtEntero.format(existentes.bloquesConInventario),
      },
    ],
    grafico: {
      tipo: 'barrasH',
      titulo: 'Equipos por edificación',
      datos: (() => {
        const porEdificacion: Record<string, number> = {}
        for (const e of existentes.filas) {
          porEdificacion[e.edificacion] = (porEdificacion[e.edificacion] ?? 0) + e.cantidad
        }
        return Object.keys(porEdificacion).map((etiqueta) => {
          const valor = porEdificacion[etiqueta]
          return { etiqueta, valor, tooltip: `${fmtEntero.format(valor)} equipos` }
        })
      })(),
    },
    columnas: [
      { id: 'edificacion', etiqueta: 'Edificación' },
      { id: 'bloque', etiqueta: 'Bloque' },
      { id: 'espacio', etiqueta: 'Espacio' },
      { id: 'tipo', etiqueta: 'Tipo' },
      { id: 'cantidad', etiqueta: 'Cantidad', derecha: true },
      { id: 'potencia', etiqueta: 'Potencia (kW)', derecha: true },
    ],
    filas: existentes.filas.map((e) => ({
      id: e.id,
      celdas: [
        e.edificacion,
        `${e.bloqueCodigo} — ${e.bloqueNombre}`,
        e.espacio,
        e.tipo,
        String(e.cantidad),
        fmtKw.format(e.potenciaNominal),
      ],
    })),
    nota: 'Cada equipo guardado define la carga por espacio que estructura el inventario base para el diseño de las Líneas Base y las Variables Operativas.',
    vacio: {
      titulo: 'El inventario todavía está vacío',
      descripcion:
        'Cargue los equipos por edificación para poblar bloques, espacios y cargas potenciales.',
    },
  }
}

export function construirPanelVariables(existentes: VariablesExistentes): PanelDatosVM {
  return {
    tono: 'sky',
    titulo: 'Datos en la base de datos',
    descripcion: 'Variables operativas guardadas: población y clima por bloque y periodo',
    total: existentes.total,
    chips: [
      { etiqueta: 'Registros guardados', valor: fmtEntero.format(existentes.total) },
      { etiqueta: 'Último periodo', valor: existentes.ultimoPeriodo ?? '—' },
      {
        etiqueta: 'Población flotante prom.',
        valor: fmtEntero.format(existentes.poblacionFlotantePromedio),
      },
      {
        etiqueta: 'GDE promedio',
        valor: fmtDecimal2.format(existentes.gradesDiaEnfriamientoPromedio),
      },
    ],
    grafico: {
      tipo: 'barras',
      titulo: 'GDE mensual (Grados Día de Enfriamiento)',
      datos: [...existentes.filas].reverse().map((v) => ({
        etiqueta: v.periodo.slice(5),
        valor: v.gradesDiaEnfriamiento,
        tooltip: `${v.periodo} · ${v.bloqueCodigo} · GDE ${fmtDecimal2.format(v.gradesDiaEnfriamiento)}`,
      })),
    },
    columnas: [
      { id: 'periodo', etiqueta: 'Periodo' },
      { id: 'bloque', etiqueta: 'Bloque' },
      { id: 'poblacionFija', etiqueta: 'Pob. fija', derecha: true },
      { id: 'poblacionFlotante', etiqueta: 'Pob. flotante', derecha: true },
      { id: 'dias', etiqueta: 'Días lectivos/laborales', derecha: true },
      { id: 'gde', etiqueta: 'GDE', derecha: true },
    ],
    filas: existentes.filas.map((v) => ({
      id: v.id,
      celdas: [
        v.periodo,
        `${v.bloqueCodigo} — ${v.bloqueNombre}`,
        fmtEntero.format(v.poblacionFija),
        fmtEntero.format(v.poblacionFlotante),
        String(v.diasLectivosLaborales),
        fmtDecimal2.format(v.gradesDiaEnfriamiento),
      ],
    })),
    nota: 'Cada registro aporta la población fija y flotante y el GDE que ajustan el consumo normalizado al contexto operativo de cada bloque.',
    vacio: {
      titulo: 'Aún no hay variables operativas',
      descripcion:
        'Importe la población y el clima por bloque y periodo para contextualizar el consumo de las Líneas Base.',
    },
  }
}

export function construirPanelAjustes(existentes: AjustesExistentes): PanelDatosVM {
  return {
    tono: 'purple',
    titulo: 'Datos en la base de datos',
    descripcion: 'Ajustes energéticos guardados: variaciones rutinarias y no rutinarias por bloque',
    total: existentes.total,
    chips: [
      { etiqueta: 'Registros guardados', valor: fmtEntero.format(existentes.total) },
      { etiqueta: 'Bloques con ajustes', valor: fmtEntero.format(existentes.bloquesConAjustes) },
      {
        etiqueta: 'Ajuste promedio',
        valor: `${fmtDecimal2.format(existentes.valorAjustePromedio)} %`,
      },
      {
        etiqueta: 'Rutinarios / No rutinarios',
        valor: `${fmtEntero.format(existentes.rutinarios)} / ${fmtEntero.format(existentes.noRutinarios)}`,
      },
    ],
    grafico: {
      tipo: 'barras',
      titulo: 'Valor del ajuste (%)',
      datos: [...existentes.filas].reverse().map((a) => ({
        etiqueta: `${a.bloqueCodigo} · ${a.tipo === 'NO_RUTINARIO' ? 'No rut.' : 'Rut.'}`,
        // `VistaDatos` no tiene línea base en cero: la barra mide magnitud y
        // el signo vive en el tooltip y en la tabla.
        valor: Math.abs(a.valorAjuste),
        tooltip: `${a.bloqueCodigo} · ${a.tipo} · ${fmtDecimal2.format(a.valorAjuste)} %`,
      })),
    },
    columnas: [
      { id: 'bloque', etiqueta: 'Bloque' },
      { id: 'tipo', etiqueta: 'Tipo' },
      { id: 'periodo', etiqueta: 'Periodo' },
      { id: 'valor', etiqueta: 'Valor', derecha: true },
      { id: 'observaciones', etiqueta: 'Observaciones' },
    ],
    filas: existentes.filas.map((a) => ({
      id: a.id,
      celdas: [
        `${a.bloqueCodigo} — ${a.bloqueNombre}`,
        a.tipo === 'NO_RUTINARIO' ? 'No rutinario' : 'Rutinario',
        a.periodo,
        `${fmtDecimal2.format(a.valorAjuste)} %`,
        a.observaciones ?? '—',
      ],
    })),
    nota: 'Los ajustes registran variaciones conocidas del consumo (estacionalidad, remodelaciones, paradas). Vaciarlos desde la pestaña Gestión libera el catálogo de bloques para su eliminación.',
    vacio: {
      titulo: 'Aún no hay ajustes energéticos',
      descripcion:
        'Los ajustes rutinarios y no rutinarios de cada bloque aparecerán aquí cuando se registren.',
    },
  }
}
