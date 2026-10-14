/**
 * Fase 2b — dashboard inicial como vista de inicio (T3).
 *
 * Contracts protected here:
 *  1. SECURITY (non-negotiable): the energy summary is only rendered — and
 *     its queries are only launched — for users with access to the
 *     `consumption` module (static matrix + temporary overrides through
 *     `canWithOverrides`). A role without access sees NO energy number.
 *     The gate lives in the real Server Component (`page.tsx`) with Prisma
 *     and the session mocked: that is where the authorization check runs.
 *  2. Module cards: same visibility and same order as `ModuleNav`
 *     (the exported `isItemVisible`, not a parallel gating implementation)
 *     and never a card linking to the home itself.
 *  3. Preservation (S1): name, email, role, "member since" and ID stay.
 *  4. Responsive: no horizontal overflow at 320 / 375 / 768 / 1024 / 1280 /
 *     1920 and module cards ≥ 40px tall below `lg`.
 *
 * A failing assertion is never fixed by lowering a threshold.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'

import '@/app/globals.css'

// --- Next mocks (the page is an App Router Server Component) ----------------
vi.mock(
  'next/link',
  async () => {
    const { createElement } = await import('react')
    const LinkMock = ({
      href,
      children,
      ...rest
    }: {
      href?: unknown
      children?: React.ReactNode
      className?: string
      title?: string
      'aria-label'?: string
    }) =>
      createElement(
        'a',
        { href: typeof href === 'string' ? href : '#', ...rest },
        children
      )
    return { __esModule: true, default: LinkMock }
  }
)

vi.mock('next/navigation', () => ({
  __esModule: true,
  redirect: (route: string) => {
    throw new Error(`unexpected redirect: ${route}`)
  },
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// --- Backend doubles: session, user row, permission overrides, counts -------
const estado = vi.hoisted(() => ({
  session: { userId: 'ckuser0000000000000000' } as { userId: string } | null,
  user: {
    id: 'ckuser0000000000000000',
    name: 'Ana Torres',
    email: 'ana.torres@tecnologicoantioquia.edu.co',
    role: 'ADMIN_TI',
    createdAt: new Date('2025-06-01T12:00:00.000Z'),
  },
  overrides: [] as Array<{ moduleId: string; action: string; expiresAt: Date | null }>,
  facturas: 48,
  ultimoPeriodo: '2026-08' as string | null,
  edificaciones: 4,
  bloques: 9,
  /** Energy queries launched during one test — must be 0 without permission. */
  energyQueries: 0,
}))

vi.mock('@/shared/models/auth', () => ({
  getSession: async () => estado.session,
}))

vi.mock('@/shared/models/prisma', () => ({
  prisma: {
    user: { findUnique: async () => estado.user },
    userPermissionOverride: {
      findMany: async () => estado.overrides,
      findFirst: async () => (estado.overrides.length > 0 ? { id: 'override-1' } : null),
    },
    facturaEnergia: {
      count: async () => {
        estado.energyQueries += 1
        return estado.facturas
      },
      findFirst: async () => {
        estado.energyQueries += 1
        return estado.ultimoPeriodo === null ? null : { periodo: estado.ultimoPeriodo }
      },
    },
    edificacion: {
      count: async () => {
        estado.energyQueries += 1
        return estado.edificaciones
      },
    },
    bloque: {
      count: async () => {
        estado.energyQueries += 1
        return estado.bloques
      },
    },
  },
}))

// --- Component under test: the real Server Component ------------------------
async function renderHome(): Promise<void> {
  const { default: DashboardPage } = await import('@/app/dashboard/page')
  const tree = await DashboardPage()
  render(tree)
}

const RESUMEN = 'section[aria-labelledby="home-resumen"]'

function bodyText(): string {
  return document.body.innerText
}

async function present(selector: string): Promise<HTMLElement> {
  return vi.waitFor(
    () => {
      const el = document.querySelector<HTMLElement>(selector)
      expect(el, `expected element ${selector}`).not.toBeNull()
      return el as HTMLElement
    },
    { timeout: 5000 }
  )
}

function horizontalOverflow(): number {
  const root = document.documentElement
  return root.scrollWidth - root.clientWidth
}

async function setViewport(width: number, height: number) {
  await page.viewport(width, height)
  await vi.waitFor(
    () => {
      expect(window.innerWidth).toBeLessThanOrEqual(width)
    },
    { timeout: 5000 }
  )
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

beforeEach(() => {
  cleanup()
  estado.session = { userId: 'ckuser0000000000000000' }
  estado.user = {
    id: 'ckuser0000000000000000',
    name: 'Ana Torres',
    email: 'ana.torres@tecnologicoantioquia.edu.co',
    role: 'ADMIN_TI',
    createdAt: new Date('2025-06-01T12:00:00.000Z'),
  }
  estado.overrides = []
  estado.facturas = 48
  estado.ultimoPeriodo = '2026-08'
  estado.edificaciones = 4
  estado.bloques = 9
  estado.energyQueries = 0
})
afterEach(() => cleanup())

describe('Home view — energy summary permission gate', () => {
  beforeEach(async () => {
    await setViewport(1280, 800)
  })

  it('ADMIN_TI sees the summary with an explicit period, its identity and the module cards in nav order', async () => {
    await renderHome()
    await present('main h1')

    // Identity preserved (S1): name, email, role, member-since and truncated ID
    expect(bodyText()).toContain('Ana Torres')
    expect(bodyText()).toContain('ana.torres@tecnologicoantioquia.edu.co')
    expect(bodyText()).toContain('Administrador (TI)')
    expect(bodyText()).toContain('junio de 2025')
    expect(bodyText()).toContain('ckuser000000')

    // Real summary (S4): counts from the mocked DB, period always explicit.
    // Labels use `text-transform: uppercase`, so compare lowercased.
    const resumen = await present(RESUMEN)
    const resumenText = resumen.innerText.toLowerCase()
    expect(resumenText).toContain('facturas registradas')
    expect(resumenText).toMatch(/\b48\b/)
    expect(resumenText).toContain('último periodo')
    expect(resumenText).toContain('2026-08')
    expect(resumenText).toContain('edificaciones')
    expect(resumenText).toContain('bloques')
    expect(estado.energyQueries).toBeGreaterThan(0)

    // Module cards: same visibility + order as ModuleNav, home excluded.
    // ADMIN_TI: users, consumption, analisis (consumption), alertas (no module),
    // plans — estimates/reports are denied by the matrix.
    const hrefs = Array.from(document.querySelectorAll('main a')).map((a) =>
      a.getAttribute('href')
    )
    expect(hrefs).toEqual([
      '/dashboard/users',
      '/dashboard/datos',
      '/dashboard/analisis',
      '/dashboard/alertas',
      '/dashboard/espacial',
    ])
    expect(hrefs).not.toContain('/dashboard')
  })

  it('COMUNIDAD_UNIVERSITARIA: no energy query runs and no energy number is rendered', async () => {
    estado.user.role = 'COMUNIDAD_UNIVERSITARIA'
    await renderHome()
    await present('main h1')

    // The gate must sit before the queries, not only before the rendering
    expect(estado.energyQueries).toBe(0)
    expect(document.querySelector(RESUMEN)).toBeNull()
    const texto = bodyText().toLowerCase()
    expect(texto).not.toContain('resumen energético')
    expect(texto).not.toContain('último periodo')
    expect(texto).not.toContain('facturas registradas')
    // Nor a card to the module it cannot access (same gating as ModuleNav)
    expect(document.querySelector('main a[href="/dashboard/datos"]')).toBeNull()
  })

  it('a temporary override on consumption does enable the summary (canWithOverrides)', async () => {
    estado.user.role = 'COMUNIDAD_UNIVERSITARIA'
    estado.overrides = [{ moduleId: 'consumption', action: 'read', expiresAt: null }]

    await renderHome()
    await present(RESUMEN)

    expect(estado.energyQueries).toBe(4)
    expect(document.querySelector('main a[href="/dashboard/datos"]')).not.toBeNull()
  })

  it('with zero invoices: useful empty state with an action into the data module', async () => {
    estado.facturas = 0
    estado.ultimoPeriodo = null

    await renderHome()
    const vacio = await present('.ui-empty')

    expect(vacio.innerText).toContain('facturas')
    expect(vacio.querySelector('a[href="/dashboard/datos"]')).not.toBeNull()
    expect(bodyText()).toContain('Sin registros')
  })
})

describe('Home view — responsive', () => {
  const VIEWPORTS = [
    { nombre: 'xs 320', width: 320, height: 568 },
    { nombre: 'móvil 375', width: 375, height: 812 },
    { nombre: 'tablet 768', width: 768, height: 1024 },
    { nombre: 'laptop 1024', width: 1024, height: 768 },
    { nombre: 'desktop 1280', width: 1280, height: 800 },
    { nombre: 'ancho 1920', width: 1920, height: 1080 },
  ]

  describe.each(VIEWPORTS)('$nombre', ({ width, height }) => {
    beforeEach(async () => {
      await setViewport(width, height)
    })

    it('the document does not overflow horizontally', async () => {
      await renderHome()
      await present('main h1')
      expect(horizontalOverflow()).toBeLessThanOrEqual(1)
    })

    it.skipIf(width >= 1024)('module cards are at least 40px tall', async () => {
      await renderHome()
      await present('main h1')
      const cards = Array.from(document.querySelectorAll<HTMLElement>('main a'))
      expect(cards.length).toBeGreaterThan(0)
      for (const card of cards) {
        expect(card.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
      }
      expect(horizontalOverflow()).toBeLessThanOrEqual(1)
    })
  })
})
