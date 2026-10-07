'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { GestionAjustes } from './GestionAjustes'
import { crearAjuste } from '@/features/datos/controllers/ajustes'
import { VistaDatos } from './VistaDatos'
import { construirPanelAjustes } from './existencias'
import type { AjusteExistente, AjustesExistentes } from './existencias'
import { IconCarga, IconVistaPrevia, IconGestionar, IconInfo, IconPlus, IconX, IconCheck } from './icons'

interface AjustesSectionProps {
  ajustes: AjustesExistentes
  ajustesAplicados: { ano: number; mes: number; proporcion: number; direccion: string; descripcion: string }[]
  modo: 'carga' | 'datos' | 'gestion'
  puedeCargar: boolean
  onModoChange?: (modo: 'carga' | 'datos' | 'gestion') => void
}

const TABS = [
  { id: 'referencia', label: 'Referencia Anexo 4', Icon: IconInfo },
  { id: 'registrados', label: 'Registrados', Icon: IconVistaPrevia },
  { id: 'aplicados', label: 'Aplicados', Icon: IconCheck },
] as const

const ANEXO4_EJEMPLOS = [
  {
    modelo: 'Valor Absoluto',
    ahorroSinAjuste: '9,35%',
    ahorroConAjuste: '4,2%',
    descripcion: 'Remodelación piso (may-sep año 2): AC apagado, −25% consumo. Ajuste por proporción sobre meses normales del mismo año → años 1 y 3 corregidos.',
  },
  {
    modelo: 'Cociente de Valores Medido',
    ahorroSinAjuste: '9,35%',
    ahorroConAjuste: '5,5%',
    descripcion: 'Mismo caso: ajuste del cociente energía/variable. Procedimiento idéntico (promedio normal vs anómalo → proporción → años 1 y 3).',
  },
  {
    modelo: 'Estadístico (Regresión)',
    ahorroSinAjuste: '—',
    ahorroConAjuste: '4,42%',
    descripcion: 'Remodelación en periodo de reporte (post-LBEn). Ajuste vía LBEn_m estimada + promedio personas/mes. Ahorro ajustado con línea meta.',
  },
] as const

export function AjustesSection({
  ajustes,
  ajustesAplicados,
  modo,
  puedeCargar,
  onModoChange,
}: AjustesSectionProps) {
  const [tab, setTab] = useState<'referencia' | 'registrados' | 'aplicados'>('referencia')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    tipo: 'NO_RUTINARIO',
    bloqueId: '',
    periodoInicio: '',
    periodoFin: '',
    valorAjuste: '',
    direccion: 'reduccion',
    descripcion: '',
    observaciones: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await crearAjuste({
        tipo: form.tipo,
        bloqueId: form.bloqueId,
        periodoInicio: form.periodoInicio,
        periodoFin: form.periodoFin,
        valorAjuste: form.valorAjuste,
        direccion: form.direccion,
        descripcion: form.descripcion,
        observaciones: form.observaciones,
      })
      if (res.estado === 'completado') {
        setShowForm(false)
        setForm({
          tipo: 'NO_RUTINARIO',
          bloqueId: '',
          periodoInicio: '',
          periodoFin: '',
          valorAjuste: '',
          direccion: 'reduccion',
          descripcion: '',
          observaciones: '',
        })
        window.location.reload()
      } else {
        alert(res.mensaje)
      }
    } catch {
      alert('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  const canManage = puedeCargar && (modo === 'carga' || modo === 'gestion')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="ui-title text-lg">Ajustes Energéticos</h2>
          <p className="ui-muted text-sm">
            {modo === 'carga'
              ? 'Cree ajustes no rutinarios (Anexo 4) para corregir consumos anómalos antes de la depuración.'
              : modo === 'datos'
              ? 'Consulte los ejemplos del Anexo 4, los ajustes registrados y los aplicados en el cálculo actual.'
              : 'Elimine ajustes puntuales o vacíe la base: edificaciones, bloques y los demás datos se conservan.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex shrink-0 rounded-xl border border-gray-200 bg-gray-100 p-1.5 dark:border-slate-800 dark:bg-slate-900" role="group" aria-label="Modo de la sección Ajustes">
            {(['carga', 'datos', 'gestion'] as const).map((m) => (
              <button
                key={m}
                onClick={() => onModoChange?.(m)}
                disabled={!puedeCargar && (m === 'carga' || m === 'gestion')}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${modo === m ? 'bg-uv-purple text-white' : 'text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-slate-800'} ${!puedeCargar && (m === 'carga' || m === 'gestion') ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {m === 'carga' && <IconCarga className="inline w-4 h-4 mr-1" />}
                {m === 'datos' && <IconVistaPrevia className="inline w-4 h-4 mr-1" />}
                {m === 'gestion' && <IconGestionar className="inline w-4 h-4 mr-1" />}
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          {canManage && modo === 'carga' && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-uv-purple rounded-lg hover:bg-uv-purple/90 transition"
            >
              <IconPlus className="w-4 h-4" />
              Nuevo Ajuste
            </button>
          )}
        </div>
      </div>

      {!puedeCargar && (
        <div className="ui-callout ui-callout-info" role="status">
          Su rol tiene permisos de <strong>solo lectura</strong> en este módulo. Puede
          consultar los ajustes, pero no modificarlos.
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="flex gap-1 px-1" role="tablist" aria-label="Pestañas de ajustes">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px rounded-t-lg transition ${
                tab === t.id
                  ? 'border-uv-purple text-uv-purple'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <t.Icon className="inline w-4 h-4 mr-1" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="pt-4" role="tabpanel" aria-labelledby={tab}>
        {/* Referencia Anexo 4 */}
        {tab === 'referencia' && (
          <div className="grid gap-4 md:grid-cols-3">
            {ANEXO4_EJEMPLOS.map((e, i) => (
              <motion.div
                key={e.modelo}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-uv-purple/10 flex items-center justify-center">
                    <span className="text-xs font-medium text-uv-purple">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{e.modelo}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{e.descripcion}</p>
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        Sin ajuste: <span className="font-mono font-medium text-red-600 dark:text-red-400">{e.ahorroSinAjuste}</span>
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        Con ajuste: <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{e.ahorroConAjuste}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Registrados */}
        {tab === 'registrados' && (
          <>
            <VistaDatos {...construirPanelAjustes(ajustes)} />
            {canManage && modo !== 'carga' && (
              <GestionAjustes ajustes={ajustes} />
            )}
          </>
        )}

        {/* Aplicados */}
        {tab === 'aplicados' && (
          <div>
            {ajustesAplicados.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
                <IconCheck className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Sin ajustes aplicados</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  El cálculo actual no aplicó ajustes no rutinarios. Registre ajustes en la
                  pestaña «Registrados» o cree nuevos en «Carga» para que se apliquen
                  automáticamente en la depuración.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
                      <th className="pb-2 px-3 font-medium">Año</th>
                      <th className="pb-2 px-3 font-medium">Mes</th>
                      <th className="pb-2 px-3 font-medium">Proporción</th>
                      <th className="pb-2 px-3 font-medium">Dirección</th>
                      <th className="pb-2 px-3 font-medium">Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ajustesAplicados.map((a, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                        <td className="py-2 px-3 font-mono">{a.ano}</td>
                        <td className="py-2 px-3 font-mono">{a.mes}</td>
                        <td className="py-2 px-3 font-mono text-uv-purple">{(a.proporcion * 100).toFixed(2)}%</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            a.direccion === 'reduccion'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {a.direccion === 'reduccion' ? 'Reducción' : 'Incremento'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{a.descripcion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Formulario de creación (modal) */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="ui-title text-lg">Nuevo Ajuste No Rutinario</h3>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <IconX className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="tipo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo
                  </label>
                  <select
                    id="tipo"
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                  >
                    <option value="RUTINARIO">Rutinario</option>
                    <option value="NO_RUTINARIO">No Rutinario (Anexo 4)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="bloqueId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bloque (ID — obligatorio: el ajuste se guarda sobre un bloque)
                  </label>
                  <input
                    id="bloqueId"
                    type="text"
                    value={form.bloqueId}
                    onChange={(e) => setForm({ ...form, bloqueId: e.target.value })}
                    placeholder="ID del bloque"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="periodoInicio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Periodo inicio (YYYY-MM)
                    </label>
                    <input
                      id="periodoInicio"
                      type="month"
                      value={form.periodoInicio}
                      onChange={(e) => setForm({ ...form, periodoInicio: e.target.value })}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="periodoFin" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Periodo fin (YYYY-MM)
                    </label>
                    <input
                      id="periodoFin"
                      type="month"
                      value={form.periodoFin}
                      onChange={(e) => setForm({ ...form, periodoFin: e.target.value })}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="valorAjuste" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Proporción (%)
                  </label>
                  <input
                    id="valorAjuste"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.valorAjuste}
                    onChange={(e) => setForm({ ...form, valorAjuste: e.target.value })}
                    required
                    placeholder="Ej: 25"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Dirección
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="direccion"
                        value="reduccion"
                        checked={form.direccion === 'reduccion'}
                        onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                        className="text-uv-purple"
                      />
                      <span className="text-sm">Reducción (consumo bajó anómalamente)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="direccion"
                        value="incremento"
                        checked={form.direccion === 'incremento'}
                        onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                        className="text-amber-600"
                      />
                      <span className="text-sm">Incremento (consumo subió anómalamente)</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Descripción / Causa
                  </label>
                  <textarea
                    id="descripcion"
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    rows={3}
                    placeholder="Ej: Remodelación piso 3, AC apagado may-sep"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label htmlFor="observaciones" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Observaciones (opcional)
                  </label>
                  <textarea
                    id="observaciones"
                    value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-uv-purple px-4 py-2 text-sm font-medium text-white hover:bg-uv-purple/90 transition disabled:opacity-50"
                  >
                    {submitting ? 'Creando…' : 'Crear Ajuste'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}