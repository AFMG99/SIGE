import type { Variants } from 'framer-motion'

/**
 * Variantes compartidas del módulo de datos (Motion UI).
 * Mismo lenguaje de easing que login/register para que toda la
 * aplicación se mueva con el mismo carácter.
 */
export const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

/** Entrada base: sube 16px y se desvanece. */
export const revealUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

/** Contenedor que escona a sus hijos `revealUp`. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

/** Revela con blur (títulos). */
export const revealBlur: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: EASE } },
}
