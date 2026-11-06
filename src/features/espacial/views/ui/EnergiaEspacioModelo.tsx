'use client'

import { useEffect, useMemo, useState } from 'react'

interface EquipoEnergia {
  id: string
  tipo: string
  cantidad: number
  potenciaW: number
  horasUsoDia: number | null
  diasUsoMes: number | null
  consumoKwh: number | null
  estadoUso: string
  motivoRevision: string | null
}
interface EspacioEnergia {
  id: string
  nombre: string
  piso: string
  bloque: { id: string; codigo: string; nombre: string }
}
interface ElementoEnergia {
  nodeKey: string
  nodeName: string
  espacio: EspacioEnergia
  equipos: EquipoEnergia[]
  cantidadEquipos: number
  consumoKwh: number | null
  fuente: string
}
interface Props { modeloId: string; nodeKey: string; onEnergyChange?: (values: Record<string, number | null>) => void }

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const COPIA_FUENTE: Record<string,string> = {
  USO_PERIODO: 'Cálculo de uso guardado',
  CONFIGURACION_BASE: 'Configuración base del inventario',
  SIN_RESULTADO: 'Periodo pendiente o en revisión',
}

export function EnergiaEspacioModelo({ modeloId, nodeKey, onEnergyChange }: Props) {
  const ahora = new Date()
  const [mes, setMes] = useState(String(ahora.getMonth() + 1))
  const [ano, setAno] = useState(String(ahora.getFullYear()))
  const [elementos, setElementos] = useState<ElementoEnergia[]>([])
  const [estadoPeriodo, setEstadoPeriodo] = useState('Cargando')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const consultar = async () => {
      setCargando(true)
      setError('')
      try {
        const query = new URLSearchParams({ mes, ano })
        const response = await fetch(`/api/espacial/modelos/${encodeURIComponent(modeloId)}/energia?${query}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'No fue posible consultar el consumo del espacio.')
        const nextElementos = data.elementos as ElementoEnergia[]
        setElementos(nextElementos)
        onEnergyChange?.(Object.fromEntries(nextElementos.map((item) => [item.nodeKey, item.consumoKwh])))
        setEstadoPeriodo(data.periodo.estado as string)
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Error consultando energía.')
      } finally {
        if (!controller.signal.aborted) setCargando(false)
      }
    }
    void consultar()
    return () => controller.abort()
  }, [modeloId, mes, ano, onEnergyChange])

  const elemento = useMemo(() => elementos.find((item) => item.nodeKey === nodeKey), [elementos, nodeKey])
  const total = elemento?.consumoKwh ?? null
  const fuente = elemento ? COPIA_FUENTE[elemento.fuente] ?? elemento.fuente : null
  const formato = (value: number | null) => value === null ? '—' : value.toLocaleString('es-CO', { maximumFractionDigits: 2 })

  return (
    <section className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-900 dark:text-white">Consumo energético estimado</p>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Estimación</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-[11px] text-slate-600 dark:text-slate-300">
          Mes
          <select className="ui-input mt-1 w-full" value={mes} onChange={(event) => setMes(event.target.value)}>
            {MESES.map((nombre, index) => <option key={index} value={String(index + 1)}>{nombre}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-slate-600 dark:text-slate-300">
          Año
          <input className="ui-input mt-1 w-full" type="number" min="2000" max="2100" value={ano} onChange={(event) => setAno(event.target.value)} />
        </label>
      </div>

      {cargando ? <p className="mt-3 text-xs text-slate-500">Consultando consumo del periodo…</p> : null}
      {error && <p role="alert" className="mt-3 text-xs text-rose-600">{error}</p>}
      {!cargando && !error && !elemento && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Este nodo no tiene un espacio asociado. Asócielo para consultar sus equipos y consumo.</p>
      )}
      {!cargando && elemento && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
              <p className="text-[10px] text-slate-500">Consumo del periodo</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{formato(total)} <span className="text-xs font-medium">kWh</span></p>
            </div>
            <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
              <p className="text-[10px] text-slate-500">Equipos activos</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{elemento.cantidadEquipos}</p>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">{elemento.espacio.bloque.codigo} · {elemento.espacio.nombre} · Piso {elemento.espacio.piso}</p>
          <p className="mt-1 text-[10px] text-slate-500">Fuente: {fuente} · Estado del periodo: {estadoPeriodo}</p>
          <div className="mt-3 space-y-2">
            {elemento.equipos.map((equipo) => (
              <div key={equipo.id} className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100">{equipo.tipo} <span className="text-slate-500">× {equipo.cantidad}</span></p>
                  <p className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-900 dark:text-white">{formato(equipo.consumoKwh)} kWh</p>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">{formato(equipo.potenciaW)} W · {formato(equipo.horasUsoDia)} h/día · {formato(equipo.diasUsoMes)} días/mes</p>
                {equipo.motivoRevision && <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">{equipo.motivoRevision}</p>}
              </div>
            ))}
            {elemento.equipos.length === 0 && <p className="text-xs text-slate-500">El espacio no tiene equipos activos registrados.</p>}
          </div>
        </>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
        Estimación basada en potencia, cantidad y horas/días de uso. No representa una medición independiente ni sustituye la factura EPM de la edificación.
      </p>
    </section>
  )
}
