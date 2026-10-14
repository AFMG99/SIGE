/**
 * T6 (Phase 4a) — regression guard for the `potenciaTotalKw` wiring of the
 * data-module Server Component.
 *
 * The page computes `equiposExistentes.potenciaTotalKw` from query #4 of the
 * `Promise.all` — a raw SQL aggregate
 * (`SELECT COALESCE(SUM("potenciaNominal" * cantidad), 0) AS total FROM
 * equipos_electricos`), destructured as `potenciaAgg` and forwarded as
 * `potenciaAgg[0]?.total ?? 0`.
 *
 * The SQL itself runs against Postgres and is NOT unit-testable here (Prisma
 * is mocked), so this test pins the WIRING instead:
 *  1. The raw aggregate row reaches `equiposExistentes.potenciaTotalKw`
 *     unchanged (exact value, not a formatted string), while `.total` still
 *     comes from a *different* query (`equipoElectrico.aggregate`) — a wrong
 *     position or index in the destructuring cannot pass silently.
 *  2. An empty raw result yields exactly `0` (the `?? 0` fallback).
 *  3. The page only runs for an authorized user: the real
 *     `requireModuleAccess('consumption')` gate runs against a mocked
 *     session + user row (same doubles as the home-page test), and the
 *     returned element mounts for real.
 *
 * A failing assertion is never fixed by lowering the expected value: it means
 * the raw aggregate no longer reaches the view model intact.
 */
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
      'data-no-drag'?: boolean
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
  // The page redirects when the gate denies access — never expected here.
  redirect: (route: string) => {
    throw new Error(`unexpected redirect: ${route}`)
  },
  usePathname: () => '/dashboard/datos',
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// The data-module views import their server actions (Prisma / `next/headers`
// / the Python LBEn engine, unusable outside Next): point them at the
// deterministic double that Storybook and the overflow test already use.
vi.mock('@/features/datos/controllers/ajustes', () =>
  import('@/features/datos/views/__mocks__/serverActions')
)
vi.mock('@/features/datos/controllers/facturas', () =>
  import('@/features/datos/views/__mocks__/serverActions')
)
vi.mock('@/features/datos/controllers/lineasBase', () =>
  import('@/features/datos/views/__mocks__/serverActions')
)
vi.mock('@/features/datos/controllers/equipos', () =>
  import('@/features/datos/views/__mocks__/serverActions')
)
vi.mock('@/features/datos/controllers/variables', () =>
  import('@/features/datos/views/__mocks__/serverActions')
)
vi.mock('@/features/datos/controllers/edificaciones', () =>
  import('@/features/datos/views/__mocks__/serverActions')
)

// --- Backend doubles: authorized session + the full Prisma surface ----------
const estado = vi.hoisted(() => ({
  session: { userId: 'ckuser0000000000000000' } as { userId: string } | null,
  user: {
    id: 'ckuser0000000000000000',
    name: 'Ana Torres',
    email: 'ana.torres@tecnologicoantioquia.edu.co',
    role: 'ADMIN_TI',
    avatarUrl: null as string | null,
  },
  /** Rows the raw SQL aggregate returns — T6 feeds `potenciaTotalKw`. */
  potenciaFilas: [] as Array<{ total: number }>,
  facturas: 48,
  equipos: 6,
}))

// The real authz guards (`requireModuleAccess`, `canWithOverrides`) run on
// top of this session + `prisma.user.findUnique`.
vi.mock('@/shared/models/auth', () => ({
  __esModule: true,
  getSession: async () => estado.session,
}))

vi.mock('@/shared/models/prisma', () => ({
  prisma: {
    // Gate path: getCurrentUser + hasActiveOverride fallback.
    user: { findUnique: async () => estado.user },
    userPermissionOverride: {
      findFirst: async () => null,
      findMany: async () => [],
    },
    // Queries #1–#2 (facturas), #3/#5–#6 (equipos), #7–#8 (variables),
    // #9/#17 (líneas base), #10–#12 (catálogo), #13–#16 (ajustes).
    facturaEnergia: {
      aggregate: async () => ({
        _count: estado.facturas,
        _sum: { consumoKwh: 12500.5, costoCop: 4310000 },
      }),
      findMany: async () => [],
    },
    equipoElectrico: {
      aggregate: async () => ({ _count: estado.equipos }),
      findMany: async () => [],
      groupBy: async () => [],
    },
    // Query #4: called as a tagged template; the value under test.
    $queryRaw: async () => estado.potenciaFilas,
    variableOperativa: {
      aggregate: async () => ({
        _count: 0,
        _avg: { poblacionFlotante: null, gradesDiaEnfriamiento: null },
      }),
      findMany: async () => [],
    },
    lineaBaseEnergia: {
      count: async () => 0,
      findMany: async () => [],
    },
    edificacion: { findMany: async () => [] },
    bloque: { findMany: async () => [] },
    espacio: { findMany: async () => [] },
    ajusteEnergetico: {
      aggregate: async () => ({ _count: 0, _avg: { valorAjuste: null } }),
      findMany: async () => [],
      groupBy: async () => [],
    },
  },
}))

// --- Component under test: the real Server Component ------------------------
import { DatosContent } from '@/features/datos/views/DatosContent'
import type {
  EquiposExistentes,
  FacturasExistentes,
} from '@/features/datos/views/existencias'
import { ToastProvider } from '@/shared/views/ui/ToastProvider'

/** Only the props this guard asserts on — the rest of the tree is unchanged. */
type DatosTree = ReactElement<{
  equiposExistentes: EquiposExistentes
  facturasExistentes: FacturasExistentes
}>

async function runPage(): Promise<DatosTree> {
  const { default: DatosPage } = await import('@/app/dashboard/datos/page')
  return (await DatosPage()) as DatosTree
}

beforeEach(() => {
  cleanup()
  estado.session = { userId: 'ckuser0000000000000000' }
  estado.user = {
    id: 'ckuser0000000000000000',
    name: 'Ana Torres',
    email: 'ana.torres@tecnologicoantioquia.edu.co',
    role: 'ADMIN_TI',
    avatarUrl: null,
  }
  estado.potenciaFilas = []
  estado.facturas = 48
  estado.equipos = 6
})
afterEach(() => cleanup())

describe('Datos page — potenciaTotalKw wiring (T6)', () => {
  it('forwards the raw SQL aggregate into equiposExistentes.potenciaTotalKw unchanged', async () => {
    estado.potenciaFilas = [{ total: 123.5 }]

    const arbol = await runPage()

    // The element really is the view component, not a wrapper.
    expect(arbol.type).toBe(DatosContent)

    // Exact value from `$queryRaw` row #1 — no formatting, no rounding.
    expect(arbol.props.equiposExistentes.potenciaTotalKw).toBe(123.5)

    // Sibling fields come from OTHER queries of the same Promise.all, so a
    // position/index slip in the destructuring cannot pass silently:
    // `.total` is `equipoElectrico.aggregate._count` (query #3) and the
    // facturas count is query #1.
    expect(arbol.props.equiposExistentes.total).toBe(6)
    expect(arbol.props.facturasExistentes.total).toBe(48)

    // The same element mounts for real (the views' useToast contract).
    render(<ToastProvider>{arbol}</ToastProvider>)
    await vi.waitFor(
      () => {
        const h1 = document.querySelector('h1')
        expect(h1?.textContent ?? '').toContain(
          'Módulo de Carga y Gestión de Datos'
        )
      },
      { timeout: 5000 }
    )
  })

  it('yields exactly 0 when the raw aggregate returns no rows', async () => {
    estado.potenciaFilas = []

    const arbol = await runPage()

    // Exercises the `?? 0` fallback: `potenciaAgg[0]?.total` is `undefined`.
    expect(arbol.props.equiposExistentes.potenciaTotalKw).toBe(0)
    // The _count aggregate feeding `.total` is untouched by the raw query.
    expect(arbol.props.equiposExistentes.total).toBe(6)
  })
})
