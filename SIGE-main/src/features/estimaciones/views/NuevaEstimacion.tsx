'use client'
import { useState } from 'react'
import { calcularEstimacion, guardarEstimacion } from '../controllers/estimaciones'
import type { ModeloEstimacion, ResultadoEstimacion } from '../models/estimaciones'
import { MODELO_LABELS, validarHorizonte } from '../models/estimaciones'
import { ProyeccionChart } from './ProyeccionChart'

interface Edificacion { id: string; nombre: string }

interface Props {
  edificaciones: Edificacion[]
}

export function NuevaEstimacion({ edificaciones }: Props) {
  const [edificacionId, setEdificacionId] = useState('')
  const [modelo, setModelo] = useState<ModeloEstimacion>('ARIMA')
  const [horizonte, setHorizonte] = useState(6)
  const [resultado, setResultado] = useState<ResultadoEstimacion | null>(null)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardadoId, setGuardadoId] = useState<string | null>(null)

  async function handleCalcular() {
    if (!edificacionId) { setError('Selecciona una edificación'); return }
    if (!validarHorizonte(horizonte)) { setError('Horizonte inválido'); return }
    setError(null); setCargando(true); setResultado(null); setGuardadoId(null)
    try {
      const res = await calcularEstimacion(edificacionId, modelo, {}, horizonte)
      setResultado(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }

  async function handleGuardar() {
    if (!resultado || !edificacionId) return
    setGuardando(true)
    try {
      const id = await guardarEstimacion(edificacionId, resultado, modelo, {}, horizonte)
      setGuardadoId(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Edificación */}
      <div className="ui-panel flex flex-col gap-3">
        <label className="text-sm font-medium">Edificación</label>
        <select
          className="ui-input"
          value={edificacionId}
          onChange={(e) => setEdificacionId(e.target.value)}
        >
          <option value="">Selecciona una edificación…</option>
          {edificaciones.map((ed) => (
            <option key={ed.id} value={ed.id}>{ed.nombre}</option>
          ))}
        </select>
      </div>

      {/* Modelo */}
      <div className="ui-panel flex flex-col gap-3">
        <label className="text-sm font-medium">Modelo estadístico</label>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(MODELO_LABELS) as ModeloEstimacion[]).map((m) => (
            <button
              key={m}
              onClick={() => setModelo(m)}
              className={modelo === m ? 'ui-btn-primary' : 'ui-btn-secondary'}
            >
              {MODELO_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Horizonte */}
      <div className="ui-panel flex flex-col gap-3">
        <label className="text-sm font-medium">
          Horizonte de proyección: <span className="font-semibold">{horizonte} meses</span>
        </label>
        <input
          type="range" min={1} max={24} value={horizonte}
          onChange={(e) => setHorizonte(Number(e.target.value))}
          className="w-full accent-emerald-600"
        />
        <div className="flex justify-between text-xs text-ui-muted">
          <span>1 mes</span><span>24 meses</span>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button onClick={handleCalcular} disabled={cargando} className="ui-btn-primary self-start">
        {cargando ? 'Calculando…' : 'Calcular estimación'}
      </button>

      {/* Resultado */}
      {resultado && (
        <div className="ui-panel flex flex-col gap-4">
          <div className="flex gap-6 flex-wrap text-sm">
            <Stat label="Modelo" value={MODELO_LABELS[resultado.modelo]} />
            <Stat label="Horizonte" value={`${resultado.horizonte} meses`} />
            <Stat label="Histórico" value={`${resultado.meses_historico} meses`} />
            <Stat label="Período base" value={resultado.periodo_base} />
            {resultado.mape !== null && <Stat label="MAPE" value={`${resultado.mape.toFixed(2)}%`} />}
          </div>
          {resultado.advertencias && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-3 py-2">
              {resultado.advertencias}
            </p>
          )}
          <ProyeccionChart proyecciones={resultado.proyecciones} />
          {!guardadoId ? (
            <button onClick={handleGuardar} disabled={guardando} className="ui-btn-secondary self-start">
              {guardando ? 'Guardando…' : 'Guardar estimación'}
            </button>
          ) : (
            <p className="text-sm text-emerald-600">✓ Estimación guardada</p>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-ui-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}