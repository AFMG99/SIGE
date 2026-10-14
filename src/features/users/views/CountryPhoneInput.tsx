'use client'

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react'

/**
 * Phone input with a country dial-code selector.
 *
 * Data source: world-countries via jsDelivr CDN (free, no API key, CORS *).
 * Normalized list is cached in sessionStorage (≈15 KB) after the first fetch.
 * Flags: flagcdn.com (free flag CDN, no key).
 * Fallback: embedded list of ~33 countries if the CDN is unreachable.
 */

export interface CountryOption {
  cca2: string
  name: string
  dial: string
}

const DATA_URL = 'https://cdn.jsdelivr.net/npm/world-countries/countries.json'
const CACHE_KEY = 'uv-country-phone-list-v1'
const FETCH_TIMEOUT_MS = 8000

const flagUrl = (cca2: string) => `https://flagcdn.com/w40/${cca2.toLowerCase()}.png`

// Embedded fallback (used only when the CDN fetch fails).
const FALLBACK_COUNTRIES: CountryOption[] = [
  { cca2: 'AR', name: 'Argentina', dial: '+54' },
  { cca2: 'AU', name: 'Australia', dial: '+61' },
  { cca2: 'BO', name: 'Bolivia', dial: '+591' },
  { cca2: 'BR', name: 'Brasil', dial: '+55' },
  { cca2: 'CA', name: 'Canadá', dial: '+1' },
  { cca2: 'CL', name: 'Chile', dial: '+56' },
  { cca2: 'CN', name: 'China', dial: '+86' },
  { cca2: 'CO', name: 'Colombia', dial: '+57' },
  { cca2: 'CR', name: 'Costa Rica', dial: '+506' },
  { cca2: 'CU', name: 'Cuba', dial: '+53' },
  { cca2: 'DO', name: 'República Dominicana', dial: '+1809' },
  { cca2: 'EC', name: 'Ecuador', dial: '+593' },
  { cca2: 'ES', name: 'España', dial: '+34' },
  { cca2: 'SV', name: 'El Salvador', dial: '+503' },
  { cca2: 'FR', name: 'Francia', dial: '+33' },
  { cca2: 'GT', name: 'Guatemala', dial: '+502' },
  { cca2: 'HN', name: 'Honduras', dial: '+504' },
  { cca2: 'IN', name: 'India', dial: '+91' },
  { cca2: 'IT', name: 'Italia', dial: '+39' },
  { cca2: 'JP', name: 'Japón', dial: '+81' },
  { cca2: 'MX', name: 'México', dial: '+52' },
  { cca2: 'NI', name: 'Nicaragua', dial: '+505' },
  { cca2: 'PA', name: 'Panamá', dial: '+507' },
  { cca2: 'PE', name: 'Perú', dial: '+51' },
  { cca2: 'PR', name: 'Puerto Rico', dial: '+1787' },
  { cca2: 'PT', name: 'Portugal', dial: '+351' },
  { cca2: 'PY', name: 'Paraguay', dial: '+595' },
  { cca2: 'RU', name: 'Rusia', dial: '+7' },
  { cca2: 'US', name: 'Estados Unidos', dial: '+1' },
  { cca2: 'UY', name: 'Uruguay', dial: '+598' },
  { cca2: 'VE', name: 'Venezuela', dial: '+58' },
  { cca2: 'GB', name: 'Reino Unido', dial: '+44' },
  { cca2: 'DE', name: 'Alemania', dial: '+49' },
]

interface Idd {
  root?: string
  suffixes?: string[]
}

/**
 * E.164 dial code from ISO 3166 idd metadata:
 * - one suffix  → root + suffix (ES: +3·4 → +34)
 * - many suffixes → root only (US/CA: +1, RU: +7 are shared area-code families)
 */
function dialFromIdd(idd?: Idd): string | null {
  if (!idd?.root) return null
  const suffixes = (idd.suffixes ?? []).filter((s) => typeof s === 'string' && s.length > 0)
  const dial = suffixes.length === 1 ? idd.root + suffixes[0] : idd.root
  return /^\+\d{1,4}$/.test(dial) ? dial : null
}

async function loadCountries(): Promise<CountryOption[]> {
  // 1) session cache
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached) as CountryOption[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // ignore storage errors
  }

  // 2) CDN fetch
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(DATA_URL, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(String(res.status))
    const raw = (await res.json()) as Array<{
      cca2?: string
      translations?: { spa?: { common?: string } }
      name?: { common?: string }
      idd?: Idd
    }>
    const list: CountryOption[] = []
    for (const item of raw) {
      const dial = dialFromIdd(item.idd)
      const cca2 = typeof item.cca2 === 'string' ? item.cca2 : ''
      const name = item.translations?.spa?.common || item.name?.common
      if (!dial || !cca2 || !name) continue
      list.push({ cca2, name, dial })
    }
    if (list.length === 0) throw new Error('empty list')
    list.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(list))
    } catch {
      // quota — still usable for this session
    }
    return list
  } catch {
    // 3) fallback
    return [...FALLBACK_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }
}

interface CountryPhoneInputProps {
  inputId: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  placeholder?: string
}

/** Split "+57 300 123 4567" → { dial: '+57', national: '300 123 4567' } */
function splitPhone(value: string): { dial: string | null; national: string } {
  const match = value.trim().match(/^(\+\d{1,4})[\s\-()]*([\d\s\-()]*)$/)
  if (match) return { dial: match[1], national: match[2].trim() }
  return { dial: null, national: value.trim() }
}

export function CountryPhoneInput({
  inputId,
  value,
  onChange,
  onBlur,
  disabled = false,
  invalid = false,
  describedBy,
  placeholder = '600 000 000',
}: CountryPhoneInputProps) {
  const [countries, setCountries] = useState<CountryOption[] | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Colocación del listbox: se calcula contra el viewport para que nunca sobresalga
  // de la pantalla (flip hacia arriba si abajo no cabe, clamp horizontal y `max-height`
  // al espacio libre). Todo en coordenadas del root, que es el bloque de posición.
  const [panel, setPanel] = useState({
    arriba: false,
    y: 0,
    left: 0,
    ancho: 304,
    altura: 320,
  })

  useLayoutEffect(() => {
    if (!open) return
    const EDGE = 8
    const GAP = 4
    const ANCHO = 304 // 19rem

    const medir = () => {
      const root = rootRef.current
      if (!root) return
      const r = root.getBoundingClientRect()
      const espacioAbajo = window.innerHeight - r.bottom - GAP - EDGE
      const espacioArriba = r.top - GAP - EDGE
      const arriba = espacioAbajo < 240 && espacioArriba > espacioAbajo
      const espacio = Math.max(0, arriba ? espacioArriba : espacioAbajo)
      const ancho = Math.min(ANCHO, window.innerWidth - 2 * EDGE)
      const bordeDcho = Math.max(EDGE, window.innerWidth - ancho - EDGE)
      const left = Math.min(Math.max(r.left, EDGE), bordeDcho) - r.left
      const siguiente = {
        arriba,
        y: r.height + GAP,
        left,
        ancho,
        altura: Math.min(320, espacio),
      }
      setPanel((prev) =>
        prev.arriba === siguiente.arriba &&
        prev.y === siguiente.y &&
        prev.left === siguiente.left &&
        prev.ancho === siguiente.ancho &&
        prev.altura === siguiente.altura
          ? prev
          : siguiente
      )
    }

    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [open])

  const initial = splitPhone(value)
  // Default country: Colombia (+57) — overridden when the value carries its own dial code.
  const [selectedCca2, setSelectedCca2] = useState<string | null>('CO')

  useEffect(() => {
    let alive = true
    void loadCountries().then((list) => {
      if (!alive) return
      setCountries(list)
      // Resolve dial → country on first load (for hydrated edit values).
      if (initial.dial) {
        // Prefer US for +1 and RU for +7 when several countries share the code.
        const matches = list.filter((c) => c.dial === initial.dial)
        const preferred =
          matches.find((c) => (initial.dial === '+1' && c.cca2 === 'US') || (initial.dial === '+7' && c.cca2 === 'RU')) ||
          matches[0]
        if (preferred) setSelectedCca2(preferred.cca2)
      }
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    const t = setTimeout(() => searchRef.current?.focus(), 0)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open])

  const selected = useMemo(() => {
    if (countries) return countries.find((c) => c.cca2 === selectedCca2) ?? null
    // While the list loads, still resolve the Colombia default immediately.
    return selectedCca2 === 'CO' ? { cca2: 'CO', name: 'Colombia', dial: '+57' } : null
  }, [countries, selectedCca2])

  const filtered = useMemo(() => {
    if (!countries) return []
    const q = query.trim().toLowerCase()
    if (!q) return countries
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.cca2.toLowerCase() === q
    )
  }, [countries, query])

  // Current national digits (as displayed)
  const currentNational = (() => {
    const parts = splitPhone(value)
    return parts.national
  })()

  const emit = useCallback(
    (dial: string | null, national: string) => {
      const digits = national.replace(/[^\d\s\-()]/g, '').trim()
      // Country picked but no digits yet → keep the value empty so the
      // phone schema (optional) does not flag a bare "+57" as invalid.
      if (dial && digits) onChange(`${dial} ${digits}`)
      else onChange(digits)
    },
    [onChange]
  )

  const pickCountry = (country: CountryOption) => {
    setSelectedCca2(country.cca2)
    emit(country.dial, currentNational)
    setOpen(false)
    setQuery('')
  }

  const handleInput = (raw: string) => {
    const digits = raw.replace(/[^\d\s\-()]/g, '')
    emit(selected?.dial ?? null, digits)
  }

  return (
    <div ref={rootRef} className="relative flex">
      {/* Country / dial-code selector */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={selected ? `País: ${selected.name} (${selected.dial})` : 'Seleccionar país'}
        className={`focus-ring flex shrink-0 cursor-pointer items-center gap-1.5 rounded-l-xl border border-r-0 px-2.5 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          invalid
            ? 'border-red-300 bg-red-50/40 dark:border-red-700 dark:bg-red-950/30'
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700'
        }`}
      >
        {selected ? (
          <>
            <img
              src={flagUrl(selected.cca2)}
              alt=""
              width={20}
              height={15}
              className="h-[15px] w-5 rounded-[2px] object-cover"
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden'
              }}
            />
            <span className="font-medium text-gray-700 dark:text-gray-200">{selected.dial}</span>
          </>
        ) : (
          <span className="font-medium text-gray-500 dark:text-gray-400">País +</span>
        )}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true" className="text-gray-400">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Number input */}
      <input
        id={inputId}
        type="tel"
        inputMode="tel"
        value={currentNational}
        onChange={(e) => handleInput(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={selected ? placeholder : '+57 300 000 000'}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
        className={`ui-input rounded-l-none rounded-r-xl transition-colors disabled:opacity-60 ${
          invalid ? 'ui-input-error' : ''
        }`}
      />

      {/* Dropdown */}
      {open && (
        <div
          style={{
            ...(panel.arriba ? { bottom: panel.y } : { top: panel.y }),
            left: panel.left,
            width: panel.ancho,
            maxHeight: panel.altura,
          }}
          className="absolute z-30 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl animate-fade-in dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="shrink-0 border-b border-gray-100 p-2 dark:border-slate-800">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar país o código…"
              aria-label="Buscar país"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus-ring dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto py-1" role="listbox" aria-label="Países">
            {!countries && (
              <li className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Cargando países…</li>
            )}
            {countries && filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Sin resultados</li>
            )}
            {filtered.map((c) => (
              <li key={c.cca2}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.cca2 === selectedCca2}
                  onClick={() => pickCountry(c)}
                  className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-500/10 ${
                    c.cca2 === selectedCca2 ? 'bg-emerald-50/70 dark:bg-emerald-500/10' : ''
                  }`}
                >
                  <img
                    src={flagUrl(c.cca2)}
                    alt=""
                    width={20}
                    height={15}
                    loading="lazy"
                    className="h-[15px] w-5 shrink-0 rounded-[2px] object-cover"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden'
                    }}
                  />
                  <span className="flex-1 truncate text-gray-700 dark:text-gray-200">{c.name}</span>
                  <span className="shrink-0 font-medium text-gray-400 dark:text-gray-500">{c.dial}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="shrink-0 border-t border-gray-100 px-3 py-1.5 text-[10px] text-gray-400 dark:border-slate-800 dark:text-gray-500">
            Países: jsDelivr (world-countries) · Banderas: flagcdn.com
          </p>
        </div>
      )}
    </div>
  )
}
