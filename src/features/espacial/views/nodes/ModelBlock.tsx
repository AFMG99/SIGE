'use client'

import React from 'react'
import { Bloque3DNode } from '../../models/espacial.types'

interface ModelBlockProps {
  bloque: Bloque3DNode
  isSelected: boolean
  onSelect: (bloque: Bloque3DNode) => void
}

/**
 * Componente preparado para renderizar modelos 3D externos (.glb / .gltf)
 * en futuras iteraciones mediante useGLTF de @react-three/drei.
 */
export function ModelBlock({ bloque, isSelected, onSelect }: ModelBlockProps) {
  // Nota arquitectónica: cuando bloque.modelUrl esté disponible,
  // aquí se integrará: const { scene } = useGLTF(bloque.modelUrl)
  // y se retornará <primitive object={scene} ... />
  return (
    <group
      position={bloque.position}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(bloque)
      }}
    >
      {/* Fallback visual temporal si el modelo no está cargado */}
      <mesh>
        <boxGeometry args={bloque.dimensions} />
        <meshStandardMaterial
          color={isSelected ? '#92bd24' : '#45a78f'}
          wireframe
        />
      </mesh>
    </group>
  )
}
