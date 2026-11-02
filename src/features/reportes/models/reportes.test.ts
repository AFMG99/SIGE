import { describe, it, expect } from 'vitest'
import {
  agruparFacturasPorPeriodicidad,
  filtroReporteSchema,
  MEDIDAS_EFICIENCIA_UPME_DEFECTO,
  solicitudDescargaReporteSchema,
} from './reportes'

describe('reportes model schemas and defaults', () => {
  it('validates a valid filtroReporte', () => {
    const input = {
      edificacionId: 'edif-123',
      bloqueId: 'bloque-456',
      periodicidad: 'mes',
      periodoInicio: '2023-01',
      periodoFin: '2025-12',
      modeloClave: 'valor_absoluto',
    }

    const resultado = filtroReporteSchema.safeParse(input)
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.edificacionId).toBe('edif-123')
      expect(resultado.data.periodicidad).toBe('mes')
    }
  })

  it('fails when edificacionId is empty', () => {
    const input = {
      edificacionId: '',
    }
    const resultado = filtroReporteSchema.safeParse(input)
    expect(resultado.success).toBe(false)
  })

  it('fails when date format is invalid', () => {
    const input = {
      edificacionId: 'edif-1',
      periodoInicio: '2024/01',
    }
    const resultado = filtroReporteSchema.safeParse(input)
    expect(resultado.success).toBe(false)
  })

  it('rejects unsupported download formats instead of falling back to PDF', () => {
    const resultado = solicitudDescargaReporteSchema.safeParse({
      edificacionId: 'edif-123',
      formato: 'xlsx',
    })
    expect(resultado.success).toBe(false)
  })

  it('keeps recommended measures without invented savings percentages', () => {
    expect(MEDIDAS_EFICIENCIA_UPME_DEFECTO.length).toBeGreaterThanOrEqual(3)
    for (const m of MEDIDAS_EFICIENCIA_UPME_DEFECTO) {
      expect(m.ahorroEstimadoPct).toBeNull()
      expect(['BPO', 'Medida Pasiva', 'Medida Activa']).toContain(m.tipo)
    }
  })

  it('aggregates invoices by semester and year while preserving unknown classification', () => {
    const facturas = [
      {
        periodo: '2024-01',
        consumoKwh: 100,
        consumoNormalizado: 110,
        diasFacturados: 28,
        costoCop: 500,
        esAtipico: false,
      },
      {
        periodo: '2024-07',
        consumoKwh: 200,
        consumoNormalizado: 220,
        diasFacturados: 31,
        costoCop: 900,
        esAtipico: null,
      },
    ]

    expect(agruparFacturasPorPeriodicidad(facturas, 'semestre')).toEqual([
      {
        periodo: '2024-S1',
        consumoKwh: 100,
        consumoNormalizado: 110,
        diasFacturados: 28,
        costoCop: 500,
        esAtipico: false,
        motivoAtipico: undefined,
      },
      {
        periodo: '2024-S2',
        consumoKwh: 200,
        consumoNormalizado: 220,
        diasFacturados: 31,
        costoCop: 900,
        esAtipico: null,
        motivoAtipico: undefined,
      },
    ])
    expect(agruparFacturasPorPeriodicidad(facturas, 'ano')).toEqual([
      {
        periodo: '2024',
        consumoKwh: 300,
        consumoNormalizado: 330,
        diasFacturados: 59,
        costoCop: 1400,
        esAtipico: null,
        motivoAtipico: undefined,
      },
    ])
  })
})
