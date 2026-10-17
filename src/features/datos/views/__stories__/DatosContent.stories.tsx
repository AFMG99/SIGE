import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { HeaderPosProvider } from '@/shared/views/nav/NavContext'
import { DatosContent } from '../DatosContent'

/**
 * Sections split out with React.lazy (T7) load their chunk on demand, so the
 * first query for their content needs more than the default 1s wait.
 */
const LAZY_SECTION_TIMEOUT = 5000
import { bloquesDemo, calendariosDemo, edificacionesDemo, espaciosDemo, eventosDemo, horariosEquipoDemo, rangosCalendarioDemo } from '../__fixtures__/catalogo'
import {
  ajustesExistentesDemo,
  equiposExistentesDemo,
  facturasExistentesDemo,
  lineasBaseFilasDemo,
  variablesExistentesDemo,
} from '../__fixtures__/existencias'

const meta = {
  component: DatosContent,
  tags: ['ai-generated'],
  args: {
    role: 'ADMIN_TI',
    puedeCargar: true,
    puedeCalcular: true,
    stats: { facturas: 6, equipos: 14, variables: 9, lineasBase: 4 },
    edificaciones: edificacionesDemo,
    bloques: bloquesDemo,
    espacios: espaciosDemo,
    calendarios: calendariosDemo,
    rangos: rangosCalendarioDemo,
    horarios: horariosEquipoDemo,
    eventos: eventosDemo,
    facturasExistentes: facturasExistentesDemo,
    equiposExistentes: equiposExistentesDemo,
    variablesExistentes: variablesExistentesDemo,
    ajustesExistentes: ajustesExistentesDemo,
    lineasBaseFilas: lineasBaseFilasDemo,
  },
} satisfies Meta<typeof DatosContent>

export default meta
type Story = StoryObj<typeof meta>

export const VistaResumen: Story = {
  name: 'Resumen (guía Cómo funciona)',
}

export const HeaderIzquierda: Story = {
  name: 'Header docked a la izquierda (sin sidebar propio)',
  decorators: [
    (Story) => (
      <HeaderPosProvider value="left">
        <Story />
      </HeaderPosProvider>
    ),
  ],
}

export const NavegaDesdeTarjetas: Story = {
  name: 'Navegación interna desde las tarjetas',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: /facturas de energía.*registros en bd/i })
    )

    await expect(
      await canvas.findByRole('heading', { name: /carga de facturas de energía/i })
    ).toBeVisible()
    // Por defecto la sección abre en modo carga: el asistente está montado.
    await expect(
      await canvas.findByRole(
        'button',
        { name: /descargar plantilla/i },
        { timeout: LAZY_SECTION_TIMEOUT }
      )
    ).toBeVisible()
  },
}

export const SeparaCargaDeVisualizacion: Story = {
  name: 'Separación · Carga vs Visualización',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: /facturas de energía.*registros en bd/i })
    )

    // Modo carga: solo el asistente, sin datos de la BD.
    await expect(
      await canvas.findByRole(
        'button',
        { name: /descargar plantilla/i },
        { timeout: LAZY_SECTION_TIMEOUT }
      )
    ).toBeVisible()
    await expect(canvas.queryByLabelText(/buscar en datos guardados/i)).toBeNull()

    // Modo visualización: solo los datos guardados, sin el asistente.
    await userEvent.click(canvas.getByRole('button', { name: /^visualización$/i }))
    await expect(await canvas.findByText('Último periodo')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /descargar plantilla/i })).toBeNull()
  },
}

export const GestionaDesdeElToggle: Story = {
  name: 'Separación · pestaña Gestión con CRUD y vaciado',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: /facturas de energía.*registros en bd/i })
    )

    // Tercera pestaña: la tabla de gestión con acciones por fila.
    await userEvent.click(canvas.getByRole('button', { name: /^gestión$/i }))
    await expect(
      await canvas.findByRole('heading', { name: /gestión de facturas guardadas/i })
    ).toBeVisible()
    await expect(
      await canvas.findByRole('button', { name: 'Editar factura 2024-12' })
    ).toBeVisible()
    await expect(
      await canvas.findByRole('button', { name: 'Vaciar base de datos' })
    ).toBeVisible()
    // La pestaña de gestión no monta el importador.
    await expect(canvas.queryByRole('button', { name: /descargar plantilla/i })).toBeNull()
  },
}

export const VariablesOperativas: Story = {
  name: 'Variables Operativas · tres pestañas',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: /variables mensuales.*registros activos/i })
    )

    await expect(
      await canvas.findByRole('heading', { name: /variables operativas/i })
    ).toBeVisible()
    // Modo carga: el asistente de importación segmentado por edificación.
    await expect(
      await canvas.findByRole(
        'button',
        { name: /descargar plantilla/i },
        { timeout: LAZY_SECTION_TIMEOUT }
      )
    ).toBeVisible()

    // Visualización: el panel con tono sky.
    await userEvent.click(canvas.getByRole('button', { name: /^visualización$/i }))
    await expect(await canvas.findByText('GDE promedio')).toBeVisible()
    await expect(
      await canvas.findByText('GDE mensual (Grados Día de Enfriamiento)')
    ).toBeVisible()

    // Gestión: la tabla editable con acciones por fila.
    await userEvent.click(canvas.getByRole('button', { name: /^gestión$/i }))
    await expect(
      await canvas.findByRole('heading', { name: /gestión de variables guardadas/i })
    ).toBeVisible()
    await expect(
      await canvas.findByRole('button', { name: /editar variable 2024-12/i })
    ).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /descargar plantilla/i })).toBeNull()
  },
}

export const AjustesSinCarga: Story = {
  name: 'Ajustes · modos Carga/Visualización/Gestión (Anexo 4)',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /^ajustes$/i }))

    await expect(
      await canvas.findByRole(
        'heading',
        { name: /ajustes energéticos/i },
        { timeout: LAZY_SECTION_TIMEOUT }
      )
    ).toBeVisible()

    // Toggle de tres modos (Anexo 4); arranca en Carga.
    await expect(
      await canvas.findByRole(
        'group',
        { name: 'Modo de la sección Ajustes' },
        { timeout: LAZY_SECTION_TIMEOUT }
      )
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: /^carga$/i })).toBeVisible()
    await expect(canvas.getByRole('button', { name: /^datos$/i })).toBeVisible()
    await expect(canvas.getByRole('button', { name: /^gestion$/i })).toBeVisible()

    // Modo carga: creación habilitada.
    await expect(
      await canvas.findByText(/cree ajustes no rutinarios \(anexo 4\)/i)
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: /nuevo ajuste/i })).toBeVisible()

    // Los pills del toggle cambian el modo (onModoChange → setVista global).
    await userEvent.click(canvas.getByRole('button', { name: /^datos$/i }))
    await expect(
      await canvas.findByText(/consulte los ejemplos del anexo 4/i)
    ).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /nuevo ajuste/i })).toBeNull()

    await userEvent.click(canvas.getByRole('button', { name: /^carga$/i }))
    await expect(
      await canvas.findByText(/cree ajustes no rutinarios \(anexo 4\)/i)
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: /nuevo ajuste/i })).toBeVisible()

    // Pestaña Registrados en modo carga: solo lectura, sin acciones de gestión.
    await userEvent.click(canvas.getByRole('tab', { name: /registrados/i }))
    await expect(await canvas.findByText('Registros guardados')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /eliminar ajuste/i })).toBeNull()
    // Nunca hay importador en esta sección.
    await expect(canvas.queryByRole('button', { name: /descargar plantilla/i })).toBeNull()

    // Pestaña Aplicados: vacía hasta que la depuración aplique ajustes.
    await userEvent.click(canvas.getByRole('tab', { name: /aplicados/i }))
    await expect(await canvas.findByText(/sin ajustes aplicados/i)).toBeVisible()

    // Gestión: se llega cambiando el modo global en otra sección
    // (los pills del toggle de Ajustes aún no cambian el modo).
    await userEvent.click(
      canvas.getByRole('button', { name: /^facturas de energía$/i })
    )
    await userEvent.click(await canvas.findByRole('button', { name: /^gestión$/i }))

    await userEvent.click(canvas.getByRole('button', { name: /^ajustes$/i }))
    await userEvent.click(canvas.getByRole('tab', { name: /registrados/i }))
    await expect(
      await canvas.findByRole('heading', { name: /gestión de ajustes guardados/i })
    ).toBeVisible()
    await expect(
      await canvas.findByRole('button', { name: /eliminar ajuste no rutinario del bloque a-101/i })
    ).toBeVisible()
    await expect(await canvas.findByRole('button', { name: 'Vaciar base de datos' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /descargar plantilla/i })).toBeNull()
  },
}

export const CalendarioFestivosEnEdificaciones: Story = {
  name: 'Edificaciones → vista Calendario con festivos',
  play: async ({ canvas, userEvent }) => {
    // Sección Edificaciones (sidebar de DATOS_SECTIONS).
    await userEvent.click(await canvas.findByRole('button', { name: /^edificaciones$/i }))
    await expect(
      await canvas.findByRole('heading', { name: /gestión de edificaciones/i })
    ).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: 'Infraestructura', pressed: true })
    ).toBeVisible()

    // Sub-vista «Calendario» (S11): festivos de Colombia del mes en curso.
    await userEvent.click(canvas.getByRole('button', { name: 'Calendario' }))
    await expect(
      await canvas.findByRole('heading', { name: /calendario de festivos de colombia/i })
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Mes siguiente' })).toBeVisible()
    await expect(
      canvas.getByRole('heading', { name: /^festivos de .+ de \d{4}$/i })
    ).toBeVisible()
    // Volver al catálogo.
    await userEvent.click(canvas.getByRole('button', { name: 'Infraestructura' }))
    await expect(
      await canvas.findByRole('button', { name: /nueva edificación/i })
    ).toBeVisible()
  },
}

export const EventosCalendarioEnSubvista: Story = {
  name: 'Edificaciones → Calendario · panel CRUD de eventos (S7/S8)',
  play: async ({ canvas, userEvent }) => {
    // Sub-vista «Calendario»: el panel de eventos es hermano del calendario.
    await userEvent.click(await canvas.findByRole('button', { name: /^edificaciones$/i }))
    await userEvent.click(canvas.getByRole('button', { name: 'Calendario' }))
    await expect(
      await canvas.findByRole('heading', { name: /eventos del calendario/i })
    ).toBeVisible()
    await expect(
      await canvas.findByRole('heading', { name: /calendario de festivos de colombia/i })
    ).toBeVisible()

    // Sin edificación seleccionada: estado vacío (el contexto es obligatorio).
    await expect(await canvas.findByText('Seleccione una edificación')).toBeVisible()

    // Elegir el campus lista sus 5 eventos con badge de nivel (S8).
    const selector = canvas.getByLabelText(/edificación/i)
    await userEvent.click(selector)
    const panel = await waitFor(() => {
      const abierto = document.querySelector('[role="listbox"]')
      expect(abierto, 'listbox abierto').not.toBeNull()
      return abierto as HTMLElement
    })
    const opcion = panel.querySelector<HTMLElement>('[data-value="ed-campus-00000001"]')
    expect(opcion, 'opción del campus').not.toBeNull()
    await userEvent.click(opcion as HTMLElement)

    await expect(await canvas.findByText('Semana de la infraestructura')).toBeVisible()
    await expect(await canvas.findByText('Espacio · Aula 101')).toBeVisible()
    expect(canvas.queryByText('Cierre por auditoría interna')).toBeNull()
  },
}

export const HorariosPorEquipoEnSeccion: Story = {
  name: 'Equipos Eléctricos · trazabilidad de horarios y horas de uso (S3)',
  play: async ({ canvas, userEvent }) => {
    // Sección «Equipos Eléctricos» (sidebar de DATOS_SECTIONS). Se acota al
    // aside: la guía «Cómo funciona» del Resumen repite una pestaña con el
    // mismo nombre exacto y rompe el getByRole único.
    const menu = canvas.getByRole('complementary', {
      name: /menú lateral del módulo de datos/i,
    })
    await userEvent.click(
      await within(menu).findByRole('button', { name: /^equipos eléctricos$/i })
    )

    // Modo Visualización: panel de datos + trazabilidad por equipo (S3).
    await userEvent.click(canvas.getByRole('button', { name: /^visualización$/i }))
    await expect(
      await canvas.findByRole('heading', { name: 'Horarios aplicables y horas de uso' })
    ).toBeVisible()
    // Cada equipo con horarios muestra su resumen anclado a «esta semana».
    expect(canvas.getAllByText('Horas de uso · esta semana').length).toBeGreaterThan(0)
    // Los equipos de Administración no tienen horarios en el fixture: estado
    // vacío por equipo con la puntería a la sub-vista «Calendario».
    const vacios = await canvas.findAllByText('Este equipo aún no tiene horarios asociados.')
    expect(vacios.length).toBe(2)

    // La trazabilidad también se lista bajo la tabla del modo Gestión.
    await userEvent.click(canvas.getByRole('button', { name: /^gestión$/i }))
    await expect(
      await canvas.findByRole('heading', { name: 'Horarios aplicables y horas de uso' })
    ).toBeVisible()
  },
}
