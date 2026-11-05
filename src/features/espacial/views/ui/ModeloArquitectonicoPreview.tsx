'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Object3D, Vector3 } from 'three'
import { AsociacionEspacioModelo } from './AsociacionEspacioModelo'

interface NodoModelo {
  nodeKey: string
  nombre: string
  tipo: string
  dimensiones: [number, number, number]
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

function ModeloGLB({ url, onNodes }: { url: string; onNodes: (nodes: NodoModelo[], size: [number, number, number]) => void }) {
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

    const visit = (node: Object3D, path: string) => {
      if (node !== model) {
        const nodeBounds = new Box3().setFromObject(node)
        if (!nodeBounds.isEmpty()) {
          const nodeSize = nodeBounds.getSize(new Vector3())
          nodes.push({
            nodeKey: path,
            nombre: node.name || node.type,
            tipo: node.type,
            dimensiones: [nodeSize.x, nodeSize.y, nodeSize.z],
          })
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
    }
  }, [model])

  useEffect(() => {
    onNodes(info.nodes, info.size)
  }, [info, onNodes])

  return (
    <group position={[-info.center[0] * info.displayScale, -info.center[1] * info.displayScale, -info.center[2] * info.displayScale]} scale={info.displayScale}>
      <primitive object={model} />
    </group>
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
    setSelectedNode((current) => current && nextNodes.some((node) => node.nodeKey === current) ? current : null)
  }, [])

  const cargarLista = useCallback(async () => {
    const response = await fetch(`/api/espacial/modelos?edificacionId=${encodeURIComponent(edificacionId)}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('No fue posible consultar los modelos guardados.')
    const data = await response.json() as { modelos: ModeloGuardado[] }
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

  const selected = nodes.find((node) => node.nodeKey === selectedNode)

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
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 dark:border-slate-800">
            <ModeloErrorBoundary key={url}>
              <Canvas camera={{ position: [12, 10, 12], fov: 45 }} dpr={[1, 1.5]}>
                <color attach="background" args={['#0f172a']} />
                <ambientLight intensity={1.2} />
                <directionalLight position={[10, 15, 10]} intensity={2} />
                <gridHelper args={[12, 24, '#64748b', '#334155']} />
                <Suspense fallback={<Html center><span className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Cargando modelo…</span></Html>}>
                  <ModeloGLB url={url} onNodes={handleNodes} />
                </Suspense>
                <OrbitControls makeDefault enableDamping />
              </Canvas>
            </ModeloErrorBoundary>
          </div>
          <aside className="max-h-[560px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white">Estructura del modelo</h3>
            {modelSize && (
              <div className="mt-3 grid grid-cols-3 gap-2">
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
                <button key={node.nodeKey} type="button" onClick={() => setSelectedNode(node.nodeKey)} className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${selectedNode === node.nodeKey ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <span className="block truncate font-medium">{node.nombre}</span>
                  <span className="text-[10px] opacity-70">{node.tipo}</span>
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
          </aside>
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
