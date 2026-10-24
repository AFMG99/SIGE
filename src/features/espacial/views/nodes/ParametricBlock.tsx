'use client'

import React, { useState } from 'react'
import { Html, Edges } from '@react-three/drei'
import { Bloque3DNode } from '../../models/espacial.types'

interface ParametricBlockProps {
  bloque: Bloque3DNode
  isSelected: boolean
  isDraggingThis?: boolean
  onSelect: (bloque: Bloque3DNode) => void
  onStartDrag?: (bloque: Bloque3DNode) => void
}

function getColorByDensity(
  densidadWm2: number,
  isSelected: boolean,
  isHovered: boolean,
  isDragging: boolean
): string {
  if (isDragging) return '#92bd24' // uv-lime activo durante arrastre
  if (isSelected) return '#82c7e6' // uv-sky de selección
  if (isHovered) return '#45a78f' // uv-turquoise al pasar el cursor
  if (densidadWm2 > 45) return '#e11d48' // Carga alta / densa
  if (densidadWm2 > 20) return '#00652e' // Carga moderada (uv-forest)
  return '#46b258' // Carga baja / eficiente (uv-soft)
}

export function ParametricBlock({
  bloque,
  isSelected,
  isDraggingThis = false,
  onSelect,
  onStartDrag,
}: ParametricBlockProps) {
  const [hovered, setHovered] = useState(false)

  const color = getColorByDensity(
    bloque.metricas.densidadPotenciaWm2,
    isSelected,
    hovered,
    isDraggingThis
  )

  const kW = (bloque.metricas.potenciaTotalW / 1000).toFixed(1)

  // Elevar ligeramente el bloque mientras se arrastra
  const currentY = isDraggingThis
    ? bloque.position[1] + 0.4
    : bloque.position[1]

  const position: [number, number, number] = [
    bloque.position[0],
    currentY,
    bloque.position[2],
  ]

  return (
    <group position={position}>
      <mesh
        castShadow
        receiveShadow
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect(bloque)
          if (onStartDrag) onStartDrag(bloque)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = isDraggingThis ? 'grabbing' : 'grab'
        }}
        onPointerOut={() => {
          setHovered(false)
          if (!isDraggingThis) {
            document.body.style.cursor = 'default'
          }
        }}
      >
        <boxGeometry args={bloque.dimensions} />
        <meshStandardMaterial
          color={color}
          roughness={0.35}
          metalness={0.15}
          transparent={hovered || isSelected || isDraggingThis}
          opacity={isDraggingThis ? 0.85 : hovered || isSelected ? 0.92 : 1.0}
        />
        {/* Contorno arquitectónico definido */}
        <Edges
          threshold={15}
          color={isDraggingThis ? '#211915' : isSelected ? '#1d4851' : '#334155'}
          lineWidth={isDraggingThis || isSelected ? 2.5 : 1}
        />
      </mesh>

      {/* Etiqueta flotante 3D sobre el bloque */}
      <Html
        position={[0, bloque.dimensions[1] / 2 + 0.7, 0]}
        center
        distanceFactor={18}
        zIndexRange={[10, 0]}
      >
        <div
          onPointerDown={(e) => {
            e.stopPropagation()
            onSelect(bloque)
            if (onStartDrag) onStartDrag(bloque)
          }}
          className={`cursor-grab select-none rounded-lg px-2.5 py-1 text-xs font-semibold shadow-md transition-all duration-150 active:cursor-grabbing whitespace-nowrap ${
            isDraggingThis
              ? 'bg-uv-ink text-white ring-2 ring-uv-lime scale-110 shadow-xl'
              : isSelected
              ? 'bg-uv-deep text-white ring-2 ring-uv-sky'
              : 'bg-white/95 text-slate-800 backdrop-blur-sm border border-slate-200 dark:bg-slate-900/90 dark:text-slate-100 dark:border-slate-700 hover:scale-105'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-uv-forest dark:text-uv-soft">
              {bloque.codigo}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {kW} kW • {bloque.areaUtil} m²
            </span>
          </div>
        </div>
      </Html>
    </group>
  )
}
