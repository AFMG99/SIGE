import { z } from 'zod'

export const periodicidadReporteSchema = z.enum(['mes', 'semestre', 'ano'])
export type PeriodicidadReporte = z.infer<typeof periodicidadReporteSchema>

export const modeloClaveReporteSchema = z.enum([
  'auto',
  'valor_absoluto',
  'cociente',
  'regresion',
  'confort',
])
export type ModeloClaveReporte = z.infer<typeof modeloClaveReporteSchema>

export const formatoDescargaSchema = z.enum(['pdf', 'docx'])
export type FormatoDescarga = z.infer<typeof formatoDescargaSchema>

export const filtroReporteSchema = z.object({
  edificacionId: z.string().min(1, 'Seleccione una edificación'),
  bloqueId: z.string().optional(),
  periodicidad: periodicidadReporteSchema.default('mes'),
  periodoInicio: z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM').optional(),
  periodoFin: z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM').optional(),
  modeloClave: modeloClaveReporteSchema.default('auto'),
})
export type FiltroReporte = z.infer<typeof filtroReporteSchema>

export const solicitudDescargaReporteSchema = filtroReporteSchema.extend({
  formato: formatoDescargaSchema.default('pdf'),
})

// ==========================================
// Estructuras de Contenido UPME 0016
// ==========================================

export interface SeccionGeneralidadesUPME {
  institucion: string
  nit: string
  sede: string
  edificacionNombre: string
  bloqueCodigo: string | null
  bloqueNombre: string | null
  areaUtilM2: number | null
  fuentesEnergia: string[]
  ocupantes: {
    poblacionFija: number | null
    poblacionFlotante: number | null
    total: number | null
  }
  actividades: string
  fechaGeneracion: string
  responsableNombre: string
  responsableRol: string
}

export interface CategoriaEquipoResumen {
  categoria: string
  cantidad: number
  potenciaTotalKw: number
  participacionPct: number
}

export interface SeccionInventarioUPME {
  totalEquipos: number
  potenciaTotalKw: number
  categorias: CategoriaEquipoResumen[]
}

export interface FilaHistoricoReporte {
  periodo: string
  consumoKwh: number
  consumoNormalizado: number
  diasFacturados: number
  costoCop: number
  esAtipico: boolean | null
  motivoAtipico?: string
}

export interface SeccionHistoricoUPME {
  totalFacturas: number
  facturasDentroBanda: number | null
  facturasAtipicas: number | null
  consumoTotalKwh: number
  costoTotalCop: number
  consumoPromedioMensualKwh: number | null
  desviacionEstandarKwh: number | null
  rangoPeriodos: string
  filas: FilaHistoricoReporte[]
}

export interface EstadisticosModeloUPME {
  r2: number | null
  pValor: number | null
  mape: number | null
  ecuacion: string | null
  variables: string[]
}

export interface SeccionLineaBaseUPME {
  modeloSeleccionado: string
  modeloClave: string
  periodoBase: string
  consumoBaseMensualKwh: number | null
  desviacionEstandarKwh: number | null
  bandaInferiorKwh: number | null
  bandaSuperiorKwh: number | null
  estadisticos: EstadisticosModeloUPME
  criterioAprobacion: string
  alcanzaMinimo36Facturas: boolean
}

export interface FilaAhorroMensualUPME {
  mes: string
  mesNumero: number
  consumoBaseKwh: number
  metaConsumoKwh: number
  ahorroKwh: number
  ahorroPct: number
}

export interface MedidaEficienciaUPME {
  tipo: 'BPO' | 'Medida Pasiva' | 'Medida Activa'
  medida: string
  ahorroEstimadoPct: number | null
  descripcion: string
}

export interface SeccionAhorrosUPME {
  metaAhorroAnualKwh: number | null
  metaAhorroAnualPct: number | null
  ahorrosMensuales: FilaAhorroMensualUPME[]
  medidasEficiencia: MedidaEficienciaUPME[]
}

export interface ItemAjusteUPME {
  id: string
  tipo: string
  descripcion: string
  periodo: string
  /** Proporción (Pr) del ajuste, expresada en porcentaje (0–100). */
  valorAjustePct: number
  observaciones: string | null
}

export interface SeccionAjustesUPME {
  totalAjustes: number
  items: ItemAjusteUPME[]
}

export interface DatosReporteUPME {
  generalidades: SeccionGeneralidadesUPME
  inventario: SeccionInventarioUPME
  historico: SeccionHistoricoUPME
  lineaBase: SeccionLineaBaseUPME
  ahorros: SeccionAhorrosUPME
  ajustes: SeccionAjustesUPME
}

export function agruparFacturasPorPeriodicidad(
  facturas: FilaHistoricoReporte[],
  periodicidad: PeriodicidadReporte
): FilaHistoricoReporte[] {
  const grupos = new Map<string, FilaHistoricoReporte[]>()

  for (const factura of facturas) {
    const [ano, mes] = factura.periodo.split('-')
    const mesNumero = Number(mes)
    const periodo =
      periodicidad === 'ano'
        ? ano
        : periodicidad === 'semestre'
        ? `${ano}-S${mesNumero <= 6 ? 1 : 2}`
        : factura.periodo
    const grupo = grupos.get(periodo) ?? []
    grupo.push(factura)
    grupos.set(periodo, grupo)
  }

  return Array.from(grupos, ([periodo, filas]) => {
    const clasificacionDisponible = filas.every((fila) => fila.esAtipico !== null)
    const atipicos = filas.filter((fila) => fila.esAtipico).length
    return {
      periodo,
      consumoKwh: filas.reduce((total, fila) => total + fila.consumoKwh, 0),
      consumoNormalizado: filas.reduce(
        (total, fila) => total + fila.consumoNormalizado,
        0
      ),
      diasFacturados: filas.reduce((total, fila) => total + fila.diasFacturados, 0),
      costoCop: filas.reduce((total, fila) => total + fila.costoCop, 0),
      esAtipico: clasificacionDisponible ? atipicos > 0 : null,
      motivoAtipico:
        clasificacionDisponible && atipicos > 0
          ? `${atipicos} de ${filas.length} mes(es) fuera de la banda de la LBEn`
          : undefined,
    }
  })
}

// Catálogo de medidas tipo según Resolución UPME 0016 de 2024 (Anexo 5)
export const MEDIDAS_EFICIENCIA_UPME_DEFECTO: MedidaEficienciaUPME[] = [
  {
    tipo: 'BPO',
    medida: 'Ajuste de consignas de temperatura en sistemas de climatización a 24°C',
    ahorroEstimadoPct: null,
    descripcion: 'Modificación de hábitos y consignas de climatización según confort térmico y ocupación real.',
  },
  {
    tipo: 'BPO',
    medida: 'Apagado automático o supervisado de luminarias y equipos ofimáticos fuera de jornada',
    ahorroEstimadoPct: null,
    descripcion: 'Control operativo de cargas fantasma y desconexión en horarios no lectivos.',
  },
  {
    tipo: 'Medida Pasiva',
    medida: 'Películas de control solar y sombreado en ventanas perimetrales',
    ahorroEstimadoPct: null,
    descripcion: 'Reducción de ganancia térmica solar para disminuir carga de refrigeración (ASHRAE 90.1).',
  },
  {
    tipo: 'Medida Activa',
    medida: 'Migración a luminarias LED de alta eficacia (>120 lm/W)',
    ahorroEstimadoPct: null,
    descripcion: 'Sustitución de tubos fluorescentes restantes y reflectores halógenos.',
  },
  {
    tipo: 'Medida Activa',
    medida: 'Renovación y sectorización de acondicionadores de aire tipo Inverter',
    ahorroEstimadoPct: null,
    descripcion: 'Reemplazo de unidades de ventana y sistemas convencionales por tecnología de volumen de refrigerante variable.',
  },
]
