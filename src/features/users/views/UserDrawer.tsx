'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { ROLES, ROLE_LABELS, type Role, USER_STATUSES, STATUS_LABELS, type UserStatus } from '@/shared/models/permissions'
import { phoneSchema } from '@/features/users/models/validations'
import { CountryPhoneInput } from './CountryPhoneInput'

interface UserDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: UserFormData) => Promise<void>
  initialData?: UserFormData | null
  mode: 'create' | 'edit'
  submitting?: boolean
}

export interface UserFormData {
  name: string
  email: string
  phone: string
  role: Role
  status: UserStatus
  sendInvitation?: boolean
  password?: string
}

type FieldKey = keyof UserFormData

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form: UserFormData, mode: 'create' | 'edit'): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {}

  if (!form.name.trim()) {
    errors.name = 'El nombre es obligatorio'
  } else if (form.name.trim().length < 2) {
    errors.name = 'El nombre debe tener al menos 2 caracteres'
  }

  if (!form.email.trim()) {
    errors.email = 'El correo es obligatorio'
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errors.email = 'Correo electrónico inválido'
  }

  if (form.phone && form.phone.trim()) {
    const parsed = phoneSchema.safeParse(form.phone.trim())
    if (!parsed.success) errors.phone = 'Formato de teléfono inválido'
  }

  if (mode === 'create' && !form.sendInvitation) {
    if (!form.password) {
      errors.password = 'La contraseña es obligatoria si no envías invitación'
    } else if (form.password.length < 8) {
      errors.password = 'La contraseña debe tener al menos 8 caracteres'
    }
  }

  return errors
}

export function UserDrawer({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  submitting = false,
}: UserDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [form, setForm] = useState<UserFormData>({
    name: '',
    email: '',
    phone: '',
    role: 'COMUNIDAD_UNIVERSITARIA',
    status: 'ACTIVE',
    sendInvitation: false,
    password: '',
  })

  // Reset when opening (create) or hydrate from the edited user
  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setTouched({})
    setSubmitted(false)
    setSubmitError('')
    setForm(
      initialData ?? {
        name: '',
        email: '',
        phone: '',
        role: 'COMUNIDAD_UNIVERSITARIA',
        status: 'ACTIVE',
        sendInvitation: false,
        password: '',
      }
    )
    const firstInput = drawerRef.current?.querySelector<HTMLInputElement>('input')
    firstInput?.focus()
  }, [isOpen, initialData])

  // Escape closes
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

  const update = (patch: Partial<UserFormData>, field: FieldKey) => {
    const next = { ...form, ...patch }
    setForm(next)
    if (touched[field] || submitted) {
      setErrors(validate(next, mode))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setSubmitError('')
    const found = validate(form, mode)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    try {
      await onSubmit({ ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar el usuario'
      if (/correo|email|registrado/i.test(message)) {
        setErrors((prev) => ({ ...prev, email: message }))
      } else {
        setSubmitError(message)
      }
    }
  }

  const invite = mode === 'create' && form.sendInvitation === true

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
      aria-labelledby="drawer-title"
    >
      <div
        ref={drawerRef}
        className="h-full w-full max-w-[28rem] animate-slide-in-right overflow-y-auto bg-white shadow-2xl dark:bg-slate-900 dark:shadow-black/40"
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-gray-100 pb-4 px-6 pt-6 dark:border-slate-800">
          <div>
            <h2 id="drawer-title" className="ui-title text-lg">
              {mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
            </h2>
            <p className="ui-muted mt-1 text-sm">
              {mode === 'create'
                ? 'Invita a una persona o créala con contraseña.'
                : 'Actualiza los datos de la cuenta.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="focus-ring cursor-pointer rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
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
            <label htmlFor="user-name" className="ui-label mb-1.5">Nombre completo</label>
            <input
              id="user-name"
              type="text"
              value={form.name}
              onChange={(e) => update({ name: e.target.value }, 'name')}
              onBlur={() => { setTouched((t) => ({ ...t, name: true })); setErrors(validate(form, mode)) }}
              disabled={submitting}
              placeholder="Juan Pérez"
              aria-invalid={show('name') ? 'true' : undefined}
              aria-describedby={show('name') ? 'user-name-error' : undefined}
              className={inputClass('name')}
            />
            {show('name') && <p id="user-name-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="user-email" className="ui-label mb-1.5">Correo electrónico</label>
            <input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(e) => update({ email: e.target.value }, 'email')}
              onBlur={() => { setTouched((t) => ({ ...t, email: true })); setErrors(validate(form, mode)) }}
              disabled={submitting || mode === 'edit'}
              placeholder="tu@universidad.edu"
              aria-invalid={show('email') ? 'true' : undefined}
              aria-describedby={show('email') ? 'user-email-error' : undefined}
              className={inputClass('email')}
            />
            {show('email') && <p id="user-email-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>}
            {mode === 'edit' && <p className="ui-muted mt-1 text-xs">El correo no se puede modificar.</p>}
          </div>

          <div>
            <label htmlFor="user-phone" className="ui-label mb-1.5">Teléfono (opcional)</label>
            <CountryPhoneInput
              inputId="user-phone"
              value={form.phone}
              onChange={(v) => update({ phone: v }, 'phone')}
              onBlur={() => { setTouched((t) => ({ ...t, phone: true })); setErrors(validate(form, mode)) }}
              disabled={submitting}
              invalid={!!show('phone')}
              describedBy={show('phone') ? 'user-phone-error' : undefined}
              placeholder="600 000 000"
            />
            {show('phone') && <p id="user-phone-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.phone}</p>}
          </div>

          <div>
            <label htmlFor="user-role" className="ui-label mb-1.5">Rol</label>
            <select
              id="user-role"
              value={form.role}
              onChange={(e) => update({ role: e.target.value as Role }, 'role')}
              disabled={submitting}
              className={inputClass('role')}
            >
              {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="user-status" className="ui-label mb-1.5">Estado</label>
            <select
              id="user-status"
              value={invite ? 'PENDING' : form.status}
              onChange={(e) => update({ status: e.target.value as UserStatus }, 'status')}
              disabled={submitting || invite}
              className={inputClass('status')}
            >
              {USER_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
            </select>
            {invite && <p className="ui-muted mt-1 text-xs">La cuenta quedará como pendiente hasta que se acepte la invitación.</p>}
          </div>

          {mode === 'create' && (
            <div className="rounded-lg border border-gray-200 p-3 dark:border-slate-700">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.sendInvitation === true}
                  onChange={(e) => update({ sendInvitation: e.target.checked }, 'sendInvitation')}
                  disabled={submitting}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus-ring cursor-pointer"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Enviar invitación por correo</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">La persona recibirá un enlace para establecer su contraseña. (Envío simulado hasta integrar el servicio de correo.)</span>
                </span>
              </label>

              {!invite && (
                <div className="mt-3">
                  <label htmlFor="user-password" className="ui-label mb-1.5">Contraseña</label>
                  <input
                    id="user-password"
                    type="password"
                    value={form.password ?? ''}
                    onChange={(e) => update({ password: e.target.value }, 'password')}
                    onBlur={() => { setTouched((t) => ({ ...t, password: true })); setErrors(validate(form, mode)) }}
                    disabled={submitting}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    aria-invalid={show('password') ? 'true' : undefined}
                    aria-describedby={show('password') ? 'user-password-error' : undefined}
                    className={inputClass('password')}
                  />
                  {show('password') && <p id="user-password-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 mt-4 dark:border-slate-800">
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
              {submitting ? 'Guardando…' : mode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
