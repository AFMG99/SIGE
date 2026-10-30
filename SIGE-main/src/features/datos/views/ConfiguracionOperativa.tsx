'use client'

/**
 * Sub-vista «Configuración operativa» (S1 del slice 6d).
 *
 * Reemplaza al drawer «Calendario operativo» (CalendarioGdeDrawer): el
 * formulario de configuración por edificación —horario H, temperatura base Tb,
 * interruptor «Usar horarios como Xe» (S4 de Fase 6) y ubicación por
 * ciudad/zona con geocoding Open-Meteo (S1 de Fase 6)— vive ahora como
 * pestaña hermana de «Infraestructura» y «Calendario» dentro de la sección
 * Gestión de Edificaciones. Rangos, plantilla TdeA y horarios de equipos se
 * mudaron al sub-vista «Calendario» (S2/S3).
 *
 * El cálculo de la GDE vive en «Variables Operativas» («Cálculo de la GDE»);
 * aquí solo queda el aviso al pie. Las lat/lon son el contrato interno hacia
 * la fuente climática: el usuario elige una ciudad y nunca las escribe.
 */

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/shared/views/ui/ToastProvider'
import { ListboxSelect } from '@/shared/views/ui/ListboxSelect'
import { guardarConfigCalendario } from '@/features/datos/controllers/calendario'
import { buscarUbicacion } from '@/features/datos/controllers/clima'
import type { UbicacionEncontrada } from '@/features/datos/models/calendario'
import type { CalendarioInfo, EdificacionInfo } from './useCatalogoEdificaciones'

const hora = (h: number): string => `${String(h).padStart(2, '0')}:00`

/** Coordenada en es-CO con hasta 4 decimales: `6,2477`. */
const coord = (n: number): string =>
  new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 }).format(n)

interface ConfiguracionOperativaProps {
  /** Catálogo completo de edificaciones (selector interno). */
  edificaciones: EdificacionInfo[]
  /** Configuración operativa por edificación. */
  calendarios: CalendarioInfo[]
}

export function ConfiguracionOperativa({
  edificaciones,
  calendarios,
}: ConfiguracionOperativaProps) {
  const router = useRouter()
  const { showToast } = useToast()

  const [edificacionId, setEdificacionId] = useState('')
  const [horaInicio, setHoraInicio] = useState('8')
  const [horasDia, setHorasDia] = useState('12')
  const [tb, setTb] = useState('23')
  // Ubicación por ciudad/zona (geocoding): nunca lat/lon manuales.
  const [ubicacion, setUbicacion] = useState<{
    nombre: string | null
    lat: number
    lon: number
  } | null>(null)
  const [busquedaAbierta, setBusquedaAbierta] = useState(true)
  const [consulta, setConsulta] = useState('')
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [resultadosUbicacion, setResultadosUbicacion] = useState<UbicacionEncontrada[] | null>(null)
  const [usarHorariosXe, setUsarHorariosXe] = useState(false)
  // S2: política de operatividad (default ON/ON = legado hasta que se flaguee).
  const [domingosOperativos, setDomingosOperativos] = useState(true)
  const [festivosOperativos, setFestivosOperativos] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const edificacion = edificaciones.find((e) => e.id === edificacionId) ?? null
  const config = calendarios.find((c) => c.edificacionId === edificacionId) ?? null
  const hayConfig = config != null
  const horaFin = hayConfig ? (config.horaInicioOperacion + config.horasOperacionDia) % 24 : 0

  // (Re)inicializa el formulario desde la edificación seleccionada.
  useEffect(() => {
    setError('')
    setGuardando(false)
    if (!edificacionId) return
    const cfg = calendarios.find((c) => c.edificacionId === edificacionId) ?? null
    setHoraInicio(cfg ? String(cfg.horaInicioOperacion) : '8')
    setHorasDia(cfg ? String(cfg.horasOperacionDia) : '12')
    setTb(cfg ? String(cfg.temperaturaBase) : '23')
    setUsarHorariosXe(cfg?.usarHorariosXe ?? false)
    setDomingosOperativos(cfg?.domingosOperativos ?? true)
    setFestivosOperativos(cfg?.festivosOperativos ?? true)
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
  }, [edificacionId, calendarios, edificacion]) // eslint-disable-line react-hooks/exhaustive-deps

  const fallo = (mensaje: string) => setError(mensaje)

  const guardarConfig = async (e: FormEvent) => {
    e.preventDefault()
    if (guardando || !edificacion) return
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
      usarHorariosXe,
      domingosOperativos,
      festivosOperativos,
    }
    setGuardando(true)
    try {
      const res = await guardarConfigCalendario(edificacion.id, datos)
      if (res.estado === 'error') {
        fallo(res.mensaje)
        return
      }
      showToast(res.mensaje, 'success')
      router.refresh()
    } finally {
      setGuardando(false)
    }
  }

  /** Busca ciudades/zonas en el geocoding server-side (bajo demanda).
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

  return (
    <div className="ui-card">
      <div>
        <h3 className="ui-title text-sm">Configuración operativa</h3>
        <p className="ui-muted mt-1 text-xs">
          Horario H sobre el que se promedia la temperatura, temperatura base Tb de la fórmula
          GDE = Σ(Tp − Tb)·Xd, fuente de Xe y ubicación de la edificación (UPME 0016/2024 §7.1/§7.3).
        </p>
      </div>

      <div className="max-w-md">
        <label htmlFor="config-edificacion" className="ui-label">
          Edificación
        </label>
        <ListboxSelect
          id="config-edificacion"
          value={edificacionId}
          onChange={setEdificacionId}
          placeholder="— Seleccione una edificación —"
          options={edificaciones.map((e) => ({ value: e.id, label: e.nombre }))}
          className="ui-input mt-1 cursor-pointer"
        />
      </div>

      {edificaciones.length === 0 ? (
        <div className="ui-empty">
          <p className="ui-title text-sm">Sin edificaciones registradas</p>
          <p className="max-w-md text-xs">
            Cree primero una edificación en la pestaña «Infraestructura» para configurar su
            horario de operación, temperatura base y ubicación.
          </p>
        </div>
      ) : !edificacion ? (
        <div className="ui-empty">
          <p className="ui-title text-sm">Seleccione una edificación</p>
          <p className="max-w-md text-xs">
            Elija una edificación arriba para ver y editar su configuración operativa.
          </p>
        </div>
      ) : (
        <form onSubmit={guardarConfig} className="space-y-3" noValidate>
          {error && (
            <div role="alert" className="ui-callout ui-callout-danger">
              {error}
            </div>
          )}

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

          {/* S4 de Fase 6: fuente de Xe para el cálculo de la GDE */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="ui-label" id="cfg-xe-label">
                Usar horarios como Xe
              </span>
              <label htmlFor="cfg-xe" className="inline-flex shrink-0 cursor-pointer items-center">
                <input
                  id="cfg-xe"
                  type="checkbox"
                  role="switch"
                  aria-labelledby="cfg-xe-label"
                  aria-describedby="cfg-xe-help"
                  checked={usarHorariosXe}
                  onChange={(e) => setUsarHorariosXe(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-uv-lime peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-slate-600 dark:peer-checked:bg-emerald-700 dark:peer-checked:after:bg-white"
                />
              </label>
            </div>
            <p id="cfg-xe-help" className="ui-muted mt-1 text-xs">
              Apagado: Xe = horas de operación (H), comportamiento legacy bit a bit. Encendido:
              Xe = horas de uso de los horarios vigentes por día (edición en «Calendario»).
            </p>
          </div>

          {/* S2: política de operatividad — domingos y festivos de Colombia */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="ui-label" id="cfg-domingos-label">
                Domingos operativos
              </span>
              <label
                htmlFor="cfg-domingos"
                className="inline-flex shrink-0 cursor-pointer items-center"
              >
                <input
                  id="cfg-domingos"
                  type="checkbox"
                  role="switch"
                  aria-labelledby="cfg-domingos-label"
                  aria-describedby="cfg-domingos-help"
                  checked={domingosOperativos}
                  onChange={(e) => setDomingosOperativos(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-uv-lime peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-slate-600 dark:peer-checked:bg-emerald-700 dark:peer-checked:after:bg-white"
                />
              </label>
            </div>
            <p id="cfg-domingos-help" className="ui-muted mt-1 text-xs">
              Encendido (por defecto): los domingos operan cuando el calendario los marca LECTIVO o
              HÁBIL. Apagado: ningún domingo cuenta como día operativo, aunque el rango lo indique.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="ui-label" id="cfg-festivos-label">
                Festivos operativos
              </span>
              <label
                htmlFor="cfg-festivos"
                className="inline-flex shrink-0 cursor-pointer items-center"
              >
                <input
                  id="cfg-festivos"
                  type="checkbox"
                  role="switch"
                  aria-labelledby="cfg-festivos-label"
                  aria-describedby="cfg-festivos-help"
                  checked={festivosOperativos}
                  onChange={(e) => setFestivosOperativos(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-uv-lime peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-slate-600 dark:peer-checked:bg-emerald-700 dark:peer-checked:after:bg-white"
                />
              </label>
            </div>
            <p id="cfg-festivos-help" className="ui-muted mt-1 text-xs">
              Encendido (por defecto): los festivos de Colombia operan si el calendario los marca
              LECTIVO o HÁBIL. Apagado: ningún festivo cuenta, aunque el rango lo indique.
            </p>
          </div>

          {/* Ubicación por ciudad/zona (geocoding) — nunca lat/lon manual */}
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

          <button type="submit" disabled={guardando} className="ui-btn ui-btn-primary">
            {guardando ? 'Guardando…' : hayConfig ? 'Actualizar configuración' : 'Guardar configuración'}
          </button>
        </form>
      )}

      {/* Pie: la GDE se calcula desde «Variables Operativas» */}
      <div className="ui-callout ui-callout-info" role="status">
        La GDE mensual se calcula desde Variables Operativas. Los rangos, la plantilla TdeA y los
        horarios de equipos se editan en la pestaña «Calendario».
      </div>
    </div>
  )
}
