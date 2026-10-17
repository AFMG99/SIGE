'use client'

/**
 * Configuración del calendario dentro de la sub-vista «Calendario» (6d2/6d3).
 *
 * Absorbe las secciones 2 y 3 del antiguo drawer «Calendario operativo»
 * (borrado en 6d1): rangos de fechas + plantilla TdeA y CRUD de horarios de
 * funcionamiento de equipos. Usa la MISMA selección de edificación que el
 * calendario y los eventos (S9, estado compartido en DatosContent): al
 * cambiar la edificación arriba se recargan rangos y horarios aquí.
 *
 * Sin configuración operativa no hay calendario subyacente: el formulario
 * pide guardarla primero en la pestaña «Configuración operativa».
 */

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/shared/views/ui/ToastProvider'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'
import { ListboxSelect } from '@/shared/views/ui/ListboxSelect'
import {
  agregarRangoCalendario,
  cargarPlantillaCalendario,
  eliminarRangoCalendario,
} from '@/features/datos/controllers/calendario'
import { crearHorarioEquipo, eliminarHorarioEquipo } from '@/features/datos/controllers/horarios'
import { CATALOGO_TIPOS_DIA } from '@/features/datos/models/calendario'
import { CATALOGO_DIAS, formatearDias } from '@/features/datos/models/horarios'
import { etiquetaAmbitoDeHorario } from './ambitos'
import type {
  BloqueInfo,
  CalendarioInfo,
  EspacioInfo,
  HorarioEquipoInfo,
  RangoCalendarioUI,
} from './useCatalogoEdificaciones'
import type { EquipoExistente } from './existencias'

/** `2026-02-09` → `09/02/2026` (dd/MM/yyyy, determinista). */
const fechaCorta = (iso: string): string => iso.split('-').reverse().join('/')

const hora = (h: number): string => `${String(h).padStart(2, '0')}:00`

interface ConfiguracionCalendarioProps {
  /** Selección compartida con el calendario y los eventos (S9). */
  edificacionId: string
  /** Configuración operativa por edificación (calendario subyacente). */
  calendarios: CalendarioInfo[]
  /** Rangos de fechas de todos los calendarios (se filtran aquí). */
  rangos: RangoCalendarioUI[]
  /** Horarios de funcionamiento por edificación (se filtran aquí). */
  horarios: HorarioEquipoInfo[]
  bloques: BloqueInfo[]
  espacios: EspacioInfo[]
  /** Equipos registrados (ids jerárquicos para el ámbito, S12). */
  equipos: EquipoExistente[]
  /** Solo lectura: oculta los formularios (la lista queda visible). */
  puedeCargar: boolean
}

const RANGO_INICIAL = {
  fechaInicio: '',
  fechaFin: '',
  tipoDia: 'LECTIVO',
  nombre: '',
}

const HORARIO_INICIAL = {
  nombre: '',
  ambito: '',
  dias: [] as string[],
  horaInicio: '8',
  horaFin: '17',
}

export function ConfiguracionCalendario({
  edificacionId,
  calendarios,
  rangos,
  horarios,
  bloques,
  espacios,
  equipos,
  puedeCargar,
}: ConfiguracionCalendarioProps) {
  const router = useRouter()
  const { showToast } = useToast()

  const config = calendarios.find((c) => c.edificacionId === edificacionId) ?? null
  const rangosSel = config
    ? rangos
        .filter((r) => r.calendarioId === config.id)
        .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))
    : []
  const horariosSel = horarios.filter((h) => h.edificacionId === edificacionId)

  // ------------------------------------------------------------
  // Rangos de fechas + plantilla TdeA
  // ------------------------------------------------------------
  const [rango, setRango] = useState(RANGO_INICIAL)
  const [agregandoRango, setAgregandoRango] = useState(false)
  const [borrandoRango, setBorrandoRango] = useState<string | null>(null)
  const [errorRango, setErrorRango] = useState('')
  const [confirmarPlantilla, setConfirmarPlantilla] = useState(false)

  const agregarRango = async (e: FormEvent) => {
    e.preventDefault()
    if (agregandoRango || !edificacionId) return
    setErrorRango('')
    if (!rango.fechaInicio || !rango.fechaFin) {
      setErrorRango('Indique la fecha de inicio y la fecha de fin del rango.')
      return
    }
    if (rango.fechaFin < rango.fechaInicio) {
      setErrorRango('La fecha de fin no puede ser anterior a la de inicio.')
      return
    }
    setAgregandoRango(true)
    try {
      const res = await agregarRangoCalendario(edificacionId, {
        fechaInicio: rango.fechaInicio,
        fechaFin: rango.fechaFin,
        tipoDia: rango.tipoDia,
        nombre: rango.nombre.trim() || undefined,
      })
      if (res.estado === 'error') {
        setErrorRango(res.mensaje)
        return
      }
      showToast(res.mensaje, 'success')
      setRango(RANGO_INICIAL)
      router.refresh()
    } finally {
      setAgregandoRango(false)
    }
  }

  const eliminarRango = async (id: string) => {
    if (borrandoRango) return
    setErrorRango('')
    setBorrandoRango(id)
    try {
      const res = await eliminarRangoCalendario(id)
      if (res.estado === 'error') {
        setErrorRango(res.mensaje)
        return
      }
      showToast(res.mensaje, 'success')
      router.refresh()
    } finally {
      setBorrandoRango(null)
    }
  }

  const cargarPlantilla = async () => {
    if (!edificacionId) return
    setErrorRango('')
    const res = await cargarPlantillaCalendario(edificacionId)
    if (res.estado === 'error') {
      setErrorRango(res.mensaje)
      return
    }
    showToast(res.mensaje, 'success')
    router.refresh()
  }

  // ------------------------------------------------------------
  // Horarios de funcionamiento de equipos
  // ------------------------------------------------------------
  const [horario, setHorario] = useState(HORARIO_INICIAL)
  const [creandoHorario, setCreandoHorario] = useState(false)
  const [borrandoHorario, setBorrandoHorario] = useState<string | null>(null)
  const [errorHorario, setErrorHorario] = useState('')

  const bloquesEdif = bloques.filter((b) => b.edificacionId === edificacionId)
  const espaciosEdif = espacios.filter((s) => bloquesEdif.some((b) => b.id === s.bloqueId))
  const equiposEdif = equipos.filter((q) => bloquesEdif.some((b) => b.id === q.bloqueId))

  const ambitosDisponibles = [
    { valor: '', etiqueta: 'Toda la edificación' },
    ...bloquesEdif.map((b) => ({
      valor: `bloque:${b.id}`,
      etiqueta: `Bloque ${b.codigo}${b.nombre ? ` — ${b.nombre}` : ''}`,
    })),
    ...espaciosEdif.map((s) => ({ valor: `espacio:${s.id}`, etiqueta: `Espacio ${s.nombre}` })),
    ...equiposEdif.map((q) => ({
      valor: `equipo:${q.id}`,
      etiqueta: `Equipo ${q.tipo} en ${q.espacio}`,
    })),
  ]

  const toggleDia = (codigo: string) =>
    setHorario((h) => ({
      ...h,
      dias: h.dias.includes(codigo) ? h.dias.filter((d) => d !== codigo) : [...h.dias, codigo],
    }))

  const crearHorario = async (e: FormEvent) => {
    e.preventDefault()
    if (creandoHorario || !edificacionId) return
    setErrorHorario('')
    if (!horario.nombre.trim()) {
      setErrorHorario('Asigne un nombre al horario (p. ej. «Aula con clases»).')
      return
    }
    if (horario.dias.length === 0) {
      setErrorHorario('Seleccione al menos un día de la semana.')
      return
    }
    const inicio = Number(horario.horaInicio)
    const fin = Number(horario.horaFin)
    if (fin <= inicio) {
      setErrorHorario('La hora de fin debe ser posterior a la de inicio.')
      return
    }
    const [tipo, id] = horario.ambito.split(':')
    setCreandoHorario(true)
    try {
      const res = await crearHorarioEquipo(edificacionId, {
        nombre: horario.nombre.trim(),
        diasSemana: horario.dias,
        horaInicio: inicio,
        horaFin: fin,
        ambito:
          horario.ambito && id
            ? {
                bloqueId: tipo === 'bloque' ? id : null,
                espacioId: tipo === 'espacio' ? id : null,
                equipoId: tipo === 'equipo' ? id : null,
              }
            : undefined,
      })
      if (res.estado === 'error') {
        setErrorHorario(res.mensaje)
        return
      }
      showToast(res.mensaje, 'success')
      setHorario(HORARIO_INICIAL)
      router.refresh()
    } finally {
      setCreandoHorario(false)
    }
  }

  const eliminarHorario = async (id: string) => {
    if (borrandoHorario) return
    setErrorHorario('')
    setBorrandoHorario(id)
    try {
      const res = await eliminarHorarioEquipo(id)
      if (res.estado === 'error') {
        setErrorHorario(res.mensaje)
        return
      }
      showToast(res.mensaje, 'success')
      router.refresh()
    } finally {
      setBorrandoHorario(null)
    }
  }

  /** Vigencia inclusiva (sin campos = sin límite). */
  const esVigente = (h: HorarioEquipoInfo, hoy: string): boolean =>
    (!h.desde || h.desde <= hoy) && (!h.hasta || h.hasta >= hoy)

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  if (!edificacionId) {
    return (
      <div className="ui-empty">
        <p className="ui-title text-sm">Sin edificación seleccionada</p>
        <p className="max-w-md text-xs">
          Los rangos, la plantilla TdeA y los horarios de equipos se editan siempre dentro de una
          edificación: elija una arriba en el calendario.
        </p>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="ui-empty">
        <p className="ui-title text-sm">Sin configuración operativa</p>
        <p className="max-w-md text-xs">
          Guarde primero el horario de operación y la ubicación en la pestaña «Configuración
          operativa»: sin calendario operativo no hay rangos ni horarios que registrar.
        </p>
      </div>
    )
  }

  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      {/* Rangos de fechas + plantilla TdeA (sección 2 del ex-drawer) */}
      <section className="ui-card">
        <div>
          <h3 className="ui-title text-sm">Rangos de fechas y plantilla TdeA</h3>
          <p className="ui-muted mt-1 text-xs">
            Días operativos vs. no operativos por rango de fechas. Si dos rangos se superponen, el
            último que cubre la fecha gana — la misma regla que usa la GDE. La plantilla TdeA son
            datos iniciales editables, sin fechas fijas en la lógica.
          </p>
        </div>

        {errorRango && (
          <div role="alert" className="ui-callout ui-callout-danger">
            {errorRango}
          </div>
        )}

        {puedeCargar && (
          <form onSubmit={agregarRango} className="space-y-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="rango-inicio" className="ui-label mb-1.5">
                  Fecha de inicio
                </label>
                <input
                  id="rango-inicio"
                  type="date"
                  className="ui-input"
                  value={rango.fechaInicio}
                  onChange={(e) => setRango({ ...rango, fechaInicio: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="rango-fin" className="ui-label mb-1.5">
                  Fecha de fin
                </label>
                <input
                  id="rango-fin"
                  type="date"
                  className="ui-input"
                  value={rango.fechaFin}
                  onChange={(e) => setRango({ ...rango, fechaFin: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="rango-tipo" className="ui-label mb-1.5">
                  Tipo de día
                </label>
                <select
                  id="rango-tipo"
                  className="ui-input"
                  value={rango.tipoDia}
                  onChange={(e) => setRango({ ...rango, tipoDia: e.target.value })}
                >
                  {CATALOGO_TIPOS_DIA.map((t) => (
                    <option key={t.codigo} value={t.codigo}>
                      {t.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rango-nombre" className="ui-label mb-1.5">
                  Nombre del rango (opcional)
                </label>
                <input
                  id="rango-nombre"
                  className="ui-input"
                  placeholder="Semana santa"
                  value={rango.nombre}
                  onChange={(e) => setRango({ ...rango, nombre: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={agregandoRango} className="ui-btn ui-btn-primary">
                {agregandoRango ? 'Agregando…' : 'Agregar rango'}
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-secondary"
                onClick={() => setConfirmarPlantilla(true)}
              >
                Cargar plantilla TdeA
              </button>
            </div>
          </form>
        )}

        {rangosSel.length === 0 ? (
          <div className="ui-empty">
            <p className="ui-title text-sm">Sin rangos registrados</p>
            <p className="max-w-md text-xs">
              Mientras no haya rangos, todo el mes se considera hábil (HBL). Agregue un rango o
              cargue la plantilla TdeA.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rangosSel.map((r) => {
              const tipo = CATALOGO_TIPOS_DIA.find((t) => t.codigo === r.tipoDia)
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">
                      {fechaCorta(r.fechaInicio)} → {fechaCorta(r.fechaFin)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium dark:bg-slate-800">
                      {tipo?.etiqueta ?? r.tipoDia}
                    </span>
                    {r.nombre && <span className="ui-muted text-xs">({r.nombre})</span>}
                  </div>
                  {puedeCargar && (
                    <button
                      type="button"
                      aria-label={`Eliminar rango ${fechaCorta(r.fechaInicio)} a ${fechaCorta(r.fechaFin)}`}
                      disabled={borrandoRango === r.id}
                      onClick={() => void eliminarRango(r.id)}
                      className="ui-btn ui-btn-danger-outline ui-btn-sm focus-ring"
                    >
                      {borrandoRango === r.id ? 'Eliminando…' : 'Eliminar'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <ConfirmDialog
          isOpen={confirmarPlantilla}
          onClose={() => setConfirmarPlantilla(false)}
          onConfirm={() => void cargarPlantilla()}
          title="Reemplazar rango actual"
          description="La plantilla TdeA reemplaza los rangos actuales con datos típicos (lectivos, vacaciones y festivos de ejemplo). Puede editarlos después."
          confirmText="Cargar plantilla"
          cancelText="Cancelar"
          variant="primary"
        />
      </section>

      {/* Horarios de funcionamiento de equipos (sección 3 del ex-drawer) */}
      <section className="ui-card">
        <div>
          <h3 className="ui-title text-sm">Horarios de funcionamiento de equipos</h3>
          <p className="ui-muted mt-1 text-xs">
            Días de la semana y franja horaria por ámbito (edificación, bloque, espacio o equipo).
            Con el interruptor «Usar horarios como Xe» encendido en «Configuración operativa», los
            horarios vigentes alimentan el cálculo de la GDE.
          </p>
        </div>

        {errorHorario && (
          <div role="alert" className="ui-callout ui-callout-danger">
            {errorHorario}
          </div>
        )}

        {puedeCargar && (
          <form onSubmit={crearHorario} className="space-y-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="horario-nombre" className="ui-label mb-1.5">
                  Nombre del horario
                </label>
                <input
                  id="horario-nombre"
                  className="ui-input"
                  placeholder="Aula con clases"
                  value={horario.nombre}
                  onChange={(e) => setHorario({ ...horario, nombre: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="horario-ambito" className="ui-label mb-1.5">
                  Ámbito
                </label>
                <ListboxSelect
                  id="horario-ambito"
                  value={horario.ambito}
                  onChange={(v) => setHorario({ ...horario, ambito: v })}
                  options={ambitosDisponibles.map((a) => ({ value: a.valor, label: a.etiqueta }))}
                  className="ui-input mt-1 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <span className="ui-label mb-1.5" id="horario-dias-label">
                Días de la semana
              </span>
              <div
                role="group"
                aria-labelledby="horario-dias-label"
                className="mt-1 flex flex-wrap gap-2"
              >
                {CATALOGO_DIAS.map((d) => {
                  const activo = horario.dias.includes(d.codigo)
                  return (
                    <button
                      key={d.codigo}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => toggleDia(d.codigo)}
                      className={`focus-ring min-h-10 min-w-10 cursor-pointer rounded-lg border px-2.5 text-sm font-medium ${
                        activo
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200'
                      }`}
                    >
                      {d.abrev}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid max-w-md grid-cols-2 gap-3">
              <div>
                <label htmlFor="horario-inicio" className="ui-label mb-1.5">
                  Hora de inicio
                </label>
                <select
                  id="horario-inicio"
                  className="ui-input"
                  value={horario.horaInicio}
                  onChange={(e) => setHorario({ ...horario, horaInicio: e.target.value })}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {hora(h)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="horario-fin" className="ui-label mb-1.5">
                  Hora de fin
                </label>
                <select
                  id="horario-fin"
                  className="ui-input"
                  value={horario.horaFin}
                  onChange={(e) => setHorario({ ...horario, horaFin: e.target.value })}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {hora(h)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" disabled={creandoHorario} className="ui-btn ui-btn-primary">
              {creandoHorario ? 'Creando…' : 'Crear horario'}
            </button>
          </form>
        )}

        {horariosSel.length === 0 ? (
          <div className="ui-empty">
            <p className="ui-title text-sm">Sin horarios registrados</p>
            <p className="max-w-md text-xs">
              Sin horarios, la fuente Xe usa las horas de operación (H) de la configuración.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {horariosSel.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{h.nombre}</span>
                  <span className="ui-muted text-xs">
                    {etiquetaAmbitoDeHorario(h, bloques, espacios, equipos)}
                  </span>
                  <span className="ui-muted text-xs">{formatearDias(h.diasSemana)}</span>
                  <span className="ui-muted text-xs">
                    {hora(h.horaInicio)}–{hora(h.horaFin)}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      esVigente(h, hoy)
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {esVigente(h, hoy) ? 'Vigente' : 'Sin vigencia'}
                  </span>
                </div>
                {puedeCargar && (
                  <button
                    type="button"
                    aria-label={`Eliminar horario ${h.nombre}`}
                    disabled={borrandoHorario === h.id}
                    onClick={() => void eliminarHorario(h.id)}
                    className="ui-btn ui-btn-danger-outline ui-btn-sm focus-ring"
                  >
                    {borrandoHorario === h.id ? 'Eliminando…' : 'Eliminar'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
