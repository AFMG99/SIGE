import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DatosReporteUPME } from '../models/reportes'

const COLOR_FOREST: [number, number, number] = [0, 101, 46] // #00652e uv-forest
const COLOR_INK: [number, number, number] = [33, 25, 21] // #211915 uv-ink
const COLOR_MUTED: [number, number, number] = [100, 116, 139] // #64748b uv-mid
const COLOR_LIGHT_BG: [number, number, number] = [248, 250, 252] // #f8fafc

export function generarDocumentoPdfBuffer(datos: DatosReporteUPME): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  // Márgenes estandarizados de 50pt (~18mm)
  const margin = 50
  const contentWidth = pageWidth - 2 * margin
  let y = 50

  const asegurarEspacio = (necesario: number) => {
    if (y + necesario > pageHeight - 50) {
      doc.addPage()
      y = 50
    }
  }

  // Encabezado institucional
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...COLOR_FOREST)
  doc.text('TECNOLÓGICO DE ANTIOQUIA - INSTITUCIÓN UNIVERSITARIA', pageWidth / 2, y, {
    align: 'center',
  })
  y += 18

  doc.setFontSize(11)
  doc.setTextColor(...COLOR_INK)
  doc.text('Sistema de Información para la Gestión Energética (SIGE)', pageWidth / 2, y, {
    align: 'center',
  })
  y += 15

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...COLOR_MUTED)
  doc.text(
    'INFORME DE GESTIÓN ENERGÉTICA — REFERENCIA UPME 0016 DE 2024',
    pageWidth / 2,
    y,
    { align: 'center' }
  )
  y += 10

  doc.setDrawColor(...COLOR_FOREST)
  doc.setLineWidth(1.5)
  doc.line(margin, y, margin + contentWidth, y)
  y += 22

  // 1. Generalidades (§9.1)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLOR_FOREST)
  doc.text('1. Identificación y Generalidades de la Edificación (§9.1)', margin, y)
  y += 10

  const filasGeneralidades = [
    ['Instalación / Edificación', datos.generalidades.edificacionNombre],
    [
      'Bloque Evaluado',
      datos.generalidades.bloqueCodigo
        ? `${datos.generalidades.bloqueCodigo} - ${datos.generalidades.bloqueNombre}`
        : 'Alcance consolidado de toda la edificación',
    ],
    ['Sede y Ubicación', datos.generalidades.sede],
    [
      'Área Útil Ocupada',
      datos.generalidades.areaUtilM2 === null
        ? 'No registrada'
        : `${datos.generalidades.areaUtilM2.toLocaleString('es-CO')} m²`,
    ],
    ['Fuentes de Energía', datos.generalidades.fuentesEnergia.join(', ')],
    [
      'Población / Ocupantes',
      `Fija: ${datos.generalidades.ocupantes.poblacionFija ?? 'No registrada'} | Flotante: ${datos.generalidades.ocupantes.poblacionFlotante ?? 'No registrada'} | Total: ${datos.generalidades.ocupantes.total ?? 'No registrado'}`,
    ],
    ['Actividades y Operaciones', datos.generalidades.actividades],
    [
      'Emisión y Responsable',
      `${datos.generalidades.fechaGeneracion} por ${datos.generalidades.responsableNombre} (${datos.generalidades.responsableRol})`,
    ],
  ]

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Parámetro Institucional', 'Detalle']],
    body: filasGeneralidades,
    theme: 'grid',
    headStyles: {
      fillColor: COLOR_FOREST,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: COLOR_INK,
    },
    columnStyles: {
      0: { cellWidth: 150, fontStyle: 'bold' },
    },
  })

  // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
  y = doc.lastAutoTable.finalY + 22

  // 2. Inventario y USEs (§7.1)
  asegurarEspacio(120)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLOR_FOREST)
  doc.text('2. Inventario y Usos Significativos de Energía - USEs (§7.1)', margin, y)
  y += 10

  const filasInventario = datos.inventario.categorias.map((c) => [
    c.categoria,
    c.cantidad.toString(),
    c.potenciaTotalKw.toLocaleString('es-CO'),
    `${c.participacionPct} %`,
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Categoría de Uso Final', 'Cantidad Equipos', 'Potencia Total (kW)', 'Participación (%)']],
    body: filasInventario,
    theme: 'grid',
    headStyles: {
      fillColor: COLOR_FOREST,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: COLOR_INK,
    },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
  })

  // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
  y = doc.lastAutoTable.finalY + 22

  // 3. Histórico de Consumo y Depuración (§7.2, §7.3)
  asegurarEspacio(150)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLOR_FOREST)
  doc.text('3. Histórico de Facturas y Clasificación frente a la LBEn (§7.2, §7.3)', margin, y)
  y += 10

  const filasHistorico = datos.historico.filas.slice(-12).map((f) => [
    f.periodo,
    f.consumoKwh.toLocaleString('es-CO'),
    f.consumoNormalizado.toLocaleString('es-CO'),
    f.diasFacturados.toString(),
    `$ ${f.costoCop.toLocaleString('es-CO')}`,
    f.esAtipico === null
      ? 'Sin clasificación (no hay banda mensual guardada)'
      : f.esAtipico
      ? `Atípico (${f.motivoAtipico})`
      : 'Dentro de banda LBEn',
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Período', 'Consumo (kWh)', 'Consumo Norm. (kWh)', 'Días', 'Costo (COP)', 'Clasificación LBEn']],
    body: filasHistorico,
    theme: 'grid',
    headStyles: {
      fillColor: COLOR_FOREST,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLOR_INK,
    },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  })

  // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
  y = doc.lastAutoTable.finalY + 22

  // 4. Línea Base Energética (§9.2, §9.3, §9.4)
  asegurarEspacio(140)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLOR_FOREST)
  doc.text('4. Línea Base Energética registrada - LBEn (§9.2 - §9.4)', margin, y)
  y += 10

  const filasLBEn = [
    ['Modelo Seleccionado', datos.lineaBase.modeloSeleccionado],
    ['Período Base Evaluado', datos.lineaBase.periodoBase],
    [
      'Consumo Base Mensual E0',
      datos.lineaBase.consumoBaseMensualKwh === null
        ? 'No disponible'
        : `${datos.lineaBase.consumoBaseMensualKwh.toLocaleString('es-CO')} kWh/mes`,
    ],
    [
      'Desviación Estándar σ',
      datos.lineaBase.desviacionEstandarKwh === null
        ? 'No disponible'
        : `${datos.lineaBase.desviacionEstandarKwh.toLocaleString('es-CO')} kWh`,
    ],
    [
      'Banda ±10% guardada',
      datos.lineaBase.bandaInferiorKwh === null ||
      datos.lineaBase.bandaSuperiorKwh === null
        ? 'No disponible'
        : `[${datos.lineaBase.bandaInferiorKwh.toLocaleString('es-CO')} – ${datos.lineaBase.bandaSuperiorKwh.toLocaleString('es-CO')}] kWh`,
    ],
    ['Coeficiente R²', datos.lineaBase.estadisticos.r2 !== null ? datos.lineaBase.estadisticos.r2.toFixed(4) : 'N/A'],
    ['MAPE (Error porcentual)', datos.lineaBase.estadisticos.mape !== null ? `${datos.lineaBase.estadisticos.mape.toFixed(2)} %` : 'N/A'],
    ['Ecuación Matemática', datos.lineaBase.estadisticos.ecuacion ?? 'No registrada'],
    ['Criterio Regulatorio', datos.lineaBase.criterioAprobacion],
  ]

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Dato de LBEn', 'Valor Registrado']],
    body: filasLBEn,
    theme: 'grid',
    headStyles: {
      fillColor: COLOR_FOREST,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: COLOR_INK,
    },
    columnStyles: {
      0: { cellWidth: 160, fontStyle: 'bold' },
    },
  })

  // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
  y = doc.lastAutoTable.finalY + 22

  // 5. Ahorros y Medidas Eficientes (§8, Anexo 5)
  asegurarEspacio(150)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLOR_FOREST)
  doc.text('5. Medidas BPO/Activas/Pasivas recomendadas (Anexo 5)', margin, y)
  y += 10

  const filasMedidas = datos.ahorros.medidasEficiencia.map((m) => [
    m.tipo,
    m.medida,
    m.ahorroEstimadoPct === null ? 'No estimado' : `${m.ahorroEstimadoPct} %`,
    m.descripcion,
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Tipo', 'Medida de Eficiencia Energética', 'Ahorro (%)', 'Descripción']],
    body: filasMedidas,
    theme: 'grid',
    headStyles: {
      fillColor: COLOR_FOREST,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLOR_INK,
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' },
      2: { halign: 'right', cellWidth: 60 },
    },
  })

  // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
  y = doc.lastAutoTable.finalY + 22

  // 6. Firmas
  asegurarEspacio(90)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLOR_INK)
  doc.text('CONSTANCIA DE EMISIÓN INSTITUCIONAL', margin, y)
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLOR_MUTED)
  doc.text(
    'Este informe refleja registros del sistema SIGE y no constituye una certificación de cumplimiento regulatorio.',
    margin,
    y
  )
  y += 28

  doc.setDrawColor(...COLOR_INK)
  doc.setLineWidth(0.8)
  doc.line(margin, y, margin + 200, y)
  y += 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLOR_INK)
  doc.text(datos.generalidades.responsableNombre, margin, y)
  y += 10

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLOR_MUTED)
  doc.text(`${datos.generalidades.responsableRol} — Tecnológico de Antioquia`, margin, y)

  // Numeración de páginas en pie
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_MUTED)
    doc.text(
      `Página ${i} de ${totalPages} | SIGE TdeA - Referencia UPME 0016 de 2024`,
      pageWidth / 2,
      pageHeight - 20,
      { align: 'center' }
    )
  }

  return Buffer.from(doc.output('arraybuffer'))
}
