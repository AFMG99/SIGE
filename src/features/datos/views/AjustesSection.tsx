'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { GestionAjustes } from './GestionAjustes'
import { crearAjuste, editarAjuste } from '@/features/datos/controllers/ajustes'
import { ListboxSelect } from '@/shared/views/ui/ListboxSelect'
import { useToast } from '@/shared/views/ui/ToastProvider'
import { VistaDatos } from './VistaDatos'
import { construirPanelAjustes } from './existencias'
import type { AjusteExistente, AjustesExistentes } from './existencias'
import type { BloqueInfo, EdificacionInfo } from './useCatalogoEdificaciones'
import type { EventoInfo } from '../models/eventos'
import { IconCarga, IconVistaPrevia, IconGestionar, IconInfo, IconPlus, IconX, IconCheck } from './icons'

/** Fila de la pestaña «Aplicados»: salida `ajustes_aplicados` del motor. */
type AjusteAplicado = {
  ano: number
  mes: number
  proporcion: number
  direccion: string
  descripcion: string
}

interface AjustesSectionProps {
  ajustes: AjustesExistentes
  /**
   * Ajustes que el motor aplicó en el último cálculo de línea base.
   * `null` = aún no se calculó en esta sesión (no se puede afirmar nada);
   * `[]` = sí hubo cálculo y no aplicó ningún ajuste no rutinario.
   */
  ajustesAplicados: AjusteAplicado[] | null
  modo: 'carga' | 'datos' | 'gestion'
  puedeCargar: boolean
  onModoChange?: (modo: 'carga' | 'datos' | 'gestion') => void
  /** Catálogo de edificaciones (fuente única de `DatosContent`). */
  edificaciones: EdificacionInfo[]
  /** Catálogo completo: la cascada filtra por la edificación elegida. */
  bloques: BloqueInfo[]
  /**
   * Evento del calendario pendiente de convertir en ajuste («Crear ajuste
   * desde este evento»): al cambiar, se abre el modal de creación precargado
   * con los campos derivados del evento (periodos en `YYYY-MM`, bloque con su
   * edificación en cascada y descripción). La proporción, la dirección y las
   * observaciones las completa el usuario; nada se envía solo.
   */
  eventoPrellenado?: EventoInfo | null
  /** Notifica al padre que el pre-fill ya se aplicó (para limpiarlo). */
  onPrellenadoConsumido?: () => void
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
  edificaciones,
  bloques,
  eventoPrellenado,
  onPrellenadoConsumido,
}: AjustesSectionProps) {
  const [tab, setTab] = useState<'referencia' | 'registrados' | 'aplicados'>('referencia')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    tipo: 'NO_RUTINARIO',
    edificacionId: '',
    bloqueId: '',
    periodoInicio: '',
    periodoFin: '',
    valorAjuste: '',
    direccion: 'reduccion',
    descripcion: '',
    observaciones: '',
  })
  const [submitting, setSubmitting] = useState(false)
  /** Error de validación del campo Bloque (el `<select>` no admite `required`). */
  const [errorBloque, setErrorBloque] = useState('')
  /** Id del ajuste que se está editando (`null` = creación). */
  const [editingId, setEditingId] = useState<string | null>(null)
  const router = useRouter()
  const { showToast } = useToast()
  const modalRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  /** Cascada: solo los bloques de la edificación elegida. */
  const bloquesVisibles = useMemo(
    () =>
      form.edificacionId
        ? bloques.filter((b) => b.edificacionId === form.edificacionId)
        : [],
    [bloques, form.edificacionId]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.bloqueId) {
      setErrorBloque('Seleccione la edificación y el bloque al que aplica el ajuste.')
      return
    }
    setErrorBloque('')
    setSubmitting(true)
    try {
      const payload = {
        tipo: form.tipo,
        bloqueId: form.bloqueId,
        periodoInicio: form.periodoInicio,
        periodoFin: form.periodoFin,
        valorAjuste: form.valorAjuste,
        direccion: form.direccion,
        descripcion: form.descripcion,
        observaciones: form.observaciones,
      }
      const res = editingId ? await editarAjuste(editingId, payload) : await crearAjuste(payload)
      if (res.estado === 'completado') {
        setShowForm(false)
        setEditingId(null)
        setForm({
          tipo: 'NO_RUTINARIO',
          edificacionId: '',
          bloqueId: '',
          periodoInicio: '',
          periodoFin: '',
          valorAjuste: '',
          direccion: 'reduccion',
          descripcion: '',
          observaciones: '',
        })
        showToast(res.mensaje ?? (editingId ? 'Ajuste actualizado.' : 'Ajuste creado.'), 'success')
        router.refresh()
      } else {
        showToast(res.mensaje ?? 'No fue posible guardar el ajuste.', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  /** Cierra el modal limpiando el modo edición (sin guardar). */
  const cerrarModal = () => {
    setShowForm(false)
    setEditingId(null)
  }

  /** Abre el modal en modo edición, precargando los campos del ajuste. */
  const abrirEditar = (ajuste: AjusteExistente) => {
    setEditingId(ajuste.id)
    const edificacionDeBloque = edificaciones.find((e) => bloques.some((b) => b.id === ajuste.bloqueId && b.edificacionId === e.id))
    setForm({
      tipo: ajuste.tipo,
      edificacionId: edificacionDeBloque?.id ?? '',
      bloqueId: ajuste.bloqueId ?? '',
      periodoInicio: ajuste.fechaInicio?.slice(0, 7) ?? '',
      periodoFin: ajuste.fechaFin?.slice(0, 7) ?? '',
      valorAjuste: String(ajuste.valorAjuste),
      direccion: ajuste.direccion === 'incremento' ? 'incremento' : 'reduccion',
      descripcion: ajuste.descripcion ?? '',
      observaciones: ajuste.observaciones ?? '',
    })
    setShowForm(true)
  }

  // Pre-fill desde un evento del calendario («Crear ajuste desde este
  // evento»): al llegar un evento pendiente se abre el modal de CREACIÓN con
  // los campos derivados (periodos en `YYYY-MM`, bloque con su edificación
  // resuelta en cascada y descripción = nombre — descripción). No se envía
  // nada: el usuario completa los obligatorios restantes y envía normalmente.
  // El padre limpia el pendiente vía `onPrellenadoConsumido`, así un
  // remontaje posterior de la sección no reabre el modal con datos viejos.
  useEffect(() => {
    if (!eventoPrellenado) return
    const bloque = eventoPrellenado.bloqueId
      ? bloques.find((b) => b.id === eventoPrellenado.bloqueId)
      : undefined
    setEditingId(null)
    setErrorBloque('')
    setForm({
      tipo: 'NO_RUTINARIO',
      // Edificación derivada del bloque del evento (fallback: la del evento).
      edificacionId: bloque?.edificacionId ?? eventoPrellenado.edificacionId,
      bloqueId: eventoPrellenado.bloqueId ?? '',
      periodoInicio: eventoPrellenado.fechaInicio.slice(0, 7),
      periodoFin: (eventoPrellenado.fechaFin ?? eventoPrellenado.fechaInicio).slice(0, 7),
      valorAjuste: '',
      direccion: 'reduccion',
      descripcion: eventoPrellenado.descripcion
        ? `${eventoPrellenado.nombre} — ${eventoPrellenado.descripcion}`
        : eventoPrellenado.nombre,
      observaciones: '',
    })
    setShowForm(true)
    onPrellenadoConsumido?.()
  }, [eventoPrellenado, bloques, onPrellenadoConsumido])

  // Focus trap + Escape para el modal de creación.
  useEffect(() => {
    if (!showForm) return
    const modal = modalRef.current
    if (!modal) return

    const focusables = (): HTMLElement[] =>
      Array.from(
        modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      )

    const previouslyFocused = document.activeElement as HTMLElement | null
    const first = focusables()[0]
    first?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cerrarModal()
        return
      }
      if (e.key !== 'Tab') return
      const els = focusables()
      if (els.length === 0) return
      const firstEl = els[0]
      const lastEl = els[els.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [showForm])

  const canManage = puedeCargar && (modo === 'carga' || modo === 'gestion')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="ui-title text-lg">Ajustes Energéticos</h2>
          <p className="ui-muted text-sm">
            {modo === 'carga'
              ? 'Cree ajustes no rutinarios (Anexo 4): el motor ajusta los meses homólogos de los demás años con la proporción registrada, antes de la depuración.'
              : modo === 'datos'
              ? 'Consulte los ejemplos del Anexo 4, los ajustes registrados y los aplicados en el cálculo actual.'
              : 'Elimine ajustes puntuales o vacíe la base: edificaciones, bloques y los demás datos se conservan.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div data-pill-strip className="scrollbar-hide inline-flex max-w-full shrink-0 snap-x snap-mandatory overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-1.5 dark:border-slate-800 dark:bg-slate-900 lg:justify-center lg:overflow-x-visible" role="group" aria-label="Modo de la sección Ajustes">
            {(['carga', 'datos', 'gestion'] as const).map((m) => (
              <button
                key={m}
                onClick={() => onModoChange?.(m)}
                disabled={!puedeCargar && (m === 'carga' || m === 'gestion')}
                aria-pressed={modo === m}
                className={`min-h-10 shrink-0 snap-start whitespace-nowrap px-3 py-1.5 text-sm rounded-lg transition lg:min-h-0 ${modo === m ? 'bg-uv-purple text-white' : 'text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-slate-800'} ${!puedeCargar && (m === 'carga' || m === 'gestion') ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              ref={triggerRef}
              onClick={() => setShowForm(true)}
              className="ui-btn ui-btn-primary gap-2"
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
        {/* `pb-px` compensa el `-mb-px` de la pestaña activa: al hacerse la
            tira scrolleable, cualquier sobresaliente vertical se recortaría. */}
        <nav className="scrollbar-hide flex snap-x snap-mandatory gap-1 overflow-x-auto px-1 pb-px lg:justify-center lg:overflow-x-visible" role="tablist" aria-label="Pestañas de ajustes">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-10 shrink-0 snap-start whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px rounded-t-lg transition lg:min-h-0 ${
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
              <GestionAjustes ajustes={ajustes} onEditar={abrirEditar} />
            )}
          </>
        )}

        {/* Aplicados */}
        {tab === 'aplicados' && (
          <div>
            {!ajustesAplicados || ajustesAplicados.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
                <IconCheck className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Sin ajustes aplicados</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {ajustesAplicados === null
                    ? 'Aún no se ha calculado una línea base en esta sesión. Abra «Líneas Base» y pulse ' +
                      '«Calcular modelos»: los ajustes no rutinarios que el motor aplique en la depuración ' +
                      'aparecerán aquí.'
                    : 'El cálculo actual no aplicó ajustes no rutinarios. Registre ajustes en la ' +
                      'pestaña «Registrados» o cree nuevos en «Carga» para que se apliquen ' +
                      'automáticamente en la depuración.'}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={cerrarModal}>
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ajuste-modal-titulo"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-slate-900 focus-ring"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 id="ajuste-modal-titulo" className="ui-title text-lg">
                  {editingId ? 'Editar ajuste' : 'Nuevo ajuste'}
                </h3>
                <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <IconX className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="ui-field">
                  <label htmlFor="tipo" className="ui-label">
                    Tipo
                  </label>
                  <select
                    id="tipo"
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    aria-describedby={form.tipo === 'RUTINARIO' ? 'tipo-ayuda' : undefined}
                    className="ui-input"
                  >
                    <option value="RUTINARIO">Rutinario</option>
                    <option value="NO_RUTINARIO">No Rutinario (Anexo 4)</option>
                  </select>
                  {form.tipo === 'RUTINARIO' && (
                    <p id="tipo-ayuda" className="ui-muted text-xs">
                      Se registra para documentar (§7.6.2); no aplica al cálculo de la LBEn.
                    </p>
                  )}
                </div>
                <div className="ui-field">
                  <label htmlFor="ajuste-edificacion" className="ui-label">
                    Edificación
                  </label>
                  <ListboxSelect
                    id="ajuste-edificacion"
                    value={form.edificacionId}
                    onChange={(v) =>
                      // El bloque elegido pertenece a la edificación anterior: se limpia.
                      setForm((f) => ({ ...f, edificacionId: v, bloqueId: '' }))
                    }
                    placeholder="— Seleccione una edificación —"
                    options={edificaciones.map((e) => ({ value: e.id, label: e.nombre }))}
                    className="ui-input cursor-pointer"
                  />
                </div>
                <div className="ui-field">
                  <label htmlFor="ajuste-bloque" className="ui-label">
                    Bloque
                  </label>
                  <ListboxSelect
                    id="ajuste-bloque"
                    value={form.bloqueId}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, bloqueId: v }))
                      setErrorBloque('')
                    }}
                    disabled={!form.edificacionId}
                    invalid={errorBloque !== ''}
                    placeholder={
                      form.edificacionId
                        ? '— Seleccione un bloque —'
                        : 'Primero elija una edificación'
                    }
                    options={bloquesVisibles.map((b) => ({
                      value: b.id,
                      label: `${b.codigo} — ${b.nombre}`,
                    }))}
                    className={`ui-input cursor-pointer${
                      errorBloque ? ' ui-input-error' : ''
                    }`}
                  />
                  <p className="ui-muted text-xs">
                    El ajuste se guarda sobre un bloque: ese es el alcance al que aplicará en la
                    línea base.
                  </p>
                  {errorBloque && (
                    <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                      {errorBloque}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="ui-field">
                    <label htmlFor="periodoInicio" className="ui-label">
                      Periodo inicio (YYYY-MM)
                    </label>
                    <input
                      id="periodoInicio"
                      type="month"
                      value={form.periodoInicio}
                      onChange={(e) => setForm({ ...form, periodoInicio: e.target.value })}
                      required
                      className="ui-input"
                    />
                  </div>
                  <div className="ui-field">
                    <label htmlFor="periodoFin" className="ui-label">
                      Periodo fin (YYYY-MM)
                    </label>
                    <input
                      id="periodoFin"
                      type="month"
                      value={form.periodoFin}
                      onChange={(e) => setForm({ ...form, periodoFin: e.target.value })}
                      required
                      className="ui-input"
                    />
                  </div>
                </div>
                <div className="ui-field">
                  <label htmlFor="valorAjuste" className="ui-label">
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
                    className="ui-input"
                  />
                </div>
                <div className="ui-field">
                  <label className="ui-label">
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
                <div className="ui-field">
                  <label htmlFor="descripcion" className="ui-label">
                    Descripción / Causa
                  </label>
                  <textarea
                    id="descripcion"
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    rows={3}
                    placeholder="Ej: Remodelación piso 3, AC apagado may-sep"
                    required
                    className="ui-input"
                  />
                </div>
                <div className="ui-field">
                  <label htmlFor="observaciones" className="ui-label">
                    Observaciones (opcional)
                  </label>
                  <textarea
                    id="observaciones"
                    value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                    rows={2}
                    className="ui-input"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    className="ui-btn ui-btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="ui-btn ui-btn-primary flex-1"
                  >
                    {submitting ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear Ajuste'}
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