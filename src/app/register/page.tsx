'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { registerSchema, RegisterInput, registerFieldSchemas } from '@/lib/validations'
import { toggleTheme, getCurrentTheme } from '@/lib/theme'

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<RegisterInput>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Partial<RegisterInput>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [dark, setDark] = useState(false)

  // Sync icon with the theme applied by the layout anti-flash script.
  useEffect(() => {
    setDark(getCurrentTheme() === 'dark')
  }, [])

  const handleThemeToggle = () => {
    toggleTheme()
    setDark(getCurrentTheme() === 'dark')
  }

  const validateField = (name: keyof RegisterInput, value: string) => {
    const fieldSchema = registerFieldSchemas[name]
    if (fieldSchema) {
      const result = fieldSchema.safeParse(value)
      if (!result.success) {
        setErrors(prev => ({ ...prev, [name]: result.error.errors[0].message }))
      } else {
        setErrors(prev => {
          const next = { ...prev }
          delete next[name]
          return next
        })
      }
    }
    
    // Special handling for confirmPassword
    if (name === 'confirmPassword') {
      if (value !== formData.password) {
        setErrors(prev => ({ ...prev, confirmPassword: 'Las contraseñas no coinciden' }))
      } else {
        setErrors(prev => {
          const next = { ...prev }
          delete next.confirmPassword
          return next
        })
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    validateField(name as keyof RegisterInput, value)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    validateField(e.target.name as keyof RegisterInput, e.target.value)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError('')
    
    const result = registerSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof RegisterInput, string>> = {}
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as keyof RegisterInput] = err.message
      })
      setErrors(fieldErrors as Partial<RegisterInput>)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.message || 'Error al registrarse')
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-gray-50 dark:bg-slate-950">
      {/* Theme toggle: fixed top-right. The register page background changes with
          the theme, so the button uses a neutral adaptive style. */}
      <button
        type="button"
        onClick={handleThemeToggle}
        aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        title={dark ? 'Tema claro' : 'Tema oscuro'}
        className="fixed right-4 top-4 z-[60] grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-gray-200 bg-white/80 text-gray-600 backdrop-blur transition-colors hover:border-gray-300 hover:bg-white hover:text-gray-900 focus-ring dark:border-slate-700 dark:bg-slate-800/80 dark:text-emerald-50 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        {dark ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l-1.41-1.41m11.32-11.32l-1.41-1.41" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </button>

      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-md mx-auto bg-white/95 backdrop-blur-xl rounded-3xl border border-white/30 shadow-2xl p-8 dark:border-white/10 dark:bg-slate-900/90"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif font-light text-gray-900 tracking-tight dark:text-gray-50">
              Crear cuenta
            </h1>
            <p className="ui-muted mt-2 text-sm">
              Únete a la Universidad Virtual
            </p>
          </div>

          {serverError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="ui-callout ui-callout-danger mb-6"
              role="alert"
            >
              {serverError}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="name" className="ui-label mb-1.5">
                Nombre completo
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isLoading}
                className={`ui-input py-3 transition-colors disabled:opacity-50 ${
                  errors.name ? 'ui-input-error' : ''
                }`}
                placeholder="Juan Pérez"
                aria-invalid={errors.name ? 'true' : 'false'}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <p id="name-error" className="mt-1.5 text-sm text-red-500 dark:text-red-400" role="alert">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="ui-label mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={isLoading}
                  className={`ui-input py-3 pr-10 transition-colors disabled:opacity-50 ${
                    errors.email ? 'ui-input-error' : ''
                  }`}
                  placeholder="tu@universidad.edu"
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-sm text-red-500 dark:text-red-400" role="alert">{errors.email}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="ui-label">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="focus-ring cursor-pointer rounded text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={isLoading}
                  className={`ui-input py-3 transition-colors disabled:opacity-50 ${
                    errors.password ? 'ui-input-error' : ''
                  }`}
                  placeholder="••••••••"
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-sm text-red-500 dark:text-red-400" role="alert">{errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="ui-label mb-1.5">
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isLoading}
                className={`ui-input py-3 transition-colors disabled:opacity-50 ${
                  errors.confirmPassword ? 'ui-input-error' : ''
                }`}
                placeholder="••••••••"
                aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
              />
              {errors.confirmPassword && (
                <p id="confirm-error" className="mt-1.5 text-sm text-red-500 dark:text-red-400" role="alert">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="ui-btn ui-btn-primary w-full py-3 text-base"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creando cuenta...
                </>
              ) : (
                'Crear cuenta'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              ¿Ya tienes cuenta?{' '}
              <a href="/login" className="focus-ring rounded text-emerald-600 font-medium transition-colors hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
                Inicia sesión
              </a>
            </p>
          </div>
        </motion.div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            SIGE-TdeA &copy; 2026
          </p>
        </div>
      </div>
    </div>
  )
}
