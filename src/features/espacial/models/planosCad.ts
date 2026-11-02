import DxfParser, {
  type IDxf,
  type IArcEntity,
  type ICircleEntity,
  type IEntity,
  type ILineEntity,
  type ILwpolylineEntity,
  type IMtextEntity,
  type IPolylineEntity,
  type ITextEntity,
} from 'dxf-parser'

export const MAX_CAD_FILE_BYTES = 10 * 1024 * 1024
export const MAX_DXF_ENTITIES = 20_000
export const MAX_DXF_CANDIDATES = 2_000
export const MAX_DXF_PREVIEW_ENTITIES = 10_000
export const MAX_DXF_CONTOUR_VERTICES = 128
export const CAPA_ESPACIOS_CAD_PREFIX = 'SIGE_ESPACIOS_'

export const UNIDADES_DXF = [
  { codigo: 1, nombre: 'Pulgadas', metros: 0.0254 },
  { codigo: 2, nombre: 'Pies', metros: 0.3048 },
  { codigo: 3, nombre: 'Millas', metros: 1609.344 },
  { codigo: 4, nombre: 'Milímetros', metros: 0.001 },
  { codigo: 5, nombre: 'Centímetros', metros: 0.01 },
  { codigo: 6, nombre: 'Metros', metros: 1 },
  { codigo: 7, nombre: 'Kilómetros', metros: 1000 },
  { codigo: 8, nombre: 'Micro pulgadas', metros: 0.0000000254 },
  { codigo: 9, nombre: 'Mils', metros: 0.0000254 },
  { codigo: 10, nombre: 'Yardas', metros: 0.9144 },
  { codigo: 11, nombre: 'Ångströms', metros: 0.0000000001 },
  { codigo: 12, nombre: 'Nanómetros', metros: 0.000000001 },
  { codigo: 13, nombre: 'Micrómetros', metros: 0.000001 },
  { codigo: 14, nombre: 'Decímetros', metros: 0.1 },
  { codigo: 15, nombre: 'Decámetros', metros: 10 },
  { codigo: 16, nombre: 'Hectómetros', metros: 100 },
  { codigo: 17, nombre: 'Gigámetros', metros: 1_000_000_000 },
  { codigo: 18, nombre: 'Unidades astronómicas', metros: 149_597_870_700 },
  { codigo: 19, nombre: 'Años luz', metros: 9_460_730_472_000_000 },
  { codigo: 20, nombre: 'Pársecs', metros: 30_856_775_814_913_673 },
  { codigo: 21, nombre: 'Pies topográficos de EE. UU.', metros: 1200 / 3937 },
  { codigo: 22, nombre: 'Pulgadas topográficas de EE. UU.', metros: 100 / 3937 },
  { codigo: 23, nombre: 'Yardas topográficas de EE. UU.', metros: 3600 / 3937 },
  { codigo: 24, nombre: 'Millas topográficas de EE. UU.', metros: 6_336_000 / 3937 },
] as const

export type UnidadDxf = (typeof UNIDADES_DXF)[number]['codigo']

export interface PuntoDxf {
  x: number
  y: number
}

export interface ContornoDxf {
  id: string
  capa: string
  puntos: PuntoDxf[]
  minX: number
  maxX: number
  minY: number
  maxY: number
  etiqueta: string | null
  areaOrigen: number
}

export type GeometriaVistaDxf =
  | { id: string; capa: string; tipo: 'trazo'; puntos: PuntoDxf[]; cerrado: boolean }
  | { id: string; capa: string; tipo: 'circulo'; centro: PuntoDxf; radio: number }
  | { id: string; capa: string; tipo: 'texto'; punto: PuntoDxf; texto: string }

export interface ResultadoDxf {
  contornos: ContornoDxf[]
  geometriaVista: GeometriaVistaDxf[]
  capas: string[]
  totalEntidades: number
  entidadesNoSoportadas: number
  polilineasNoRectangulares: number
  unidadesDetectadas: UnidadDxf | null
  advertencias: string[]
}

export interface CandidatoEspacial extends ContornoDxf {
  largoM: number | null
  anchoM: number | null
  areaM2: number | null
}

const tolerancia = (rango: number) => Math.max(1, rango) * 1e-7

function esUnidadDxf(valor: unknown): valor is UnidadDxf {
  return UNIDADES_DXF.some((unidad) => unidad.codigo === valor)
}

function segmentosSeCruzan(
  a: PuntoDxf,
  b: PuntoDxf,
  c: PuntoDxf,
  d: PuntoDxf,
  epsilon: number
): boolean {
  const orientacion = (p: PuntoDxf, q: PuntoDxf, r: PuntoDxf) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const enSegmento = (p: PuntoDxf, q: PuntoDxf, r: PuntoDxf) =>
    q.x >= Math.min(p.x, r.x) - epsilon &&
    q.x <= Math.max(p.x, r.x) + epsilon &&
    q.y >= Math.min(p.y, r.y) - epsilon &&
    q.y <= Math.max(p.y, r.y) + epsilon

  const abC = orientacion(a, b, c)
  const abD = orientacion(a, b, d)
  const cdA = orientacion(c, d, a)
  const cdB = orientacion(c, d, b)
  const escala = Math.max(
    1,
    Math.hypot(b.x - a.x, b.y - a.y),
    Math.hypot(d.x - c.x, d.y - c.y)
  )
  const areaEpsilon = epsilon * escala
  const signo = (value: number) =>
    Math.abs(value) <= areaEpsilon ? 0 : value > 0 ? 1 : -1
  const first = signo(abC)
  const second = signo(abD)
  const third = signo(cdA)
  const fourth = signo(cdB)

  if (first * second < 0 && third * fourth < 0) return true
  if (first === 0 && enSegmento(a, c, b)) return true
  if (second === 0 && enSegmento(a, d, b)) return true
  if (third === 0 && enSegmento(c, a, d)) return true
  if (fourth === 0 && enSegmento(c, b, d)) return true
  return false
}

function tieneAutointerseccion(vertices: PuntoDxf[], epsilon: number): boolean {
  for (let first = 0; first < vertices.length; first++) {
    const firstNext = (first + 1) % vertices.length
    for (let second = first + 1; second < vertices.length; second++) {
      const secondNext = (second + 1) % vertices.length
      if (firstNext === second || secondNext === first) continue
      if (
        segmentosSeCruzan(
          vertices[first],
          vertices[firstNext],
          vertices[second],
          vertices[secondNext],
          epsilon
        )
      ) {
        return true
      }
    }
  }
  return false
}

function extraerContornoEspacio(entity: IEntity, index: number): ContornoDxf | null {
  if (entity.type !== 'LWPOLYLINE') return null

  const polyline = entity as ILwpolylineEntity
  if (
    !polyline.shape ||
    !polyline.layer?.toLocaleUpperCase('es-CO').startsWith(CAPA_ESPACIOS_CAD_PREFIX) ||
    polyline.vertices.length < 3 ||
    polyline.vertices.length > MAX_DXF_CONTOUR_VERTICES
  ) {
    return null
  }

  const vertices = polyline.vertices.map(({ x, y, bulge }) => ({ x, y, bulge }))
  if (
    vertices.some(
      ({ x, y, bulge }) =>
        !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(bulge ?? 0) > 1e-8
    )
  ) {
    return null
  }
  const first = vertices[0]
  const last = vertices[vertices.length - 1]
  const cierre = Math.max(
    Math.abs(first.x - last.x),
    Math.abs(first.y - last.y)
  )
  if (cierre <= tolerancia(Math.max(Math.abs(first.x), Math.abs(first.y)))) {
    vertices.pop()
  }
  if (vertices.length < 3) return null

  const xs = vertices.map((p) => p.x)
  const ys = vertices.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const epsilon = tolerancia(Math.max(maxX - minX, maxY - minY))

  if (maxX - minX <= epsilon || maxY - minY <= epsilon) return null
  if (tieneAutointerseccion(vertices, epsilon)) return null

  const origin = vertices[0]
  const areaOrigen = Math.abs(
    vertices.reduce((sum, current, index) => {
      const next = vertices[(index + 1) % vertices.length]
      return (
        sum +
        (current.x - origin.x) * (next.y - origin.y) -
        (next.x - origin.x) * (current.y - origin.y)
      )
    }, 0) / 2
  )
  if (!Number.isFinite(areaOrigen) || areaOrigen <= epsilon * epsilon) return null

  return {
    id: entity.handle == null ? `contorno-${index + 1}` : String(entity.handle),
    capa: entity.layer || '0',
    puntos: vertices.map(({ x, y }) => ({ x, y })),
    minX,
    maxX,
    minY,
    maxY,
    etiqueta: null,
    areaOrigen,
  }
}

function textoEntidad(entity: IEntity): { texto: string; punto: PuntoDxf } | null {
  if (entity.type === 'TEXT') {
    const text = entity as ITextEntity
    if (!text.text || !text.startPoint) return null
    return { texto: text.text, punto: text.startPoint }
  }

  if (entity.type === 'MTEXT') {
    const text = entity as IMtextEntity
    if (!text.text || !text.position) return null
    return { texto: text.text, punto: text.position }
  }

  return null
}

function extraerGeometriaVista(entities: IEntity[]): GeometriaVistaDxf[] {
  const geometria: GeometriaVistaDxf[] = []

  entities.some((entity, index) => {
    const id = entity.handle == null ? `entidad-${index + 1}` : String(entity.handle)
    const capa = entity.layer || '0'

    if (entity.type === 'LINE') {
      const line = entity as ILineEntity
      if (
        line.vertices.length >= 2 &&
        line.vertices.slice(0, 2).every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
      ) {
        geometria.push({
          id,
          capa,
          tipo: 'trazo',
          puntos: line.vertices.slice(0, 2).map(({ x, y }) => ({ x, y })),
          cerrado: false,
        })
      }
    } else if (entity.type === 'LWPOLYLINE') {
      const polyline = entity as ILwpolylineEntity
      if (
        polyline.vertices.length >= 2 &&
        polyline.vertices.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)) &&
        polyline.vertices.every((vertex) => Math.abs(vertex.bulge ?? 0) <= 1e-8)
      ) {
        geometria.push({
          id,
          capa,
          tipo: 'trazo',
          puntos: polyline.vertices.map(({ x, y }) => ({ x, y })),
          cerrado: polyline.shape,
        })
      }
    } else if (entity.type === 'POLYLINE') {
      const polyline = entity as IPolylineEntity
      if (
        polyline.vertices.length >= 2 &&
        !polyline.is3dPolyline &&
        polyline.vertices.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
      ) {
        geometria.push({
          id,
          capa,
          tipo: 'trazo',
          puntos: polyline.vertices.map(({ x, y }) => ({ x, y })),
          cerrado: polyline.shape,
        })
      }
    } else if (entity.type === 'CIRCLE') {
      const circle = entity as ICircleEntity
      if (
        circle.center &&
        Number.isFinite(circle.center.x) &&
        Number.isFinite(circle.center.y) &&
        Number.isFinite(circle.radius) &&
        circle.radius > 0
      ) {
        geometria.push({
          id,
          capa,
          tipo: 'circulo',
          centro: { x: circle.center.x, y: circle.center.y },
          radio: circle.radius,
        })
      }
    } else if (entity.type === 'ARC') {
      const arc = entity as IArcEntity
      if (
        arc.center &&
        Number.isFinite(arc.center.x) &&
        Number.isFinite(arc.center.y) &&
        Number.isFinite(arc.radius) &&
        arc.radius > 0
      ) {
        const start = arc.startAngle
        let end = arc.endAngle
        while (end <= start) end += Math.PI * 2
        const segments = Math.min(72, Math.max(2, Math.ceil(((end - start) * 180) / Math.PI / 10)))
        geometria.push({
          id,
          capa,
          tipo: 'trazo',
          puntos: Array.from({ length: segments + 1 }, (_, pointIndex) => {
            const angle = start + ((end - start) * pointIndex) / segments
            return {
              x: arc.center.x + Math.cos(angle) * arc.radius,
              y: arc.center.y + Math.sin(angle) * arc.radius,
            }
          }),
          cerrado: false,
        })
      }
    } else if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
      const text = textoEntidad(entity)
      if (text) {
        const cleaned = limpiarTextoDxf(text.texto)
        if (cleaned) {
          geometria.push({
            id,
            capa,
            tipo: 'texto',
            punto: text.punto,
            texto: cleaned.slice(0, 160),
          })
        }
      }
    }

    return geometria.length >= MAX_DXF_PREVIEW_ENTITIES
  })

  return geometria
}

function limpiarTextoDxf(texto: string): string {
  return texto
    .replace(/\\P/gi, ' ')
    .replace(/\\[A-Za-z][^;]*;/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parsearDocumento(source: string): IDxf {
  const parsed = new DxfParser().parseSync(source)
  if (!parsed) throw new Error('El archivo DXF no contiene un documento válido.')
  return parsed
}

export function extraerDxf(source: string): ResultadoDxf {
  if (source.length === 0) throw new Error('El archivo DXF está vacío.')
  if (source.length > MAX_CAD_FILE_BYTES) {
    throw new Error('El DXF supera el límite de 10 MB.')
  }

  const document = parsearDocumento(source)
  if (document.entities.length > MAX_DXF_ENTITIES) {
    throw new Error(`El DXF supera el límite de ${MAX_DXF_ENTITIES.toLocaleString('es-CO')} entidades.`)
  }

  const contornos: ContornoDxf[] = []
  let polilineasNoRectangulares = 0

  document.entities.forEach((entity, index) => {
    if (entity.type !== 'LWPOLYLINE') return
    const polyline = entity as ILwpolylineEntity
    const isSpaceLayer = polyline.layer
      ?.toLocaleUpperCase('es-CO')
      .startsWith(CAPA_ESPACIOS_CAD_PREFIX)
    if (!isSpaceLayer) return
    const contour = extraerContornoEspacio(entity, index)
    if (contour) contornos.push(contour)
    else polilineasNoRectangulares++
  })

  const textos = document.entities
    .map(textoEntidad)
    .filter((text): text is { texto: string; punto: PuntoDxf } => text !== null)
    .map(({ texto, punto }) => ({ texto: limpiarTextoDxf(texto), punto }))
    .filter(({ texto }) => texto.length > 0)

  for (const text of textos) {
    const contorno = contornos
      .filter(
        (candidate) =>
          text.punto.x >= candidate.minX &&
          text.punto.x <= candidate.maxX &&
          text.punto.y >= candidate.minY &&
          text.punto.y <= candidate.maxY
      )
      .sort(
        (a, b) =>
          (a.maxX - a.minX) * (a.maxY - a.minY) -
          (b.maxX - b.minX) * (b.maxY - b.minY)
      )[0]
    if (contorno) {
      contorno.etiqueta = contorno.etiqueta
        ? `${contorno.etiqueta} · ${text.texto}`
        : text.texto
    }
  }

  if (contornos.length > MAX_DXF_CANDIDATES) {
    throw new Error(`El DXF supera el límite de ${MAX_DXF_CANDIDATES.toLocaleString('es-CO')} contornos importables.`)
  }

  const unitHeader = document.header['$INSUNITS']
  const unidadesDetectadas = esUnidadDxf(unitHeader) ? unitHeader : null
  const advertencias: string[] = []

  if (unidadesDetectadas === null) {
    advertencias.push('El DXF no declara unidades reconocidas; seleccione la unidad de origen antes de importar.')
  }
  if (polilineasNoRectangulares > 0) {
    advertencias.push(
      `${polilineasNoRectangulares} polilínea(s) de capas ${CAPA_ESPACIOS_CAD_PREFIX}* no se pudieron usar; deben ser cerradas, planas, sin segmentos curvos y tener entre 3 y ${MAX_DXF_CONTOUR_VERTICES} vértices.`
    )
  }
  if (contornos.length === 0) {
    advertencias.push(
      `No hay recintos importables. Delimite cada espacio como polilínea cerrada, sin curvas, en una capa cuyo nombre comience por ${CAPA_ESPACIOS_CAD_PREFIX}.`
    )
  }
  const entidadesNoSoportadas = document.entities.filter(
    (entity) => !['LWPOLYLINE', 'TEXT', 'MTEXT'].includes(entity.type)
  ).length
  if (entidadesNoSoportadas > 0) {
    advertencias.push(
      `${entidadesNoSoportadas} entidad(es) no se usan para extraer contornos ni etiquetas.`
    )
  }
  if (source.includes('\uFFFD')) {
    advertencias.push('El archivo contiene texto con codificación no reconocida; revise las etiquetas extraídas.')
  }

  return {
    contornos,
    geometriaVista: extraerGeometriaVista(document.entities),
    capas: Object.keys(document.tables.layer.layers ?? {}).sort((a, b) => a.localeCompare(b)),
    totalEntidades: document.entities.length,
    entidadesNoSoportadas,
    polilineasNoRectangulares,
    unidadesDetectadas,
    advertencias,
  }
}

export function aplicarUnidades(
  resultado: ResultadoDxf,
  codigoUnidad: UnidadDxf | null
): CandidatoEspacial[] {
  const unidad = UNIDADES_DXF.find((option) => option.codigo === codigoUnidad)
  if (!unidad) {
    return resultado.contornos.map((contorno) => ({
      ...contorno,
      largoM: null,
      anchoM: null,
      areaM2: null,
    }))
  }

  return resultado.contornos.map((contorno) => {
    const largoM = Number(
      (Math.max(contorno.maxX - contorno.minX, contorno.maxY - contorno.minY) * unidad.metros).toFixed(3)
    )
    const anchoM = Number(
      (Math.min(contorno.maxX - contorno.minX, contorno.maxY - contorno.minY) * unidad.metros).toFixed(3)
    )
    return {
      ...contorno,
      largoM,
      anchoM,
      areaM2: Number((contorno.areaOrigen * unidad.metros * unidad.metros).toFixed(3)),
    }
  })
}
