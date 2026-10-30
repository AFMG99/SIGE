'use client'

import { useState, useRef } from 'react'

interface TwoFactorCodeFormProps {
  onSubmit: (code: string) => Promise<void>
  submitLabel?: string
  showBackupHint?: boolean
  disabled?: boolean
}

// Accepts either a 6-digit TOTP code or a 10-char hex backup code. Paste-friendly
// (a full code pasted into the single box works as-is).
export function TwoFactorCodeForm({
  onSubmit,
  submitLabel = 'Verificar',
  showBackupHint = true,
  disabled = false,
}: TwoFactorCodeFormProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const normalized = code.replace(/[^a-zA-Z0-9]/g, '')
  const isSixDigits = /^\d{6}$/.test(normalized)
  const isBackup = /^[a-fA-F0-9]{10}$/.test(normalized)
  const isValid = isSixDigits || isBackup
  const isBusy = isSubmitting || disabled

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // TOTP codes are always digits; a backup code is hex. Let the user paste either.
    const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '')
    setCode(value)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || isBusy) return

    setIsSubmitting(true)
    setError('')
    try {
      await onSubmit(normalized)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar el código')
      setCode('')
      inputRef.current?.focus()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="twofa-code" className="ui-label mb-1.5">
          Código de verificación
        </label>
        <input
          ref={inputRef}
          id="twofa-code"
          name="code"
          type="text"
          inputMode={isBackup && code.length > 0 ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={handleChange}
          disabled={isBusy}
          maxLength={10}
          placeholder={showBackupHint ? '123456 o código de respaldo' : '123456'}
          className={`ui-input py-3 text-center font-mono tracking-[0.3em] transition-colors disabled:opacity-50 ${
            code && !isValid ? 'ui-input-error' : ''
          }`}
          aria-invalid={code && !isValid ? 'true' : 'false'}
          aria-describedby="twofa-code-hint"
        />
        {showBackupHint && (
          <p id="twofa-code-hint" className="ui-muted mt-1.5 text-xs">
            Introduce el código de 6 dígitos de tu app, o uno de tus códigos de respaldo.
          </p>
        )}
      </div>

      {error && (
        <div className="ui-callout ui-callout-danger" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid || isBusy}
        className="ui-btn ui-btn-primary w-full py-3 text-base disabled:cursor-not-allowed"
      >
        {isBusy ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Verificando...
          </>
        ) : (
          submitLabel
        )}
      </button>
    </form>
  )
}
