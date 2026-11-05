import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  Packer,
} from 'docx'
import type { DatosReporteUPME } from '../models/reportes'

const COLOR_FOREST = '00652E'
const COLOR_SLATE = '1E293B'
const COLOR_MUTED = '64748B'
const COLOR_BG_HEADER = '00652E'
const BORDER_LIGHT = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: 'CBD5E1',
}
const BORDERS_CELL = {
  top: BORDER_LIGHT,
  bottom: BORDER_LIGHT,
  left: BORDER_LIGHT,
  right: BORDER_LIGHT,
}

type AlignType = (typeof AlignmentType)[keyof typeof AlignmentType]

function parrafoTitulo(texto: string, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    text: texto,
    heading: level,
    spacing: { before: 320, after: 140 },
  })
}

function parrafoTexto(texto: string, bold = false) {
  return new Paragraph({
    children: [new TextRun({ text: texto, font: 'Calibri', size: 22, bold })],
    spacing: { after: 120 },
  })
}

function celda(
  texto: string,
  esCabecera = false,
  bold = false,
  align: AlignType = AlignmentType.LEFT
) {
  return new TableCell({
    borders: BORDERS_CELL,
    width: { size: 100, type: WidthType.PERCENTAGE },
    shading: esCabecera ? { fill: COLOR_BG_HEADER } : undefined,
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: texto,
            font: 'Calibri',
            size: esCabecera ? 20 : 19,
            bold: esCabecera || bold,
            color: esCabecera ? 'FFFFFF' : COLOR_SLATE,
          }),
        ],
      }),
    ],
  })
}

export async function generarDocumentoDocxBuffer(datos: DatosReporteUPME): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            // Márgenes estandarizados de informe institucional (3.0cm superior e izquierdo, 2.5cm inferior y derecho)
            margin: {
              top: 1701,    // 3.0 cm en twips (1440 twips = 1 pulgada = 2.54cm)
              bottom: 1417, // 2.5 cm en twips
              left: 1701,   // 3.0 cm en twips
              right: 1417,  // 2.5 cm en twips
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'SIGE - Tecnológico de Antioquia | Resolución UPME 0016 de 2024',
                    font: 'Calibri',
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Página ',
                    font: 'Calibri',
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: 'Calibri',
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    text: ' de ',
                    font: 'Calibri',
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: 'Calibri',
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Portada / Encabezado
          new Paragraph({
            text: 'INFORME DE GESTIÓN ENERGÉTICA INSTITUCIONAL',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 120 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Referencia técnica: Resolución UPME 0016 de 2024 (Artículo 237 Ley 2294 de 2023)',
                font: 'Calibri',
                size: 24,
                color: COLOR_FOREST,
                bold: true,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${datos.generalidades.institucion} — NIT: ${datos.generalidades.nit}`,
                font: 'Calibri',
                size: 20,
                color: COLOR_SLATE,
              }),
            ],
            spacing: { after: 300 },
          }),

          // 1. Generalidades
          parrafoTitulo('1. Identificación y Generalidades de la Edificación (§9.1)'),
          parrafoTexto(
            'En cumplimiento del numeral 9.1 de la Resolución UPME 0016 de 2024, se describen los parámetros operacionales y físicos de la instalación evaluada:'
          ),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  celda('Parámetro', true),
                  celda('Detalle Registrado', true),
                ],
              }),
              new TableRow({
                children: [
                  celda('Edificación / Instalación', false, true),
                  celda(datos.generalidades.edificacionNombre),
                ],
              }),
              new TableRow({
                children: [
                  celda('Bloque Evaluado', false, true),
                  celda(
                    datos.generalidades.bloqueCodigo
                      ? `${datos.generalidades.bloqueCodigo} - ${datos.generalidades.bloqueNombre}`
                      : 'Alcance consolidado de toda la edificación'
                  ),
                ],
              }),
              new TableRow({
                children: [
                  celda('Sede y Dirección', false, true),
                  celda(datos.generalidades.sede),
                ],
              }),
              new TableRow({
                children: [
                  celda('Área Útil Ocupada', false, true),
                  celda(
                    datos.generalidades.areaUtilM2 === null
                      ? 'No registrada'
                      : `${datos.generalidades.areaUtilM2.toLocaleString('es-CO')} m²`
                  ),
                ],
              }),
              new TableRow({
                children: [
                  celda('Fuentes de Energía Utilizadas', false, true),
                  celda(datos.generalidades.fuentesEnergia.join(', ')),
                ],
              }),
              new TableRow({
                children: [
                  celda('Ocupantes (Población)', false, true),
                  celda(
                    `Fija: ${datos.generalidades.ocupantes.poblacionFija ?? 'No registrada'} | Flotante: ${datos.generalidades.ocupantes.poblacionFlotante ?? 'No registrada'} | Total: ${datos.generalidades.ocupantes.total ?? 'No registrado'}`
                  ),
                ],
              }),
              new TableRow({
                children: [
                  celda('Actividades y Operaciones', false, true),
                  celda(datos.generalidades.actividades),
                ],
              }),
              new TableRow({
                children: [
                  celda('Fecha de Emisión y Responsable', false, true),
                  celda(
                    `${datos.generalidades.fechaGeneracion} por ${datos.generalidades.responsableNombre} (${datos.generalidades.responsableRol})`
                  ),
                ],
              }),
            ],
          }),

          // 2. Inventario y USEs
          parrafoTitulo('2. Inventario de Equipos y Usos Significativos de Energía (§7.1)'),
          parrafoTexto(
            `Inventario consolidado: ${datos.inventario.totalEquipos} equipos registrados con una potencia instalada total de ${datos.inventario.potenciaTotalKw.toLocaleString('es-CO')} kW.`
          ),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  celda('Categoría de Uso Final', true),
                  celda('Cantidad de Equipos', true, true, AlignmentType.RIGHT),
                  celda('Potencia Total (kW)', true, true, AlignmentType.RIGHT),
                  celda('Participación (%)', true, true, AlignmentType.RIGHT),
                ],
              }),
              ...datos.inventario.categorias.map(
                (c) =>
                  new TableRow({
                    children: [
                      celda(c.categoria),
                      celda(c.cantidad.toString(), false, false, AlignmentType.RIGHT),
                      celda(c.potenciaTotalKw.toLocaleString('es-CO'), false, false, AlignmentType.RIGHT),
                      celda(`${c.participacionPct} %`, false, false, AlignmentType.RIGHT),
                    ],
                  })
              ),
            ],
          }),

          // 3. Histórico de Consumo y Depuración
          parrafoTitulo('3. Histórico de Facturas y Clasificación frente a la LBEn (§7.2, §7.3)'),
          parrafoTexto(
            `Total de períodos analizados: ${datos.historico.totalFacturas} meses (${datos.historico.rangoPeriodos}). ` +
              `Consumo facturado total: ${datos.historico.consumoTotalKwh.toLocaleString('es-CO')} kWh. ` +
              `Media mensual: ${datos.historico.consumoPromedioMensualKwh?.toLocaleString('es-CO') ?? 'No disponible'} kWh/mes (σ = ${datos.historico.desviacionEstandarKwh?.toLocaleString('es-CO') ?? 'No disponible'} kWh). ` +
              `Facturas fuera de banda: ${datos.historico.facturasAtipicas ?? 'No clasificadas'}; meses dentro de banda: ${datos.historico.facturasDentroBanda ?? 'No disponibles'}.`
          ),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  celda('Período', true),
                  celda('Consumo Facturado (kWh)', true, true, AlignmentType.RIGHT),
                  celda('Consumo Norm. 30d (kWh)', true, true, AlignmentType.RIGHT),
                  celda('Días', true, true, AlignmentType.RIGHT),
                  celda('Costo (COP)', true, true, AlignmentType.RIGHT),
                  celda('Clasificación frente a la LBEn', true),
                ],
              }),
              ...datos.historico.filas.slice(-12).map(
                (f) =>
                  new TableRow({
                    children: [
                      celda(f.periodo),
                      celda(f.consumoKwh.toLocaleString('es-CO'), false, false, AlignmentType.RIGHT),
                      celda(f.consumoNormalizado.toLocaleString('es-CO'), false, false, AlignmentType.RIGHT),
                      celda(f.diasFacturados.toString(), false, false, AlignmentType.RIGHT),
                      celda(`$ ${f.costoCop.toLocaleString('es-CO')}`, false, false, AlignmentType.RIGHT),
                      celda(
                        f.esAtipico === null
                          ? 'Sin clasificación (no hay banda mensual guardada)'
                          : f.esAtipico
                          ? `Atípico (${f.motivoAtipico})`
                          : 'Dentro de banda LBEn'
                      ),
                    ],
                  })
              ),
            ],
          }),

          // 4. Línea Base Energética (LBEn)
          parrafoTitulo('4. Línea Base Energética registrada (§9.2, §9.3, §9.4)'),
          parrafoTexto(
            `Modelo seleccionado: ${datos.lineaBase.modeloSeleccionado}. Período base: ${datos.lineaBase.periodoBase}. ` +
              `Consumo base de referencia: ${datos.lineaBase.consumoBaseMensualKwh === null ? 'No disponible' : `${datos.lineaBase.consumoBaseMensualKwh.toLocaleString('es-CO')} kWh/mes`}. ` +
              `Banda ±10%: ${datos.lineaBase.bandaInferiorKwh === null || datos.lineaBase.bandaSuperiorKwh === null ? 'No disponible' : `[${datos.lineaBase.bandaInferiorKwh.toLocaleString('es-CO')} – ${datos.lineaBase.bandaSuperiorKwh.toLocaleString('es-CO')}] kWh`}.`
          ),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [celda('Parámetro de Validación', true), celda('Valor Obtenido', true)],
              }),
              new TableRow({
                children: [
                  celda('Coeficiente de Determinación R²', false, true),
                  celda(datos.lineaBase.estadisticos.r2 !== null ? datos.lineaBase.estadisticos.r2.toFixed(4) : 'N/A'),
                ],
              }),
              new TableRow({
                children: [
                  celda('Error Porcentual Absoluto Medio (MAPE)', false, true),
                  celda(datos.lineaBase.estadisticos.mape !== null ? `${datos.lineaBase.estadisticos.mape.toFixed(2)} % (Límite UPME ≤ 5%)` : 'N/A'),
                ],
              }),
              new TableRow({
                children: [
                  celda('P-Valor Máximo Variables', false, true),
                  celda(datos.lineaBase.estadisticos.pValor !== null ? datos.lineaBase.estadisticos.pValor.toFixed(4) : 'N/A'),
                ],
              }),
              new TableRow({
                children: [
                  celda('Ecuación Matemática del Modelo', false, true),
                  celda(datos.lineaBase.estadisticos.ecuacion ?? 'Consumo Promedio Constante E0'),
                ],
              }),
              new TableRow({
                children: [
                  celda('Criterio Regulatorio', false, true),
                  celda(datos.lineaBase.criterioAprobacion),
                ],
              }),
            ],
          }),

          // 5. Ahorros y Medidas Eficientes
          parrafoTitulo('5. Medidas recomendadas (Anexo 5)'),
          parrafoTexto('No hay metas ni estimaciones de ahorro registradas para estas medidas.'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  celda('Tipo de Medida', true),
                  celda('Medida de Eficiencia Energética', true),
                  celda('Potencial Ahorro (%)', true, true, AlignmentType.RIGHT),
                  celda('Descripción Operativa', true),
                ],
              }),
              ...datos.ahorros.medidasEficiencia.map(
                (m) =>
                  new TableRow({
                    children: [
                      celda(m.tipo, false, true),
                      celda(m.medida),
                      celda(
                        m.ahorroEstimadoPct === null
                          ? 'No estimado'
                          : `${m.ahorroEstimadoPct} %`,
                        false,
                        false,
                        AlignmentType.RIGHT
                      ),
                      celda(m.descripcion),
                    ],
                  })
              ),
            ],
          }),

          // 6. Ajustes Energéticos
          parrafoTitulo('6. Trazabilidad de Ajustes Rutinarios y No Rutinarios (§7.5, Anexo 4)'),
          datos.ajustes.totalAjustes > 0
            ? new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      celda('Tipo', true),
                      celda('Descripción', true),
                      celda('Período Afectado', true),
                      celda('Proporción (Pr)', true, true, AlignmentType.RIGHT),
                      celda('Observaciones', true),
                    ],
                  }),
                  ...datos.ajustes.items.map(
                    (aj) =>
                      new TableRow({
                        children: [
                          celda(aj.tipo, false, true),
                          celda(aj.descripcion),
                          celda(aj.periodo),
                          celda(`${aj.valorAjustePct.toLocaleString('es-CO')} %`, false, false, AlignmentType.RIGHT),
                          celda(aj.observaciones ?? 'Sin observaciones'),
                        ],
                      })
                  ),
                ],
              })
            : parrafoTexto('No se registran eventos no rutinarios en el período evaluado.'),

          // Firmas institucionales
          new Paragraph({
            text: 'RESPONSABLE DE LA CONSULTA',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 120 },
          }),
          parrafoTexto(
            'Este informe refleja registros del Sistema de Información para la Gestión Energética (SIGE) y usa la Resolución UPME 0016 de 2024 como referencia técnica. No constituye una certificación de cumplimiento regulatorio.'
          ),
          new Paragraph({
            spacing: { before: 300 },
            children: [
              new TextRun({
                text: '_____________________________________________\n',
                bold: true,
              }),
              new TextRun({
                text: `${datos.generalidades.responsableNombre}\n`,
                bold: true,
              }),
              new TextRun({
                text: `${datos.generalidades.responsableRol} — Tecnológico de Antioquia\n`,
                color: COLOR_MUTED,
              }),
            ],
          }),
        ],
      },
    ],
  })

  return await Packer.toBuffer(doc)
}
