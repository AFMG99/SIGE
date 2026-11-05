'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

interface Props {
  userName: string
}

export function LogoutContent({ userName }: Props) {
  const router = useRouter()
  const [saliendo, setSaliendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogout() {
    if (saliendo) return

    setSaliendo(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) {
        throw new Error('No fue posible cerrar la sesión. Inténtalo nuevamente.')
      }
      router.replace('/login')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al cerrar la sesión.'
      )
      setSaliendo(false)
    }
  }

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-950/30 via-black to-black"
      />

      <motion.section
        aria-labelledby="logout-title"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8 text-center"
      >
        <div
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-950/40"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="size-8 text-emerald-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 019 9.601a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18a3.75 3.75 0 00.495-7.468 5.99 5.99 0 00-1.925 3.547 5.975 5.975 0 01-2.133-1.001A3.75 3.75 0 0012 18z"
            />
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <h1 id="logout-title" className="text-xl font-semibold text-white">
            ¿Cerrar sesión?
          </h1>
          <p className="text-sm text-white/60">
            Has iniciado sesión como{' '}
            <span className="break-all text-emerald-400">{userName}</span>
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={handleLogout}
            disabled={saliendo}
            className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saliendo ? 'Cerrando sesión…' : 'Sí, cerrar sesión'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            disabled={saliendo}
            className="w-full rounded-xl border border-white/15 bg-white/5 py-3 font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
      </motion.section>
    </main>
  )
}
