'use client'

/**
 * Drawer «Calendario y GDE» de una edificación (sección Edificaciones).
 *
 * Cuatro bloques, en orden (UPME 0016/2024 §7.1/§7.3):
 * 1. Configuración operativa: horario diario H, temperatura base Tb y
 *    ubicación elegida por ciudad/zona (geocoding Open-Meteo, S1): las
 *    lat/lon son el contrato interno hacia la fuente climática, nunca las
 *    escribe el usuario a mano.
 * 2. Rangos del calendario: días operativos vs. no operativos; plantilla TdeA
 *    como datos iniciales editables (sin fechas fijas en la lógica).
 * 3. Horarios de funcionamiento de equipos: días de la semana + franja horaria
 *    por grupo de equipos, editables sin depender de la configuración.
 * 4. GDE mensual calculada con la fórmula de la resolución, mostrando la
 *    fórmula con los valores sustituidos junto al resultado (interpretabilidad).
 */

import { useEffect, useRef, useState, FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useToast } from '@/shared/views/ui/ToastProvider'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'
import {
  CATALOGO_TIPOS_DIA,
  TDEA_PLANTILLA,
  tipoDiaEsOperativo,
} from '@/features/datos/models/calendario'
import {
  agregarRangoCalendario,
  calcularGdeMensual,
  cargarPlantillaCalendario,
  eliminarRangoCalendario,
  guardarConfigCalendario,
  registrarGdeCalculado,
} from '@/features/datos/controllers/calendario'
import { buscarUbicacion } from '@/features/datos/controllers/clima'
import type { UbicacionEncontrada } from '@/features/datos/models/calendario'
import { crearHorarioEquipo, eliminarHorarioEquipo } from '@/features/datos/controllers/horarios'
import {
  CATALOGO_AMBITOS,
  CATALOGO_DIAS,
  formatearDias,
  formatearFranja,
  formatearVigencia,
  type CodigoAmbito,
} from '@/features/datos/models/horarios'
import type { ResultadoCalculoGde } from '@/features/datos/controllers/calendario'
import type {
  BloqueInfo,
  CalendarioInfo,
  EdificacionInfo,
  EspacioInfo,
  HorarioEquipoInfo,
  RangoCalendarioUI,
} from './useCatalogoEdificaciones'
import type { EquipoExistente } from './existencias'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const num = (n: number): string =>
  new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n)

const fechaCorta = (iso: string): string => {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const hora = (h: number): string => `${String(h).padStart(2, '0')}:00`

/** Coordenada en es-CO con hasta 4 decimales: `6,2477`. */
const coord = (n: number): string =>
  new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 }).format(n)

interface CalendarioGdeDrawerProps {
  isOpen: boolean
  onClose: () => void
  /** Edificación a la que pertenece el calendario (ya creada). */
  edificacion: EdificacionInfo | null
  configInicial: CalendarioInfo | null
  rangosIniciales: RangoCalendarioUI[]
  /** Horarios de equipos ya registrados en esta edificación. */
  horariosIniciales: HorarioEquipoInfo[]
  /** Estructura jerárquica de la edificación (S12: ámbito de los horarios). */
  bloques: BloqueInfo[]
  espacios: EspacioInfo[]
  equipos: EquipoExistente[]
}

const ANO_BASE = new Date().getFullYear()
const ANOS = [ANO_BASE - 1, ANO_BASE, ANO_BASE + 1, ANO_BASE + 2]

export function CalendarioGdeDrawer({
  isOpen,
  onClose,
  edificacion,
  configInicial,
  rangosIniciales,
  horariosIniciales,
  bloques,
  espacios,
  equipos,
}: CalendarioGdeDrawerProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const drawerRef = useRef<HTMLDivElement>(null)

  // Configuración operativa
  const [horaInicio, setHoraInicio] = useState('8')
  const [horasDia, setHorasDia] = useState('12')
  const [tb, setTb] = useState('23')
  // Ubicación por ciudad/zona (S1): el usuario elige una ciudad y nunca
  // escribe lat/lon; esas coordenadas son el contrato interno hacia la
  // fuente climática y viajan ya resueltas al servidor.
  const [ubicacion, setUbicacion] = useState<{
    nombre: string | null
    lat: number
    lon: number
  } | null>(null)
  const [busquedaAbierta, setBusquedaAbierta] = useState(true)
  const [consulta, setConsulta] = useState('')
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [resultadosUbicacion, setResultadosUbicacion] = useState<UbicacionEncontrada[] | null>(null)
  const [guardandoConfig, setGuardandoConfig] = useState(false)
  const [config, setConfig] = useState<CalendarioInfo | null>(configInicial)

  // Rangos
  const [rangos, setRangos] = useState<RangoCalendarioUI[]>(rangosIniciales)
  const [rangoForm, setRangoForm] = useState({
    fechaInicio: '',
    fechaFin: '',
    tipoDia: 'LECTIVO',
    nombre: '',
  })
  const [rangoEliminando, setRangoEliminando] = useState<RangoCalendarioUI | null>(null)

  // Horarios de equipos
  const [horarios, setHorarios] = useState<HorarioEquipoInfo[]>(horariosIniciales)
  const [horarioForm, setHorarioForm] = useState({
    nombre: '',
    diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'] as string[],
    horaInicio: '7',
    horaFin: '19',
    // Ámbito jerárquico (S12): nivel + ids seleccionados en cascada.
    nivel: 'EDIFICACION' as CodigoAmbito,
    bloqueId: '',
    espacioId: '',
    equipoId: '',
    // Vigencia: `desde` recomendada, `hasta` abierta si queda vacía.
    desde: '',
    hasta: '',
  })
  const [horarioEliminando, setHorarioEliminando] = useState<HorarioEquipoInfo | null>(null)

  // GDE
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(ANO_BASE)
  const [calculando, setCalculando] = useState(false)
  const [registro, setRegistro] = useState(false)
  const [resultado, setResultado] = useState<ResultadoCalculoGde | null>(null)
  const [error, setError] = useState('')

  // Re-inicializa desde props al abrir
  useEffect(() => {
    if (!isOpen) return
    setConfig(configInicial)
    setRangos(rangosIniciales)
    setHorarios(horariosIniciales)
    setResultado(null)
    setError('')
    setHoraInicio(configInicial ? String(configInicial.horaInicioOperacion) : '8')
    setHorasDia(configInicial ? String(configInicial.horasOperacionDia) : '12')
    setTb(configInicial ? String(configInicial.temperaturaBase) : '23')
    const conUbicacion =
      edificacion?.lat != null && edificacion?.lon != null
        ? {
            nombre: edificacion.ubicacionNombre ?? null,
            lat: edificacion.lat,
            lon: edificacion.lon,
          }
        : null
    setUbicacion(conUbicacion)
    setBusquedaAbierta(conUbicacion == null)
    setConsulta('')
    setBuscandoUbicacion(false)
    setResultadosUbicacion(null)
    setHorarioForm({
      nombre: '',
      diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
      horaInicio: '7',
      horaFin: '19',
      nivel: 'EDIFICACION',
      bloqueId: '',
      espacioId: '',
      equipoId: '',
      desde: '',
      hasta: '',
    })
    const first = drawerRef.current?.querySelector<HTMLInputElement>('input, select')
    first?.focus()
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen || !edificacion) return null

  const fallo = (mensaje: string) => setError(mensaje)

  // ------------------------- Configuración -------------------------

  const guardarConfig = async (e: FormEvent) => {
    e.preventDefault()
    if (guardandoConfig) return
    setError('')
    if (!ubicacion) {
      fallo('Busque y seleccione la ubicación (ciudad o zona) de la edificación.')
      return
    }
    const datos = {
      horaInicioOperacion: Number(horaInicio),
      horasOperacionDia: Number(horasDia),
      temperaturaBase: Number(tb),
      lat: ubicacion.lat,
      lon: ubicacion.lon,
      ubicacionNombre: ubicacion.nombre,
    }
    setGuardandoConfig(true)
    try {
      const res = await guardarConfigCalendario(edificacion.id, datos)
      if (res.estado === 'error') {
        fallo(res.mensaje)
        return
      }
      setConfig({
        id: config?.id ?? 'local',
        edificacionId: edificacion.id,
        horaInicioOperacion: datos.horaInicioOperacion,
        horasOperacionDia: datos.horasOperacionDia,
        temperaturaBase: datos.temperaturaBase,
      })
      showToast(res.mensaje, 'success')
      router.refresh()
    } finally {
      setGuardandoConfig(false)
    }
  }

  // ------------------------- Ubicación (ciudad/zona, S1) -------------------

  /** Busca ciudades/zonas en el geocoding server-side (bajo demanda, S1).
   *  Sin `FormEvent`: el bloque de configuración ya es un `<form>` y anidar
   *  forms es HTML inválido — el input dispara con Enter y el botón con click. */
  const buscarUbicacionEnFuente = async () => {
    if (buscandoUbicacion) return
    setError('')
    const texto = consulta.trim()
    if (texto.length < 3) {
      fallo('Escriba al menos 3 caracteres para buscar la ciudad o zona.')
      return
    }
    setBuscandoUbicacion(true)
    try {
      const res = await buscarUbicacion(texto)
      if (res.estado === 'error') {
        fallo(res.mensaje)
        return
      }
      setResultadosUbicacion(res.ubicaciones)
    } finally {
      setBuscandoUbicacion(false)
    }
  }

  /** Elige un resultado: fija nombre + lat/lon pendientes de «Guardar». */
  const seleccionarUbicacion = (u: UbicacionEncontrada) => {
    setUbicacion({
      nombre: u.admin1 ? `${u.nombre}, ${u.admin1}` : u.nombre,
      lat: u.lat,
      lon: u.lon,
    })
    setResultadosUbicacion(null)
    setConsulta('')
    setBusquedaAbierta(false)
    setError('')
  }

  // ------------------------- Rangos -------------------------

  const agregarRango = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await agregarRangoCalendario(edificacion.id, {
      fechaInicio: rangoForm.fechaInicio,
      fechaFin: rangoForm.fechaFin,
      tipoDia: rangoForm.tipoDia,
      nombre: rangoForm.nombre.trim() || undefined,
    })
    if (res.estado === 'error') {
      fallo(res.mensaje)
      return
    }
    // Refresca desde el servidor: el id lo crea la BD.
    showToast(res.mensaje, 'success')
    router.refresh()
    setRangoForm({ fechaInicio: '', fechaFin: '', tipoDia: 'LECTIVO', nombre: '' })
  }

  const eliminarRango = async () => {
    if (!rangoEliminando) return
    const res = await eliminarRangoCalendario(rangoEliminando.id)
    if (res.estado === 'error') {
      setRangoEliminando(null)
      fallo(res.mensaje)
      return
    }
    setRangos((prev) => prev.filter((r) => r.id !== rangoEliminando.id))
    setRangoEliminando(null)
    showToast(res.mensaje, 'success')
    router.refresh()
  }

  const cargarPlantilla = async () => {
    setError('')
    const res = await cargarPlantillaCalendario(edificacion.id)
    if (res.estado === 'error') {
      fallo(res.mensaje)
      return
    }
    showToast(res.mensaje, 'success')
    router.refresh()
  }

  // ------------------------- Horarios de equipos -------------------------

  const alternarDia = (codigo: string) => {
    setHorarioForm((f) => ({
      ...f,
      diasSemana: f.diasSemana.includes(codigo)
        ? f.diasSemana.filter((c) => c !== codigo)
        : [...f.diasSemana, codigo],
    }))
  }

  // Cambiar de nivel o de bloque reinicia la selección dependiente (cascada).
  const cambiarNivel = (nivel: CodigoAmbito) => {
    setHorarioForm((f) => ({ ...f, nivel, bloqueId: '', espacioId: '', equipoId: '' }))
  }
  const cambiarBloque = (bloqueId: string) => {
    setHorarioForm((f) => ({ ...f, bloqueId, espacioId: '', equipoId: '' }))
  }
  const cambiarEspacio = (espacioId: string) => {
    setHorarioForm((f) => ({ ...f, espacioId, equipoId: '' }))
  }

  /** Etiqueta del ámbito de un horario ya guardado (chip en la lista). */
  const etiquetaAmbito = (h: HorarioEquipoInfo): string => {
    if (h.equipoId) {
      const eq = equipos.find((e) => e.id === h.equipoId)
      return eq ? `Equipo · ${eq.tipo} (${eq.espacio})` : 'Equipo'
    }
    if (h.espacioId) {
      const sp = espacios.find((s) => s.id === h.espacioId)
      return sp ? `Espacio · ${sp.nombre}` : 'Espacio'
    }
    if (h.bloqueId) {
      const bk = bloques.find((b) => b.id === h.bloqueId)
      return bk ? `Bloque · ${bk.codigo}` : 'Bloque'
    }
    return 'Edificación completa'
  }

  const agregarHorario = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const ini = Number(horarioForm.horaInicio)
    const fin = Number(horarioForm.horaFin)
    if (horarioForm.diasSemana.length === 0) {
      fallo('Seleccione al menos un día de la semana.')
      return
    }
    if (fin <= ini) {
      fallo('La hora final debe ser posterior a la inicial (sin cruce de medianoche).')
      return
    }
    // Validación del ámbito antes de ir al servidor (el servidor también valida).
    if (horarioForm.nivel !== 'EDIFICACION' && !horarioForm.bloqueId) {
      fallo('Seleccione el bloque del ámbito.')
      return
    }
    if (horarioForm.nivel !== 'EDIFICACION' && horarioForm.nivel !== 'BLOQUE' && !horarioForm.espacioId) {
      fallo('Seleccione el espacio del ámbito.')
      return
    }
    if (horarioForm.nivel === 'EQUIPO' && !horarioForm.equipoId) {
      fallo('Seleccione el equipo del ámbito.')
      return
    }
    if (horarioForm.desde && horarioForm.hasta && horarioForm.hasta < horarioForm.desde) {
      fallo('La fecha final de vigencia debe ser posterior o igual a la inicial.')
      return
    }
    const ambito =
      horarioForm.nivel === 'EDIFICACION'
        ? {}
        : horarioForm.nivel === 'BLOQUE'
          ? { bloqueId: horarioForm.bloqueId }
          : horarioForm.nivel === 'ESPACIO'
            ? { bloqueId: horarioForm.bloqueId, espacioId: horarioForm.espacioId }
            : {
                bloqueId: horarioForm.bloqueId,
                espacioId: horarioForm.espacioId,
                equipoId: horarioForm.equipoId,
              }
    const res = await crearHorarioEquipo(edificacion.id, {
      nombre: horarioForm.nombre,
      diasSemana: horarioForm.diasSemana,
      horaInicio: ini,
      horaFin: fin,
      ambito,
      desde: horarioForm.desde || null,
      hasta: horarioForm.hasta || null,
    })
    if (res.estado === 'error') {
      fallo(res.mensaje)
      return
    }
    // Refresca desde el servidor: el id lo crea la BD.
    showToast(res.mensaje, 'success')
    router.refresh()
    setHorarioForm({
      nombre: '',
      diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
      horaInicio: '7',
      horaFin: '19',
      nivel: 'EDIFICACION',
      bloqueId: '',
      espacioId: '',
      equipoId: '',
      desde: '',
      hasta: '',
    })
  }

  const eliminarHorario = async () => {
    if (!horarioEliminando) return
    const res = await eliminarHorarioEquipo(horarioEliminando.id)
    if (res.estado === 'error') {
      setHorarioEliminando(null)
      fallo(res.mensaje)
      return
    }
    setHorarios((prev) => prev.filter((h) => h.id !== horarioEliminando.id))
    setHorarioEliminando(null)
    showToast(res.mensaje, 'success')
    router.refresh()
  }

  // ------------------------- GDE -------------------------

  const calcular = async () => {
    if (calculando) return
    setError('')
    setResultado(null)
    setCalculando(true)
    try {
      const res = await calcularGdeMensual(edificacion.id, mes, ano)
      if (res.estado === 'error') {
        fallo(res.mensaje)
        return
      }
      setResultado(res)
    } finally {
      setCalculando(false)
    }
  }

  const registrar = async () => {
    if (!resultado || registro) return
    setError('')
    setRegistro(true)
    try {
      const res = await registrarGdeCalculado(
        edificacion.id,
        resultado.mes,
        resultado.ano,
        resultado.resultado.gde
      )
      if (res.estado === 'error') {
        fallo(res.mensaje)
        return
      }
      showToast(res.mensaje, 'success')
      router.refresh()
    } finally {
      setRegistro(false)
    }
  }

  // ------------------------- Render -------------------------

  const hayConfig = config != null
  const horaFin = hayConfig
    ? (config.horaInicioOperacion + config.horasOperacionDia) % 24
    : 0

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 dark:bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendario-drawer-title"
    >
      <div
        ref={drawerRef}
        className="h-full w-full max-w-[34rem] animate-slide-in-right overflow-y-auto bg-white shadow-2xl dark:bg-slate-900 dark:shadow-black/40"
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-gray-100 px-6 pt-6 pb-4 dark:border-slate-800">
          <div>
            <h2 id="calendario-drawer-title" className="ui-title text-lg">
              Calendario y GDE
            </h2>
            <p className="ui-muted mt-1 text-sm">{edificacion.nombre}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="focus-ring cursor-pointer rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-slate-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 px-6 pb-6">
          {error && (
            <div role="alert" className="ui-callout ui-callout-danger">
              {error}
            </div>
          )}

          {/* 1. Configuración operativa (H, Tb, coordenadas) */}
          <form onSubmit={guardarConfig} className="space-y-3" noValidate>
            <div>
              <h3 className="ui-title text-sm">Configuración operativa</h3>
              <p className="ui-muted mt-1 text-xs">
                Horario H sobre el que se promedia la temperatura, temperatura base Tb de la
                fórmula GDE = Σ(Tp − Tb)·Xd y coordenadas de la fuente climática.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cfg-hora-inicio" className="ui-label mb-1.5">
                  Inicio del día operativo
                </label>
                <select
                  id="cfg-hora-inicio"
                  className="ui-input"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{hora(h)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cfg-horas" className="ui-label mb-1.5">
                  Horas de operación por día
                </label>
                <input
                  id="cfg-horas"
                  type="number"
                  min={1}
                  max={24}
                  className="ui-input"
                  value={horasDia}
                  onChange={(e) => setHorasDia(e.target.value)}
                />
              </div>
            </div>
            <p className="ui-muted text-xs">
              Horario diario: {hora(Number(horaInicio))}–{hora(horaFin)} ({horasDia} h)
            </p>

            <div>
              <label htmlFor="cfg-tb" className="ui-label mb-1.5">Tb (°C)</label>
              <input
                id="cfg-tb"
                type="number"
                min={10}
                max={40}
                step="any"
                className="ui-input"
                value={tb}
                onChange={(e) => setTb(e.target.value)}
              />
              <p className="ui-muted mt-1 text-xs">
                La temperatura base Tb se define por tipo de edificación (típicamente 3 °C bajo el
                confort: 20 / 23 / 25 °C según la resolución).
              </p>
            </div>

            {/* S1: ubicación por ciudad/zona (geocoding) — nunca lat/lon manual */}
            <div>
              <span className="ui-label mb-1.5" id="cfg-ubicacion-legend">
                Ubicación
              </span>
              {ubicacion && !busquedaAbierta ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 dark:bg-slate-800 dark:text-emerald-300">
                    <span className="font-medium">{ubicacion.nombre ?? 'Ubicación seleccionada'}</span>
                    <span className="text-xs opacity-70">
                      {coord(ubicacion.lat)}, {coord(ubicacion.lon)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="ui-btn ui-btn-secondary ui-btn-sm focus-ring"
                    onClick={() => setBusquedaAbierta(true)}
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="grow min-w-[12rem]">
                    <label htmlFor="cfg-ubicacion" className="ui-label mb-1.5">
                      Ciudad o zona
                    </label>
                    <input
                      id="cfg-ubicacion"
                      className="ui-input focus-ring"
                      value={consulta}
                      onChange={(e) => setConsulta(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void buscarUbicacionEnFuente()
                        }
                      }}
                      placeholder="Medellín"
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="button"
                    className="ui-btn ui-btn-secondary focus-ring"
                    onClick={() => void buscarUbicacionEnFuente()}
                    disabled={buscandoUbicacion || consulta.trim().length < 3}
                  >
                    {buscandoUbicacion ? 'Buscando…' : 'Buscar ubicación'}
                  </button>
                </div>
              )}

              {resultadosUbicacion && resultadosUbicacion.length > 0 && (
                <ul className="mt-2 overflow-hidden rounded-xl border border-slate-200 divide-y divide-slate-200 dark:border-slate-700 dark:divide-slate-700">
                  {resultadosUbicacion.map((r) => (
                    <li key={`${r.lat},${r.lon}`}>
                      <button
                        type="button"
                        className="flex min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 focus-ring dark:hover:bg-slate-800"
                        onClick={() => seleccionarUbicacion(r)}
                      >
                        <span className="font-medium">{r.nombre}</span>
                        <span className="ui-muted text-xs">
                          {[r.admin1, r.pais].filter(Boolean).join(', ')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {resultadosUbicacion && resultadosUbicacion.length === 0 && !buscandoUbicacion && (
                <p className="ui-empty mt-2">
                  Sin coincidencias. Pruebe con otro nombre de ciudad o zona.
                </p>
              )}
            </div>

            <button type="submit" disabled={guardandoConfig} className="ui-btn ui-btn-primary">
              {guardandoConfig ? 'Guardando…' : hayConfig ? 'Actualizar configuración' : 'Guardar configuración'}
            </button>
          </form>

          {/* 2. Rangos del calendario */}
          <div className="space-y-3 border-t border-gray-100 pt-5 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="ui-title text-sm">Rangos del calendario</h3>
                <p className="ui-muted mt-1 text-xs">
                  Días operativos (lectivo/hábil) vs. no operativos (vacaciones/festivo). Si un
                  rango cae dentro de otro, manda el último registrado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void cargarPlantilla()}
                disabled={!hayConfig}
                className="ui-btn ui-btn-secondary shrink-0"
                title={TDEA_PLANTILLA.descripcion}
              >
                Plantilla TdeA
              </button>
            </div>

            {!hayConfig && (
              <div className="ui-callout ui-callout-info" role="status">
                Guarde primero la configuración operativa para editar los rangos.
              </div>
            )}

            {hayConfig && (
              <>
                <form onSubmit={agregarRango} className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-slate-700" noValidate>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="rango-inicio" className="ui-label mb-1.5">Fecha inicio</label>
                      <input
                        id="rango-inicio"
                        type="date"
                        required
                        className="ui-input"
                        value={rangoForm.fechaInicio}
                        onChange={(e) => setRangoForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="rango-fin" className="ui-label mb-1.5">Fecha final</label>
                      <input
                        id="rango-fin"
                        type="date"
                        required
                        className="ui-input"
                        value={rangoForm.fechaFin}
                        onChange={(e) => setRangoForm((f) => ({ ...f, fechaFin: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="rango-tipo" className="ui-label mb-1.5">Tipo de día</label>
                      <select
                        id="rango-tipo"
                        className="ui-input"
                        value={rangoForm.tipoDia}
                        onChange={(e) => setRangoForm((f) => ({ ...f, tipoDia: e.target.value }))}
                      >
                        {CATALOGO_TIPOS_DIA.map((t) => (
                          <option key={t.codigo} value={t.codigo}>{t.etiqueta}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="rango-nombre" className="ui-label mb-1.5">Nombre (opcional)</label>
                      <input
                        id="rango-nombre"
                        type="text"
                        maxLength={80}
                        placeholder="Ej. Período 2026-1"
                        className="ui-input"
                        value={rangoForm.nombre}
                        onChange={(e) => setRangoForm((f) => ({ ...f, nombre: e.target.value }))}
                      />
                    </div>
                  </div>
                  <button type="submit" className="ui-btn ui-btn-secondary">Agregar rango</button>
                </form>

                {rangos.length === 0 ? (
                  <div className="ui-empty">
                    Sin rangos. Agregue rangos manualmente o cargue la plantilla TdeA como punto de
                    partida editable.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-slate-800 dark:border-slate-700">
                    {rangos.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {fechaCorta(r.fechaInicio)} → {fechaCorta(r.fechaFin)}
                            {r.nombre ? <span className="ui-muted"> · {r.nombre}</span> : null}
                          </p>
                          <span
                            className={`text-xs font-medium ${tipoDiaEsOperativo(r.tipoDia) ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}
                          >
                            {CATALOGO_TIPOS_DIA.find((t) => t.codigo === r.tipoDia)?.etiqueta ?? r.tipoDia}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRangoEliminando(r)}
                          aria-label={`Eliminar rango del ${fechaCorta(r.fechaInicio)}`}
                          className="focus-ring shrink-0 rounded text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* 3. Horarios de funcionamiento de equipos */}
          <div className="space-y-3 border-t border-gray-100 pt-5 dark:border-slate-800">
            <div>
              <h3 className="ui-title text-sm">Horarios de funcionamiento de equipos</h3>
              <p className="ui-muted mt-1 text-xs">
                Días de la semana y franja horaria en que opera cada grupo de equipos de la
                edificación (horarios de operación, UPME §7.1/§7.3). Independiente de la
                configuración del calendario.
              </p>
            </div>

            <form
              onSubmit={(e) => void agregarHorario(e)}
              className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-slate-700"
              noValidate
            >
              <div>
                <label htmlFor="horario-nombre" className="ui-label mb-1.5">
                  Nombre del grupo
                </label>
                <input
                  id="horario-nombre"
                  type="text"
                  required
                  maxLength={80}
                  placeholder="Ej. Iluminación aulas, HVAC administración"
                  className="ui-input"
                  value={horarioForm.nombre}
                  onChange={(e) => setHorarioForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>

              <fieldset>
                <legend className="ui-label mb-1.5">Ámbito (nivel jerárquico)</legend>
                <div className="flex flex-wrap gap-1.5">
                  {CATALOGO_AMBITOS.map((a) => (
                    <button
                      key={a.codigo}
                      type="button"
                      onClick={() => cambiarNivel(a.codigo)}
                      aria-pressed={horarioForm.nivel === a.codigo}
                      className={`focus-ring min-h-10 rounded-lg border px-2.5 text-xs font-medium ${
                        horarioForm.nivel === a.codigo
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-gray-300 bg-white text-gray-600 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-300'
                      }`}
                    >
                      {a.etiqueta}
                    </button>
                  ))}
                </div>
              </fieldset>

              {horarioForm.nivel !== 'EDIFICACION' && (
                <div>
                  <label htmlFor="horario-bloque" className="ui-label mb-1.5">Bloque</label>
                  <select
                    id="horario-bloque"
                    className="ui-input"
                    value={horarioForm.bloqueId}
                    onChange={(e) => cambiarBloque(e.target.value)}
                  >
                    <option value="">Seleccione un bloque…</option>
                    {bloques.map((b) => (
                      <option key={b.id} value={b.id}>{b.codigo} — {b.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              {(horarioForm.nivel === 'ESPACIO' || horarioForm.nivel === 'EQUIPO') && (
                <div>
                  <label htmlFor="horario-espacio" className="ui-label mb-1.5">Espacio / aula</label>
                  <select
                    id="horario-espacio"
                    className="ui-input"
                    value={horarioForm.espacioId}
                    onChange={(e) => cambiarEspacio(e.target.value)}
                  >
                    <option value="">Seleccione un espacio…</option>
                    {espacios
                      .filter((s) => s.bloqueId === horarioForm.bloqueId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                  </select>
                </div>
              )}

              {horarioForm.nivel === 'EQUIPO' && (
                <div>
                  <label htmlFor="horario-equipo" className="ui-label mb-1.5">Equipo</label>
                  <select
                    id="horario-equipo"
                    className="ui-input"
                    value={horarioForm.equipoId}
                    onChange={(e) =>
                      setHorarioForm((f) => ({ ...f, equipoId: e.target.value }))
                    }
                  >
                    <option value="">Seleccione un equipo…</option>
                    {equipos
                      .filter((q) => q.espacioId === horarioForm.espacioId)
                      .map((q) => (
                        <option key={q.id} value={q.id}>{q.tipo} · ×{q.cantidad}</option>
                      ))}
                  </select>
                </div>
              )}

              <fieldset>
                <legend className="ui-label mb-1.5">Vigencia</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="horario-desde" className="ui-label mb-1.5">Vigente desde</label>
                    <input
                      id="horario-desde"
                      type="date"
                      className="ui-input"
                      value={horarioForm.desde}
                      onChange={(e) => setHorarioForm((f) => ({ ...f, desde: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="horario-hasta" className="ui-label mb-1.5">
                      Vigente hasta (opcional)
                    </label>
                    <input
                      id="horario-hasta"
                      type="date"
                      className="ui-input"
                      value={horarioForm.hasta}
                      onChange={(e) => setHorarioForm((f) => ({ ...f, hasta: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="ui-muted mt-1 text-xs">
                  Deje «hasta» vacío para una vigencia abierta.
                </p>
              </fieldset>

              <fieldset>
                <legend className="ui-label mb-1.5">Días de la semana</legend>
                <div className="flex flex-wrap gap-1.5">
                  {CATALOGO_DIAS.map((d) => {
                    const activo = horarioForm.diasSemana.includes(d.codigo)
                    return (
                      <button
                        key={d.codigo}
                        type="button"
                        onClick={() => alternarDia(d.codigo)}
                        aria-pressed={activo}
                        className={`focus-ring min-h-10 rounded-lg border px-2.5 text-xs font-medium ${
                          activo
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-gray-300 bg-white text-gray-600 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-300'
                        }`}
                      >
                        {d.abrev}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="horario-inicio" className="ui-label mb-1.5">Hora inicio</label>
                  <select
                    id="horario-inicio"
                    className="ui-input"
                    value={horarioForm.horaInicio}
                    onChange={(e) => setHorarioForm((f) => ({ ...f, horaInicio: e.target.value }))}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{hora(h)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="horario-fin" className="ui-label mb-1.5">Hora final</label>
                  <select
                    id="horario-fin"
                    className="ui-input"
                    value={horarioForm.horaFin}
                    onChange={(e) => setHorarioForm((f) => ({ ...f, horaFin: e.target.value }))}
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={h}>{h === 24 ? '24:00' : hora(h)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="ui-btn ui-btn-secondary">
                Agregar horario
              </button>
            </form>

            {horarios.length === 0 ? (
              <div className="ui-empty">
                Sin horarios registrados. Agregue los horarios de funcionamiento de los grupos de
                equipos de esta edificación.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-slate-800 dark:border-slate-700">
                {horarios.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{h.nombre}</p>
                      <p className="ui-muted text-xs">
                        {formatearDias(h.diasSemana)} · {formatearFranja(h.horaInicio, h.horaFin)}
                      </p>
                      <p className="ui-muted text-xs">
                        {etiquetaAmbito(h)} · {formatearVigencia(h.desde ?? null, h.hasta ?? null)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHorarioEliminando(h)}
                      aria-label={`Eliminar horario ${h.nombre}`}
                      className="focus-ring shrink-0 rounded text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 4. GDE mensual */}
          <div className="space-y-3 border-t border-gray-100 pt-5 dark:border-slate-800">
            <div>
              <h3 className="ui-title text-sm">GDE mensual calculada</h3>
              <p className="ui-muted mt-1 text-xs">
                GDE = Σ(Tp − Tb)·Xd sobre los días operativos del mes, con la temperatura de la
                fuente climática durante el horario operativo.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="gde-mes" className="ui-label mb-1.5">Mes</label>
                <select
                  id="gde-mes"
                  className="ui-input"
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                >
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="gde-ano" className="ui-label mb-1.5">Año</label>
                <select
                  id="gde-ano"
                  className="ui-input"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                >
                  {ANOS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => void calcular()}
                disabled={calculando || !hayConfig}
                className="ui-btn ui-btn-primary"
              >
                {calculando ? 'Calculando…' : 'Calcular GDE'}
              </button>
            </div>

            {!hayConfig && (
              <div className="ui-callout ui-callout-info" role="status">
                Complete la configuración operativa y los rangos antes de calcular.
              </div>
            )}

            {resultado && (
              <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
                {/* Resultado */}
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="ui-label">GDE de {MESES[resultado.mes - 1]} de {resultado.ano}</p>
                    <p className="ui-title text-2xl text-emerald-800 dark:text-emerald-300">
                      {num(resultado.resultado.gde)} °C·día
                    </p>
                  </div>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    Fuente: {resultado.fuente}
                  </p>
                </div>

                {/* Fórmula aplicada con los valores sustituidos (interpretabilidad) */}
                <div className="rounded-md bg-white/80 p-3 text-sm dark:bg-slate-900/60">
                  <p className="ui-label mb-1">Fórmula aplicada</p>
                  <p className="font-mono text-xs leading-5">
                    GDE = Σ(Tp − Tb)·Xd sobre {resultado.resultado.diasOperativos} días operativos
                    (Xd = 1 operativo / 0 no operativo)
                    <br />
                    con Tb = {num(resultado.config.temperaturaBase)} °C,
                    H = {hora(resultado.config.horaInicioOperacion)}–{hora((resultado.config.horaInicioOperacion + resultado.config.horasOperacionDia) % 24)}
                    ({resultado.config.horasOperacionDia} h/día)
                    <br />
                    = {' '}
                    {resultado.resultado.detalle
                      .filter((d) => d.tp != null)
                      .slice(0, 6)
                      .map((d) =>
                        d.grados > 0
                          ? `(${num(d.tp as number)} − ${num(resultado.config.temperaturaBase)})`
                          : 'max(0)'
                      )
                      .join(' + ')}
                    {resultado.resultado.detalle.filter((d) => d.tp != null).length > 6 ? ' + …' : ''}
                    <br />
                    = {num(resultado.resultado.sumaGrados)} °C·día
                    {resultado.resultado.diasConTemperatura !== resultado.resultado.diasOperativos && (
                      <span className="text-amber-700 dark:text-amber-400">
                        {' '}
                        (sobre {resultado.resultado.diasConTemperatura} de{' '}
                        {resultado.resultado.diasOperativos} días operativos con datos climáticos)
                      </span>
                    )}
                  </p>
                </div>

                {/* Desglose por día */}
                <div className="max-h-52 overflow-y-auto rounded-md bg-white/80 dark:bg-slate-900/60">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">Día</th>
                        <th className="px-2 py-1.5 text-right font-medium">Tp (°C)</th>
                        <th className="px-2 py-1.5 text-right font-medium">Grados (Tp − Tb)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.resultado.detalle.map((d) => (
                        <tr key={d.fecha} className="border-t border-gray-100 dark:border-slate-800">
                          <td className="px-2 py-1">{fechaCorta(d.fecha)}</td>
                          <td className="px-2 py-1 text-right">
                            {d.tp == null ? '—' : num(d.tp)}
                          </td>
                          <td className="px-2 py-1 text-right">{d.grados > 0 ? num(d.grados) : '0'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={() => void registrar()}
                  disabled={registro}
                  className="ui-btn ui-btn-secondary"
                >
                  {registro ? 'Registrando…' : 'Registrar en variables operativas'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={rangoEliminando != null}
        onClose={() => setRangoEliminando(null)}
        onConfirm={() => void eliminarRango()}
        title="Eliminar rango"
        description={`Se eliminará el rango ${rangoEliminando ? `${fechaCorta(rangoEliminando.fechaInicio)} → ${fechaCorta(rangoEliminando.fechaFin)}` : ''} del calendario. La GDE de meses que dependan de este rango cambiará. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
      />
      <ConfirmDialog
        isOpen={horarioEliminando != null}
        onClose={() => setHorarioEliminando(null)}
        onConfirm={() => void eliminarHorario()}
        title="Eliminar horario"
        description={`Se eliminará el horario "${horarioEliminando?.nombre ?? ''}" (${horarioEliminando ? formatearDias(horarioEliminando.diasSemana) : ''}). Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
      />
    </div>,
    document.body
  )
}
