import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { DATOS_REPORTE_FIXTURE } from '../views/__fixtures__/reportes.fixtures'
import { generarDocumentoDocxBuffer } from './generadorDocx'
import { generarDocumentoPdfBuffer } from './generadorPdf'
import type { DatosReporteUPME } from '../models/reportes'

describe('Generadores de documentos (Word y PDF)', () => {
  it('generates a valid docx buffer with PK zip magic bytes and saves to disk', async () => {
    const buffer = await generarDocumentoDocxBuffer(DATOS_REPORTE_FIXTURE)
    expect(buffer).toBeDefined()
    expect(buffer.length).toBeGreaterThan(5000)

    // Los archivos .docx son contenedores zip que inician con 'PK\x03\x04'
    expect(buffer[0]).toBe(0x50) // 'P'
    expect(buffer[1]).toBe(0x4b) // 'K'
    expect(buffer[2]).toBe(0x03)
    expect(buffer[3]).toBe(0x04)

    // Escribir a disco temporal para validar persistencia física
    const tempPath = path.join(process.cwd(), 'scratch', 'test-output-reporte.docx')
    fs.mkdirSync(path.dirname(tempPath), { recursive: true })
    fs.writeFileSync(tempPath, buffer)
    expect(fs.existsSync(tempPath)).toBe(true)
    const stats = fs.statSync(tempPath)
    expect(stats.size).toBeGreaterThan(5000)
    fs.unlinkSync(tempPath)
  })

  it('generates a valid pdf buffer with %PDF- header magic bytes and saves to disk', () => {
    const buffer = generarDocumentoPdfBuffer(DATOS_REPORTE_FIXTURE)
    expect(buffer).toBeDefined()
    expect(buffer.length).toBeGreaterThan(5000)

    // Los archivos PDF inician con '%PDF-'
    const header = buffer.subarray(0, 5).toString('ascii')
    expect(header).toBe('%PDF-')

    // Validar que el PDF contiene el marcador de fin de archivo '%%EOF'
    const tail = buffer.subarray(buffer.length - 128).toString('ascii')
    expect(tail).toContain('%%EOF')

    // Escribir a disco temporal para validar persistencia física
    const tempPath = path.join(process.cwd(), 'scratch', 'test-output-reporte.pdf')
    fs.mkdirSync(path.dirname(tempPath), { recursive: true })
    fs.writeFileSync(tempPath, buffer)
    expect(fs.existsSync(tempPath)).toBe(true)
    const stats = fs.statSync(tempPath)
    expect(stats.size).toBeGreaterThan(5000)
    fs.unlinkSync(tempPath)
  })

  it('handles missing measurements and empty related sections', async () => {
    const datosBorde: DatosReporteUPME = {
      ...DATOS_REPORTE_FIXTURE,
      generalidades: {
        ...DATOS_REPORTE_FIXTURE.generalidades,
        areaUtilM2: null,
        ocupantes: {
          poblacionFija: null,
          poblacionFlotante: null,
          total: null,
        },
      },
      historico: {
        ...DATOS_REPORTE_FIXTURE.historico,
        facturasDentroBanda: null,
        facturasAtipicas: null,
        consumoPromedioMensualKwh: null,
        desviacionEstandarKwh: null,
        filas: DATOS_REPORTE_FIXTURE.historico.filas.map((fila) => ({
          ...fila,
          esAtipico: null,
        })),
      },
      ajustes: { totalAjustes: 0, items: [] },
      inventario: { totalEquipos: 0, potenciaTotalKw: 0, categorias: [] },
      lineaBase: {
        ...DATOS_REPORTE_FIXTURE.lineaBase,
        alcanzaMinimo36Facturas: false,
        consumoBaseMensualKwh: null,
        desviacionEstandarKwh: null,
        bandaInferiorKwh: null,
        bandaSuperiorKwh: null,
        criterioAprobacion: 'Sin LBEn guardada',
        estadisticos: {
          r2: null,
          pValor: null,
          mape: null,
          ecuacion: null,
          variables: [],
        },
      },
      ahorros: {
        ...DATOS_REPORTE_FIXTURE.ahorros,
        metaAhorroAnualKwh: null,
        metaAhorroAnualPct: null,
        medidasEficiencia: DATOS_REPORTE_FIXTURE.ahorros.medidasEficiencia.map((medida) => ({
          ...medida,
          ahorroEstimadoPct: null,
        })),
      },
    }

    const docxBuffer = await generarDocumentoDocxBuffer(datosBorde)
    expect(docxBuffer.length).toBeGreaterThan(2000)
    expect(docxBuffer[0]).toBe(0x50)

    const pdfBuffer = generarDocumentoPdfBuffer(datosBorde)
    expect(pdfBuffer.length).toBeGreaterThan(2000)
    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })
})
