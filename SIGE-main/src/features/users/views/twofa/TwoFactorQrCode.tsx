'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface TwoFactorQrCodeProps {
  otpauthUri: string
  secret: string
}

export function TwoFactorQrCode({ otpauthUri, secret }: TwoFactorQrCodeProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false

    QRCode.toString(otpauthUri, { type: 'svg', margin: 1, width: 220, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((result) => {
        if (!cancelled) setSvg(result)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo generar el código QR')
      })

    return () => {
      cancelled = true
    }
  }, [otpauthUri])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('No se pudo copiar la clave')
    }
  }

  if (error) {
    return (
      <div className="ui-callout ui-callout-danger" role="alert">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        {svg ? (
          <div
            className="rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 [&>svg]:h-auto [&>svg]:w-[220px]"
            // The SVG is generated locally from our own otpauth URI — no user input.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="h-[236px] w-[236px] animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
        )}
      </div>

      <div className="ui-callout">
        <p className="ui-title text-sm">¿No puedes escanear?</p>
        <p className="ui-muted mt-1 text-sm">Introduce esta clave manualmente en tu app de autenticación:</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 select-all break-all rounded bg-gray-100 px-2 py-1 font-mono text-xs dark:bg-slate-800">
            {secret}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="focus-ring shrink-0 cursor-pointer rounded px-2 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            {copied ? 'Copiada' : 'Copiar'}
          </button>
        </div>
      </div>
    </div>
  )
}
