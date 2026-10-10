'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { TreeCanopyAnimation } from '@/shared/views/TreeCanopyAnimation'
import { EnergyLoader } from '@/shared/views/EnergyLoader'
import { SkipDropButton } from '@/shared/views/SkipDropButton'
import { LoginForm } from '@/features/users/views/LoginForm'
import { toggleTheme, getCurrentTheme } from '@/shared/utils/theme'

const TREE_DURATION = 8000   // ramas crecen ~8s
const ENERGY_DURATION = 7000  // cargador verde ~7s, explota y dispersa

// ============================================
// IMAGEN DE LA UNIVERSIDAD
// Coloca tu imagen en public/university/ y pon aquí la ruta.
// Si la imagen no existe, se usa la silueta procedural automáticamente.
// ============================================
const UNIVERSITY_IMAGE = '/university/campus.webp'
const IMAGE_BLUR = 10        // px de desenfoque (0 = nítida)
const IMAGE_OPACITY = 0.58   // 0..1 opacidad sobre el fondo

export default function LoginPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [animationComplete, setAnimationComplete] = useState(false)
  const [energyDone, setEnergyDone] = useState(false)
  const [dropGone, setDropGone] = useState(false)
  const [dropExploding, setDropExploding] = useState(false)
  const [dark, setDark] = useState(false)

  // Sync icon with the theme applied by the layout anti-flash script.
  useEffect(() => {
    setDark(getCurrentTheme() === 'dark')
  }, [])

  const handleThemeToggle = () => {
    toggleTheme()
    setDark(getCurrentTheme() === 'dark')
  }

  useEffect(() => {
    // Safety: force-complete at 12s
    const timer = setTimeout(() => {
      if (!animationComplete) {
        setAnimationComplete(true)
        setShowLogin(true)
        setDropGone((g) => (dropExploding ? g : true))
      }
    }, 12000)
    return () => clearTimeout(timer)
  }, [animationComplete, dropExploding])

  const handleAnimationComplete = useCallback(() => {
    setAnimationComplete(true)
    setShowLogin(true)
    // drop disappears without explosion — unless user pressed it (it's bursting)
    setDropGone((g) => (dropExploding ? g : true))
  }, [dropExploding])

  const handleEnergyComplete = useCallback(() => {
    setEnergyDone(true)
    // Show login when energy explosion has dispersed AND trees are done (or close)
    setShowLogin(prev => {
      return animationComplete || true
    })
  }, [animationComplete])

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-black">
      {/* Theme toggle: fixed top-right. The login scene is always dark, so the
          always-dark glass style from the header works in both themes. */}
      <button
        type="button"
        onClick={handleThemeToggle}
        aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        title={dark ? 'Tema claro' : 'Tema oscuro'}
        className="fixed right-4 top-4 z-[60] grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-white/15 bg-white/10 text-emerald-50 backdrop-blur transition-colors hover:border-white/30 hover:bg-white/20 hover:text-white focus-ring"
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

      {/* Layer 0: Tree canopy animation — stays visible after completion */}
      <TreeCanopyAnimation
        onComplete={handleAnimationComplete}
        duration={TREE_DURATION}
        universityImage={UNIVERSITY_IMAGE}
        imageBlur={IMAGE_BLUR}
        imageOpacity={IMAGE_OPACITY}
      />

      {/* Layer 20: Energy loader — charges green, explodes, particles disperse.
          Disappears when showLogin becomes true. */}
      {!showLogin && (
        <EnergyLoader
          active={!showLogin}
          duration={ENERGY_DURATION}
          onComplete={handleEnergyComplete}
        />
      )}

      {/* Layer 10: Login form — revealed after animation + energy done */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        {showLogin && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full"
          >
            <LoginForm />
          </motion.div>
        )}
      </div>

      {/* Skip = single water drop with university reflection.
          Press → drop explodes into particles → disappears.
          Stays mounted during the explosion (dropGone only after burst ends). */}
      {!dropGone && (
        <SkipDropButton
          onSkip={() => {
            setAnimationComplete(true)
            setEnergyDone(true)
            setShowLogin(true)
            setDropExploding(true)
            // dropGone NOT set — drop stays mounted to finish its burst
          }}
          onExploded={() => setDropGone(true)}
          universityImage={UNIVERSITY_IMAGE}
          imageBlur={IMAGE_BLUR}
          size={92}
        />
      )}
    </div>
  )
}