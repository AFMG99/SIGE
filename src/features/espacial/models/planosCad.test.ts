import { describe, expect, it } from 'vitest'
import {
  aplicarUnidades,
  CAPA_ESPACIOS_CAD_PREFIX,
  extraerDxf,
} from './planosCad'

const capaEspacios = `${CAPA_ESPACIOS_CAD_PREFIX}PISO_1`

const dxfContornos = [
  '0', 'SECTION', '2', 'HEADER',
  '9', '$INSUNITS', '70', '4',
  '0', 'ENDSEC',
  '0', 'SECTION', '2', 'TABLES',
  '0', 'TABLE', '2', 'LAYER', '70', '1',
  '0', 'LAYER', '2', capaEspacios, '70', '0', '62', '7', '6', 'CONTINUOUS',
  '0', 'ENDTAB', '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES',
  '0', 'LWPOLYLINE', '8', capaEspacios, '5', 'A1', '90', '4', '70', '1',
  '10', '0', '20', '0', '10', '6000', '20', '0', '10', '6000', '20', '8000', '10', '0', '20', '8000',
  '0', 'TEXT', '8', capaEspacios, '10', '2000', '20', '3000', '40', '250', '1', 'Aula 101',
  '0', 'ENDSEC', '0', 'EOF',
].join('\n')

describe('extracción DXF para planos espaciales', () => {
  it('extrae recintos cerrados de capas SIGE, etiquetas y unidades', () => {
    const resultado = extraerDxf(dxfContornos)
    const [candidato] = aplicarUnidades(resultado, resultado.unidadesDetectadas)

    expect(resultado.capas).toContain(capaEspacios)
    expect(resultado.contornos).toHaveLength(1)
    expect(candidato).toMatchObject({
      etiqueta: 'Aula 101',
      largoM: 8,
      anchoM: 6,
      areaM2: 48,
    })
  })

  it('calcula el área real de un recinto irregular y no su rectángulo envolvente', () => {
    const polygon = [
      '0', 'LWPOLYLINE', '8', capaEspacios, '5', 'B1', '90', '6', '70', '1',
      '10', '0', '20', '0',
      '10', '6000', '20', '0',
      '10', '6000', '20', '2000',
      '10', '4000', '20', '2000',
      '10', '4000', '20', '4000',
      '10', '0', '20', '4000',
    ].join('\n')
    const source = dxfContornos.replace(
      ['0', 'ENDSEC', '0', 'EOF'].join('\n'),
      `${polygon}\n0\nENDSEC\n0\nEOF`
    )
    const candidate = aplicarUnidades(extraerDxf(source), 4).find(
      (contour) => contour.id === 'B1'
    )

    expect(candidate).toBeDefined()
    expect(candidate).toMatchObject({
      largoM: 6,
      anchoM: 4,
      areaM2: 20,
    })
  })

  it('no ofrece rectángulos de columnas de capas CAD normales como espacios', () => {
    const source = dxfContornos.replaceAll(capaEspacios, 'COLUMNA')
    const result = extraerDxf(source)

    expect(result.contornos).toHaveLength(0)
    expect(result.advertencias.join(' ')).toContain(CAPA_ESPACIOS_CAD_PREFIX)
  })

  it('excluye recintos con polilíneas que se cruzan a sí mismas', () => {
    const crossingPolygon = [
      '0', 'LWPOLYLINE', '8', capaEspacios, '5', 'X1', '90', '4', '70', '1',
      '10', '0', '20', '0',
      '10', '6000', '20', '4000',
      '10', '0', '20', '4000',
      '10', '4000', '20', '0',
    ].join('\n')
    const source = dxfContornos.replace(
      ['0', 'ENDSEC', '0', 'EOF'].join('\n'),
      `${crossingPolygon}\n0\nENDSEC\n0\nEOF`
    )
    const result = extraerDxf(source)

    expect(result.contornos.map((contour) => contour.id)).not.toContain('X1')
  })

  it('no inventa medidas cuando el DXF no declara unidades', () => {
    const source = dxfContornos.replace(
      ['9', '$INSUNITS', '70', '4'].join('\n'),
      ['9', '$INSUNITS', '70', '0'].join('\n')
    )
    const resultado = extraerDxf(source)

    expect(resultado.unidadesDetectadas).toBeNull()
    expect(aplicarUnidades(resultado, null)[0].areaM2).toBeNull()
    expect(resultado.advertencias[0]).toContain('no declara unidades')
  })

  it('excluye las polilíneas abiertas de las medidas importables', () => {
    const source = dxfContornos.replace(
      `LWPOLYLINE\n8\n${capaEspacios}\n5\nA1\n90\n4\n70\n1`,
      `LWPOLYLINE\n8\n${capaEspacios}\n5\nA1\n90\n4\n70\n0`
    )
    const resultado = extraerDxf(source)

    expect(resultado.contornos).toHaveLength(0)
    expect(resultado.advertencias.join(' ')).toContain('polilínea(s)')
  })

  it('rechaza documentos con contenido inválido y limita el tamaño de entrada', () => {
    expect(() => extraerDxf('not a DXF')).toThrow()
    expect(() => extraerDxf('x'.repeat(10 * 1024 * 1024 + 1))).toThrow('10 MB')
  })
})
