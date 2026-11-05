'use client'

/**
 * Panel CRUD de eventos del calendario (S7/S8 — Fase 6, slice 6c).
 *
 * Hermano del calendario de festivos en la sub-vista «Calendario» de
 * Edificaciones: carga (crear) y elimina eventos por edificación con la misma
 * cascada de ámbito que los horarios (edificación → bloque → espacio →
 * equipo). Sin edición, por paridad con rangos/horarios (pin L8).
 *
 * Requiere contexto de edificación: sin selección no se listan ni se crean
 * eventos. La herencia (S8) vive en `eventosVisiblesPara` (models); aquí se
 * lista el árbol de la edificación seleccionada con el nivel de cada fila.
 * La selección de edificación es CONTROLADA desde T8 (S9): el `useState`
 * vive en el wrapper de la sub-vista «Calendario» de `DatosContent` y lo
 * comparten el panel y el calendario (eventos + tipo de día + horas de uso
 * superpuestos con la MISMA selección). Todo dato entra por props y las
 * mutaciones son server actions con revalidación en servidor.
 */

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ListboxSelect } from '@/shared/views/ui/ListboxSelect'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'
import { useToast } from '@/shared/views/ui/ToastProvider'
import { crearEvento, eliminarEvento } from '@/features/datos/controllers/eventos'
import { CATALOGO_AMBITOS, type CodigoAmbito } from '../models/horarios'
import {
  CATALOGO_TIPOS_EVENTO,
  formatearRangoEvento,
  nivelDeEvento,
  type EventoInfo,
} from '../models/eventos'
import type { BloqueInfo, EdificacionInfo, EspacioInfo } from './useCatalogoEdificaciones'
import type { EquipoExistente } from './existencias'

type EventosCalendarioProps = {
  /** Catálogo de edificaciones (fuente única de `DatosContent`). */
  edificaciones: EdificacionInfo[]
  bloques: BloqueInfo[]
  espacios: EspacioInfo[]
  /** Inventario (hasta 50 filas): alimenta el nivel EQUIPO de la cascada. */
  equipos: EquipoExistente[]
  /** Eventos guardados (todas las edificaciones; el filtrado es por id). */
  eventos: EventoInfo[]
  /** Sin permiso de carga se ocultan el formulario y las acciones de gestión. */
  puedeCargar: boolean
  /** Edificación seleccionada (compartida con el calendario; '' = ninguna). */
  edificacionId: string
  /** Cambia la edificación seleccionada (estado en el wrapper del calendario). */
  onEdificacionChange: (id: string) => void
  /**
   * «Crear ajuste desde este evento» (opcional): por cada fila de la lista se
   * ofrece la acción, que notifica el `EventoInfo` al padre (`DatosContent`
   * salta a la sección Ajustes y abre su modal precargado). Sin callback no
   * se renderiza (p. ej. roles sin permiso de carga).
   */
  onCrearAjusteDesdeEvento?: (evento: EventoInfo) => void
}

const NIVEL_ETIQUETA: Record<CodigoAmbito, string> = {
  EQUIPO: 'Equipo',
  ESPACIO: 'Espacio',
  BLOQUE: 'Bloque',
  EDIFICACION: 'Edificación',
}

const BADGE_NIVEL =
  'inline-flex max-w-full items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300'

const PUNTO_TIPO =
  'inline-block h-2.5 w-2.5 shrink-0 rounded-full aria-hidden'

const FORM_INICIAL = {
  tipo: 'INSTITUCIONAL',
  nombre: '',
  descripcion: '',
  fechaInicio: '',
  fechaFin: '',
  // Ámbito jerárquico (S12): nivel + ids seleccionados en cascada.
  nivel: 'EDIFICACION' as CodigoAmbito,
  bloqueId: '',
  espacioId: '',
  equipoId: '',
}

export function EventosCalendario({
  edificaciones,
  bloques,
  espacios,
  equipos,
  eventos,
  puedeCargar,
  edificacionId,
  onEdificacionChange,
  onCrearAjusteDesdeEvento,
}: EventosCalendarioProps) {
  const router = useRouter()
  const { showToast } = useToast()

  /** Edificación CONTROLADA por el wrapper (compartida con el calendario). */
  const [eventosEstado, setEventosEstado] = useState<EventoInfo[]>(eventos)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [error, setError] = useState('')
  const [eliminando, setEliminando] = useState<EventoInfo | null>(null)

  // Re-sincroniza desde props (el id lo crea la BD; `router.refresh()` trae la fila).
  useEffect(() => {
    setEventosEstado(eventos)
  }, [eventos])

  const fallo = (mensaje: string) => setError(mensaje)

  // ------------------------- Derivados del contexto -------------------------

  const edificacion = edificaciones.find((e) => e.id === edificacionId) ?? null
  const bloquesSel = bloques.filter((b) => b.edificacionId === edificacionId)
  const espaciosSel = espacios.filter((s) => s.bloqueId === form.bloqueId)
  const equiposSel = equipos.filter(
    (q) => q.edificacionId === edificacionId && q.espacioId === form.espacioId
  )

  /** Eventos del árbol de la edificación seleccionada, cronológicos. */
  const eventosDeEdificacion = eventosEstado
    .filter((ev) => ev.edificacionId === edificacionId)
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio) || a.nombre.localeCompare(b.nombre))

  const tipoInfo = (codigo: string): { etiqueta: string; punto: string } =>
    CATALOGO_TIPOS_EVENTO.find((t) => t.codigo === codigo) ?? {
      etiqueta: codigo,
      punto: 'bg-uv-mid',
    }

  /** Etiqueta del ámbito de un evento guardado (chip en la lista). */
  const etiquetaAmbito = (ev: EventoInfo): string => {
    const nivel = nivelDeEvento(ev)
    if (nivel === 'EQUIPO') {
      const eq = equipos.find((q) => q.id === ev.equipoId)
      return eq ? `Equipo · ${eq.tipo} (${eq.espacio})` : 'Equipo'
    }
    if (nivel === 'ESPACIO') {
      const sp = espacios.find((s) => s.id === ev.espacioId)
      return sp ? `Espacio · ${sp.nombre}` : 'Espacio'
    }
    if (nivel === 'BLOQUE') {
      const bk = bloques.find((b) => b.id === ev.bloqueId)
      return bk ? `Bloque · ${bk.codigo} — ${bk.nombre}` : 'Bloque'
    }
    return 'Edificación completa'
  }

  // ------------------------- Formulario (crear) -------------------------

  // Cambiar de nivel o de bloque reinicia la selección dependiente (cascada).
  const cambiarNivel = (nivel: CodigoAmbito) => {
    setForm((f) => ({ ...f, nivel, bloqueId: '', espacioId: '', equipoId: '' }))
  }
  const cambiarBloque = (bloqueId: string) => {
    setForm((f) => ({ ...f, bloqueId, espacioId: '', equipoId: '' }))
  }
  const cambiarEspacio = (espacioId: string) => {
    setForm((f) => ({ ...f, espacioId, equipoId: '' }))
  }

  const enviarEvento = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.nombre.trim()) {
      fallo('Ingrese el nombre del evento.')
      return
    }
    if (!form.fechaInicio) {
      fallo('Seleccione la fecha de inicio del evento.')
      return
    }
    if (form.fechaFin && form.fechaFin < form.fechaInicio) {
      fallo('La fecha final debe ser posterior o igual a la inicial.')
      return
    }
    // Validación del ámbito antes de ir al servidor (el servidor también valida).
    if (form.nivel !== 'EDIFICACION' && !form.bloqueId) {
      fallo('Seleccione el bloque del ámbito.')
      return
    }
    if (form.nivel !== 'EDIFICACION' && form.nivel !== 'BLOQUE' && !form.espacioId) {
      fallo('Seleccione el espacio del ámbito.')
      return
    }
    if (form.nivel === 'EQUIPO' && !form.equipoId) {
      fallo('Seleccione el equipo del ámbito.')
      return
    }
    const ambito =
      form.nivel === 'EDIFICACION'
        ? {}
        : form.nivel === 'BLOQUE'
          ? { bloqueId: form.bloqueId }
          : form.nivel === 'ESPACIO'
            ? { bloqueId: form.bloqueId, espacioId: form.espacioId }
            : { bloqueId: form.bloqueId, espacioId: form.espacioId, equipoId: form.equipoId }

    const res = await crearEvento(edificacionId, {
      tipo: form.tipo,
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin || null,
      ambito,
    })
    if (res.estado === 'error') {
      fallo(res.mensaje)
      return
    }
    // La fila nueva se lista al instante (id real de la BD) y `refresh()`
    // re-sincroniza el resto cuando el servidor vuelve a renderizar.
    setEventosEstado((prev) => [...prev, res.evento])
    showToast(res.mensaje, 'success')
    router.refresh()
    setForm(FORM_INICIAL)
    setMostrarForm(false)
  }

  // ------------------------- Eliminar -------------------------

  const confirmarEliminacion = async () => {
    if (!eliminando) return
    const res = await eliminarEvento(eliminando.id)
    setEliminando(null)
    if (res.estado === 'error') {
      fallo(res.mensaje)
      return
    }
    setEventosEstado((prev) => prev.filter((ev) => ev.id !== eliminando.id))
    showToast(res.mensaje, 'success')
    router.refresh()
  }

  // ------------------------- Render -------------------------

  return (
    <section aria-labelledby="eventos-calendario-titulo" className="ui-card space-y-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="eventos-calendario-titulo" className="ui-title text-sm">
            Eventos del calendario
          </h3>
          <p className="ui-muted max-w-2xl text-xs">
            Cree eventos institucionales, académicos, de mantenimiento o de excepción por
            edificación, bloque, espacio o equipo. Un evento de un nivel superior se hereda a sus
            niveles inferiores.
          </p>
        </div>
        {puedeCargar && edificacionId && (
          <button
            type="button"
            onClick={() => {
              setError('')
              setMostrarForm((v) => !v)
            }}
            aria-expanded={mostrarForm}
            className="focus-ring ui-btn ui-btn-secondary"
          >
            {mostrarForm ? 'Cerrar formulario' : 'Nuevo evento'}
          </button>
        )}
      </header>

      <div className="max-w-md">
        <label htmlFor="eventos-edificacion" className="ui-label">
          Edificación <span className="text-red-600">*</span>
        </label>
        <ListboxSelect
          id="eventos-edificacion"
          value={edificacionId}
          onChange={(v) => {
            onEdificacionChange(v)
            setError('')
            setMostrarForm(false)
            // La cascada del formulario pertenece a la edificación anterior.
            setForm(FORM_INICIAL)
          }}
          placeholder="— Seleccione una edificación —"
          options={edificaciones.map((e) => ({ value: e.id, label: e.nombre }))}
          className="ui-input mt-1 cursor-pointer"
        />
      </div>

      {!edificacionId ? (
        <div className="ui-empty">
          <p className="ui-title text-sm">Seleccione una edificación</p>
          <p className="max-w-md text-xs">
            Los eventos se cargan y listan siempre dentro del árbol de una edificación: elija una
            arriba para ver sus eventos o crear uno nuevo.
          </p>
        </div>
      ) : (
        <>
          {error && (
            <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {mostrarForm && puedeCargar && (
            <form onSubmit={(e) => void enviarEvento(e)} className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="evento-tipo" className="ui-label">Tipo de evento</label>
                  <select
                    id="evento-tipo"
                    className="ui-input"
                    value={form.tipo}
                    onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                  >
                    {CATALOGO_TIPOS_EVENTO.map((t) => (
                      <option key={t.codigo} value={t.codigo}>{t.etiqueta}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="evento-nombre" className="ui-label">
                    Nombre <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="evento-nombre"
                    type="text"
                    // Sin `required` nativo: la validación (vacío, longitud,
                    // fechas, cascada) vive en el handler y en el Zod del
                    // servidor, y así el usuario ve SIEMPRE el mensaje inline.
                    maxLength={120}
                    placeholder="Ej. Semana de la infraestructura"
                    className="ui-input"
                    value={form.nombre}
                    onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="evento-descripcion" className="ui-label">
                  Descripción (opcional)
                </label>
                <input
                  id="evento-descripcion"
                  type="text"
                  maxLength={500}
                  className="ui-input"
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                />
              </div>

              <fieldset>
                <legend className="ui-label mb-1.5">
                  Fechas <span className="text-red-600">*</span>
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="evento-inicio" className="ui-label">Fecha de inicio</label>
                    <input
                      id="evento-inicio"
                      type="date"
                      className="ui-input"
                      value={form.fechaInicio}
                      onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="evento-fin" className="ui-label">
                      Fecha final (opcional)
                    </label>
                    <input
                      id="evento-fin"
                      type="date"
                      className="ui-input"
                      value={form.fechaFin}
                      onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="ui-muted mt-1 text-xs">
                  Deje la fecha final vacía para un evento de un solo día.
                </p>
              </fieldset>

              <fieldset>
                <legend className="ui-label mb-1.5">Ámbito (nivel jerárquico)</legend>
                <div className="flex flex-wrap gap-1.5">
                  {CATALOGO_AMBITOS.map((a) => (
                    <button
                      key={a.codigo}
                      type="button"
                      onClick={() => cambiarNivel(a.codigo)}
                      aria-pressed={form.nivel === a.codigo}
                      className={`focus-ring min-h-10 rounded-lg border px-2.5 text-xs font-medium ${
                        form.nivel === a.codigo
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-gray-300 bg-white text-gray-600 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-300'
                      }`}
                    >
                      {a.etiqueta}
                    </button>
                  ))}
                </div>
              </fieldset>

              {form.nivel !== 'EDIFICACION' && (
                <div>
                  <label htmlFor="evento-bloque" className="ui-label mb-1.5">Bloque</label>
                  <select
                    id="evento-bloque"
                    className="ui-input"
                    value={form.bloqueId}
                    onChange={(e) => cambiarBloque(e.target.value)}
                  >
                    <option value="">Seleccione un bloque…</option>
                    {bloquesSel.map((b) => (
                      <option key={b.id} value={b.id}>{b.codigo} — {b.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              {(form.nivel === 'ESPACIO' || form.nivel === 'EQUIPO') && (
                <div>
                  <label htmlFor="evento-espacio" className="ui-label mb-1.5">Espacio / aula</label>
                  <select
                    id="evento-espacio"
                    className="ui-input"
                    value={form.espacioId}
                    onChange={(e) => cambiarEspacio(e.target.value)}
                  >
                    <option value="">Seleccione un espacio…</option>
                    {espaciosSel.map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre} · piso {s.piso || 'Sin asignar'}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.nivel === 'EQUIPO' && (
                <div>
                  <label htmlFor="evento-equipo" className="ui-label mb-1.5">Equipo</label>
                  <select
                    id="evento-equipo"
                    className="ui-input"
                    value={form.equipoId}
                    onChange={(e) => setForm((f) => ({ ...f, equipoId: e.target.value }))}
                  >
                    <option value="">Seleccione un equipo…</option>
                    {equiposSel.map((q) => (
                      <option key={q.id} value={q.id}>{q.tipo} · ×{q.cantidad}</option>
                    ))}
                  </select>
                </div>
              )}

              <button type="submit" className="ui-btn ui-btn-primary">
                Guardar evento
              </button>
            </form>
          )}

          {eventosDeEdificacion.length === 0 ? (
            <div className="ui-empty">
              <p className="ui-title text-sm">Esta edificación aún no tiene eventos</p>
              <p className="max-w-md text-xs">
                {puedeCargar
                  ? 'Use «Nuevo evento» para registrar actividades institucionales, académicas, mantenimientos o excepciones.'
                  : 'Aún no se han registrado eventos para esta edificación.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-slate-800 dark:border-slate-700">
              {eventosDeEdificacion.map((ev) => {
                const info = tipoInfo(ev.tipo)
                return (
                  <li key={ev.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span
                          className={`${PUNTO_TIPO} ${info.punto}`}
                          role="img"
                          aria-label={`Tipo ${info.etiqueta}`}
                        />
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                          {info.etiqueta}
                        </span>
                        <span className="break-words text-sm font-medium text-gray-800 dark:text-gray-100">
                          {ev.nombre}
                        </span>
                      </p>
                      <p className="ui-muted text-xs">
                        {formatearRangoEvento(ev.fechaInicio, ev.fechaFin)}
                      </p>
                      <p>
                        <span data-nivel={nivelDeEvento(ev)} className={BADGE_NIVEL}>
                          {etiquetaAmbito(ev)}
                        </span>
                      </p>
                      {ev.descripcion && (
                        <p className="ui-muted break-words text-xs">{ev.descripcion}</p>
                      )}
                    </div>
                    {puedeCargar && (
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {onCrearAjusteDesdeEvento && (
                          <button
                            type="button"
                            onClick={() => onCrearAjusteDesdeEvento(ev)}
                            aria-label={`Crear ajuste desde ${ev.nombre}`}
                            className="focus-ring min-h-10 rounded px-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 lg:min-h-0"
                          >
                            Crear ajuste
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setError('')
                            setEliminando(ev)
                          }}
                          aria-label={`Eliminar evento ${ev.nombre}`}
                          className="focus-ring min-h-10 rounded px-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 lg:min-h-0"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {edificacion && (
            <p className="ui-muted text-xs">
              {eventosDeEdificacion.length === 1
                ? '1 evento registrado en'
                : `${eventosDeEdificacion.length} eventos registrados en`}{' '}
              «{edificacion.nombre}». Todos (incluidos los de niveles inferiores) se
              superponen al calendario según su herencia.
            </p>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={eliminando != null}
        onClose={() => setEliminando(null)}
        onConfirm={() => void confirmarEliminacion()}
        title="Eliminar evento"
        description={`Se eliminará el evento "${eliminando?.nombre ?? ''}" (${eliminando ? formatearRangoEvento(eliminando.fechaInicio, eliminando.fechaFin) : ''}) del calendario. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="destructive"
      />
    </section>
  )
}
