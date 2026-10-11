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
      <div className="ui-callout ui-callout-warning">
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleDownload}
          className="ui-btn ui-btn-primary flex-1 cursor-pointer"
        >
          Descargar códigos
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="ui-btn flex-1 cursor-pointer"
        >
          {copied ? 'Copiados al portapapeles' : 'Copiar códigos'}
        </button>
        {onComplete && (
          <button
            type="button"
            onClick={onComplete}
            disabled={!saved}
            className="ui-btn flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saved ? 'Ya los guardé, continuar' : 'Guarda los códigos primero'}
          </button>
        )}
      </div>
    </div>
  )
}
