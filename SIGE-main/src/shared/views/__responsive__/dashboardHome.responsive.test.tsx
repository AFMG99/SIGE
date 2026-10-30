/**
 * Fase 2b — dashboard inicial como vista de inicio (T3) + overview estilo
 * dashboard (T2 del rediseño).
 *
 * Contracts protected here:
 *  1. SECURITY (non-negotiable): the energy summary is only rendered — and
 *     its queries are only launched — for users with access to the
 *     `consumption` module (static matrix + temporary overrides through
 *     `canWithOverrides`). A role without access sees NO energy number.
 *     The gate lives in the real Server Component (`page.tsx`) with Prisma
 *     and the session mocked: that is where the authorization check runs.
 *  2. Module carousel (S4): same visibility and same order as `ModuleNav`
 *     (one dot per visible module, never a card linking to the home itself,
 *     active slide = first visible module) — same exported `isItemVisible`
 *     gate, not a parallel implementation.
 *  3. Identity (S4): the view's `h1` lives in the modules section; name and
 *     email no longer render here (they live in the shell/nav).
 *  4. Redesign (S1–S5): KPI cards with real deltas, «consumo vs línea base»
 *     chart, distribution bars, recent-invoices table with LBEn badges and
 *     the ahorro leaderboard — all fed by real aggregates, never invented.
 *  5. Responsive: no horizontal overflow at 320 / 375 / 768 / 1024 / 1280 /
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

// --- Backend doubles: session, user row, permission overrides, aggregates ---
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
  usuariosActivos: 5,
  variablesOperativas: 9,
  usersQueries: 0,
  facturas: 48,
  ultimoPeriodo: '2026-08' as string | null,
  edificaciones: 4,
  bloques: [
    { id: 'cbloque00000000000001', edificacionId: 'cedif00000000000000001' },
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `cbloque${String(i + 2).padStart(16, '0')}`,
      edificacionId: 'cedif00000000000000001',
    })),
  ],
  energyQueries: 0,
  serieBruta: [
    {
      periodo: '2026-08',
      _sum: { consumoNormalizado: 45800, costoCop: 5200000 },
    },
    {
      periodo: '2026-07',
      _sum: { consumoNormalizado: 43300, costoCop: 4900000 },
    },
  ] as Array<{
    periodo: string
    _sum: { consumoNormalizado: number; costoCop: number }
  }>,
  ultimasFacturas: [
    {
      id: 'cfactura000000000000001',
      periodo: '2026-08',
      consumoKwh: 45200,
      consumoNormalizado: 45800,
      costoCop: 5200000,
      diasFacturados: 30,
      edificacion: { id: 'cedif00000000000000001', nombre: 'Campus Norte' },
    },
  ] as Array<Record<string, unknown>>,
  lineasBase: [
    {
      r2: 0.91,
      tipo: 'valor_absoluto',
      coeficientes: {
        lben_mensual: [
          null, null, null, null, null, null, null, 50000, null, null, null, null,
        ],
      },
      bloqueId: 'cbloque00000000000001',
      edificacionId: null,
      bloque: { edificacionId: 'cedif00000000000000001' },
    },
  ] as Array<Record<string, unknown>>,
  nombres: [{ id: 'cedif00000000000000001', nombre: 'Campus Norte' }] as Array<{
    id: string
    nombre: string
  }>,
  porEdifActual: [
    {
      edificacionId: 'cedif00000000000000001',
      _sum: { consumoNormalizado: 45800, costoCop: 5200000 },
    },
  ] as Array<{
    edificacionId: string
    _sum: { consumoNormalizado: number | null; costoCop: number | null }
  }> | null,
  porEdifPrevio: [
    {
      edificacionId: 'cedif00000000000000001',
      _sum: { consumoNormalizado: 43300, costoCop: 4900000 },
    },
  ] as Array<{
    edificacionId: string
    _sum: { consumoNormalizado: number | null; costoCop: number | null }
  }> | null,
}))

vi.mock('@/shared/models/auth', () => ({
  getSession: async () => estado.session,
}))

vi.mock('@/shared/models/prisma', () => ({
  prisma: {
    user: {
      findUnique: async () => estado.user,
      count: async () => {
        estado.usersQueries += 1
        return estado.usuariosActivos
      },
    },
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
      groupBy: async (args: {
        by: string[]
        where?: { periodo?: string }
      }) => {
        estado.energyQueries += 1
        if (args.by.includes('periodo')) return estado.serieBruta
        return args.where?.periodo === '2026-08'
          ? estado.porEdifActual
          : estado.porEdifPrevio
      },
      findMany: async () => {
        estado.energyQueries += 1
        return estado.ultimasFacturas
      },
    },
    edificacion: {
      count: async () => {
        estado.energyQueries += 1
        return estado.edificaciones
      },
      findMany: async () => {
        estado.energyQueries += 1
        return estado.nombres
      },
    },
    bloque: {
      findMany: async () => {
        estado.energyQueries += 1
        return estado.bloques
      },
    },
    lineaBaseEnergia: {
      findMany: async () => {
        estado.energyQueries += 1
        return estado.lineasBase
      },
    },
    variableOperativa: {
      count: async () => {
        // Consumption-domain stat (S4); counts with the energy queries.
        estado.energyQueries += 1
        return estado.variablesOperativas
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
  estado.usuariosActivos = 5
  estado.variablesOperativas = 9
  estado.usersQueries = 0
  estado.facturas = 48
  estado.ultimoPeriodo = '2026-08'
  estado.edificaciones = 4
  estado.bloques = [
    { id: 'cbloque00000000000001', edificacionId: 'cedif00000000000000001' },
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `cbloque${String(i + 2).padStart(16, '0')}`,
      edificacionId: 'cedif00000000000000001',
    })),
  ]
  estado.energyQueries = 0
  estado.serieBruta = [
    { periodo: '2026-08', _sum: { consumoNormalizado: 45800, costoCop: 5200000 } },
    { periodo: '2026-07', _sum: { consumoNormalizado: 43300, costoCop: 4900000 } },
  ]
  estado.ultimasFacturas = [
    {
      id: 'cfactura000000000000001',
      periodo: '2026-08',
      consumoKwh: 45200,
      consumoNormalizado: 45800,
      costoCop: 5200000,
      diasFacturados: 30,
      edificacion: { id: 'cedif00000000000000001', nombre: 'Campus Norte' },
    },
  ]
  estado.lineasBase = [
    {
      r2: 0.91,
      tipo: 'valor_absoluto',
      coeficientes: {
        lben_mensual: [
          null, null, null, null, null, null, null, 50000, null, null, null, null,
        ],
      },
      bloqueId: 'cbloque00000000000001',
      edificacionId: null,
      bloque: { edificacionId: 'cedif00000000000000001' },
    },
  ]
  estado.nombres = [{ id: 'cedif00000000000000001', nombre: 'Campus Norte' }]
  estado.porEdifActual = [
    {
      edificacionId: 'cedif00000000000000001',
      _sum: { consumoNormalizado: 45800, costoCop: 5200000 },
    },
  ]
  estado.porEdifPrevio = [
    {
      edificacionId: 'cedif00000000000000001',
      _sum: { consumoNormalizado: 43300, costoCop: 4900000 },
    },
  ]
})
afterEach(() => cleanup())

describe('Home view — energy summary permission gate', () => {
  beforeEach(async () => {
    await setViewport(1280, 800)
  })

  it('ADMIN_TI sees the overview with real KPIs, chart, table, ranking and the module cards in nav order', async () => {
    await renderHome()
    await present('main h1')

    // S4: identity (name/email) lives in the shell and must not render here;
    // the modules section owns the view's h1 and contains the carousel.
    const carrusel = await present('[aria-roledescription="carrusel"]')
    const h1 = document.querySelector('main h1')
    expect(h1?.getAttribute('id')).toBe('home-modulos')
    expect(
      document
        .querySelector('section[aria-labelledby="home-modulos"]')
        ?.contains(h1)
    ).toBe(true)
    expect(bodyText()).not.toContain('ana.torres@tecnologicoantioquia.edu.co')
    // Same visibility + order as ModuleNav: one dot per visible module.
    // ADMIN_TI: users, consumption, analisis (consumption), alertas (alerts),
    // plans — estimates/reports are denied by the matrix.
    const puntos = Array.from(
      carrusel.querySelectorAll('[aria-label^="Ir al módulo"]')
    ).map((el) => el.getAttribute('aria-label'))
    expect(puntos).toEqual([
      'Ir al módulo Usuarios y acceso',
      'Ir al módulo Gestión de datos',
      'Ir al módulo Análisis estadístico',
      'Ir al módulo Alertas',
      'Ir al módulo Representación espacial',
    ])
    // Active slide = first visible module, with its real server-queried figure
    const enlaceActivo = carrusel.querySelector('a')
    expect(enlaceActivo?.getAttribute('href')).toBe('/dashboard/users')
    expect(enlaceActivo?.textContent).toContain('usuarios activos')
    expect(enlaceActivo?.textContent).toContain('5')
    expect(estado.usersQueries).toBeGreaterThan(0)

    // Redesigned overview (S1/S2): real aggregates only.
    const resumen = await present(RESUMEN)
    const texto = resumen.innerText.toLowerCase()
    expect(texto).toContain('consumo · ago 26')
    expect(texto).toContain('45.800 kwh')
    expect(texto).toContain('costo · ago 26')
    expect(texto).toContain('ahorro vs línea base')
    expect(texto).toContain('4.200 kwh')
    expect(texto).toContain('cobertura lben')
    expect(texto).toContain('1 / 9')

    // Chart: two real series (real vs LBEn) drawn on the figure
    const figura = await present(`${RESUMEN} figure svg[viewBox^="0 0 720"]`)
    expect(figura.querySelectorAll('path').length).toBeGreaterThan(0)

    // Distribution bars + recent invoices table + leaderboard
    await present(`${RESUMEN} [role="meter"]`)
    expect(resumen.querySelectorAll('[role="meter"]').length).toBeGreaterThan(0)
    await present(`${RESUMEN} table`)
    expect(resumen.innerText).toContain('Con LBEn')
    expect(resumen.innerText).toContain('Top ahorros')
    expect(resumen.querySelector('ol[aria-label="Ranking de ahorro por edificación"]')).not.toBeNull()

    // Inventory (S4): counts from the mocked DB, period always explicit.
    expect(texto).toContain('facturas registradas')
    expect(texto).toMatch(/\b48\b/)
    expect(texto).toContain('último periodo')
    expect(texto).toContain('2026-08')
    expect(texto).toContain('edificaciones')
    expect(texto).toContain('bloques')
    expect(estado.energyQueries).toBeGreaterThan(0)

    // The home is never a card of itself (S4)
    expect(document.querySelector('main a[href="/dashboard"]')).toBeNull()
  })

  it('without saved line bases: ahorro shows the honest callout, never an invented number', async () => {
    estado.lineasBase = []
    await renderHome()
    const resumen = await present(RESUMEN)
    const texto = resumen.innerText.toLowerCase()

    expect(texto).toContain('sin línea base guardada')
    expect(texto).toContain('guarda líneas base en datos')
    // Cobertura 0 / 9 and no leaderboard rows
    expect(texto).toContain('0 / 9')
    expect(resumen.querySelector('ol[aria-label="Ranking de ahorro por edificación"]')).toBeNull()
  })

  it('COMUNIDAD_UNIVERSITARIA: no energy query runs and no energy number is rendered', async () => {
    estado.user.role = 'COMUNIDAD_UNIVERSITARIA'
    await renderHome()
    await present('main h1')

    // The gate must sit before the queries, not only before the rendering
    expect(estado.energyQueries).toBe(0)
    expect(estado.usersQueries).toBe(0)
    expect(document.querySelector(RESUMEN)).toBeNull()
    const texto = bodyText().toLowerCase()
    expect(texto).not.toContain('resumen energético')
    expect(texto).not.toContain('último periodo')
    expect(texto).not.toContain('facturas registradas')
    // Nor a slide to the modules it cannot access (same gating as ModuleNav)
    expect(document.querySelector('main a[href="/dashboard/datos"]')).toBeNull()
    expect(document.querySelector('[aria-label^="Ir al módulo Gestión"]')).toBeNull()
    expect(document.querySelector('[aria-label^="Ir al módulo Usuarios"]')).toBeNull()
    // Alertas es un módulo con permiso propio desde HU-08: oculto a Comunidad,
    // igual que Planos (material de gestión interna).
    expect(document.querySelector('[aria-label^="Ir al módulo Alertas"]')).toBeNull()
    // The carousel starts at the first module it CAN see (nav order)
    expect(
      document
        .querySelector('[aria-label^="Ir al módulo"]')
        ?.getAttribute('aria-label')
    ).toBe('Ir al módulo Estimaciones')
  })

  it('a temporary override on consumption does enable the summary (canWithOverrides)', async () => {
    estado.user.role = 'COMUNIDAD_UNIVERSITARIA'
    estado.overrides = [{ moduleId: 'consumption', action: 'read', expiresAt: null }]

    await renderHome()
    await present(RESUMEN)

    // 8 aggregate queries + 2 per-edification groupBys + the variables stat
    expect(estado.energyQueries).toBe(11)
    expect(estado.usersQueries).toBe(0)
    expect(document.querySelector('main a[href="/dashboard/datos"]')).not.toBeNull()
    // …and the override opens the module in the carousel too
    expect(
      document.querySelector('[aria-label="Ir al módulo Gestión de datos"]')
    ).not.toBeNull()
  })

  it('with zero invoices: useful empty state with an action into the data module', async () => {
    estado.facturas = 0
    estado.ultimoPeriodo = null
    estado.serieBruta = []
    estado.ultimasFacturas = []
    estado.porEdifActual = null
    estado.porEdifPrevio = null

    await renderHome()
    const vacio = await present('.ui-empty')

    expect(vacio.innerText).toContain('facturas')
    expect(vacio.querySelector('a[href="/dashboard/datos"]')).not.toBeNull()
    expect(bodyText()).toContain('Sin registros')
    // No fabricated KPIs when there is nothing to measure
    expect(bodyText()).not.toContain('Ahorro vs línea base')
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

    it('el documento no desborda horizontalmente', async () => {
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
      // The carousel controls are also ≥40px touch targets below `lg`
      const controles = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[aria-roledescription="carrusel"] button'
        )
      )
      expect(controles.length).toBeGreaterThan(0)
      for (const control of controles) {
        expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
        expect(control.getBoundingClientRect().width).toBeGreaterThanOrEqual(39.5)
      }
      expect(horizontalOverflow()).toBeLessThanOrEqual(1)
    })
  })
})
