'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { tipoEdificacionPorCodigo } from '@/features/datos/models/validations'

interface BloqueDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: BloqueFormData) => Promise<void>
  /** Edificación a la que pertenece el bloque (solo lectura en el formulario). */
  edificacion: { nombre: string; tipo: string } | null
  submitting?: boolean
}

export type BloqueFormData = {
  codigo: string
  nombre: string
  area: string
  factor: string
}

type FieldKey = keyof BloqueFormData

const CODIGO_RE = /^[A-Za-z0-9_-]{2,32}$/

function validate(form: BloqueFormData): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {}

  if (!form.codigo.trim()) {
    errors.codigo = 'El código es obligatorio'
  } else if (!CODIGO_RE.test(form.codigo.trim())) {
    errors.codigo = 'El código debe tener entre 2 y 32 caracteres (letras, números, - o _)'
  }

  const nombre = form.nombre.trim()
  if (!nombre) {
    errors.nombre = 'El nombre es obligatorio'
  } else if (nombre.length < 2 || nombre.length > 100) {
    errors.nombre = 'El nombre debe tener entre 2 y 100 caracteres'
  }

  if (form.area.trim()) {
    const area = Number(form.area)
    if (!Number.isFinite(area) || area < 0) {
      errors.area = 'El área útil debe ser un número mayor o igual a 0'
    }
  }

  if (form.factor.trim()) {
    const factor = Number(form.factor)
    if (!Number.isFinite(factor) || factor <= 0) {
      errors.factor = 'El factor de infraestructura debe ser un número positivo'
    }
  }

  return errors
}

export function BloqueDrawer({
  isOpen,
  onClose,
  onSubmit,
  edificacion,
  submitting = false,
}: BloqueDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [form, setForm] = useState<BloqueFormData>({ codigo: '', nombre: '', area: '', factor: '' })

  // Reset al abrir
  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setTouched({})
    setSubmitted(false)
    setSubmitError('')
    setForm({ codigo: '', nombre: '', area: '', factor: '' })
    const firstInput = drawerRef.current?.querySelector<HTMLInputElement>('input')
    firstInput?.focus()
  }, [isOpen])

  // Escape cierra
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const show = (field: FieldKey): string | undefined =>
    (touched[field] || submitted) ? errors[field] : undefined

  const update = (patch: Partial<BloqueFormData>, field: FieldKey) => {
    const next = { ...form, ...patch }
    setForm(next)
    if (touched[field] || submitted) {
      setErrors(validate(next))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setSubmitError('')
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    try {
      await onSubmit({
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        area: form.area.trim(),
        factor: form.factor.trim(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear el bloque'
      setSubmitError(message)
    }
  }

  const inputClass = (field: FieldKey) =>
    `ui-input transition-colors disabled:opacity-60 ${show(field) ? 'ui-input-error' : ''}`

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 dark:bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bloque-drawer-title"
    >
      <div
        ref={drawerRef}
        className="h-full w-full max-w-[28rem] animate-slide-in-right overflow-y-auto bg-white shadow-2xl dark:bg-slate-900 dark:shadow-black/40"
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-gray-100 px-6 pt-6 pb-4 dark:border-slate-800">
          <div>
            <h2 id="bloque-drawer-title" className="ui-title text-lg">
              Crear bloque
            </h2>
            <p className="ui-muted mt-1 text-sm">
              {edificacion
                ? `Pertenece a: ${edificacion.nombre} — ${tipoEdificacionPorCodigo(edificacion.tipo).etiqueta}`
                : 'Bloque / piso de la edificación seleccionada.'}
            </p>
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

        <form onSubmit={handleSubmit} noValidate className="space-y-4 px-6 pb-6">
          {submitError && (
            <div role="alert" className="ui-callout ui-callout-danger">
              {submitError}
            </div>
          )}

          <div>
            <label htmlFor="bloque-codigo" className="ui-label mb-1.5">
              Código
            </label>
            <input
              id="bloque-codigo"
              type="text"
              value={form.codigo}
              onChange={(e) => update({ codigo: e.target.value }, 'codigo')}
              onBlur={() => {
                setTouched((t) => ({ ...t, codigo: true }))
                setErrors(validate(form))
              }}
              disabled={submitting}
              placeholder="Ej. MAN-M1"
              maxLength={32}
              aria-invalid={show('codigo') ? 'true' : undefined}
              aria-describedby={show('codigo') ? 'bloque-codigo-error' : undefined}
              className={inputClass('codigo')}
            />
            {show('codigo') && (
              <p id="bloque-codigo-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.codigo}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="bloque-nombre" className="ui-label mb-1.5">
              Nombre
            </label>
            <input
              id="bloque-nombre"
              type="text"
              value={form.nombre}
              onChange={(e) => update({ nombre: e.target.value }, 'nombre')}
              onBlur={() => {
                setTouched((t) => ({ ...t, nombre: true }))
                setErrors(validate(form))
              }}
              disabled={submitting}
              placeholder="Ej. Bloque 1 / Piso 2"
              maxLength={100}
              aria-invalid={show('nombre') ? 'true' : undefined}
              aria-describedby={show('nombre') ? 'bloque-nombre-error' : undefined}
              className={inputClass('nombre')}
            />
            {show('nombre') && (
              <p id="bloque-nombre-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.nombre}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bloque-area" className="ui-label mb-1.5">
                Área útil (m²)
              </label>
              <input
                id="bloque-area"
                type="text"
                inputMode="decimal"
                value={form.area}
                onChange={(e) => update({ area: e.target.value }, 'area')}
                onBlur={() => {
                  setTouched((t) => ({ ...t, area: true }))
                  setErrors(validate(form))
                }}
                disabled={submitting}
                placeholder="0"
                aria-invalid={show('area') ? 'true' : undefined}
                aria-describedby={show('area') ? 'bloque-area-error' : undefined}
                className={inputClass('area')}
              />
              {show('area') && (
                <p id="bloque-area-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.area}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="bloque-factor" className="ui-label mb-1.5">
                Factor de infraestructura
              </label>
              <input
                id="bloque-factor"
                type="text"
                inputMode="decimal"
                value={form.factor}
                onChange={(e) => update({ factor: e.target.value }, 'factor')}
                onBlur={() => {
                  setTouched((t) => ({ ...t, factor: true }))
                  setErrors(validate(form))
                }}
                disabled={submitting}
                placeholder="1"
                aria-invalid={show('factor') ? 'true' : undefined}
                aria-describedby={show('factor') ? 'bloque-factor-error' : undefined}
                className={inputClass('factor')}
              />
              {show('factor') && (
                <p id="bloque-factor-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.factor}
                </p>
              )}
            </div>
          </div>

          <p className="ui-muted text-xs">
            Área y factor son opcionales: se usarán 0 y 1 si se dejan vacíos.
          </p>

          <div className="mt-4 flex items-center justify-end gap-3 border-t border-gray-100 pt-2 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="ui-btn ui-btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="ui-btn ui-btn-primary"
            >
              {submitting ? 'Guardando…' : 'Crear bloque'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
