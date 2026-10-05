"use client"

/**
 * Importador de inventario de equipos eléctricos — SIGE-TdeA
 *
 * Asistente de importación en 4 pasos, segmentado por edificación, bloque y
 * espacio:
 *   1. Edificación y carga → selección de edificación (catálogo heredado de
 *                   Facturas de energía › Edificaciones), campo de bloque condicional
 *                   según el tipo, arrastrar y soltar, selector de archivo o
 *                   ingreso manual
 *   2. Mapeo      → selección de hoja (Excel), detección de encabezados y mapeo de columnas
 *   3. Vista previa → primeras 50 filas por página, edición en línea, errores en rojo
 *   4. Importación → resumen, confirmación de sobrescritura, barra de progreso y resultado
 */

import React, { useCallback, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { parse as parseCsv } from 'papaparse'
import {
  filaEquipoElectricoschema,
  normalizarEspacio,
  TIPOS_EQUIPO,
  ESTADOS_INDICADOR,
  tipoEdificacionPorCodigo,
} from '@/lib/validations/energia'
import type { ConflictoEquipo, FilaEnvioEquipos } from '@/lib/validations/energia'
import { importarFilasEquipos } from '@/actions/equipos'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/ToastProvider'
import { BloqueDrawer } from './BloqueDrawer'
import type { BloqueFormData } from './BloqueDrawer'
import type {
  BloqueInfo,
  CrearBloque,
  EdificacionInfo,
  EliminarBloque,
  EspacioInfo,
} from './useCatalogoEdificaciones'
import { IconCarga, IconImportar, IconMapeo, IconVistaPrevia } from './icons'

// ==========================================
// Constantes
// ==========================================

const FORMATOS_PERMITIDOS = ['xlsx', 'xls', 'csv']
const MAX_ARCHIVO_BYTES = 5 * 1024 * 1024 // 5 MB
const FILAS_POR_PAGINA = 50
const MAX_FILAS = 5000
const ETIQUETA_FORMATOS = '.xlsx, .xls o .csv'
const ETIQUETA_TAMANO = '5 MB'

type CampoId =
  | 'bloque'
  | 'espacio'
  | 'tipo'
  | 'cantidad'
  | 'potenciaNominal'
  | 'horasUsoDia'
  | 'diasUsoMes'
  | 'usenIndicador'
type CampoFila = CampoId
type Paso = 'carga' | 'mapeo' | 'vista' | 'resultado'

interface DefCampo {
  id: CampoId
  etiqueta: string
  ejemplo: string
  tipo: 'texto' | 'numero'
  /** Campo que puede resolverse con un valor global (si el archivo no lo trae). */
  respaldadoGlobal?: boolean
}

const CAMPOS: DefCampo[] = [
  { id: 'bloque', etiqueta: 'Bloque', ejemplo: 'BLOQUE-A-001', tipo: 'texto', respaldadoGlobal: true },
  { id: 'espacio', etiqueta: 'Espacio', ejemplo: 'Aula Mayor', tipo: 'texto', respaldadoGlobal: true },
  { id: 'tipo', etiqueta: 'Tipo de equipo', ejemplo: 'HVAC', tipo: 'texto' },
  { id: 'cantidad', etiqueta: 'Cantidad', ejemplo: '3', tipo: 'numero' },
  { id: 'potenciaNominal', etiqueta: 'Potencia nominal (kW)', ejemplo: '45.5', tipo: 'numero' },
  { id: 'horasUsoDia', etiqueta: 'Horas de uso por día', ejemplo: '12', tipo: 'numero' },
  { id: 'diasUsoMes', etiqueta: 'Días de uso por mes', ejemplo: '22', tipo: 'numero' },
  { id: 'usenIndicador', etiqueta: '¿En uso?', ejemplo: 'ACTIVO', tipo: 'texto' },
]

const SINONIMOS: Record<CampoId, string[]> = {
  bloque: ['bloque', 'bloqueid', 'idbloque', 'codigobloque', 'codigo', 'edificio'],
  espacio: ['espacio', 'ambiente', 'zona', 'aula', 'salon', 'espaciofisico', 'local'],
  tipo: ['tipo', 'tipoequipo', 'equipotipo', 'clase', 'equipo'],
  cantidad: ['cantidad', 'nro', 'numero', 'unidades', 'und', 'total'],
  potenciaNominal: ['potencianominal', 'potencia', 'kw', 'potenciakw', 'potenciakwnominal'],
  horasUsoDia: ['horasusodia', 'horas', 'horasdia', 'horasuso'],
  diasUsoMes: ['diasusomes', 'dias', 'diasmes', 'diasuso'],
  usenIndicador: ['usenindicador', 'indicador', 'enuso', 'uso', 'estado'],
}

const normalizar = (texto: unknown): string =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

/** Intenta asociar un encabezado de archivo a un campo esperado. */
function campoDesdeEncabezado(texto: unknown): CampoFila | null {
  const n = normalizar(texto)
  if (!n) return null
  for (const campo of CAMPOS) {
    if (n === normalizar(campo.id) || SINONIMOS[campo.id].includes(n)) return campo.id
  }
  return null
}

/** Detección automática: ¿la primera fila parece ser encabezados? */
function detectarEncabezado(primeraFila: unknown[] | undefined): boolean {
  if (!primeraFila) return false
  const celdas = primeraFila.map((c) => String(c ?? '').trim()).filter(Boolean)
  if (celdas.length === 0) return false
  const algunaCoincide = celdas.some((c) => campoDesdeEncabezado(c) !== null)
  const algunaNumerica = celdas.some((c) => /^-?\d+([.,]\d+)?$/.test(c))
  return algunaCoincide && !algunaNumerica
}

function autoMapear(encabezados: string[]): Record<CampoFila, number | null> {
  const mapeo: Record<CampoFila, number | null> = {
    bloque: null,
    espacio: null,
    tipo: null,
    cantidad: null,
    potenciaNominal: null,
    horasUsoDia: null,
    diasUsoMes: null,
    usenIndicador: null,
  }
  encabezados.forEach((texto, indice) => {
    const campo = campoDesdeEncabezado(texto)
    if (campo && mapeo[campo] === null) mapeo[campo] = indice
  })
  return mapeo
}

/** Normaliza el valor de la columna "tipo" a uno de los tipos soportados. */
function normalizarTipoEquipo(valor: unknown): string {
  const crudo = String(valor ?? '').trim()
  const n = normalizar(crudo)
  if (['hvac', 'aireacondicionado', 'climatizacion', 'acondicionado'].includes(n)) return 'HVAC'
  if (['iluminacion', 'iluminaria', 'luminarias', 'lighting'].includes(n)) return 'ILUMINACION'
  if (['oficina', 'ofimatica', 'computo', 'equipooficina'].includes(n)) return 'OFICINA'
  if (['motor', 'motores', 'maquinas'].includes(n)) return 'MOTORES'
  return crudo.toUpperCase()
}

/** Normaliza el valor de la columna "¿En uso?". */
function normalizarIndicador(valor: unknown): string {
  const crudo = String(valor ?? '').trim()
  const n = normalizar(crudo)
  if (['activo', 'si', 's', 'on', 'true', '1'].includes(n)) return 'ACTIVO'
  if (['inactivo', 'no', 'n', 'off', 'false', '0'].includes(n)) return 'INACTIVO'
  return crudo.toUpperCase()
}

type FilaTrabajo = { id: string; datos: Record<CampoFila, string>; descartada: boolean }
type ValidacionFila = { errores: Partial<Record<CampoFila, string>>; duplicada: boolean }

export type ResultadoCompletado = Extract<
  Awaited<ReturnType<typeof importarFilasEquipos>>,
  { estado: 'completado' }
>

const nuevaFila = (): FilaTrabajo => ({
  id: Math.random().toString(36).slice(2, 10),
  datos: {
    bloque: '',
    espacio: '',
    tipo: '',
    cantidad: '',
    potenciaNominal: '',
    horasUsoDia: '',
    diasUsoMes: '',
    usenIndicador: '',
  },
  descartada: false,
})

const filaVacia = (fila: FilaTrabajo): boolean =>
  (Object.keys(fila.datos) as CampoFila[]).every((k) => !String(fila.datos[k] ?? '').trim())

const extensionDe = (nombre: string): string => nombre.split('.').pop()?.toLowerCase() ?? ''

function descargar(nombreArchivo: string, contenido: string, tipo: string) {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

// ==========================================
// Componente
// ==========================================

export function ImportadorEquipos({
  bloques,
  edificaciones,
  espacios,
  crearBloque: crearBloqueCatalogo,
  eliminarBloque: eliminarBloqueCatalogo,
  onIrAlCatalogo,
  puedeCargar,
  resultadoInicial,
}: {
  bloques: BloqueInfo[]
  edificaciones: EdificacionInfo[]
  espacios: EspacioInfo[]
  /** Crea un bloque en la edificación indicada (catálogo compartido de DatosContent). */
  crearBloque: CrearBloque
  /** Elimina un bloque vacío del catálogo compartido. */
  eliminarBloque: EliminarBloque
  /** Navega al modo «Edificaciones» de Facturas de energía (CTA cuando el catálogo está vacío). */
  onIrAlCatalogo: () => void
  puedeCargar: boolean
  /**
   * Semilla del paso 4 para documentación (Storybook): muestra la pantalla de
   * resultado sin ejecutar la importación. En producción no se envía.
   */
  resultadoInicial?: ResultadoCompletado
}) {
  const { showToast } = useToast()
  const inputArchivoRef = useRef<HTMLInputElement | null>(null)
  const libroRef = useRef<XLSX.WorkBook | null>(null)

  const [paso, setPaso] = useState<Paso>(resultadoInicial ? 'resultado' : 'carga')
  const [modo, setModo] = useState<'archivo' | 'manual'>('archivo')
  const [arrastre, setArrastre] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  // Segmentación: edificación (obligatoria) + valores globales
  const [edificacionSel, setEdificacionSel] = useState('')
  const [bloqueGlobal, setBloqueGlobal] = useState('')
  const [espacioGlobal, setEspacioGlobal] = useState('')

  // Drawer de creación de bloques (patrón "Nuevo usuario": panel lateral con portal)
  const [bloqueDrawerOpen, setBloqueDrawerOpen] = useState(false)
  const [guardandoBloque, setGuardandoBloque] = useState(false)

  // Eliminación del catálogo (paso 1) y estado de la petición en curso
  const [dialogoBorrado, setDialogoBorrado] = useState<'bloque' | null>(null)
  const [borrando, setBorrando] = useState(false)

  const [archivoInfo, setArchivoInfo] = useState<{ nombre: string; bytes: number } | null>(null)
  const [hojas, setHojas] = useState<string[]>([])
  const [hojaSel, setHojaSel] = useState('')
  const [matriz, setMatriz] = useState<string[][]>([])
  const [tieneEncabezado, setTieneEncabezado] = useState(true)
  const [mapeo, setMapeo] = useState<Record<CampoFila, number | null>>({
    bloque: null,
    espacio: null,
    tipo: null,
    cantidad: null,
    potenciaNominal: null,
    horasUsoDia: null,
    diasUsoMes: null,
    usenIndicador: null,
  })

  const [filas, setFilas] = useState<FilaTrabajo[]>([])
  const [pagina, setPagina] = useState(0)

  const [importando, setImportando] = useState(false)
  const [progreso, setProgreso] = useState<number | null>(null)
  const [conflictos, setConflictos] = useState<ConflictoEquipo[] | null>(null)
  const [resultado, setResultado] = useState<ResultadoCompletado | null>(
    resultadoInicial ?? null
  )

  // ------------------------------------------
  // Datos derivados
  // ------------------------------------------

  const edificacionActual = edificaciones.find((e) => e.id === edificacionSel) ?? null
  const tipoActual = edificacionActual ? tipoEdificacionPorCodigo(edificacionActual.tipo) : null
  /** Sin edificación seleccionada se asume "requiere bloque" (fail-safe del catálogo). */
  const requiereBloque = tipoActual ? tipoActual.requiereBloque : true
  /** Bloque elegido en el desplegable; null cuando el valor global está vacío. */
  const bloqueSeleccionado = bloques.find((b) => b.id === bloqueGlobal) ?? null

  const bloquesFiltrados = useMemo(
    () => (edificacionSel ? bloques.filter((b) => b.edificacionId === edificacionSel) : []),
    [bloques, edificacionSel]
  )

  const bloquesPorId = useMemo(() => new Map(bloques.map((b) => [b.id, b])), [bloques])

  const bloquesPorCodigo = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const b of bloques) mapa.set(normalizar(b.codigo), b.id)
    return mapa
  }, [bloques])

  const espaciosPorBloque = useMemo(() => {
    const mapa = new Map<string, string[]>()
    for (const e of espacios) {
      const lista = mapa.get(e.bloqueId)
      if (lista) lista.push(e.nombre)
      else mapa.set(e.bloqueId, [e.nombre])
    }
    mapa.forEach((lista) => lista.sort((a, b) => a.localeCompare(b)))
    return mapa
  }, [espacios])

  const etiquetaTipo = (codigo: string): string => tipoEdificacionPorCodigo(codigo).etiqueta

  /** Resuelve el valor de la columna "bloque" (código o ID) a un ID de bloque. */
  const resolverBloque = useCallback(
    (valor: string): string => {
      const crudo = valor.trim()
      if (!crudo) return ''
      const porId = bloquesPorId.get(crudo)
      if (porId) return porId.id
      const porCodigo = bloquesPorCodigo.get(normalizar(crudo))
      if (porCodigo) return porCodigo
      return crudo
    },
    [bloquesPorId, bloquesPorCodigo]
  )

  // ------------------------------------------
  // Utilidades de archivo
  // ------------------------------------------

  const procesarArchivo = useCallback(
    async (file: File) => {
      setAviso(null)
      if (!edificacionSel) {
        const mensaje = 'Seleccione primero la edificación.'
        setAviso(mensaje)
        return
      }
      const extension = extensionDe(file.name)

      if (!FORMATOS_PERMITIDOS.includes(extension)) {
        const mensaje = `Formato no permitido. Use archivos ${ETIQUETA_FORMATOS}.`
        setAviso(mensaje)
        return
      }
      if (file.size > MAX_ARCHIVO_BYTES) {
        const mensaje = `El archivo supera el límite de ${ETIQUETA_TAMANO} (${(file.size / (1024 * 1024)).toFixed(1)} MB).`
        setAviso(mensaje)
        return
      }

      setLeyendo(true)
      try {
        const buffer = await file.arrayBuffer()
        let matrizLeida: string[][] = []
        let hojasLeidas: string[] = []
        let hojaInicial = ''

        if (extension === 'csv') {
          const texto = new TextDecoder('utf-8').decode(buffer)
          const parseo = parseCsv<string[]>(texto, { header: false, skipEmptyLines: 'greedy' })
          matrizLeida = (parseo.data ?? []).map((fila) =>
            fila.map((celda) => String(celda ?? '').trim())
          )
        } else {
          const libro = XLSX.read(buffer, { type: 'array' })
          libroRef.current = libro
          hojasLeidas = libro.SheetNames
          hojaInicial = libro.SheetNames[0] ?? ''
          if (hojaInicial) {
            matrizLeida = hojaDesdeLibro(libro, hojaInicial)
          }
        }

        const conEncabezado = detectarEncabezado(matrizLeida[0])
        const cuerpo = conEncabezado ? matrizLeida.slice(1) : matrizLeida
        const encabezados = conEncabezado
          ? (matrizLeida[0] ?? []).map((c, i) => (String(c).trim() || `Columna ${i + 1}`))
          : (matrizLeida[0] ?? []).map((_, i) => `Columna ${i + 1}`)

        if (cuerpo.length === 0) {
          const mensaje = 'El archivo no contiene filas de datos.'
          setAviso(mensaje)
          return
        }
        if (cuerpo.length > MAX_FILAS) {
          const mensaje = `El archivo tiene ${cuerpo.length} filas; el máximo por importación es ${MAX_FILAS}.`
          setAviso(mensaje)
          return
        }

        setArchivoInfo({ nombre: file.name, bytes: file.size })
        setHojas(hojasLeidas)
        setHojaSel(hojaInicial)
        setMatriz(matrizLeida)
        setTieneEncabezado(conEncabezado)
        setMapeo(autoMapear(encabezados))
        setPaso('mapeo')
        showToast(`Archivo leído: ${cuerpo.length} filas detectadas.`, 'success')
      } catch {
        const mensaje = 'No se pudo leer el archivo. Verifique que no esté dañado.'
        setAviso(mensaje)
      } finally {
        setLeyendo(false)
      }
    },
    [edificacionSel, showToast]
  )

  const hojaDesdeLibro = (libro: XLSX.WorkBook, nombreHoja: string): string[][] => {
    const hoja = libro.Sheets[nombreHoja]
    if (!hoja) return []
    const crudo = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    })
    return crudo.map((fila) => fila.map((celda) => String(celda ?? '').trim()))
  }

  const cambiarHoja = (nombreHoja: string) => {
    setHojaSel(nombreHoja)
    if (!libroRef.current) return
    const nuevaMatriz = hojaDesdeLibro(libroRef.current, nombreHoja)
    const conEncabezado = detectarEncabezado(nuevaMatriz[0])
    const cuerpo = conEncabezado ? nuevaMatriz.slice(1) : nuevaMatriz
    const encabezados = conEncabezado
      ? (nuevaMatriz[0] ?? []).map((c, i) => (String(c).trim() || `Columna ${i + 1}`))
      : (nuevaMatriz[0] ?? []).map((_, i) => `Columna ${i + 1}`)
    setMatriz(nuevaMatriz)
    setTieneEncabezado(conEncabezado)
    setMapeo(autoMapear(encabezados))
    if (cuerpo.length > MAX_FILAS) {
      showToast(`La hoja "${nombreHoja}" supera las ${MAX_FILAS} filas máximas.`, 'error')
    }
  }

  // ------------------------------------------
  // Paso 2 → 3: construir filas de trabajo
  // ------------------------------------------

  const columnas = useMemo(() => {
    if (matriz.length === 0) return []
    const ancho = matriz.reduce((max, fila) => Math.max(max, fila.length), 0)
    if (tieneEncabezado) {
      const primera = matriz[0] ?? []
      return Array.from({ length: ancho }, (_, i) => {
        const texto = String(primera[i] ?? '').trim()
        return texto || `Columna ${i + 1}`
      })
    }
    return Array.from({ length: ancho }, (_, i) => `Columna ${i + 1}`)
  }, [matriz, tieneEncabezado])

  const filasDeMapeo = useMemo(() => {
    const cuerpo = tieneEncabezado ? matriz.slice(1) : matriz
    return cuerpo.filter((fila) => fila.some((celda) => String(celda ?? '').trim() !== ''))
  }, [matriz, tieneEncabezado])

  const faltanCampos = CAMPOS.filter((campo) => {
    // La columna "bloque" se ignora cuando el tipo de edificación no la requiere
    if (campo.id === 'bloque' && !requiereBloque) return false
    if (mapeo[campo.id] !== null) return false
    if (campo.id === 'bloque' && bloqueGlobal.trim()) return false
    if (campo.id === 'espacio' && espacioGlobal.trim()) return false
    return true
  })

  const continuarDesdeMapeo = () => {
    if (faltanCampos.length > 0) {
      showToast(
        `Asigne las columnas obligatorias: ${faltanCampos.map((c) => c.etiqueta).join(', ')}.`,
        'error'
      )
      return
    }
    const nuevas: FilaTrabajo[] = filasDeMapeo.map((fila) => {
      const trabajo = nuevaFila()
      for (const campo of CAMPOS) {
        const indice = mapeo[campo.id]
        const crudo = indice === null ? '' : String(fila[indice] ?? '').trim()
        if (campo.id === 'bloque')
          trabajo.datos.bloque = requiereBloque ? resolverBloque(crudo) : ''
        else if (campo.id === 'espacio') trabajo.datos.espacio = crudo
        else if (campo.id === 'tipo') trabajo.datos.tipo = normalizarTipoEquipo(crudo)
        else if (campo.id === 'usenIndicador') trabajo.datos.usenIndicador = normalizarIndicador(crudo)
        else trabajo.datos[campo.id] = crudo
      }
      return trabajo
    })
    if (nuevas.length === 0) {
      showToast('No hay filas con datos después del mapeo.', 'error')
      return
    }
    setFilas(nuevas)
    setPagina(0)
    setPaso('vista')
  }

  const iniciarManual = () => {
    setAviso(null)
    if (!edificacionSel) {
      const mensaje = 'Seleccione primero la edificación.'
      setAviso(mensaje)
      return
    }
    if (filas.length === 0 || modo !== 'manual') {
      setModo('manual')
      setFilas(Array.from({ length: 5 }, nuevaFila))
      setPagina(0)
    }
    setPaso('vista')
  }

  const reiniciar = () => {
    setPaso('carga')
    setModo('archivo')
    setArchivoInfo(null)
    setHojas([])
    setHojaSel('')
    setMatriz([])
    setFilas([])
    setResultado(null)
    setConflictos(null)
    setProgreso(null)
    setAviso(null)
    setPagina(0)
    setBloqueDrawerOpen(false)
    libroRef.current = null
    if (inputArchivoRef.current) inputArchivoRef.current.value = ''
  }

  // ------------------------------------------
  // Bloques vía drawer (el catálogo de edificaciones vive en Facturas de energía)
  // ------------------------------------------

  /** Submit del BloqueDrawer: en error lanza para que el drawer muestre la alerta. */
  const crearBloqueDesdeDrawer = async (datos: BloqueFormData) => {
    if (guardandoBloque || !edificacionSel) return
    setGuardandoBloque(true)
    try {
      const res = await crearBloqueCatalogo(
        edificacionSel,
        datos.codigo,
        datos.nombre,
        datos.area || undefined,
        datos.factor || undefined
      )
      if (res.estado === 'error') {
        throw new Error(res.mensaje)
      }
      setBloqueGlobal(res.bloque.id)
      setBloqueDrawerOpen(false)
      setAviso(null)
      showToast(res.mensaje, 'success')
    } finally {
      setGuardandoBloque(false)
    }
  }

  // ------------------------------------------
  // Eliminación del catálogo (bloque)
  // ------------------------------------------

  /** Confirmación del diálogo: borra el bloque seleccionado (vacío) de la edificación. */
  const eliminarBloqueSeleccionado = async () => {
    if (borrando) return
    const objetivo = bloques.find((b) => b.id === bloqueGlobal)
    if (!objetivo) return
    setBorrando(true)
    try {
      const res = await eliminarBloqueCatalogo(objetivo.id)
      if (res.estado === 'error') {
        setAviso(res.mensaje)
        return
      }
      setBloqueGlobal('')
      setEspacioGlobal('')
      setAviso(null)
      showToast(res.mensaje, 'success')
    } finally {
      setBorrando(false)
    }
  }

  // ------------------------------------------
  // Validación (derivada del estado)
  // ------------------------------------------

  const numerosDeFila = useMemo(() => {
    const mapa = new Map<string, number>()
    filas.forEach((fila, i) => mapa.set(fila.id, i + 1))
    return mapa
  }, [filas])

  const bloqueEfectivo = (fila: FilaTrabajo): string =>
    fila.datos.bloque.trim() || bloqueGlobal.trim()

  const espacioEfectivo = (fila: FilaTrabajo): string =>
    normalizarEspacio(fila.datos.espacio) || normalizarEspacio(espacioGlobal)

  const validaciones = useMemo(() => {
    const mapa = new Map<string, ValidacionFila>()
    const claves = new Map<string, number>()

    filas.forEach((fila) => {
      if (fila.descartada) {
        mapa.set(fila.id, { errores: {}, duplicada: false })
        return
      }
      if (filaVacia(fila)) return

      const errores: Partial<Record<CampoFila, string>> = {}

      // Segmentación: si la edificación requiere bloque, debe existir y
      // pertenecer a la edificación seleccionada
      if (requiereBloque) {
        const bloqueId = bloqueEfectivo(fila)
        if (!bloqueId) {
          errores.bloque = 'Campo obligatorio'
        } else {
          const bloque = bloquesPorId.get(bloqueId)
          if (!bloque) errores.bloque = 'Bloque no encontrado'
          else if (edificacionSel && bloque.edificacionId !== edificacionSel)
            errores.bloque = 'No pertenece a esta edificación'
        }
      }

      const espacio = espacioEfectivo(fila)
      if (!espacio) errores.espacio = 'Campo obligatorio'

      for (const campo of CAMPOS) {
        if (campo.respaldadoGlobal) continue
        const valor = String(fila.datos[campo.id] ?? '').trim()
        if (!valor) errores[campo.id] = 'Campo obligatorio'
      }

      if (Object.keys(errores).length === 0) {
        const r = filaEquipoElectricoschema.safeParse({
          ...(requiereBloque ? { bloqueId: bloqueEfectivo(fila) } : {}),
          espacio,
          tipo: fila.datos.tipo.trim(),
          cantidad: fila.datos.cantidad.trim(),
          potenciaNominal: fila.datos.potenciaNominal.trim(),
          horasUsoDia: fila.datos.horasUsoDia.trim(),
          diasUsoMes: fila.datos.diasUsoMes.trim(),
          usenIndicador: fila.datos.usenIndicador.trim(),
        })
        if (!r.success) {
          for (const issue of r.error.issues) {
            const crudo = String(issue.path[0])
            const clave = (crudo === 'bloqueId' ? 'bloque' : crudo) as CampoFila
            if (!errores[clave]) errores[clave] = issue.message
          }
        }
      }

      mapa.set(fila.id, { errores, duplicada: false })
    })

    // Segunda pasada: duplicados (mismo bloque + espacio + tipo) entre filas sin error
    filas.forEach((fila) => {
      const validacion = mapa.get(fila.id)
      if (!validacion || fila.descartada || filaVacia(fila)) return
      if (Object.keys(validacion.errores).length > 0) return

      const clave = `${bloqueEfectivo(fila)}|${espacioEfectivo(fila)}|${fila.datos.tipo.trim().toUpperCase()}`
      const numero = numerosDeFila.get(fila.id) ?? 0
      const previa = claves.get(clave)
      if (previa !== undefined) {
        validacion.duplicada = true
        validacion.errores.tipo = `Duplicado: ya está en la fila ${previa}`
      } else {
        claves.set(clave, numero)
      }
    })

    return mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, numerosDeFila, bloqueGlobal, espacioGlobal, bloquesPorId, edificacionSel, requiereBloque])

  const resumen = useMemo(() => {
    let utiles = 0
    let validas = 0
    let conError = 0
    let duplicadas = 0
    let descartadas = 0

    filas.forEach((fila) => {
      const vacia = filaVacia(fila)
      if (fila.descartada) {
        if (!vacia) descartadas++
        return
      }
      if (vacia) return
      utiles++
      const v = validaciones.get(fila.id)
      if (!v) return
      if (v.duplicada) duplicadas++
      else if (Object.keys(v.errores).length > 0) conError++
      else validas++
    })

    return { total: filas.length, utiles, validas, conError, duplicadas, descartadas }
  }, [filas, validaciones])

  const payload = useMemo<FilaEnvioEquipos[]>(() => {
    const salida: FilaEnvioEquipos[] = []
    filas.forEach((fila, i) => {
      if (fila.descartada || filaVacia(fila)) return
      const v = validaciones.get(fila.id)
      if (!v || v.duplicada || Object.keys(v.errores).length > 0) return
      salida.push({
        fila: i + 1,
        ...(requiereBloque ? { bloqueId: bloqueEfectivo(fila) } : {}),
        espacio: espacioEfectivo(fila),
        tipo: fila.datos.tipo.trim() as FilaEnvioEquipos['tipo'],
        cantidad: fila.datos.cantidad.trim(),
        potenciaNominal: fila.datos.potenciaNominal.trim(),
        horasUsoDia: fila.datos.horasUsoDia.trim(),
        diasUsoMes: fila.datos.diasUsoMes.trim(),
        usenIndicador: fila.datos.usenIndicador.trim() as FilaEnvioEquipos['usenIndicador'],
      })
    })
    return salida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, validaciones, bloqueGlobal, espacioGlobal, requiereBloque])

  // ------------------------------------------
  // Edición de filas
  // ------------------------------------------

  const actualizarCelda = (idFila: string, campo: CampoFila, valor: string) => {
    setFilas((prev) =>
      prev.map((fila) => (fila.id === idFila ? { ...fila, datos: { ...fila.datos, [campo]: valor } } : fila))
    )
  }

  const alternarDescartada = (idFila: string) => {
    setFilas((prev) =>
      prev.map((fila) => (fila.id === idFila ? { ...fila, descartada: !fila.descartada } : fila))
    )
  }

  const descartarConError = () => {
    setFilas((prev) =>
      prev.map((fila) => {
        if (fila.descartada || filaVacia(fila)) return fila
        const v = validaciones.get(fila.id)
        const tieneError = v && Object.keys(v.errores).length > 0
        return tieneError ? { ...fila, descartada: true } : fila
      })
    )
    showToast('Se descartaron las filas con errores.', 'info')
  }

  const restaurarTodas = () => {
    setFilas((prev) => prev.map((fila) => ({ ...fila, descartada: false })))
    showToast('Se restauraron todas las filas.', 'info')
  }

  const agregarFila = () => {
    setFilas((prev) => [...prev, nuevaFila()])
    setPagina(Math.floor(filas.length / FILAS_POR_PAGINA))
  }

  // ------------------------------------------
  // Plantillas
  // ------------------------------------------

  const descargarPlantilla = () => {
    const encabezado = 'bloque,espacio,tipo,cantidad,potenciaNominal,horasUsoDia,diasUsoMes,usenIndicador'
    const ejemplos = [
      'BLOQUE-A-001,Aula Mayor,HVAC,3,45.5,12,22,ACTIVO',
      'BLOQUE-A-001,Pasillo,ILUMINACION,150,18.2,10,22,ACTIVO',
      'BLOQUE-A-001,Oficina Administrativa,OFICINA,45,12.8,8,22,ACTIVO',
    ]
    const csv = '\uFEFF' + [encabezado, ...ejemplos].join('\r\n')
    descargar('plantilla-inventario-equipos.csv', csv, 'text/csv;charset=utf-8')
    showToast('Plantilla descargada. Ábrela en Excel y rellene sus filas.', 'success')
  }

  const descargarReporteErrores = () => {
    if (!resultado || resultado.errores.length === 0) return
    const lineas = ['fila,razon', ...resultado.errores.map((e) => `${e.fila},"${e.razon.replace(/"/g, '""')}"`)]
    descargar('errores-importacion-equipos.csv', '\uFEFF' + lineas.join('\r\n'), 'text/csv;charset=utf-8')
  }

  // ------------------------------------------
  // Importación
  // ------------------------------------------

  const ejecutarImportacion = useCallback(
    async (sobrescribir: boolean) => {
      if (payload.length === 0 || importando) return
      setImportando(true)
      setAviso(null)
      setProgreso(5)
      const timer = window.setInterval(() => {
        setProgreso((p) => (p !== null && p < 85 ? p + 5 : p))
      }, 120)

      try {
        const res = await importarFilasEquipos(edificacionSel, payload, sobrescribir)
        window.clearInterval(timer)
        setProgreso(100)

        if (res.estado === 'confirmacion_requerida') {
          setProgreso(null)
          setConflictos(res.conflictos)
          showToast(res.mensaje, 'info')
          if (res.errores.length > 0) {
            const detalle = res.errores
              .slice(0, 3)
              .map((e) => `fila ${e.fila}: ${e.razon}`)
              .join('; ')
            setAviso(
              `${res.rechazadas} fila(s) no podrán importarse. ` +
                detalle +
                (res.errores.length > 3 ? ' (verá el reporte completo al finalizar)' : '')
            )
          }
        } else if (res.estado === 'completado') {
          setResultado(res)
          setConflictos(null)
          setPaso('resultado')
          showToast(res.mensaje, res.errores.length > 0 ? 'info' : 'success')
        } else {
          setProgreso(null)
          setAviso(res.mensaje)
          showToast(res.mensaje, 'error')
        }
      } catch {
        window.clearInterval(timer)
        setProgreso(null)
        const mensaje = 'Error de conexión al importar. Intente nuevamente.'
        setAviso(mensaje)
      } finally {
        setImportando(false)
      }
    },
    [payload, importando, edificacionSel, showToast]
  )

  // ------------------------------------------
  // Permisos / estados vacíos
  // ------------------------------------------

  if (!puedeCargar) {
    return (
      <div className="ui-callout ui-callout-info" role="status">
        Su rol tiene permisos de <strong>solo lectura</strong> en este módulo. Puede consultar la
        información, pero no cargar ni modificar el inventario de equipos.
      </div>
    )
  }

  // ------------------------------------------
  // Render
  // ------------------------------------------

  const indicePagina = Math.min(pagina, Math.max(0, Math.ceil(filas.length / FILAS_POR_PAGINA) - 1))
  const filasVisibles = filas.slice(indicePagina * FILAS_POR_PAGINA, (indicePagina + 1) * FILAS_POR_PAGINA)
  const totalPaginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA))

  const pasos: { id: Paso; etiqueta: string }[] =
    modo === 'manual'
      ? [
          { id: 'carga', etiqueta: '1. Edificación y carga' },
          { id: 'vista', etiqueta: '2. Vista previa' },
          { id: 'resultado', etiqueta: '3. Importación' },
        ]
      : [
          { id: 'carga', etiqueta: '1. Edificación y carga' },
          { id: 'mapeo', etiqueta: '2. Mapeo' },
          { id: 'vista', etiqueta: '3. Vista previa' },
          { id: 'resultado', etiqueta: '4. Importación' },
        ]
  const ordenPasos: Paso[] = pasos.map((p) => p.id)
  const pasoActual = ordenPasos.indexOf(paso)

  const iconosPaso: Record<Paso, React.ReactNode> = {
    carga: <IconCarga />,
    mapeo: <IconMapeo />,
    vista: <IconVistaPrevia />,
    resultado: <IconImportar />,
  }

  // Cuando la edificación no requiere bloque, la columna se oculta por completo
  const camposVisibles = requiereBloque ? CAMPOS : CAMPOS.filter((c) => c.id !== 'bloque')

  const etiquetaDeBloque = (id: string): string => {
    const b = bloquesPorId.get(id)
    return b ? `${b.codigo} — ${b.nombre}` : id
  }

  const opcionesBloque = (valorActual: string): { valor: string; etiqueta: string }[] => {
    const base = bloquesFiltrados.map((b) => ({ valor: b.id, etiqueta: `${b.codigo} — ${b.nombre}` }))
    if (valorActual && !bloquesFiltrados.some((b) => b.id === valorActual)) {
      const conocido = bloquesPorId.get(valorActual)
      base.push({
        valor: valorActual,
        etiqueta: conocido
          ? `${conocido.codigo} — otro tipo de edificación`
          : `${valorActual} (no encontrado)`,
      })
    }
    return base
  }

  return (
    <div className="space-y-6">
      {/* Indicador de pasos */}
      <ol
        className="mx-auto flex max-w-2xl flex-wrap items-start justify-center gap-x-4 gap-y-4 text-xs"
        aria-label="Pasos de la importación"
      >
        {pasos.map((p, i) => {
          const navegable = i < pasoActual && paso !== 'resultado'
          const estadoCirculo =
            i === pasoActual
              ? 'border-emerald-600 bg-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-500/30'
              : i < pasoActual
                ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:border-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'border-gray-300 bg-white text-gray-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500'
          const estadoTexto =
            i === pasoActual
              ? 'text-gray-900 dark:text-gray-100'
              : i < pasoActual
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-gray-400 dark:text-slate-500'
          const contenido = (
            <>
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${estadoCirculo}`}
              >
                {iconosPaso[p.id]}
              </span>
              <span
                className={`max-w-32 text-center font-medium leading-tight ${estadoTexto}`}
              >
                {p.etiqueta}
              </span>
            </>
          )
          return (
            <React.Fragment key={p.id}>
              {i > 0 && (
                <li
                  aria-hidden
                  className={`mt-[21px] hidden h-0.5 min-w-8 flex-1 md:block ${
                    i <= pasoActual ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-gray-200 dark:bg-slate-700'
                  }`}
                />
              )}
              <li
                className="flex flex-col items-center gap-2"
                aria-current={i === pasoActual ? 'step' : undefined}
              >
                {navegable ? (
                  <button
                    type="button"
                    onClick={() => setPaso(p.id)}
                    className="focus-ring flex cursor-pointer flex-col items-center gap-2 rounded-lg"
                    aria-label={`Ir al paso ${p.etiqueta}`}
                  >
                    {contenido}
                  </button>
                ) : (
                  <span className="flex flex-col items-center gap-2">{contenido}</span>
                )}
              </li>
            </React.Fragment>
          )
        })}
      </ol>

      {aviso && (
        <div
          className="ui-callout ui-callout-danger flex items-start justify-between gap-3"
          role="alert"
        >
          <p>{aviso}</p>
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="focus-ring -m-1 shrink-0 rounded p-1 font-bold text-red-500 hover:text-red-700"
            aria-label="Cerrar aviso"
          >
            ×
          </button>
        </div>
      )}

      {/* ============ PASO 1: CARGA ============ */}
      {paso === 'carga' && (
        <div className="space-y-4">
          {/* Segmentación: edificación + bloque condicional + espacio */}
          <div className="ui-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="ui-title text-sm">Edificación</h3>
                <p className="ui-muted mt-1 text-xs">
                  Seleccione la edificación de los equipos; el formulario se adapta a su tipo.
                  El catálogo se administra en Facturas de energía › Edificaciones.
                </p>
              </div>
            </div>

            {edificaciones.length === 0 && (
              <div className="ui-callout ui-callout-warn mt-3 flex flex-wrap items-center justify-between gap-3">
                <p>
                  Aún no hay edificaciones en el catálogo. Cree la primera desde Facturas de energía ›
                  Edificaciones.
                </p>
                <button
                  type="button"
                  onClick={onIrAlCatalogo}
                  className="ui-btn ui-btn-secondary shrink-0"
                >
                  Ir al catálogo
                </button>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="edificacion-sel" className="ui-label">
                  Edificación <span className="text-red-600">*</span>
                </label>
                <select
                  id="edificacion-sel"
                  value={edificacionSel}
                  onChange={(e) => {
                    setEdificacionSel(e.target.value)
                    setBloqueGlobal('')
                    setEspacioGlobal('')
                  }}
                  aria-invalid={!edificacionSel}
                  className={`ui-input mt-1 cursor-pointer ${
                    !edificacionSel ? 'ui-input-error' : ''
                  }`}
                >
                  <option value="">— Seleccione —</option>
                  {edificaciones.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} — {etiquetaTipo(e.tipo)}
                    </option>
                  ))}
                </select>
                {!edificacionSel ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">Obligatorio</p>
                ) : (
                  <p className="ui-muted mt-1 text-xs">Tipo: {tipoActual?.etiqueta}</p>
                )}
              </div>

              <div>
                <label htmlFor="espacio-global" className="ui-label">
                  Espacio global (opcional)
                </label>
                <input
                  id="espacio-global"
                  type="text"
                  value={espacioGlobal}
                  onChange={(e) => setEspacioGlobal(e.target.value)}
                  disabled={!edificacionSel}
                  list="datalist-espacios-global"
                  placeholder="Ej. Aula Mayor"
                  maxLength={100}
                  className="ui-input mt-1"
                />
                <datalist id="datalist-espacios-global">
                  {(bloqueGlobal ? espaciosPorBloque.get(bloqueGlobal) ?? [] : []).map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <p className="ui-muted mt-1 text-xs">Aplica a las filas sin espacio propio.</p>
              </div>
            </div>

            {/* Bloque / Piso: habilitado solo si el tipo de edificación lo requiere */}
            {requiereBloque && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-[240px] flex-1">
                    <label
                      htmlFor="bloque-global"
                      className="ui-label"
                    >
                      Bloque / Piso <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="bloque-global"
                      value={bloqueGlobal}
                      onChange={(e) => setBloqueGlobal(e.target.value)}
                      disabled={!edificacionSel}
                      className="ui-input mt-1"
                    >
                      <option value="">
                        {edificacionSel
                          ? '— Seleccione / columna en archivo —'
                          : '— Seleccione la edificación —'}
                      </option>
                      {bloquesFiltrados.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.codigo} — {b.nombre}
                        </option>
                      ))}
                    </select>
                    <p className="ui-muted mt-1 text-xs">
                      Toda fila debe tener bloque: use este valor global o la columna del archivo.
                      Seleccione un bloque para poder eliminarlo.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDialogoBorrado('bloque')}
                      disabled={!bloqueGlobal || borrando}
                      aria-label={
                        bloqueSeleccionado
                          ? `Eliminar bloque ${bloqueSeleccionado.codigo}`
                          : 'Eliminar bloque seleccionado'
                      }
                      className="ui-btn ui-btn-secondary text-red-600 hover:border-red-400 hover:text-red-700"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Eliminar bloque
                    </button>
                    <button
                      type="button"
                      onClick={() => setBloqueDrawerOpen(true)}
                      disabled={!edificacionSel}
                      className="ui-btn ui-btn-accent"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Nuevo Bloque
                    </button>
                  </div>
                </div>

                {edificacionSel && bloquesFiltrados.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                    Esta edificación aún no tiene bloques; cree el primero con «Nuevo Bloque».
                  </p>
                )}
              </div>
            )}

            {edificacionSel && !requiereBloque && (
              <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
                Esta edificación no segmenta por bloque: la importación usará su bloque único
                automáticamente y la columna «bloque» del archivo se ignora.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              aria-label={`Zona de carga de archivo. Formatos ${ETIQUETA_FORMATOS}, máximo ${ETIQUETA_TAMANO}. Presione Enter para seleccionar un archivo.`}
              onClick={() => inputArchivoRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  inputArchivoRef.current?.click()
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setArrastre(true)
              }}
              onDragLeave={() => setArrastre(false)}
              onDrop={(e) => {
                e.preventDefault()
                setArrastre(false)
                const file = e.dataTransfer.files?.[0]
                if (file) void procesarArchivo(file)
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-ring ${
                arrastre
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                  : 'border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-600 dark:hover:bg-emerald-500/10'
              }`}
            >
              <input
                ref={inputArchivoRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void procesarArchivo(file)
                }}
              />
              {leyendo ? (
                <>
                  <span
                    className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600"
                    aria-hidden
                  />
                  <p className="ui-title mt-3 text-sm">Leyendo archivo…</p>
                </>
              ) : (
                <>
                  <svg
                    className="h-10 w-10 text-emerald-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="ui-title mt-3 text-sm">
                    Arrastre el archivo aquí o haga clic para seleccionarlo
                  </p>
                  <p className="ui-muted mt-1 text-xs">
                    Formatos {ETIQUETA_FORMATOS} · máximo {ETIQUETA_TAMANO}
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => inputArchivoRef.current?.click()}
                className="ui-btn ui-btn-primary"
                disabled={leyendo}
              >
                Seleccionar archivo
              </button>
              <button
                type="button"
                onClick={iniciarManual}
                className="ui-btn ui-btn-secondary"
              >
                Ingreso manual (tabla editable)
              </button>
              <button
                type="button"
                onClick={descargarPlantilla}
                className="ui-btn ui-btn-secondary"
              >
                Descargar plantilla de ejemplo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ PASO 2: MAPEO ============ */}
      {paso === 'mapeo' && (
        <div className="space-y-4">
          <div className="ui-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="ui-title text-sm">{archivoInfo?.nombre}</p>
                <p className="ui-muted text-xs">
                  {((archivoInfo?.bytes ?? 0) / 1024).toFixed(1)} KB · {filasDeMapeo.length} filas
                  con datos · {edificacionActual?.nombre} ({tipoActual?.etiqueta})
                </p>
              </div>
              <button
                type="button"
                onClick={reiniciar}
                className="focus-ring cursor-pointer rounded text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cambiar archivo
              </button>
            </div>

            {hojas.length > 1 && (
              <div className="mt-4">
                <label htmlFor="selector-hoja" className="ui-label">
                  Hoja del archivo Excel
                </label>
                <select
                  id="selector-hoja"
                  value={hojaSel}
                  onChange={(e) => cambiarHoja(e.target.value)}
                  className="ui-input mt-1"
                >
                  {hojas.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <p className="ui-muted mt-1 text-xs">El archivo tiene {hojas.length} hojas.</p>
              </div>
            )}

            <label className="ui-label mt-4 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={tieneEncabezado}
                onChange={(e) => {
                  const activo = e.target.checked
                  setTieneEncabezado(activo)
                  const primera = matriz[0] ?? []
                  setMapeo(
                    autoMapear(
                      activo
                        ? primera.map((c, i) => String(c).trim() || `Columna ${i + 1}`)
                        : primera.map((_, i) => `Columna ${i + 1}`)
                    )
                  )
                }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-700"
              />
              <span>
                La primera fila contiene los encabezados{' '}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    tieneEncabezado
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'
                  }`}
                >
                  {tieneEncabezado ? 'detectado automáticamente' : 'sin encabezados'}
                </span>
              </span>
            </label>
          </div>

          <div className="ui-card">
            <h3 className="ui-title text-base">Mapeo de columnas</h3>
            <p className="ui-muted mt-1 text-xs">
              Se sugirió una asignación automática. Si los nombres no coinciden, ajústela aquí.
              Espacio puede omitirse si definió un valor global en el paso 1
              {requiereBloque
                ? ', igual que el bloque.'
                : '; la columna de bloque no aplica a esta edificación.'}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {camposVisibles.map((campo) => {
                const id = `map-${campo.id}`
                const sinAsignar = mapeo[campo.id] === null
                const opcionalGlobal =
                  sinAsignar &&
                  campo.respaldadoGlobal &&
                  ((campo.id === 'bloque' && bloqueGlobal.trim()) ||
                    (campo.id === 'espacio' && espacioGlobal.trim()))
                const falta = sinAsignar && !opcionalGlobal
                return (
                  <div key={campo.id}>
                    <label htmlFor={id} className="ui-label">
                      {campo.etiqueta}{' '}
                      {falta ? (
                        <span className="text-red-600">*</span>
                      ) : opcionalGlobal ? (
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(valor global)</span>
                      ) : null}
                    </label>
                    <select
                      id={id}
                      value={mapeo[campo.id] === null ? '' : String(mapeo[campo.id])}
                      onChange={(e) =>
                        setMapeo((prev) => ({
                          ...prev,
                          [campo.id]: e.target.value === '' ? null : Number(e.target.value),
                        }))
                      }
                      aria-invalid={falta}
                      className={`ui-input mt-1 cursor-pointer ${falta ? 'ui-input-error' : ''}`}
                    >
                      <option value="">— Sin asignar —</option>
                      {columnas.map((nombre, i) => (
                        <option key={i} value={i}>
                          {nombre}
                        </option>
                      ))}
                    </select>
                    {falta && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Columna obligatoria</p>}
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setPaso('carga')}
                className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Atrás
              </button>
              <button
                type="button"
                onClick={continuarDesdeMapeo}
                disabled={faltanCampos.length > 0}
                className="ui-btn ui-btn-primary"
              >
                Continuar a vista previa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ PASO 3: VISTA PREVIA ============ */}
      {paso === 'vista' && (
        <div className="space-y-4">
          {/* Volver al paso anterior (mismo estilo/posición que "Volver a usuarios") */}
          <button
            type="button"
            onClick={() => setPaso(modo === 'manual' ? 'carga' : 'mapeo')}
            className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Atrás
          </button>

          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { etiqueta: 'Totales', valor: resumen.utiles, clase: 'text-gray-900 dark:text-gray-100' },
              { etiqueta: 'Válidas', valor: resumen.validas, clase: 'text-emerald-600 dark:text-emerald-400' },
              { etiqueta: 'Con error', valor: resumen.conError, clase: 'text-red-600 dark:text-red-400' },
              { etiqueta: 'Duplicadas', valor: resumen.duplicadas, clase: 'text-amber-600 dark:text-amber-400' },
              { etiqueta: 'Descartadas', valor: resumen.descartadas, clase: 'text-gray-500 dark:text-gray-400' },
            ].map((c) => (
              <div
                key={c.etiqueta}
                className="rounded-xl border border-gray-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900"
              >
                <p className={`text-xl font-semibold ${c.clase}`}>{c.valor}</p>
                <p className="ui-muted text-xs">{c.etiqueta}</p>
              </div>
            ))}
          </div>

          {/* Barra de herramientas */}
          <div className="ui-card">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[180px]">
                <label htmlFor="vista-edificacion" className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Edificación
                </label>
                <p id="vista-edificacion" className="ui-title text-sm">
                  {edificacionActual?.nombre}
                </p>
                <p className="ui-muted text-xs">{tipoActual?.etiqueta}</p>
              </div>
              {requiereBloque && (
                <div className="min-w-[220px]">
                  <label htmlFor="vista-bloque-global" className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Bloque global
                  </label>
                  <select
                    id="vista-bloque-global"
                    value={bloqueGlobal}
                    onChange={(e) => setBloqueGlobal(e.target.value)}
                    className="ui-input mt-0.5"
                  >
                    <option value="">— Todos / columna en archivo —</option>
                    {bloquesFiltrados.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.codigo} — {b.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="min-w-[200px]">
                <label htmlFor="vista-espacio-global" className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Espacio global
                </label>
                <input
                  id="vista-espacio-global"
                  type="text"
                  value={espacioGlobal}
                  onChange={(e) => setEspacioGlobal(e.target.value)}
                  list="datalist-espacios-global-vista"
                  maxLength={100}
                  className="ui-input mt-0.5"
                />
                <datalist id="datalist-espacios-global-vista">
                  {(bloqueGlobal ? espaciosPorBloque.get(bloqueGlobal) ?? [] : []).map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>

              <div className="flex flex-wrap gap-2">
                {modo === 'manual' && (
                  <button
                    type="button"
                    onClick={agregarFila}
                    className="ui-btn ui-btn-secondary ui-btn-sm"
                  >
                    + Agregar fila
                  </button>
                )}
                <button
                  type="button"
                  onClick={descartarConError}
                  disabled={resumen.conError + resumen.duplicadas === 0}
                  className="ui-btn ui-btn-secondary ui-btn-sm"
                >
                  Descartar filas con error
                </button>
                <button
                  type="button"
                  onClick={restaurarTodas}
                  disabled={resumen.descartadas === 0}
                  className="ui-btn ui-btn-secondary ui-btn-sm"
                >
                  Restaurar todas
                </button>
              </div>
            </div>
          </div>

          {/* Tabla editable */}
          <div className="ui-table-shell">
            <div className="overflow-x-auto">
              <table className="ui-table">
                <caption className="sr-only">
                  Vista previa editable de las filas a importar. Las filas con errores aparecen
                  resaltadas en rojo.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">
                      #
                    </th>
                    {camposVisibles.map((campo) => (
                      <th key={campo.id} scope="col">
                        {campo.etiqueta}
                      </th>
                    ))}
                    <th scope="col">
                      Estado
                    </th>
                    <th scope="col" className="text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filasVisibles.length === 0 && (
                    <tr>
                      <td colSpan={camposVisibles.length + 3} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                        No hay filas. Vuelva al paso anterior o agregue filas manualmente.
                      </td>
                    </tr>
                  )}
                  {filasVisibles.map((fila) => {
                    const indiceAbsoluto = filas.indexOf(fila)
                    const numero = indiceAbsoluto + 1
                    const v = validaciones.get(fila.id)
                    const errores = v?.errores ?? {}
                    const tieneError = !fila.descartada && Object.keys(errores).length > 0
                    const filaClass = fila.descartada
                      ? 'bg-gray-50 opacity-60 dark:bg-slate-800/40'
                      : v?.duplicada
                        ? 'bg-amber-50 dark:bg-amber-500/10'
                        : tieneError
                          ? 'bg-red-50/60 dark:bg-red-500/10'
                          : ''

                    const bloqueDeFila = fila.datos.bloque.trim() || bloqueGlobal.trim()
                    const listaEspacios = espaciosPorBloque.get(bloqueDeFila) ?? []

                    return (
                      <tr key={fila.id} className={filaClass}>
                        <td className="px-3 py-2 font-mono text-xs text-gray-400 dark:text-gray-500">{numero}</td>

                        {camposVisibles.map((campo) => {
                          const idError = `err-${fila.id}-${campo.id}`
                          const mensaje = errores[campo.id]
                          const baseInput = `w-full rounded-md border px-2 py-1 text-sm placeholder:text-gray-300 focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uv-lime focus-visible:ring-offset-1 disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100 dark:placeholder:text-slate-500 dark:focus-visible:ring-offset-slate-950 dark:disabled:bg-slate-800 ${
                            mensaje
                              ? 'border-red-300 bg-white dark:border-red-900 dark:bg-red-950/40'
                              : 'border-gray-200'
                          }`

                          if (campo.id === 'bloque') {
                            return (
                              <td key={campo.id} className="px-3 py-2 align-top">
                                <select
                                  value={fila.datos.bloque}
                                  onChange={(e) => actualizarCelda(fila.id, 'bloque', e.target.value)}
                                  disabled={fila.descartada}
                                  aria-label={`Fila ${numero}, Bloque`}
                                  aria-invalid={Boolean(mensaje)}
                                  aria-describedby={mensaje ? idError : undefined}
                                  className={baseInput}
                                >
                                  <option value="">
                                    {bloqueGlobal ? '— Usar global —' : '— Seleccione —'}
                                  </option>
                                  {opcionesBloque(fila.datos.bloque).map((op) => (
                                    <option key={op.valor} value={op.valor}>
                                      {op.etiqueta}
                                    </option>
                                  ))}
                                </select>
                                {mensaje && (
                                  <p id={idError} className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                    {mensaje}
                                  </p>
                                )}
                              </td>
                            )
                          }

                          if (campo.id === 'espacio') {
                            const idLista = `espacios-${bloqueDeFila || 'global'}`
                            return (
                              <td key={campo.id} className="px-3 py-2 align-top">
                                <input
                                  type="text"
                                  value={fila.datos.espacio}
                                  onChange={(e) => actualizarCelda(fila.id, 'espacio', e.target.value)}
                                  disabled={fila.descartada}
                                  list={idLista}
                                  placeholder={espacioGlobal || 'Ej. Aula Mayor'}
                                  maxLength={100}
                                  aria-label={`Fila ${numero}, Espacio`}
                                  aria-invalid={Boolean(mensaje)}
                                  aria-describedby={mensaje ? idError : undefined}
                                  className={baseInput}
                                />
                                <datalist id={idLista}>
                                  {listaEspacios.map((n) => (
                                    <option key={n} value={n} />
                                  ))}
                                </datalist>
                                {mensaje && (
                                  <p id={idError} className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                    {mensaje}
                                  </p>
                                )}
                              </td>
                            )
                          }

                          if (campo.id === 'tipo') {
                            return (
                              <td key={campo.id} className="px-3 py-2 align-top">
                                <select
                                  value={fila.datos.tipo}
                                  onChange={(e) => actualizarCelda(fila.id, 'tipo', e.target.value)}
                                  disabled={fila.descartada}
                                  aria-label={`Fila ${numero}, Tipo de equipo`}
                                  aria-invalid={Boolean(mensaje)}
                                  aria-describedby={mensaje ? idError : undefined}
                                  className={baseInput}
                                >
                                  <option value="">— Seleccione —</option>
                                  {TIPOS_EQUIPO.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                  {fila.datos.tipo && !TIPOS_EQUIPO.includes(fila.datos.tipo as never) && (
                                    <option value={fila.datos.tipo}>{fila.datos.tipo} (inválido)</option>
                                  )}
                                </select>
                                {mensaje && (
                                  <p id={idError} className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                    {mensaje}
                                  </p>
                                )}
                              </td>
                            )
                          }

                          if (campo.id === 'usenIndicador') {
                            return (
                              <td key={campo.id} className="px-3 py-2 align-top">
                                <select
                                  value={fila.datos.usenIndicador}
                                  onChange={(e) => actualizarCelda(fila.id, 'usenIndicador', e.target.value)}
                                  disabled={fila.descartada}
                                  aria-label={`Fila ${numero}, ¿En uso?`}
                                  aria-invalid={Boolean(mensaje)}
                                  aria-describedby={mensaje ? idError : undefined}
                                  className={baseInput}
                                >
                                  <option value="">— Seleccione —</option>
                                  {ESTADOS_INDICADOR.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                                {mensaje && (
                                  <p id={idError} className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                    {mensaje}
                                  </p>
                                )}
                              </td>
                            )
                          }

                          return (
                            <td key={campo.id} className="px-3 py-2 align-top">
                              <input
                                type="text"
                                inputMode={campo.tipo === 'numero' ? 'decimal' : 'text'}
                                value={fila.datos[campo.id]}
                                onChange={(e) => actualizarCelda(fila.id, campo.id, e.target.value)}
                                disabled={fila.descartada}
                                placeholder={campo.ejemplo}
                                aria-label={`Fila ${numero}, ${campo.etiqueta}`}
                                aria-invalid={Boolean(mensaje)}
                                aria-describedby={mensaje ? idError : undefined}
                                className={baseInput}
                              />
                              {mensaje && (
                                <p id={idError} className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                  {mensaje}
                                </p>
                              )}
                            </td>
                          )
                        })}

                        <td className="px-3 py-2">
                          {fila.descartada ? (
                            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-slate-700 dark:text-gray-300">
                              Descartada
                            </span>
                          ) : v?.duplicada ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
                              Duplicada
                            </span>
                          ) : tieneError ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-500/15 dark:text-red-400">
                              Con error
                            </span>
                          ) : filaVacia(fila) ? (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                              Vacía
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                              Válida
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => alternarDescartada(fila.id)}
                            className="focus-ring cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-slate-800 dark:hover:text-gray-200"
                            aria-label={
                              fila.descartada
                                ? `Restaurar fila ${numero}`
                                : `Descartar fila ${numero}`
                            }
                          >
                            {fila.descartada ? 'Restaurar' : 'Descartar'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación: 50 filas por página */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-800/50">
              <p className="text-gray-600 dark:text-gray-300">
                Mostrando{' '}
                <strong>
                  {filasVisibles.length > 0 ? indicePagina * FILAS_POR_PAGINA + 1 : 0}–
                  {Math.min((indicePagina + 1) * FILAS_POR_PAGINA, filas.length)}
                </strong>{' '}
                de {filas.length} filas (50 por página)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  disabled={indicePagina === 0}
                  className="ui-btn ui-btn-secondary ui-btn-sm"
                >
                  Anterior
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Página {indicePagina + 1} de {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                  disabled={indicePagina >= totalPaginas - 1}
                  className="ui-btn ui-btn-secondary ui-btn-sm"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>

          {/* Confirmación de importación */}
          <div className="ui-card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <p>
                  Listo para importar: <strong className="text-emerald-700 dark:text-emerald-400">{payload.length}</strong>{' '}
                  filas válidas
                  {resumen.conError + resumen.duplicadas > 0 && (
                    <span>
                      {' '}
                      · se omitirán {resumen.conError + resumen.duplicadas} con error o duplicadas
                    </span>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void ejecutarImportacion(false)}
                disabled={payload.length === 0 || importando}
                className="ui-btn ui-btn-primary"
              >
                {importando ? 'Importando…' : `Importar ${payload.length} filas`}
              </button>
            </div>

            {progreso !== null && (
              <div className="mt-4" aria-live="polite">
                <div className="ui-muted flex items-center justify-between text-xs">
                  <span>{progreso < 100 ? 'Guardando registros…' : 'Listo'}</span>
                  <span>{progreso}%</span>
                </div>
                <div
                  className="ui-progress mt-1"
                  role="progressbar"
                  aria-valuenow={progreso}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progreso de importación"
                >
                  <div
                    className="ui-progress-fill"
                    style={{ width: `${progreso}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ PASO 4: RESULTADO ============ */}
      {paso === 'resultado' && resultado && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="flex items-start gap-3">
              <svg className="h-6 w-6 flex-shrink-0 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 0016 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="min-w-0">
                <h3 className="ui-title text-sm">Importación finalizada</h3>
                <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">{resultado.mensaje}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { etiqueta: 'Insertados', valor: resultado.insertadas, clase: 'text-emerald-700 dark:text-emerald-400' },
                { etiqueta: 'Actualizados', valor: resultado.actualizadas, clase: 'text-sky-700 dark:text-sky-400' },
                { etiqueta: 'Espacios creados', valor: resultado.espaciosCreados, clase: 'text-violet-700 dark:text-violet-400' },
                { etiqueta: 'Rechazados', valor: resultado.rechazadas, clase: 'text-red-600 dark:text-red-400' },
                {
                  etiqueta: 'Total enviado',
                  valor: resultado.insertadas + resultado.actualizadas + resultado.rechazadas,
                  clase: 'text-gray-700 dark:text-gray-200',
                },
              ].map((c) => (
                <div
                  key={c.etiqueta}
                  className="rounded-lg bg-white/70 p-3 text-center dark:bg-slate-900/70"
                >
                  <p className={`text-lg font-semibold ${c.clase}`}>{c.valor}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{c.etiqueta}</p>
                </div>
              ))}
            </div>
          </div>

          {resultado.errores.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-white p-4 dark:border-red-900 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="ui-title text-sm text-red-700 dark:text-red-400">
                  Filas rechazadas ({resultado.errores.length})
                </h3>
                <button
                  type="button"
                  onClick={descargarReporteErrores}
                  className="ui-btn ui-btn-secondary ui-btn-sm"
                >
                  Descargar reporte de errores
                </button>
              </div>
              <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
                {resultado.errores.slice(0, 100).map((e, i) => (
                  <li key={i} className="flex gap-2 text-gray-700 dark:text-gray-200">
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-500">Fila {e.fila}</span>
                    <span className="text-red-600 dark:text-red-400">{e.razon}</span>
                  </li>
                ))}
                {resultado.errores.length > 100 && (
                  <li className="ui-muted text-xs">
                    … y {resultado.errores.length - 100} errores más en el reporte.
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={reiniciar}
              className="ui-btn ui-btn-primary"
            >
              Nueva importación
            </button>
            <button
              type="button"
              onClick={() => setPaso('vista')}
              className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Volver a la vista previa
            </button>
          </div>
        </div>
      )}

      {/* ============ MODAL DE CONFIRMACIÓN (sobrescritura) ============ */}
      {conflictos && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConflictos(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-conflicto"
            className="ui-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="titulo-conflicto" className="ui-title text-base">
              Confirmar reemplazo de datos
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Se encontraron <strong>{conflictos.length}</strong> equipos ya guardados con el
              mismo bloque, espacio y tipo. Si continúa, esos registros serán{' '}
              <strong>reemplazados</strong> con los datos del archivo.
            </p>

            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
              {conflictos.slice(0, 20).map((c, i) => (
                <li key={i} className="text-gray-700 dark:text-gray-200">
                  <span className="font-mono text-xs text-gray-400 dark:text-gray-500">Fila {c.fila}</span> —{' '}
                  {etiquetaDeBloque(c.bloqueId)} · {c.espacio} · {c.tipo}
                </li>
              ))}
              {conflictos.length > 20 && (
                <li className="text-xs text-gray-500 dark:text-gray-400">… y {conflictos.length - 20} más</li>
              )}
            </ul>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setConflictos(null)}
                className="ui-btn ui-btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConflictos(null)
                  void ejecutarImportacion(true)
                }}
                disabled={importando}
                className="ui-btn ui-btn-danger"
              >
                Sobrescribir {conflictos.length} registros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer de creación de bloques (patrón "Nuevo usuario": panel lateral con portal) */}
      <BloqueDrawer
        isOpen={bloqueDrawerOpen}
        onClose={() => setBloqueDrawerOpen(false)}
        onSubmit={crearBloqueDesdeDrawer}
        edificacion={edificacionActual}
        submitting={guardandoBloque}
      />

      {/* Confirmación de borrado de bloque (paso 1) */}
      <ConfirmDialog
        isOpen={dialogoBorrado === 'bloque'}
        onClose={() => setDialogoBorrado(null)}
        onConfirm={() => void eliminarBloqueSeleccionado()}
        title="Eliminar bloque"
        description={`Se eliminará el bloque "${
          bloqueSeleccionado ? `${bloqueSeleccionado.codigo} — ${bloqueSeleccionado.nombre}` : ''
        }" y sus espacios vacíos. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
      />
    </div>
  )
}
