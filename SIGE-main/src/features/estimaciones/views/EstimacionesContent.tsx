'use client'
import { useState } from 'react'
import { ESTIMACIONES_SECTIONS } from './nav'
import { NuevaEstimacion } from './NuevaEstimacion'
import { HistorialEstimaciones } from './HistorialEstimaciones'
import type { EstimacionGuardada } from '../models/estimaciones'

interface Edificacion { id: string; nombre: string }

interface Props {
  edificaciones: Edificacion[]
  historial: EstimacionGuardada[]
}

export function EstimacionesContent({ edificaciones, historial }: Props) {
  const [seccion, setSeccion] = useState('nueva')

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 flex flex-col gap-1">
        {ESTIMACIONES_SECTIONS.map((item) => (
          <button
            key={item.id}
            onClick={() => setSeccion(item.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
              seccion === item.id
                ? 'bg-ui-active text-ui-active-text font-medium'
                : 'text-ui-muted hover:bg-ui-hover'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </aside>

      {/* Contenido */}
      <main className="flex-1 min-w-0">
        {seccion === 'nueva' && <NuevaEstimacion edificaciones={edificaciones} />}
        {seccion === 'historial' && <HistorialEstimaciones historial={historial} />}
      </main>
    </div>
  )
}