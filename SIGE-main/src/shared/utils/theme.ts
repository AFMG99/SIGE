'use client'

/**
 * Dark mode helpers for class-based strategy.
 * - Reads localStorage 'uv-theme' (values: 'light' | 'dark')
 * - Falls back to prefers-color-scheme
 * - Persists toggle to localStorage and updates document.documentElement.classList
 */

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'uv-theme'
const MEDIA_QUERY = '(prefers-color-scheme: dark)'

/**
 * Initialize theme on client mount.
 * Must be called in a useEffect to avoid SSR mismatch.
 */
export function initTheme(): void {
  if (typeof window === 'undefined') return

  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  const prefersDark = window.matchMedia(MEDIA_QUERY).matches
  const initialTheme = stored ?? (prefersDark ? 'dark' : 'light')

  applyTheme(initialTheme)
}

/**
 * Toggle theme and persist.
 */
export function toggleTheme(): void {
  if (typeof window === 'undefined') return

  const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  const next = current === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  localStorage.setItem(STORAGE_KEY, next)
}

/**
 * Set an explicit theme and persist (used by the Settings page, where the
 * user picks light/dark instead of toggling).
 */
export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  applyTheme(theme)
  localStorage.setItem(STORAGE_KEY, theme)
}

/**
 * Apply theme to document root.
 */
function applyTheme(theme: Theme): void {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

/**
 * Get current theme without side effects.
 */
export function getCurrentTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * Subscribe to system preference changes (when no explicit user choice).
 */
export function subscribeToSystemTheme(callback: (theme: Theme) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const mediaQuery = window.matchMedia(MEDIA_QUERY)
  const handler = (e: MediaQueryListEvent) => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      callback(e.matches ? 'dark' : 'light')
    }
  }

  mediaQuery.addEventListener('change', handler)
  return () => mediaQuery.removeEventListener('change', handler)
}