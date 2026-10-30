'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { TwoFactorQrCode } from './TwoFactorQrCode'
import { TwoFactorCodeForm } from './TwoFactorCodeForm'
import { BackupCodesDisplay } from './BackupCodesDisplay'

type Step = 'intro' | 'qr' | 'backup' | 'done'

interface TwoFactorEnrollmentProps {
  // When true the user cannot skip: their role mandates 2FA and they are
  // redirected here before reaching the dashboard.
  required?: boolean
  onCompleted?: () => void
}

export function TwoFactorEnrollment({ required = false, onCompleted }: TwoFactorEnrollmentProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('intro')
  const [secret, setSecret] = useState('')
  const [otpauthUri, setOtpauthUri] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const startSetup = async () => {
    setError('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Error al iniciar la configuración')
      setSecret(data.secret)
      setOtpauthUri(data.otpauthUri)
      setStep('qr')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const confirmCode = async (code: string) => {
    const res = await fetch('/api/auth/2fa/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Código incorrecto')
    setBackupCodes(data.backupCodes)
    setStep('backup')
  }

  const finish = () => {
    setStep('done')
    if (onCompleted) {
      onCompleted()
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="relative z-10 w-full max-w-md mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="bg-white/95 backdrop-blur-xl rounded-3xl border border-white/30 shadow-2xl p-8 dark:border-white/10 dark:bg-slate-900/90"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-light text-gray-900 tracking-tight dark:text-gray-50">
            {step === 'intro' && 'Protege tu cuenta'}
            {step === 'qr' && 'Escanea el código QR'}
            {step === 'backup' && 'Códigos de respaldo'}
            {step === 'done' && '¡2FA activado!'}
          </h1>
          <p className="ui-muted mt-2 text-sm">
            {step === 'intro' && (required
              ? 'Tu rol requiere autenticación de dos factores (2FA). Configúrala para continuar.'
              : 'Activa la autenticación de dos factores para añadir una capa extra de seguridad.')}
            {step === 'qr' && 'Usa Google Authenticator, Authy, 1Password u otra app compatible.'}
            {step === 'backup' && 'Guarda estos códigos en un lugar seguro.'}
            {step === 'done' && 'Tu cuenta está protegida con 2FA.'}
          </p>
        </div>

        {error && (
          <div className="ui-callout ui-callout-danger mb-6" role="alert">
            {error}
          </div>
        )}

        {step === 'intro' && (
          <div className="space-y-4">
            <ul className="space-y-3 text-sm" role="list">
              <li className="flex gap-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="ui-muted">Al iniciar sesión deberás introducir además un código de 6 dígitos de tu app.</span>
              </li>
              <li className="flex gap-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="ui-muted">Recibirás códigos de respaldo por si pierdes acceso a tu teléfono.</span>
              </li>
            </ul>
            <button
              type="button"
              onClick={startSetup}
              disabled={isLoading}
              className="ui-btn ui-btn-primary w-full py-3 text-base"
            >
              {isLoading ? 'Preparando...' : 'Configurar 2FA'}
            </button>
          </div>
        )}

        {step === 'qr' && (
          <div className="space-y-6">
            <TwoFactorQrCode otpauthUri={otpauthUri} secret={secret} />
            <div className="border-t border-gray-100 pt-6 dark:border-slate-800">
              <p className="ui-title text-sm mb-3">Introduce el código de 6 dígitos para confirmar</p>
              <TwoFactorCodeForm onSubmit={confirmCode} submitLabel="Activar 2FA" showBackupHint={false} />
            </div>
          </div>
        )}

        {step === 'backup' && <BackupCodesDisplay codes={backupCodes} onComplete={finish} />}

        {step === 'done' && (
          <div className="space-y-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="ui-muted text-sm">La próxima vez que inicies sesión necesitarás un código de tu app de autenticación.</p>
            <button
              type="button"
              onClick={finish}
              className="ui-btn ui-btn-primary w-full py-3 text-base"
            >
              Continuar
            </button>
          </div>
        )}
      </motion.div>

      <div className="mt-8 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">SIGE-TdeA &copy; 2026</p>
      </div>
    </div>
  )
}
