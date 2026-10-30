'use client'

import { useState } from 'react'

interface BackupCodesDisplayProps {
  codes: string[]
  onComplete?: () => void
}

export function BackupCodesDisplay({ codes, onComplete }: BackupCodesDisplayProps) {
  const [downloaded, setDownloaded] = useState(false)
  const [copied, setCopied] = useState(false)
  const saved = downloaded || copied

  const codesText = codes.join('\n')

  const handleDownload = () => {
    const content = [
      'SIGE - Códigos de respaldo de 2FA',
      'Generados: ' + new Date().toLocaleString(),
      '',
      'Cada código sirve UNA sola vez si pierdes acceso a tu app de autenticación.',
      'Guárdalos en un lugar seguro y accesible offline.',
      '',
      ...codes,
      '',
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sige-2fa-backup-codes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setDownloaded(true)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codesText)
      setCopied(true)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = codesText
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
    }
  }

  return (
    <div className="space-y-4">
      <div className="ui-callout ui-callout-warn">
        <p className="ui-title text-sm">Guarda estos códigos ahora</p>
        <p className="ui-muted mt-1 text-sm">
          Se muestran una sola vez. Cada código sirve una sola vez si pierdes acceso a tu app de
          autenticación. Descárgalos o cópialos a un lugar seguro (gestor de contraseñas, papel, etc.).
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-2" role="list">
        {codes.map((code, index) => (
          <li
            key={code}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm tracking-wider text-gray-800 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200"
          >
            <span className="ui-muted mr-2 text-xs">{index + 1}.</span>
            {code}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleDownload}
          className="ui-btn ui-btn-primary flex-1 cursor-pointer gap-2 py-3 text-sm font-semibold"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {downloaded ? 'Descargado' : 'Descargar'}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="ui-btn ui-btn-accent flex-1 py-3 font-semibold"
        >
          {copied ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copiado
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copiar
            </>
          )}
        </button>
        {onComplete && (
          <button
            type="button"
            onClick={onComplete}
            disabled={!saved}
            className="ui-btn flex-1 cursor-pointer gap-2 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saved ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
                Continuar
              </>
            ) : (
              'Guarda los códigos primero'
            )}
          </button>
        )}
      </div>
    </div>
  )
}
