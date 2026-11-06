'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import { BackSide, Box3, Object3D, PerspectiveCamera, Vector3 } from 'three'
import { AsociacionEspacioModelo } from './AsociacionEspacioModelo'
import { EnergiaEspacioModelo } from './EnergiaEspacioModelo'
import {
  Caja3D,
  DURACION_TRANSICION_MS,
  FAR_PLANO,
  FOV_EXTERIOR,
  FOV_INTERIOR,
  NEAR_EXTERIOR,
  NEAR_INTERIOR,
  Vector3D,
  calcularVistaInterior,
  esEspacioVolumen,
  limitarACaja,
  limitesOrbita,
} from './vistaInterior'

interface NodoModelo {
  nodeKey: string
  nombre: string
  tipo: string
  dimensiones: [number, number, number]
  centro: [number, number, number]
}

interface ModeloGuardado {
  id: string
  nombre: string
  version: number
  tamanoBytes: number
  cantidadPartes: number
  unidad: string
  escala: number
}

interface ModeloArquitectonicoPreviewProps {
  edificacionId: string
  puedeImportar: boolean
}

interface FocusTarget {
  center: [number, number, number]
  radius: number
  /** Vista interior: posición de la cámara dentro del recinto, a altura de ojos. */
  camara?: [number, number, number]
  /** Caja del recinto en coordenadas de la vista para confinar la navegación. */
  caja?: Caja3D
  /** Límites de distancia de la órbita en modo interior. */
  orbita?: { min: number; max: number }
  /** Dirección de aproximación fija (vista general de salida). */
  direccion?: [number, number, number]
}

const MAX_FILE_BYTES = 100 * 1024 * 1024
const CHUNK_BYTES = 3 * 1024 * 1024

class ModeloErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-rose-300">No fue posible interpretar el archivo GLB. Compruebe que sea válido y vuelva a cargarlo.</div>
    }
    return this.props.children
  }
}

/** El modelo se normaliza a 9 unidades de arista máxima: la vista general usa media arista. */
const RADIO_VISTA_GENERAL = 4.5

/**
 * Encuadra la cámara sobre un nodo seleccionado con una transición animada.
 * En modo interior mantiene la cámara confinada al recinto y acota la órbita;
 * al salir, regresa a la vista general del edificio.
 */
function FocusController({ target }: { target: FocusTarget | null }) {
  const controls = useThree((state) => (state as any).controls) as any
  const camera = useThree((state) => state.camera)
  const anim = useRef<{
    pos0: Vector3
    pos1: Vector3
    tgt0: Vector3
    tgt1: Vector3
    fov0: number
    fov1: number
    near0: number
    near1: number
    inicio: number
  } | null>(null)
  const anterior = useRef<FocusTarget | null>(null)

  useEffect(() => {
    if (!controls) return
    const cam = camera as PerspectiveCamera

    const encuadrar = (t: FocusTarget) => {
      const interior = Boolean(t.camara)
      const center = new Vector3(t.center[0], t.center[1], t.center[2])

      let pos1: Vector3
      if (t.camara) {
        pos1 = new Vector3(t.camara[0], t.camara[1], t.camara[2])
      } else {
        const dir = t.direccion
          ? new Vector3(t.direccion[0], t.direccion[1], t.direccion[2])
          : new Vector3().subVectors(camera.position, controls.target)
        if (dir.lengthSq() < 1e-6) dir.set(1, 0.8, 1)
        dir.normalize()
        pos1 = center.clone().add(dir.multiplyScalar(Math.max(t.radius, 0.3) * 3 + 1))
      }

      // Sin límites de órbita durante el vuelo para que el lerp no pelee con los controles.
      controls.enabled = false
      cam.far = FAR_PLANO
      cam.updateProjectionMatrix()
      anim.current = {
        pos0: camera.position.clone(),
        pos1,
        tgt0: (controls.target as Vector3).clone(),
        tgt1: center,
        fov0: cam.fov,
        fov1: interior ? FOV_INTERIOR : FOV_EXTERIOR,
        near0: cam.near,
        near1: interior ? NEAR_INTERIOR : NEAR_EXTERIOR,
        inicio: performance.now(),
      }
    }

    if (!target) {
      const prev = anterior.current
      anterior.current = null
      // Salir de un interior: vuelvo a la vista general del edificio.
      if (prev?.camara) encuadrar({ center: [0, 0, 0], radius: RADIO_VISTA_GENERAL, direccion: [1, 0.8, 1] })
      return
    }
    anterior.current = target
    encuadrar(target)
  }, [target, controls, camera])

  useFrame(() => {
    if (!controls) return
    const a = anim.current
    const cam = camera as PerspectiveCamera
    if (a) {
      const t = Math.min(1, (performance.now() - a.inicio) / DURACION_TRANSICION_MS)
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      camera.position.lerpVectors(a.pos0, a.pos1, e)
      ;(controls.target as Vector3).lerpVectors(a.tgt0, a.tgt1, e)
      cam.fov = a.fov0 + (a.fov1 - a.fov0) * e
      cam.near = a.near0 + (a.near1 - a.near0) * e
      cam.updateProjectionMatrix()
      if (t >= 1) {
        anim.current = null
        if (target?.orbita) {
          controls.minDistance = target.orbita.min
          controls.maxDistance = target.orbita.max
        } else {
          controls.minDistance = 0
          controls.maxDistance = Number.POSITIVE_INFINITY
        }
        controls.enabled = true
      }
      return
    }

    // Sin vuelo en curso, la cámara y el objetivo quedan confinados al recinto.
    if (!target?.caja) return
    const caja = target.caja
    const p = camera.position
    const [px, py, pz] = limitarACaja([p.x, p.y, p.z], caja, 0.01)
    p.set(px, py, pz)
    const objetivo = controls.target as Vector3
    const [tx, ty, tz] = limitarACaja([objetivo.x, objetivo.y, objetivo.z], caja)
    objetivo.set(tx, ty, tz)
  })

  return null
}

function ModeloGLB({
  url,
  onNodes,
  energyByNode,
  selectedNode,
  onNodeClick,
  onFocus,
}: {
  url: string
  onNodes: (nodes: NodoModelo[], size: [number, number, number]) => void
  energyByNode: Record<string, number | null>
  selectedNode: string | null
  onNodeClick?: (nodeKey: string) => void
  onFocus?: (target: FocusTarget | null) => void
}) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => scene.clone(true), [scene])

  const info = useMemo(() => {
    model.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(model)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z, 0.001)
    const displayScale = 9 / maxDimension
    const nodes: NodoModelo[] = []
    const pathMap = new Map<string, Object3D>()
    const objectPathMap = new Map<Object3D, string>()

    const visit = (node: Object3D, path: string) => {
      if (node !== model) {
        const nodeBounds = new Box3().setFromObject(node)
        if (!nodeBounds.isEmpty()) {
          const nodeSize = nodeBounds.getSize(new Vector3())
          const nodeCenter = nodeBounds.getCenter(new Vector3())
          nodes.push({
            nodeKey: path,
            nombre: node.name || node.type,
            tipo: node.type,
            dimensiones: [nodeSize.x, nodeSize.y, nodeSize.z],
            centro: [nodeCenter.x, nodeCenter.y, nodeCenter.z],
          })
          pathMap.set(path, node)
          objectPathMap.set(node, path)
        }
      }
      node.children.forEach((child, index) => {
        const label = (child.name || child.type).replaceAll('/', '_')
        visit(child, `${path}/${label}[${index}]`)
      })
    }

    model.children.forEach((child, index) => {
      const label = (child.name || child.type).replaceAll('/', '_')
      visit(child, `${label}[${index}]`)
    })
    nodes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))

    return {
      center: [center.x, center.y, center.z] as [number, number, number],
      size: [size.x, size.y, size.z] as [number, number, number],
      displayScale,
      nodes,
      pathMap,
      objectPathMap,
    }
  }, [model])

  useEffect(() => {
    const values = Object.values(energyByNode).filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)
    const max = Math.max(0, ...values)
    const colorFor = (value: number | null) => {
      if (value === null || max === 0) return '#64748b'
      const ratio = value / max
      if (ratio <= 0.25) return '#22c55e'
      if (ratio <= 0.5) return '#eab308'
      if (ratio <= 0.75) return '#f97316'
      return '#ef4444'
    }
    const visit = (node: Object3D, path: string) => {
      const value = energyByNode[path]
      if (value !== undefined) {
        const color = colorFor(value)
        node.traverse((child) => {
          const mesh = child as Object3D & { isMesh?: boolean; material?: any }
          if (!mesh.isMesh || !mesh.material) return
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((material: any) => {
              const copy = material.userData?.sigeEnergyMaterial ? material : material.clone()
              copy.userData = { ...copy.userData, sigeEnergyMaterial: true }
              if (copy.color) copy.color.set(color)
              return copy
            })
          } else {
            const copy = mesh.material.userData?.sigeEnergyMaterial ? mesh.material : mesh.material.clone()
            copy.userData = { ...copy.userData, sigeEnergyMaterial: true }
            if (copy.color) copy.color.set(color)
            mesh.material = copy
          }
        })
      }
      node.children.forEach((child, index) => {
        const label = (child.name || child.type).replaceAll('/', '_')
        visit(child, `${path}/${label}[${index}]`)
      })
    }
    model.children.forEach((child, index) => {
      const label = (child.name || child.type).replaceAll('/', '_')
      visit(child, `${label}[${index}]`)
    })
  }, [model, energyByNode])

  // Resaltado del nodo seleccionado (emissive) sobre el resto del modelo.
  useEffect(() => {
    model.traverse((child) => {
      const mesh = child as Object3D & { isMesh?: boolean; material?: any }
      if (!mesh.isMesh || !mesh.material) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of mats) {
        if (material.emissive) {
          material.emissive.set(0, 0, 0)
          material.emissiveIntensity = 1
        }
      }
    })
    if (!selectedNode) return
    const target = info.pathMap.get(selectedNode)
    if (!target) return
    target.traverse((child) => {
      const mesh = child as Object3D & { isMesh?: boolean; material?: any }
      if (!mesh.isMesh || !mesh.material) return
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material: any) => {
          const copy = material.clone()
          if (copy.emissive) {
            copy.emissive.set('#92bd24')
            copy.emissiveIntensity = 0.6
          }
          return copy
        })
      } else {
        const copy = mesh.material.clone()
        if (copy.emissive) {
          copy.emissive.set('#92bd24')
          copy.emissiveIntensity = 0.6
        }
        mesh.material = copy
      }
    })
  }, [model, selectedNode, info])

  const nodoSeleccionado = useMemo(
    () => (selectedNode ? info.nodes.find((item) => item.nodeKey === selectedNode) : undefined),
    [selectedNode, info],
  )
  const esInterior = Boolean(nodoSeleccionado && esEspacioVolumen(nodoSeleccionado.nombre, nodoSeleccionado.dimensiones))

  // Modo interior: la caja del recinto se dibuja por sus caras internas (BackSide) con
  // polygonOffset, de modo que funcione como cerramiento sin ocultar ni borrar geometría.
  // Se clona el material para no afectar a las demás cajas del modelo.
  useEffect(() => {
    if (!selectedNode || !esInterior) return
    const objetivo = info.pathMap.get(selectedNode)
    if (!objetivo) return
    const originales: Array<{ mesh: any; material: any }> = []
    objetivo.traverse((child) => {
      const mesh = child as Object3D & { isMesh?: boolean; material?: any }
      if (!mesh.isMesh || !mesh.material) return
      const original = mesh.material
      const materiales = Array.isArray(original) ? original : [original]
      const copias = materiales.map((material: any) => {
        const copy = material.clone()
        copy.side = BackSide
        copy.polygonOffset = true
        copy.polygonOffsetFactor = 1
        copy.polygonOffsetUnits = 1
        return copy
      })
      mesh.material = Array.isArray(original) ? copias : copias[0]
      originales.push({ mesh, material: original })
    })
    return () => {
      for (const item of originales) item.mesh.material = item.material
    }
  }, [selectedNode, esInterior, info])

  // Calcula el encuadre del nodo seleccionado: vista interior si es un recinto habitable.
  useEffect(() => {
    if (!onFocus) return
    if (!selectedNode || !nodoSeleccionado) {
      onFocus(null)
      return
    }
    const nodo = nodoSeleccionado
    const proyectar = (p: Vector3D): [number, number, number] => [
      (p[0] - info.center[0]) * info.displayScale,
      (p[1] - info.center[1]) * info.displayScale,
      (p[2] - info.center[2]) * info.displayScale,
    ]
    const center = proyectar([nodo.centro[0], nodo.centro[1], nodo.centro[2]])
    const radius = (Math.max(...nodo.dimensiones) / 2) * info.displayScale

    if (esInterior) {
      const { posicion, objetivo, radio } = calcularVistaInterior(nodo.centro, nodo.dimensiones)
      const mitad: Vector3D = [
        (nodo.dimensiones[0] / 2) * info.displayScale,
        (nodo.dimensiones[1] / 2) * info.displayScale,
        (nodo.dimensiones[2] / 2) * info.displayScale,
      ]
      onFocus({
        center: proyectar(objetivo),
        radius: Math.max(radius, 0.3),
        camara: proyectar(posicion),
        caja: {
          min: [center[0] - mitad[0], center[1] - mitad[1], center[2] - mitad[2]],
          max: [center[0] + mitad[0], center[1] + mitad[1], center[2] + mitad[2]],
        },
        orbita: limitesOrbita(radio, info.displayScale, Math.min(nodo.dimensiones[0], nodo.dimensiones[2]) / 2),
      })
      return
    }
    onFocus({ center, radius: Math.max(radius, 0.3) })
  }, [selectedNode, nodoSeleccionado, esInterior, info, onFocus])

  useEffect(() => {
    onNodes(info.nodes, info.size)
  }, [info, onNodes])

  const handleModelClick = useCallback(
    (event: any) => {
      event.stopPropagation()
      let hit: Object3D | null = event.object as Object3D
      while (hit) {
        const path = info.objectPathMap.get(hit)
        if (path) {
          onNodeClick?.(path)
          return
        }
        hit = hit.parent
      }
    },
    [info, onNodeClick],
  )

  const handlePointerOver = useCallback(() => {
    document.body.style.cursor = 'pointer'
  }, [])
  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = 'auto'
  }, [])

  return (
    <group
      position={[-info.center[0] * info.displayScale, -info.center[1] * info.displayScale, -info.center[2] * info.displayScale]}
      scale={info.displayScale}
      onClick={handleModelClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <primitive object={model} />
    </group>
  )
}

function IconoPanel() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function IconoCerrar() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function IconoConsumo() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

export function ModeloArquitectonicoPreview({ edificacionId, puedeImportar }: ModeloArquitectonicoPreviewProps) {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [nodes, setNodes] = useState<NodoModelo[]>([])
  const [modelSize, setModelSize] = useState<[number, number, number] | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [models, setModels] = useState<ModeloGuardado[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [unidad, setUnidad] = useState('METERS')
  const [escala, setEscala] = useState('1')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [energyByNode, setEnergyByNode] = useState<Record<string, number | null>>({})
  const [estructuraAbierta, setEstructuraAbierta] = useState(false)
  const [consumoAbierto, setConsumoAbierto] = useState(false)
  const [focus, setFocus] = useState<FocusTarget | null>(null)
  const handleEnergyChange = useCallback((values: Record<string, number | null>) => setEnergyByNode(values), [])

  // Dentro de un recinto, inspeccionar un objeto interior no debe sacarme de la vista interior.
  const handleFocus = useCallback((target: FocusTarget | null) => {
    setFocus((prev) => (prev?.camara && target && !target.camara ? prev : target))
  }, [])

  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }
    const nextUrl = URL.createObjectURL(file)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])

  const handleNodes = useCallback((nextNodes: NodoModelo[], size: [number, number, number]) => {
    setNodes(nextNodes)
    setModelSize(size)
    setSelectedNode((current) => (current && nextNodes.some((node) => node.nodeKey === current) ? current : null))
  }, [])

  const selected = nodes.find((node) => node.nodeKey === selectedNode)

  // Cierra el panel de consumo cuando ya no hay nodo seleccionado.
  useEffect(() => {
    if (!selected) setConsumoAbierto(false)
  }, [selected])

  const cargarLista = useCallback(async () => {
    const response = await fetch(`/api/espacial/modelos?edificacionId=${encodeURIComponent(edificacionId)}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('No fue posible consultar los modelos guardados.')
    const data = (await response.json()) as { modelos: ModeloGuardado[] }
    setModels(data.modelos)
    return data.modelos
  }, [edificacionId])

  useEffect(() => {
    void cargarLista().catch((cause) => setError(cause instanceof Error ? cause.message : 'Error consultando modelos.'))
  }, [cargarLista])

  const limpiarVista = () => {
    setFile(null)
    setNodes([])
    setModelSize(null)
    setSelectedNode(null)
    setSelectedModelId('')
    setFocus(null)
    setConsumoAbierto(false)
  }

  const seleccionarArchivo = (nextFile?: File) => {
    setError('')
    setStatus('')
    limpiarVista()
    if (!nextFile) return
    if (!/\.glb$/i.test(nextFile.name)) {
      setError('Seleccione un archivo con extensión .glb.')
      return
    }
    if (nextFile.size > MAX_FILE_BYTES) {
      setError('El archivo supera el límite de 100 MB.')
      return
    }
    if (nextFile.size < 20) {
      setError('El archivo está vacío o no contiene una cabecera GLB válida.')
      return
    }
    setFile(nextFile)
    setNombre(nextFile.name.replace(/\.glb$/i, '').slice(0, 180))
  }

  const cargarModeloGuardado = async (model: ModeloGuardado) => {
    setBusy(true)
    setError('')
    setStatus('Descargando modelo guardado…')
    setProgress(0)
    try {
      const chunks: BlobPart[] = []
      for (let index = 0; index < model.cantidadPartes; index++) {
        const response = await fetch(`/api/espacial/modelos/${model.id}/partes/${index}`, { cache: 'no-store' })
        if (!response.ok) throw new Error(`No se pudo descargar la parte ${index + 1} del modelo.`)
        chunks.push(await response.arrayBuffer())
        setProgress(Math.round(((index + 1) / model.cantidadPartes) * 100))
      }
      const blob = new Blob(chunks, { type: 'model/gltf-binary' })
      if (blob.size !== model.tamanoBytes) throw new Error('El tamaño descargado no coincide con los metadatos del modelo.')
      const downloadedFile = new File([blob], model.nombre, { type: 'model/gltf-binary' })
      setFile(downloadedFile)
      setSelectedModelId(model.id)
      setStatus(`Modelo v${model.version} descargado y listo para inspección.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible abrir el modelo guardado.')
    } finally {
      setBusy(false)
    }
  }

  const guardarModelo = async () => {
    if (!file || !puedeImportar) return
    setBusy(true)
    setError('')
    setStatus('Preparando carga segura por fragmentos…')
    setProgress(0)
    try {
      const scale = Number(escala)
      if (!nombre.trim() || !Number.isFinite(scale) || scale <= 0 || scale > 1000) {
        throw new Error('Indique un nombre y una escala válida mayor que cero.')
      }

      const startResponse = await fetch('/api/espacial/modelos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edificacionId, nombre: nombre.trim(), tamanoBytes: file.size, unidad, escala: scale }),
      })
      const startData = await startResponse.json()
      if (!startResponse.ok) throw new Error(startData.message || 'No fue posible iniciar la carga.')

      const modeloId = startData.modelo.id as string
      const count = startData.modelo.cantidadPartes as number
      for (let index = 0; index < count; index++) {
        const chunk = file.slice(index * CHUNK_BYTES, Math.min((index + 1) * CHUNK_BYTES, file.size))
        const response = await fetch(`/api/espacial/modelos/${modeloId}/partes/${index}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: chunk,
        })
        if (!response.ok) {
          const detail = await response.json().catch(() => null)
          throw new Error(detail?.message || `Falló la carga de la parte ${index + 1}.`)
        }
        setProgress(Math.round(((index + 1) / count) * 100))
        setStatus(`Cargando modelo: ${index + 1} de ${count} partes…`)
      }

      const finishResponse = await fetch(`/api/espacial/modelos/${modeloId}/finalizar`, { method: 'POST' })
      const finishData = await finishResponse.json()
      if (!finishResponse.ok) throw new Error(finishData.message || 'No fue posible validar y finalizar el archivo.')

      const list = await cargarLista()
      setSelectedModelId(modeloId)
      setStatus('Modelo almacenado correctamente en PostgreSQL.')
      if (!list.some((item) => item.id === modeloId)) throw new Error('El modelo se guardó, pero no apareció en la lista de modelos activos.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error durante la carga del modelo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Modelo arquitectónico GLB</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Guarde el modelo en la base de datos institucional y consulte su geometría sin depender de servicios externos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="ui-btn ui-btn-secondary cursor-pointer text-center">
              Seleccionar archivo
              <input type="file" accept=".glb,model/gltf-binary" className="sr-only" disabled={busy} onChange={(event) => { seleccionarArchivo(event.target.files?.[0]); event.currentTarget.value = '' }} />
            </label>
            {file && puedeImportar && (
              <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={() => void guardarModelo()}>
                {busy ? 'Procesando…' : 'Guardar en SIGE'}
              </button>
            )}
          </div>
        </div>

        {file && (
          <div className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB · archivo GLB</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-600 dark:text-slate-300">
                Unidad del modelo
                <select className="ui-input mt-1" value={unidad} onChange={(event) => setUnidad(event.target.value)} disabled={busy}>
                  <option value="METERS">Metros</option>
                  <option value="CENTIMETERS">Centímetros</option>
                  <option value="MILLIMETERS">Milímetros</option>
                </select>
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-300">
                Factor de escala
                <input className="ui-input mt-1" type="number" min="0.001" max="1000" step="0.001" value={escala} onChange={(event) => setEscala(event.target.value)} disabled={busy} />
              </label>
            </div>
            <label className="text-xs text-slate-600 dark:text-slate-300 sm:col-span-2">
              Nombre del modelo
              <input className="ui-input mt-1" maxLength={180} value={nombre} onChange={(event) => setNombre(event.target.value)} disabled={busy} />
            </label>
          </div>
        )}

        {models.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
            <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Modelos almacenados para esta edificación</p>
            <div className="flex flex-wrap gap-2">
              {models.map((model) => (
                <button key={model.id} type="button" disabled={busy} onClick={() => void cargarModeloGuardado(model)} className={`rounded-lg border px-3 py-2 text-left text-xs ${selectedModelId === model.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
                  <span className="block font-semibold">{model.nombre} · v{model.version}</span>
                  <span className="text-slate-500">{(model.tamanoBytes / 1024 / 1024).toFixed(1)} MB</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {busy && (
          <div className="mt-3" role="status">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} /></div>
            <p className="mt-1 text-xs text-slate-500">{status || 'Procesando…'} {progress}%</p>
          </div>
        )}
        {status && !busy && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{status}</p>}
        {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
        {!puedeImportar && <p className="mt-3 text-xs text-slate-500">Su rol permite consultar modelos, pero no cargar o reemplazar archivos.</p>}
        <p className="mt-3 rounded-lg bg-sky-50 p-3 text-xs text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
          Los archivos se guardan en PostgreSQL como fragmentos binarios. El límite actual es 100 MB por modelo. Las dimensiones se muestran en unidades del archivo y no modifican automáticamente los espacios de SIGE.
        </p>
      </div>

      {url ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <span className="font-semibold">Consumo estimado:</span>
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-green-500" /> Bajo</span>
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> Medio-bajo</span>
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Medio-alto</span>
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-red-500" /> Alto</span>
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-slate-500" /> Sin dato</span>
            <span className="ml-auto text-slate-500">Escala relativa al máximo del modelo en el periodo</span>
          </div>

          <div className="relative h-[620px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 dark:border-slate-800">
            <ModeloErrorBoundary key={url}>
              <Canvas camera={{ position: [12, 10, 12], fov: FOV_EXTERIOR, near: NEAR_EXTERIOR, far: FAR_PLANO }} dpr={[1, 1.5]}>
                <color attach="background" args={['#0f172a']} />
                <ambientLight intensity={1.2} />
                <directionalLight position={[10, 15, 10]} intensity={2} />
                <gridHelper args={[12, 24, '#64748b', '#334155']} />
                <Suspense fallback={<Html center><span className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Cargando modelo…</span></Html>}>
                  <ModeloGLB
                    url={url}
                    onNodes={handleNodes}
                    energyByNode={energyByNode}
                    selectedNode={selectedNode}
                    onNodeClick={setSelectedNode}
                    onFocus={handleFocus}
                  />
                </Suspense>
                {focus && selectedModelId && selected && (
                  <Html position={focus.center} center zIndexRange={[40, 0]}>
                    <button
                      type="button"
                      onClick={() => setConsumoAbierto((value) => !value)}
                      title="Consultar consumo de este espacio"
                      aria-label="Consultar consumo de este espacio"
                      aria-pressed={consumoAbierto}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/70 shadow-lg transition-colors focus-ring ${consumoAbierto ? 'bg-emerald-700 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    >
                      <IconoConsumo />
                    </button>
                  </Html>
                )}
                <FocusController target={focus} />
                <OrbitControls makeDefault enableDamping />
              </Canvas>
            </ModeloErrorBoundary>

            <button
              type="button"
              onClick={() => setEstructuraAbierta((value) => !value)}
              title="Estructura del modelo"
              aria-label="Mostrar u ocultar la estructura del modelo"
              aria-expanded={estructuraAbierta}
              className="absolute left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-slate-900/80 text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-800 focus-ring"
            >
              <IconoPanel />
            </button>

            {focus?.camara && (
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                title="Salir del espacio"
                aria-label="Salir del espacio y volver a la vista exterior"
                className="absolute left-14 top-3 z-30 flex h-10 items-center gap-1.5 rounded-lg border border-white/20 bg-slate-900/80 px-3 text-xs font-semibold text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-800 focus-ring"
              >
                <IconoCerrar />
                Salir del espacio
              </button>
            )}

            {estructuraAbierta && (
              <aside className="absolute left-3 top-14 z-20 flex max-h-[calc(100%-4.5rem)] w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Estructura del modelo</h3>
                  <button
                    type="button"
                    onClick={() => setEstructuraAbierta(false)}
                    title="Cerrar estructura"
                    aria-label="Cerrar estructura"
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <IconoCerrar />
                  </button>
                </div>

                <div className="mt-3 flex-1 overflow-y-auto pr-1">
                  {modelSize && (
                    <div className="grid grid-cols-3 gap-2">
                      {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                        <div key={axis} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                          <p className="text-[10px] text-slate-500">Eje {axis}</p>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{modelSize[index].toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-slate-500">{nodes.length} nodos con geometría</p>
                  <div className="mt-2 space-y-1">
                    {nodes.slice(0, 250).map((node) => (
                      <button
                        key={node.nodeKey}
                        type="button"
                        onClick={() => setSelectedNode(node.nodeKey)}
                        className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors focus-ring ${selectedNode === node.nodeKey ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        <span className="block truncate font-medium">{node.nombre}</span>
                        <span className="text-[10px] opacity-70">
                          {node.tipo}
                          {esEspacioVolumen(node.nombre, node.dimensiones) && (
                            <span className="ml-1.5 rounded bg-emerald-100 px-1 py-px font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">Espacio</span>
                          )}
                        </span>
                      </button>
                    ))}
                    {nodes.length > 250 && <p className="px-2 py-2 text-xs text-slate-500">Se muestran los primeros 250 nodos.</p>}
                  </div>
                  {selected && (
                    <div className="mt-3 rounded-lg border border-emerald-200 p-3 dark:border-emerald-900">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{selected.nombre}</p>
                      <p className="mt-1 text-xs text-slate-500">Caja envolvente (X × Y × Z)</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selected.dimensiones.map((value) => value.toFixed(2)).join(' × ')}</p>
                      {selectedModelId && (
                        <AsociacionEspacioModelo
                          key={`${selectedModelId}:${selected.nodeKey}`}
                          modeloId={selectedModelId}
                          node={selected}
                          puedeEditar={puedeImportar}
                        />
                      )}
                    </div>
                  )}
                </div>
              </aside>
            )}

            {selectedModelId && selected && (
              <div
                className={`absolute right-3 top-3 z-20 flex max-h-[calc(100%-2rem)] w-96 max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 ${consumoAbierto ? '' : 'hidden'}`}
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">Consumo · {selected.nombre}</p>
                    <p className="text-[10px] text-slate-500">Datos del espacio asociado</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConsumoAbierto(false)}
                    title="Cerrar consumo"
                    aria-label="Cerrar consumo"
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <IconoCerrar />
                  </button>
                </div>
                <div className="mt-1 flex-1 overflow-y-auto pr-1">
                  <EnergiaEspacioModelo
                    key={`energia:${selectedModelId}:${selected.nodeKey}`}
                    modeloId={selectedModelId}
                    nodeKey={selected.nodeKey}
                    onEnergyChange={handleEnergyChange}
                  />
                </div>
              </div>
            )}

            {focus?.camara && (
              <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/20 bg-slate-900/70 px-3 py-1.5 text-[11px] text-slate-200 shadow-lg backdrop-blur">
                Vista interior · arrastre para mirar · rueda para acercar · clic en un elemento para inspeccionarlo
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-200">Aún no hay un modelo abierto</p>
            <p className="mt-1 text-sm text-slate-500">Seleccione un GLB local o abra uno de los modelos guardados.</p>
          </div>
        </div>
      )}
    </section>
  )
}
