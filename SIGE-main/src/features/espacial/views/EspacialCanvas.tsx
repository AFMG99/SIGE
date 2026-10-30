'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Bloque3DNode } from '../models/espacial.types'
import { ParametricBlock } from './nodes/ParametricBlock'
import { ModelBlock } from './nodes/ModelBlock'

interface EspacialCanvasProps {
  bloques: Bloque3DNode[]
  selectedBloqueId: string | null
  onSelectBloque: (bloque: Bloque3DNode | null) => void
  onMoveBloque: (bloqueId: string, x: number, z: number) => void
  onEndDrag: () => void
}

export default function EspacialCanvas({
  bloques,
  selectedBloqueId,
  onSelectBloque,
  onMoveBloque,
  onEndDrag,
}: EspacialCanvasProps) {
  const [draggedBloqueId, setDraggedBloqueId] = useState<string | null>(null)

  // Escuchar soltado de clic en cualquier lugar de la ventana
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (draggedBloqueId) {
        setDraggedBloqueId(null)
        document.body.style.cursor = 'default'
        onEndDrag()
      }
    }
    window.addEventListener('pointerup', handleGlobalPointerUp)
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp)
  }, [draggedBloqueId, onEndDrag])

  return (
    <div className="relative w-full h-full bg-slate-100 dark:bg-slate-950 select-none">
      <Canvas
        shadows
        onPointerDown={(e) => {
          if (e.target === e.currentTarget && !draggedBloqueId) {
            onSelectBloque(null)
          }
        }}
      >
        <PerspectiveCamera makeDefault position={[22, 20, 26]} fov={45} />

        {/* OrbitControls se deshabilita mientras se arrastra un bloque */}
        <OrbitControls
          makeDefault
          enabled={!draggedBloqueId}
          enableDamping
          dampingFactor={0.08}
          minDistance={5}
          maxDistance={120}
          maxPolarAngle={Math.PI / 2.05}
        />

        {/* Iluminación */}
        <ambientLight intensity={0.75} />
        <directionalLight
          position={[30, 45, 20]}
          intensity={1.3}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-25, 25, -25]} intensity={0.35} />

        {/* Suelo y grilla de referencia */}
        <gridHelper args={[120, 60, '#94a3b8', '#cbd5e1']} position={[0, -0.01, 0]} />

        {/* Plano invisible infinito para capturar movimiento de arrastre */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          visible={false}
          onPointerMove={(e) => {
            if (draggedBloqueId) {
              e.stopPropagation()
              onMoveBloque(draggedBloqueId, e.point.x, e.point.z)
            }
          }}
          onPointerUp={() => {
            if (draggedBloqueId) {
              setDraggedBloqueId(null)
              document.body.style.cursor = 'default'
              onEndDrag()
            }
          }}
        >
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {/* Nodos de Bloques en la escena */}
        <Suspense fallback={null}>
          <group>
            {bloques.map((bloque) =>
              bloque.renderMode === 'GLTF_MODEL' && bloque.modelUrl ? (
                <ModelBlock
                  key={bloque.id}
                  bloque={bloque}
                  isSelected={selectedBloqueId === bloque.id}
                  onSelect={onSelectBloque}
                />
              ) : (
                <ParametricBlock
                  key={bloque.id}
                  bloque={bloque}
                  isSelected={selectedBloqueId === bloque.id}
                  isDraggingThis={draggedBloqueId === bloque.id}
                  onSelect={onSelectBloque}
                  onStartDrag={(b) => {
                    setDraggedBloqueId(b.id)
                    document.body.style.cursor = 'grabbing'
                  }}
                />
              )
            )}
          </group>
        </Suspense>
      </Canvas>
    </div>
  )
}
