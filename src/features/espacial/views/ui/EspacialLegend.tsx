'use client'

import React from 'react'

export function EspacialLegend() {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-white/90 p-3 shadow-lg backdrop-blur-md border border-slate-200 text-xs dark:bg-slate-900/90 dark:border-slate-800">
      <span className="font-semibold text-slate-700 dark:text-slate-300">
        Densidad de Potencia (W/m²)
      </span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-[#46b258]" />
          <span className="text-slate-600 dark:text-slate-400">&lt; 20</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-[#00652e]" />
          <span className="text-slate-600 dark:text-slate-400">20 - 45</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-[#e11d48]" />
          <span className="text-slate-600 dark:text-slate-400">&gt; 45</span>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
        Arrastre para rotar • Rueda para zoom • Clic en un bloque
      </p>
    </div>
  )
}
