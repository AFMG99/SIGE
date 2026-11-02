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

  async function handleLogout() {
    setSaliendo(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-black flex items-center justify-center px-4">
      {/* Fondo con gradiente sutil */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/30 via-black to-black pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 flex flex-col items-center gap-8 text-center max-w-sm w-full"
      >
        {/* Ícono hoja / energía */}
        <div className="size-16 rounded-full border border-emerald-500/30 bg-emerald-950/40 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-8 text-emerald-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 009 9.601a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.468 5.99 5.99 0 00-1.925 3.547 5.975 5.975 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-white text-xl font-semibold">
            ¿Cerrar sesión?
          </h1>
          <p className="text-white/50 text-sm">
            Has iniciado sesión como <span className="text-emerald-400">{userName}</span>
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleLogout}
            disabled={saliendo}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium py-3 transition-colors"
          >
            {saliendo ? 'Cerrando sesión…' : 'Sí, cerrar sesión'}
          </button>
          <button
            onClick={() => router.back()}
            disabled={saliendo}
            className="w-full rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-60 text-white/70 hover:text-white font-medium py-3 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  )
}