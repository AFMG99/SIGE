'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Object3D, Vector3 } from 'three'

interface NodoModelo {
  nodeKey: string
  nombre: string
  tipo: string
  dimensiones: [number, number, number]
}

class ModeloErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-rose-300">No fue posible interpretar el archivo GLB. Verifique que sea válido y vuelva a intentarlo.</div>
    }
    return this.props.children
  }
}

function ModeloGLB({ url, onNodes }: { url: string; onNodes: (nodes: NodoModelo[], size: [number, number, number]) => void }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => scene.clone(true), [scene])

  const info = useMemo(() => {
    const bounds = new Box3().setFromObject(model)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
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
      nodes: nodes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
    }
  }, [model])

  useEffect(() => {
    onNodes(info.nodes, info.size)
  }, [info, onNodes])

  return (
    <group position={[-info.center[0], -info.center[1], -info.center[2]]}>
      <primitive object={model} />
    </group>
  )
}

export function ModeloArquitectonicoPreview() {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [nodes, setNodes] = useState<NodoModelo[]>([])
  const [modelSize, setModelSize] = useState<[number, number, number] | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }
    const nextUrl = URL.createObjectURL(file)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])

  const handleNodes = useMemo(
    () => (nextNodes: NodoModelo[], size: [number, number, number]) => {
      setNodes(nextNodes)
      setModelSize(size)
      setSelectedNode((current) => current && nextNodes.some((node) => node.nodeKey === current) ? current : null)
    },
    []
  )

  const handleFile = (nextFile?: File) => {
    setError('')
    setFile(null)
    setNodes([])
    setModelSize(null)
    setSelectedNode(null)
    if (!nextFile) return
    const validExtension = /\.glb$/i.test(nextFile.name)
    if (!validExtension) {
      setError('Seleccione un archivo .glb.')
      return
    }
    if (nextFile.size > 100 * 1024 * 1024) {
      setError('El archivo supera el límite de 100 MB para la vista previa.')
      return
    }
    setFile(nextFile)
  }

  const selected = nodes.find((node) => node.nodeKey === selectedNode)

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Modelo arquitectónico GLB</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Cargue un modelo para inspeccionar su geometría, jerarquía y dimensiones.
            </p>
          </div>
          <label className="ui-btn ui-btn-primary cursor-pointer text-center">
            Seleccionar archivo
            <input
              type="file"
              accept=".glb,model/gltf-binary"
              className="sr-only"
              onChange={(event) => { handleFile(event.target.files?.[0]); event.currentTarget.value = "" }}
            />
          </label>
        </div>
        {file && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span>
            <button type="button" className="text-rose-600 hover:underline" onClick={() => { setFile(null); setNodes([]); setModelSize(null) }}>
              Quitar modelo
            </button>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Vista previa local: el archivo no se envía al servidor ni queda guardado al salir o recargar la página. Las dimensiones se muestran en unidades del archivo; confirme que el modelo esté en metros antes de usarlas en SIGE.
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
              <gridHelper args={[100, 50, '#64748b', '#334155']} />
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
            <p className="mt-3 text-xs text-slate-500">{nodes.length} nodos con nombre y geometría</p>
            <div className="mt-2 space-y-1">
              {nodes.slice(0, 250).map((node) => (
                <button
                  key={node.uuid}
                  type="button"
                  onClick={() => setSelectedNode(node.uuid)}
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${selectedNode === node.uuid ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <span className="block truncate font-medium">{node.nombre}</span>
                  <span className="text-[10px] opacity-70">{node.tipo}</span>
                </button>
              ))}
              {nodes.length > 250 && <p className="px-2 py-2 text-xs text-slate-500">Se muestran los primeros 250 nodos.</p>}
            </div>
            {selected && (
              <div className="mt-3 rounded-lg border border-emerald-200 p-3 dark:border-emerald-900">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{selected.nombre}</p>
                <p className="mt-1 text-xs text-slate-500">Caja envolvente del nodo (X × Y × Z)</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selected.dimensiones.map((value) => value.toFixed(2)).join(' × ')}</p>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-200">Aún no hay un modelo cargado</p>
            <p className="mt-1 text-sm text-slate-500">Seleccione un archivo GLB para comenzar la inspección.</p>
          </div>
        </div>
      )}
    </section>
  )
}
