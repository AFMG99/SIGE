/**
 * Fase 0/3 — red de seguridad responsive.
 *
 * Renderiza componentes reales en un navegador y cambia el tamaño del viewport
 * (los mismos puntos que la matriz de Storybook: 375 / 768 / 1280) para detectar
 * desbordamientos horizontales: ni el documento ni el propio contenedor deben
 * desbordar.
 *
 * Fase 3 añade dos contratos adicionales: los controles táctiles del chrome
 * móvil miden ≥ 40px y ningún desplegable (menú) sale del viewport.
 *
 * Una aserción que falla NO se arregla bajando el umbral: describe un
 * componente aún no responsivo y marca el trabajo de la Fase 1/2/3.
 */
import { useEffect, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'

import '@/app/globals.css'

// --- mocks de Next (estos componentes se usan dentro del App Router) ---------
// `__esModule` es obligatorio: next/link se resuelve como CJS y sin él el
// import por defecto devuelve el objeto { default } en vez del componente.
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
      children?: ReactNode
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

const { routerPushSpy } = vi.hoisted(() => ({ routerPushSpy: vi.fn() }))

vi.mock(
  'next/navigation',
  () => ({
    __esModule: true,
    usePathname: () => '/dashboard/datos',
    useRouter: () => ({
      push: routerPushSpy,
      replace: () => {},
      prefetch: () => {},
      back: () => {},
    }),
    useSearchParams: () => new URLSearchParams(),
  })
)

// Las server actions del módulo de datos importan Prisma/`next/headers`
// (irrepetibles fuera de Next): se apuntan al doble determinista que ya usa
// Storybook. El import va inline porque `vi.mock` se eleva por encima del archivo.
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

// --- componentes bajo prueba ------------------------------------------------
import {
  bloquesDemo,
  edificacionesDemo,
  espaciosDemo,
} from '@/features/datos/views/__fixtures__/catalogo'
import { AjustesSection } from '@/features/datos/views/AjustesSection'
import { ComoFunciona } from '@/features/datos/views/ComoFunciona'
import { EdificacionesPanel } from '@/features/datos/views/EdificacionesPanel'
import { MockFacturaVistaPrevia } from '@/features/datos/views/ComoFuncionaMocks'
import { DATOS_SECTIONS } from '@/features/datos/views/nav'
import { DatosContent } from '@/features/datos/views/DatosContent'
import {
  ajustesExistentesDemo,
  equiposExistentesDemo,
  facturasExistentesDemo,
  lineasBaseFilasDemo,
  variablesExistentesDemo,
} from '@/features/datos/views/__fixtures__/existencias'
import { LineasBasePreguntas } from '@/features/datos/views/LineasBasePreguntas'
import type {
  CrearBloque,
  CrearEdificacion,
  EliminarBloque,
  EliminarEdificacion,
} from '@/features/datos/views/useCatalogoEdificaciones'
import { UserTable, type AdminUser } from '@/features/users/views/UserTable'
import { CountryPhoneInput } from '@/features/users/views/CountryPhoneInput'
import { SettingsView } from '@/features/users/views/settings/SettingsView'
import {
  settingsSessions,
  settingsUser,
} from '@/features/users/views/settings/__fixtures__/settings'
import { ROLES, USER_STATUSES } from '@/shared/models/permissions'
import { DashboardShell } from '@/shared/views/DashboardShell'
import SidebarNav from '@/shared/views/sidebar/SidebarNav'
import { ConfirmDialog } from '@/shared/views/ui/ConfirmDialog'
import { DropdownMenu } from '@/shared/views/ui/DropdownMenu'
import { ListboxSelect, type ListboxOption } from '@/shared/views/ui/ListboxSelect'
import { ToastProvider, useToast } from '@/shared/views/ui/ToastProvider'

const VIEWPORTS = [
  { nombre: 'móvil 375', width: 375, height: 812 },
  { nombre: 'tablet 768', width: 768, height: 1024 },
  { nombre: 'desktop 1280', width: 1280, height: 800 },
]

async function ajustarViewport(width: number, height: number) {
  await page.viewport(width, height)
  // Espera a que el iframe tenga realmente ese ancho antes de medir.
  await vi.waitFor(
    () => {
      expect(window.innerWidth).toBeLessThanOrEqual(width)
    },
    { timeout: 5000 }
  )
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

/** Píxeles que el elemento desborda por la derecha (0 = cabe). */
function desborde(el: Element): number {
  return el.scrollWidth - el.clientWidth
}

function desbordeDocumento(): number {
  return desborde(document.documentElement)
}

const usuarios: AdminUser[] = [
  {
    id: 'user-00000001',
    name: 'Ana Torres',
    email: 'ana.torres@tecnologicoantioquia.edu.co',
    role: ROLES[0],
    status: USER_STATUSES[0],
    phone: '+57 300 111 2233',
    lastLoginAt: '2026-01-15T10:00:00.000Z',
    createdAt: '2025-06-01T08:00:00.000Z',
    hasActiveSession: true,
  },
  {
    id: 'user-00000002',
    name: 'Luis Gómez',
    email: 'luis.gomez@tecnologicoantioquia.edu.co',
    role: ROLES[1],
    status: USER_STATUSES[1],
    phone: null,
    lastLoginAt: null,
    createdAt: '2025-07-12T08:00:00.000Z',
  },
]

const stubs = {
  crearEdificacion: (async () => ({ ok: true })) as unknown as CrearEdificacion,
  eliminarEdificacion: (async () => ({ ok: true })) as unknown as EliminarEdificacion,
  crearBloque: (async () => ({ ok: true })) as unknown as CrearBloque,
  eliminarBloque: (async () => ({ ok: true })) as unknown as EliminarBloque,
}

const noop = () => {}

const ajustesVacios = {
  total: 0,
  bloquesConAjustes: 0,
  valorAjustePromedio: 0,
  rutinarios: 0,
  noRutinarios: 0,
  filas: [],
}

const shell = (
  <DashboardShell
    role="ADMIN_TI"
    account={{
      name: 'Ana Pérez',
      email: 'ana.perez@udea.edu.co',
      avatarUrl: null,
    }}
  >
    <div>contenido de página</div>
  </DashboardShell>
)

describe('desborde horizontal', () => {
  beforeEach(() => cleanup())
  afterEach(() => cleanup())

  describe.each(VIEWPORTS)('$nombre', ({ width, height }) => {
    beforeEach(async () => {
      await ajustarViewport(width, height)
    })

    it('DashboardShell: el documento no desborda', async () => {
      render(shell)
      await vi.waitFor(() => {
        expect(document.querySelector('header')).not.toBeNull()
      })
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    it('DashboardShell: el encabezado cabe en la pantalla', async () => {
      render(shell)
      const header = await vi.waitFor(() => {
        const el = document.querySelector('header')
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      expect(desborde(header)).toBeLessThanOrEqual(1)
    })

    it('DashboardShell: la navegación sigue el breakpoint lg', async () => {
      render(shell)
      const nav = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>(
          'header nav[aria-label="Navegación principal"]'
        )
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      const burger = document.querySelector<HTMLButtonElement>(
        'button[aria-controls="nav-movil"]'
      )
      expect(burger).not.toBeNull()

      if (width >= 1024) {
        // desktop: la barra de módulos vive dentro del encabezado
        expect(nav.getBoundingClientRect().width).toBeGreaterThan(0)
        expect(nav.getBoundingClientRect().right).toBeLessThanOrEqual(
          window.innerWidth + 1
        )
        expect(burger?.getBoundingClientRect().width).toBe(0)
      } else {
        // móvil: la barra sale del encabezado y entra el cajón
        expect(nav.getBoundingClientRect().width).toBe(0)
        expect(burger?.getBoundingClientRect().width).toBeGreaterThan(0)
      }
    })

    it.skipIf(width >= 1024)(
      'DashboardShell: el menú móvil abre y se cierra con Escape',
      async () => {
        render(shell)
        const burger = await vi.waitFor(() => {
          const el = document.querySelector<HTMLButtonElement>(
            'button[aria-controls="nav-movil"]'
          )
          expect(el).not.toBeNull()
          return el as HTMLButtonElement
        })
        burger.click()

        const dialog = await vi.waitFor(() => {
          const el = document.querySelector<HTMLElement>('[role="dialog"]')
          expect(el).not.toBeNull()
          return el as HTMLElement
        })
        expect(dialog.getAttribute('aria-modal')).toBe('true')
        // el cajón replica la navegación de escritorio (incluye datos)
        expect(dialog.querySelectorAll('a').length).toBeGreaterThan(0)

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        await vi.waitFor(() => {
          expect(document.querySelector('[role="dialog"]')).toBeNull()
        })
      }
    )

    it('SidebarNav: el panel de datos sólo existe desde lg', async () => {
      render(
        <SidebarNav
          items={DATOS_SECTIONS}
          activeId="resumen"
          open
          onToggle={noop}
          onSelect={noop}
        />
      )
      const aside = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>('aside')
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      const { width: asideW, right } = aside.getBoundingClientRect()
      if (width >= 1024) {
        expect(asideW).toBeGreaterThan(0)
        expect(right).toBeLessThanOrEqual(window.innerWidth + 1)
      } else {
        expect(asideW).toBe(0)
      }
    })

    it('UserTable: la tabla no ensancha el documento', async () => {
      render(
        <UserTable
          users={usuarios}
          currentUserId={usuarios[0].id}
          onEdit={noop}
          onView={noop}
          onSuspend={noop}
          onActivate={noop}
          onDelete={noop}
          onRevokeSession={noop}
          selectedIds={[]}
          onSelect={noop}
          onSelectAll={noop}
          sortConfig={{ field: 'name', direction: 'asc' }}
          onSort={noop}
        />
      )
      await vi.waitFor(() => {
        expect(document.querySelector('.ui-table-shell')).not.toBeNull()
      })
      // el shell nunca debe recortar: es el contenedor de scroll de la tabla
      const shell = document.querySelector<HTMLElement>('.ui-table-shell')
      expect(['auto', 'scroll']).toContain(
        getComputedStyle(shell as Element).overflowX
      )
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    it('EdificacionesPanel: el catálogo no desborda el documento', async () => {
      render(
        <ToastProvider>
          <EdificacionesPanel
            edificaciones={edificacionesDemo}
            bloques={bloquesDemo}
            espacios={espaciosDemo}
            {...stubs}
          />
        </ToastProvider>
      )
      await vi.waitFor(() => {
        expect(document.querySelector('dl')).not.toBeNull()
      })
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    it('LineasBasePreguntas: las tablas scrollean en vez de recortarse', async () => {
      render(<LineasBasePreguntas />)
      const details = await vi.waitFor(() => {
        const el = document.querySelector<HTMLDetailsElement>(
          'details#lben-p-que-datos'
        )
        expect(el).not.toBeNull()
        return el as HTMLDetailsElement
      })
      details.open = true

      const wrapper = await vi.waitFor(() => {
        const table = details.querySelector<HTMLElement>('table')
        expect(table).not.toBeNull()
        const el = table!.parentElement
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      // `hidden` recorta la columna derecha; el contrato es que sea scrolleable
      expect(['auto', 'scroll']).toContain(getComputedStyle(wrapper).overflowX)
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    it('ComoFuncionaMocks: la tabla de vista previa es scrolleable', async () => {
      render(<MockFacturaVistaPrevia isActive />)
      const table = await vi.waitFor(
        () => {
          const el = document.querySelector<HTMLElement>('table')
          expect(el).not.toBeNull()
          return el as HTMLElement
        },
        { timeout: 5000 }
      )
      const wrapper = table.parentElement
      expect(wrapper).not.toBeNull()
      expect(['auto', 'scroll']).toContain(
        getComputedStyle(wrapper as HTMLElement).overflowX
      )
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })
  })
})

describe('Fase 3 — objetivos táctiles y desplegables', () => {
  beforeEach(() => cleanup())
  afterEach(() => cleanup())

  describe.each(VIEWPORTS)('$nombre', ({ width, height }) => {
    beforeEach(async () => {
      await ajustarViewport(width, height)
    })

    it('DropdownMenu: el menú desplegable siempre cabe en el viewport', async () => {
      render(
        <div style={{ position: 'fixed', right: 12, bottom: 12 }}>
          <DropdownMenu
            trigger={<button type="button">Acciones</button>}
            items={[
              { label: 'Ver detalle', onClick: noop },
              { label: 'Editar registro', onClick: noop },
              { label: 'Cerrar todas las sesiones', onClick: noop },
              { label: 'Eliminar definitivamente', onClick: noop },
            ]}
          />
        </div>
      )
      const trigger = await vi.waitFor(() => {
        const el = document.querySelector<HTMLButtonElement>('button')
        expect(el).not.toBeNull()
        return el as HTMLButtonElement
      })
      trigger.click()

      // se mide y se recorta a ambos ejes en el layout effect, antes del paint
      await vi.waitFor(
        () => {
          const menu = document.querySelector<HTMLElement>('[role="menu"]')
          expect(menu).not.toBeNull()
          const r = menu!.getBoundingClientRect()
          expect(r.top).toBeGreaterThanOrEqual(-1)
          expect(r.left).toBeGreaterThanOrEqual(-1)
          expect(r.bottom).toBeLessThanOrEqual(window.innerHeight + 1)
          expect(r.right).toBeLessThanOrEqual(window.innerWidth + 1)
        },
        { timeout: 3000 }
      )
    })

    it('ui-btn-sm: crece a 40px por debajo de lg y sigue compacto en desktop', async () => {
      render(<button className="ui-btn ui-btn-secondary ui-btn-sm">Guardar</button>)
      const btn = await vi.waitFor(() => {
        const el = document.querySelector<HTMLButtonElement>('button')
        expect(el).not.toBeNull()
        return el as HTMLButtonElement
      })
      const { height } = btn.getBoundingClientRect()
      if (width >= 1024) expect(height).toBeLessThan(40)
      else expect(height).toBeGreaterThanOrEqual(39.5)
    })

    it('ComoFunciona: el selector de guía no desborda y sus pills miden ≥ 40px', async () => {
      render(<ComoFunciona autoPlay={false} />)
      const pill = await vi.waitFor(() => {
        const el = document.querySelector<HTMLButtonElement>('button[aria-pressed]')
        expect(el).not.toBeNull()
        return el as HTMLButtonElement
      })
      // el target táctil de 40px sólo se exige por debajo de `lg`
      if (width < 1024) {
        expect(pill.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
      }
      const grupo = pill.parentElement
      expect(grupo).not.toBeNull()
      expect(grupo!.getBoundingClientRect().right).toBeLessThanOrEqual(
        window.innerWidth + 1
      )
      // El escenario recorta el deslizamiento del mockup con `overflow-hidden`:
      // comprobamos que ese recorte no esconde contenido del paso activo.
      const escenario = document.querySelector<HTMLElement>('div[class*="min-h-[440px]"]')
      expect(escenario).not.toBeNull()
      expect(escenario!.scrollHeight - escenario!.clientHeight).toBeLessThanOrEqual(1)
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    it('AjustesSection: el selector de modo y las pestañas caben en pantalla', async () => {
      render(
        <AjustesSection
          ajustes={ajustesVacios}
          ajustesAplicados={[]}
          modo="datos"
          puedeCargar={false}
        />
      )
      const grupo = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>(
          '[aria-label="Modo de la sección Ajustes"]'
        )
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      expect(grupo.getBoundingClientRect().right).toBeLessThanOrEqual(
        window.innerWidth + 1
      )
      const pill = grupo.querySelector('button')
      expect(pill).not.toBeNull()
      if (width < 1024) {
        expect(pill!.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
      }

      const tablist = document.querySelector<HTMLElement>('[role="tablist"]')
      expect(tablist).not.toBeNull()
      expect(tablist!.getBoundingClientRect().right).toBeLessThanOrEqual(
        window.innerWidth + 1
      )
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    it.skipIf(width >= 1024)('Encabezado móvil: los controles miden ≥ 40px', async () => {
      render(shell)
      const botones = await vi.waitFor(() => {
        const burger = document.querySelector<HTMLButtonElement>(
          'button[aria-controls="nav-movil"]'
        )
        const tema = document.querySelector<HTMLButtonElement>(
          'header button[title^="Tema"]'
        )
        const cuenta = document.querySelector<HTMLButtonElement>(
          'header button[title="Menú de cuenta"]'
        )
        expect(burger).not.toBeNull()
        expect(tema).not.toBeNull()
        expect(cuenta).not.toBeNull()
        return [burger!, tema!, cuenta!]
      })
      for (const boton of botones) {
        const r = boton.getBoundingClientRect()
        expect(r.height).toBeGreaterThanOrEqual(39.5)
        expect(r.width).toBeGreaterThanOrEqual(39.5)
      }
    })

    it('Menú de cuenta: se despliega con sus secciones y cabe en el viewport', async () => {
      render(shell)
      const trigger = await vi.waitFor(() => {
        const el = document.querySelector<HTMLButtonElement>(
          'header button[title="Menú de cuenta"]'
        )
        expect(el).not.toBeNull()
        return el as HTMLButtonElement
      })
      trigger.click()

      const menu = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>('[role="menu"]')
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      // 4 secciones de configuración + cerrar sesión
      const items = menu.querySelectorAll('[role="menuitem"]')
      expect(items).toHaveLength(5)
      expect(
        Array.from(items).map((i) => i.textContent?.trim())
      ).toEqual(['Perfil', 'Apariencia', 'Seguridad', 'Notificaciones', 'Cerrar sesión'])
      dentroDelViewport(menu)
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    // Regresión #62: el pointer capture del header (armado por pointerdowns
    // del portal) re-dirigía el click y los items nunca ejecutaban su onClick.
    it('Menú de cuenta: hacer click en una sección navega con ?tab=', async () => {
      render(shell)
      const trigger = await vi.waitFor(() => {
        const el = document.querySelector<HTMLButtonElement>(
          'header button[title="Menú de cuenta"]'
        )
        expect(el).not.toBeNull()
        return el as HTMLButtonElement
      })
      routerPushSpy.mockClear()
      trigger.click()

      const perfil = await vi.waitFor(() => {
        const el = Array.from(
          document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
        ).find((b) => b.textContent?.trim() === 'Perfil')
        expect(el).toBeInstanceOf(HTMLButtonElement)
        return el as HTMLButtonElement
      })
      perfil.click()
      expect(routerPushSpy).toHaveBeenCalledWith(
        '/dashboard/configuracion?tab=perfil'
      )
    })

    it('Menú de cuenta: Cerrar sesión envía el form de logout', async () => {
      render(shell)
      const submitSpy = vi
        .spyOn(HTMLFormElement.prototype, 'requestSubmit')
        .mockImplementation(() => {})
      try {
        const trigger = await vi.waitFor(() => {
          const el = document.querySelector<HTMLButtonElement>(
            'header button[title="Menú de cuenta"]'
          )
          expect(el).not.toBeNull()
          return el as HTMLButtonElement
        })
        trigger.click()

        const salir = await vi.waitFor(() => {
          const el = Array.from(
            document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
          ).find((b) => b.textContent?.trim() === 'Cerrar sesión')
          expect(el).toBeInstanceOf(HTMLButtonElement)
          return el as HTMLButtonElement
        })
        salir.click()
        expect(submitSpy).toHaveBeenCalledTimes(1)
        const form = document.querySelector<HTMLFormElement>(
          'form[action="/api/auth/logout"]'
        )
        expect(form).not.toBeNull()
      } finally {
        submitSpy.mockRestore()
      }
    })

    it('Barra central: los módulos no se solapan ni salen de pantalla', async () => {
      render(shell)
      await vi.waitFor(() => expect(document.querySelector('header')).not.toBeNull())
      const enlaces = Array.from(document.querySelectorAll<HTMLElement>('header a[data-no-drag]'))
        .map((a) => a.getBoundingClientRect())
        .filter((r) => r.width > 0)
        .sort((a, b) => a.left - b.left)
      if (width >= 1024) {
        expect(enlaces.length).toBeGreaterThan(0)
        for (let i = 1; i < enlaces.length; i++) {
          expect(enlaces[i].left - enlaces[i - 1].right).toBeGreaterThanOrEqual(0)
        }
        expect(enlaces.at(-1)!.right).toBeLessThanOrEqual(window.innerWidth + 1)
        expect(enlaces[0].left).toBeGreaterThanOrEqual(-1)
      }
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    it.skipIf(width >= 1024)('Cajón móvil: los enlaces de navegación miden ≥ 40px', async () => {
      render(shell)
      const burger = await vi.waitFor(() => {
        const el = document.querySelector<HTMLButtonElement>(
          'button[aria-controls="nav-movil"]'
        )
        expect(el).not.toBeNull()
        return el as HTMLButtonElement
      })
      burger.click()

      const dialog = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>('[role="dialog"]')
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      const nav = dialog.querySelector<HTMLElement>(
        'nav[aria-label="Navegación principal"]'
      )
      expect(nav).not.toBeNull()
      const enlaces = Array.from(nav!.querySelectorAll('a'))
      expect(enlaces.length).toBeGreaterThan(0)
      for (const enlace of enlaces) {
        expect(enlace.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
      }
      // árbol de secciones del módulo de datos (resumen / facturas / …)
      const filas = Array.from(dialog.querySelectorAll('.datos-row'))
      expect(filas.length).toBeGreaterThan(0)
      for (const fila of filas) {
        expect(fila.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
      }
    })
  })
})

// ---------------------------------------------------------------------------
// PA-1 — contención de popups.
//
// Un popup propio (diálogo, toast, listbox) nunca sobresale del viewport:
// se mide su rect completo y debe caber dentro de la ventana (+1px de tolerancia).
// ---------------------------------------------------------------------------
const POPUPS = [
  { nombre: 'xs 320', width: 320, height: 568 },
  { nombre: 'móvil 375', width: 375, height: 812 },
  { nombre: 'móvil 414', width: 414, height: 896 },
  { nombre: 'tablet 768', width: 768, height: 1024 },
  { nombre: 'desktop 1280', width: 1280, height: 800 },
]

function dentroDelViewport(el: Element): void {
  const r = el.getBoundingClientRect()
  expect(r.left).toBeGreaterThanOrEqual(-1)
  expect(r.top).toBeGreaterThanOrEqual(-1)
  expect(r.right).toBeLessThanOrEqual(window.innerWidth + 1)
  expect(r.bottom).toBeLessThanOrEqual(window.innerHeight + 1)
}

/** `getBoundingClientRect()` incluye transforms, así que hay que esperar a que
 *  terminen las animaciones de entrada (`slideUp` mueve 20px en Y) antes de medir. */
async function esperarAnimaciones(el: Element): Promise<void> {
  await Promise.all(
    el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined))
  )
}

describe('PA-1 — contención de popups', () => {
  beforeEach(() => cleanup())
  afterEach(() => cleanup())

  describe.each(POPUPS)('$nombre', ({ width, height }) => {
    beforeEach(async () => {
      await ajustarViewport(width, height)
    })

    it('ConfirmDialog: el panel no supera la ventana y hace scroll interno', async () => {
      render(
        <ConfirmDialog
          isOpen
          onClose={noop}
          onConfirm={noop}
          title="Vaciar la base de datos"
          description="Esta acción borra todo el histórico de mediciones."
        >
          <div style={{ height: 2400 }} />
        </ConfirmDialog>
      )

      const panel = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>('.ui-modal')
        expect(el).not.toBeNull()
        return el as HTMLElement
      })

      expect(getComputedStyle(panel).overflowY).toBe('auto')
      expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight)
      await esperarAnimaciones(panel)
      dentroDelViewport(panel)
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    it('Toast: la notificación cabe en el ancho de la pantalla', async () => {
      function LanzaToast() {
        const { showToast } = useToast()
        useEffect(() => {
          showToast('error'.repeat(80), 'error')
        }, [showToast])
        return null
      }

      render(
        <ToastProvider>
          <LanzaToast />
        </ToastProvider>
      )

      const contenedor = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>('[aria-label="Notificaciones"]')
        expect(el).not.toBeNull()
        return el as HTMLElement
      })

      dentroDelViewport(contenedor)
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    it('Selector de país: el listbox cabe por debajo del trigger', async () => {
      render(<CountryPhoneInput inputId="tel-abajo" value="" onChange={noop} />)

      const trigger = await vi.waitFor(() => {
        const el = document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')
        expect(el).not.toBeNull()
        return el as HTMLButtonElement
      })
      trigger.click()

      const listbox = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>('[role="listbox"]')
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      const panel = listbox.parentElement as HTMLElement

      dentroDelViewport(panel)
      expect(panel.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        trigger.getBoundingClientRect().bottom - 1
      )
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    it('Selector de país: con el trigger abajo, el listbox abre hacia arriba', async () => {
      render(
        <div>
          <div style={{ height: Math.max(0, height - 120) }} />
          <CountryPhoneInput inputId="tel-arriba" value="" onChange={noop} />
        </div>
      )

      const trigger = await vi.waitFor(() => {
        const el = document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')
        expect(el).not.toBeNull()
        return el as HTMLButtonElement
      })
      trigger.click()

      const listbox = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>('[role="listbox"]')
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      const panel = listbox.parentElement as HTMLElement
      const caja = panel.getBoundingClientRect()
      const gatillo = trigger.getBoundingClientRect()

      dentroDelViewport(panel)
      expect(caja.bottom).toBeLessThanOrEqual(gatillo.top + 1)
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })
  })
})

// ---------------------------------------------------------------------------
// PA-2 — tiras de pills (scroll horizontal + snap).
//
// Cada tira mide UNA sola fila (si envolviera, crecería en altura), el pill
// activo queda dentro del recorte y el documento sigue sin desbordar.
// ---------------------------------------------------------------------------
const datosArgs = {
  role: 'ADMIN_TI' as const,
  puedeCargar: true,
  puedeCalcular: true,
  stats: { facturas: 6, equipos: 14, variables: 9, lineasBase: 4 },
  edificaciones: edificacionesDemo,
  bloques: bloquesDemo,
  espacios: espaciosDemo,
  facturasExistentes: facturasExistentesDemo,
  equiposExistentes: equiposExistentesDemo,
  variablesExistentes: variablesExistentesDemo,
  ajustesExistentes: ajustesExistentesDemo,
  lineasBaseFilas: lineasBaseFilasDemo,
}

function botonesVisibles(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(
    (b) => b.offsetParent !== null
  )
}

function textoDe(b: HTMLButtonElement): string {
  return (b.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

async function irASecionDatos(nombre: string, textoEsperado: string): Promise<void> {
  const aside = document.querySelector<HTMLElement>(
    'aside[aria-label="Menú lateral del módulo de datos"]'
  )
  // El aside es `position: fixed` (su offsetParent es null): se decide por display.
  const lateralVisible = aside ? getComputedStyle(aside).display !== 'none' : false

  if (lateralVisible) {
    const item = botonesVisibles().find((b) => b.title === nombre)
    expect(item, `item del menú lateral "${nombre}"`).toBeTruthy()
    ;(item as HTMLButtonElement).click()
  } else {
    const burger = document.querySelector<HTMLButtonElement>('button[aria-controls="nav-movil"]')
    expect(burger, 'burger de navegación móvil').toBeTruthy()
    ;(burger as HTMLButtonElement).click()
    await vi.waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    })
    const fila = botonesVisibles().find((b) => textoDe(b) === nombre.toLowerCase())
    expect(fila, `fila del cajón "${nombre}"`).toBeTruthy()
    ;(fila as HTMLButtonElement).click()
    // Cambiar de sección no toca la ruta: el cajón se cierra solo.
    await vi.waitFor(() => {
      expect(
        document.querySelector('[role="dialog"]'),
        `el cajón se cierra al elegir "${nombre}"`
      ).toBeNull()
    })
  }

  const esperado = textoEsperado.toLowerCase()
  await vi.waitFor(() => {
    expect(
      document.body.innerText.replace(/\s+/g, ' ').toLowerCase(),
      `"${textoEsperado}" visible tras ir a ${nombre}`
    ).toContain(esperado)
  })
}

function comprobarTiras(): void {
  const tiras = Array.from(
    document.querySelectorAll<HTMLElement>('[data-pill-strip], [role="tablist"]')
  )
  expect(tiras.length).toBeGreaterThan(0)

  for (const tira of tiras) {
    const etiqueta = tira.getAttribute('aria-label') ?? 'tira'
    // Una sola fila: si los pills envolvieran, la caja crecería en altura.
    expect(
      tira.scrollHeight - tira.clientHeight,
      `tira de una sola fila: ${etiqueta}`
    ).toBeLessThanOrEqual(2)

    const activo = tira.querySelector<HTMLElement>(
      '[aria-pressed="true"], [aria-selected="true"]'
    )
    if (!activo) continue
    const a = activo.getBoundingClientRect()
    const c = tira.getBoundingClientRect()
    expect(a.left, `pill activo visible por la izquierda (${etiqueta})`).toBeGreaterThanOrEqual(
      c.left - 1
    )
    expect(a.right, `pill activo visible por la derecha (${etiqueta})`).toBeLessThanOrEqual(
      c.right + 1
    )
  }
}

describe('PA-2 — tiras de pills', () => {
  beforeEach(() => cleanup())
  afterEach(() => cleanup())

  describe.each(VIEWPORTS)('$nombre', ({ width, height }) => {
    beforeEach(async () => {
      await ajustarViewport(width, height)
    })

    it('las tiras de Facturas, Ajustes y Líneas Base son de una sola fila', async () => {
      render(
        <ToastProvider>
          <DashboardShell role="ADMIN_TI">
            <DatosContent {...datosArgs} />
          </DashboardShell>
        </ToastProvider>
      )

      await vi.waitFor(() => {
        expect(document.querySelectorAll('[data-pill-strip]').length).toBeGreaterThan(0)
      })
      comprobarTiras()

      await irASecionDatos('Facturas de energía', 'Edificaciones')
      comprobarTiras()

      await irASecionDatos('Ajustes', 'Ajustes energéticos')
      comprobarTiras()

      await irASecionDatos('Líneas Base', 'Cociente')
      comprobarTiras()

      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })
  })
})

// ---------------------------------------------------------------------------
// Cajón móvil — se cierra cuando el usuario navega desde dentro.
// Elegir una sección del árbol de datos es un cambio de estado (sin ruta), así
// que el cajón no se enteraba por `usePathname` y se quedaba encima.
// ---------------------------------------------------------------------------
describe('Cajón móvil — cierre al navegar', () => {
  beforeEach(() => cleanup())
  afterEach(() => cleanup())

  it('elegir una sección cierra el cajón y desbloquea el scroll del cuerpo', async () => {
    await ajustarViewport(375, 812)

    render(
      <ToastProvider>
        <DashboardShell role="ADMIN_TI">
          <DatosContent {...datosArgs} />
        </DashboardShell>
      </ToastProvider>
    )

    const burger = await vi.waitFor(() => {
      const el = document.querySelector<HTMLButtonElement>(
        'button[aria-controls="nav-movil"]'
      )
      expect(el, 'burger de navegación móvil').not.toBeNull()
      return el as HTMLButtonElement
    })
    ;(burger as HTMLButtonElement).click()

    const cajon = await vi.waitFor(() => {
      const el = document.querySelector<HTMLElement>('#nav-movil')
      expect(el, 'el cajón se abre').not.toBeNull()
      return el as HTMLElement
    })
    expect(document.body.style.overflow).toBe('hidden')

    const fila = Array.from(
      cajon.querySelectorAll<HTMLButtonElement>('button')
    ).find((b) => textoDe(b) === 'facturas de energía')
    expect(fila, 'fila de sección dentro del cajón').toBeTruthy()
    ;(fila as HTMLButtonElement).click()

    await vi.waitFor(() => {
      expect(document.querySelector('#nav-movil'), 'el cajón se cierra').toBeNull()
    })
    await vi.waitFor(() => {
      expect(document.body.style.overflow, 'scroll del cuerpo desbloqueado').not.toBe(
        'hidden'
      )
    })

    // El contenido sí cambió de sección.
    await vi.waitFor(() => {
      expect(document.body.innerText.replace(/\s+/g, ' ').toLowerCase()).toContain(
        'edificaciones'
      )
    })
  })
})

// ---------------------------------------------------------------------------
// ListboxSelect — el sustituto de los `<select>` con lista larga (edificaciones,
// bloques, columnas…). La lista la dibujamos nosotros, así que se mide igual que
// el resto de popups: nunca sobresale y hace scroll interno.
// ---------------------------------------------------------------------------
function opcionesLargas(n = 60): ListboxOption[] {
  return Array.from({ length: n }, (_, i) => ({
    value: `v${i}`,
    label: `Edificación número ${i + 1} — bloque B${i}`,
  }))
}

async function abrirListbox(): Promise<{ trigger: HTMLButtonElement; panel: HTMLElement }> {
  const trigger = await vi.waitFor(() => {
    const el = document.querySelector<HTMLButtonElement>('[aria-haspopup="listbox"]')
    expect(el, 'trigger del listbox').not.toBeNull()
    return el as HTMLButtonElement
  })
  trigger.click()
  const panel = await vi.waitFor(() => {
    const el = document.querySelector<HTMLElement>('[role="listbox"]')
    expect(el, 'listbox abierto').not.toBeNull()
    return (el as HTMLElement).parentElement as HTMLElement
  })
  return { trigger, panel }
}

describe('ListboxSelect — la lista siempre cabe en el viewport', () => {
  beforeEach(() => cleanup())
  afterEach(() => cleanup())

  describe.each(VIEWPORTS)('$nombre', ({ width, height }) => {
    beforeEach(async () => {
      await ajustarViewport(width, height)
    })

    it('sin espacio abajo: abre hacia arriba, sin salirse y con scroll interno', async () => {
      render(
        <div style={{ position: 'fixed', right: 12, bottom: 12, width: 240 }}>
          <ListboxSelect
            value=""
            onChange={noop}
            options={opcionesLargas()}
            placeholder="Edificación"
            className="ui-input"
          />
        </div>
      )

      const { trigger, panel } = await abrirListbox()
      dentroDelViewport(panel)
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)

      const gatillo = trigger.getBoundingClientRect()
      const caja = panel.getBoundingClientRect()
      expect(caja.bottom, 'la lista abre hacia arriba').toBeLessThanOrEqual(gatillo.top + 1)

      const lista = panel.querySelector<HTMLElement>('[role="listbox"]')
      expect(lista).not.toBeNull()
      expect(lista!.scrollHeight, 'la lista hace scroll interno').toBeGreaterThan(
        lista!.clientHeight
      )
    })

    it('al borde derecho: la lista se recorta a la derecha', async () => {
      render(
        <div style={{ position: 'fixed', right: 4, top: Math.round(height / 2), width: 240 }}>
          <ListboxSelect
            value=""
            onChange={noop}
            options={opcionesLargas()}
            placeholder="Edificación"
            className="ui-input"
          />
        </div>
      )

      const { panel } = await abrirListbox()
      dentroDelViewport(panel)
      expect(panel.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth - 7)
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    it('elegir una opción la cierra y emite el valor', async () => {
      const onChange = vi.fn()
      render(
        <div style={{ position: 'fixed', left: 12, top: 12, width: 240 }}>
          <ListboxSelect
            value=""
            onChange={onChange}
            options={opcionesLargas(5)}
            placeholder="Edificación"
            className="ui-input"
          />
        </div>
      )

      const { panel } = await abrirListbox()
      dentroDelViewport(panel)

      const opciones = panel.querySelectorAll<HTMLButtonElement>('[role="option"]')
      expect(opciones.length).toBe(5)
      ;(opciones[2] as HTMLButtonElement).click()

      expect(onChange).toHaveBeenCalledWith('v2')
      await vi.waitFor(() => {
        expect(document.querySelector('[role="listbox"]')).toBeNull()
      })
    })
  })
})

describe('Configuración — hero y pestañas', () => {
  beforeEach(() => cleanup())
  afterEach(() => cleanup())

  const renderSettings = async () => {
    render(
      <ToastProvider>
        <SettingsView initialUser={settingsUser} initialSessions={settingsSessions} />
      </ToastProvider>
    )
    await vi.waitFor(() => {
      expect(document.querySelector('[role="tablist"]')).not.toBeNull()
    })
  }

  describe.each(VIEWPORTS)('$nombre', ({ width, height }) => {
    beforeEach(async () => {
      await ajustarViewport(width, height)
    })

    it('el documento y la barra de pestañas no desbordan', async () => {
      await renderSettings()
      const tablist = document.querySelector<HTMLElement>('[role="tablist"]')
      expect(tablist).not.toBeNull()
      expect(tablist!.getBoundingClientRect().right).toBeLessThanOrEqual(
        window.innerWidth + 1
      )
      expect(desbordeDocumento()).toBeLessThanOrEqual(1)
    })

    it('las 4 pestañas miden ≥ 40px por debajo de lg', async () => {
      await renderSettings()
      const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      expect(tabs).toHaveLength(4)
      if (width < 1024) {
        for (const tab of tabs) {
          expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(39.5)
        }
      }
    })

    it('cambiar de pestaña no desborda el documento', async () => {
      await renderSettings()
      for (const id of ['apariencia', 'seguridad', 'notificaciones'] as const) {
        const tab = document.querySelector<HTMLButtonElement>(`#${id}-tab`)
        expect(tab).not.toBeNull()
        tab!.click()
        await vi.waitFor(() => {
          expect(document.getElementById(`${id}-panel`)).not.toBeNull()
        })
        expect(desbordeDocumento()).toBeLessThanOrEqual(1)
      }
    })
  })
})
