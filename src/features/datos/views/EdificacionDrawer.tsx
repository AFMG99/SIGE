'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { CATALOGO_EDIFICACIONES, tipoEdificacionPorCodigo } from '@/features/datos/models/validations'

interface EdificacionDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { nombre: string; tipo: string }) => Promise<void>
  submitting?: boolean
}

export type EdificacionFormData = { nombre: string; tipo: string }

type FieldKey = keyof EdificacionFormData

function validate(form: EdificacionFormData): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {}

  if (!form.nombre.trim()) {
    errors.nombre = 'El nombre es obligatorio'
  } else if (form.nombre.trim().length < 2) {
    errors.nombre = 'El nombre debe tener al menos 2 caracteres'
  } else if (form.nombre.trim().length > 100) {
    errors.nombre = 'El nombre no puede superar los 100 caracteres'
  }

  if (!form.tipo) {
    errors.tipo = 'Seleccione el tipo de edificación'
  }

  return errors
}

export function EdificacionDrawer({ isOpen, onClose, onSubmit, submitting = false }: EdificacionDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [form, setForm] = useState<EdificacionFormData>({ nombre: '', tipo: '' })

  // Reset al abrir
  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setTouched({})
    setSubmitted(false)
    setSubmitError('')
    setForm({ nombre: '', tipo: '' })
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

  const update = (patch: Partial<EdificacionFormData>, field: FieldKey) => {
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
      await onSubmit({ nombre: form.nombre.trim(), tipo: form.tipo })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear la edificación'
      setSubmitError(message)
    }
  }

  const infoTipo = form.tipo ? tipoEdificacionPorCodigo(form.tipo) : null

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
      aria-labelledby="edificacion-drawer-title"
    >
      <div
        ref={drawerRef}
        className="h-full w-full max-w-[28rem] animate-slide-in-right overflow-y-auto bg-white shadow-2xl dark:bg-slate-900 dark:shadow-black/40"
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-gray-100 px-6 pt-6 pb-4 dark:border-slate-800">
          <div>
            <h2
              id="edificacion-drawer-title"
              className="ui-title text-lg"
            >
              Crear edificación
            </h2>
            <p className="ui-muted mt-1 text-sm">
              Defina el nombre y el tipo; el formulario de importación se adapta al tipo elegido.
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
            <label htmlFor="edificacion-nombre" className="ui-label mb-1.5">
              Nombre
            </label>
            <input
              id="edificacion-nombre"
              type="text"
              value={form.nombre}
              onChange={(e) => update({ nombre: e.target.value }, 'nombre')}
              onBlur={() => {
                setTouched((t) => ({ ...t, nombre: true }))
                setErrors(validate(form))
              }}
              disabled={submitting}
              placeholder="Ej. Casa 12, Edificio A, Sede Norte"
              maxLength={100}
              aria-invalid={show('nombre') ? 'true' : undefined}
              aria-describedby={show('nombre') ? 'edificacion-nombre-error' : undefined}
              className={inputClass('nombre')}
            />
            {show('nombre') && (
              <p id="edificacion-nombre-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.nombre}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="edificacion-tipo" className="ui-label mb-1.5">
              Tipo de edificación
            </label>
            <select
              id="edificacion-tipo"
              value={form.tipo}
              onChange={(e) => update({ tipo: e.target.value }, 'tipo')}
              onBlur={() => {
                setTouched((t) => ({ ...t, tipo: true }))
                setErrors(validate(form))
              }}
              disabled={submitting}
              aria-invalid={show('tipo') ? 'true' : undefined}
              aria-describedby={show('tipo') ? 'edificacion-tipo-error' : undefined}
              className={inputClass('tipo')}
            >
              <option value="">— Seleccione —</option>
              {CATALOGO_EDIFICACIONES.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
            {show('tipo') && (
              <p id="edificacion-tipo-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.tipo}
              </p>
            )}
            {infoTipo && (
              <p className="ui-muted mt-1.5 text-xs">
                {infoTipo.requiereBloque
                  ? 'Este tipo requiere bloques: deberá crear al menos uno antes de importar.'
                  : 'Se creará automáticamente un bloque único para esta edificación.'}
              </p>
            )}
          </div>

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
              {submitting ? 'Guardando…' : 'Crear edificación'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
