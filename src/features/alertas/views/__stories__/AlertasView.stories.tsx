import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'

import { ToastProvider } from '@/shared/views/ui/ToastProvider'
import { AlertasView } from '../AlertasView'
import {
  alertasDemo,
  configsAlertasDemo,
  edificacionesAlertasDemo,
  evaluacionesAlertasDemo,
} from '../__fixtures__/alertas'

/**
 * La vista trae su propio marco de página (`min-h-screen` + contenedor con
 * `max-w-7xl`): en el canvas de Storybook se ve como en el dashboard.
 * Las server actions están aliadas al doble determinista de
 * `../__mocks__/serverActions.ts` (ver `.storybook/main.ts`).
 *
 * Nota: los toasts los pinta el `ToastProvider` (fuera del árbol del canvas) y
 * el `ConfirmDialog` entra por portal en `document.body`; ambos se consultan con
 * `screen`, no con `canvas`.
 *
 * El alcance por defecto es TODO el campus, así que las stories que necesitan el
 * panel de umbral o una bandeja concreta eligen primero su edificación.
 */

const meta = {
  component: AlertasView,
  tags: ['ai-generated'],
  // La vista avisa con toasts (guardar umbral, recalcular, triage): sin el
  // proveedor, `useToast` lanza.
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  args: {
    edificaciones: edificacionesAlertasDemo,
    alertas: alertasDemo,
    configs: configsAlertasDemo,
    evaluaciones: evaluacionesAlertasDemo,
    puedeEvaluar: true,
    puedeConfigurar: true,
  },
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof AlertasView>

export default meta
type Story = StoryObj<typeof meta>

/** Elige una opción del ListboxSelect (el panel es un portal en body). */
async function elegirListbox(trigger: HTMLElement, valor: string): Promise<void> {
  await userEvent.click(trigger)
  const doc = trigger.ownerDocument
  const panel = await waitFor(() => {
    const abierto = doc.querySelector('[role="listbox"]')
    expect(abierto, 'listbox abierto').not.toBeNull()
    return abierto as HTMLElement
  })
  const opcion = panel.querySelector<HTMLElement>(`[data-value="${valor}"]`)
  expect(opcion, `opción con data-value "${valor}"`).not.toBeNull()
  await userEvent.click(opcion as HTMLElement)
}

export const BandejaVigente: Story = {
  name: 'Bandeja vigente · KPIs, filtros y estados',
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { level: 1, name: 'Alertas de consumo' })

    // La bandeja vigente vive dentro de una edificación: el alcance por defecto
    // es todo el campus (ver la story de alcance), así que aquí se elige.
    await elegirListbox(canvas.getByLabelText('Edificación'), 'edi-demo-campus')

    // Bandeja vigente: la evaluación es la última y los datos no cambiaron.
    await canvas.findByText(/Bandeja vigente: evaluada el/)
    await canvas.findByText(/36 períodos comparados con el umbral/)

    // KPIs de Campus Robledo: 4 vigentes, 2 sin revisar, 2 de severidad alta.
    const vigentes = (await canvas.findByText('Alertas vigentes')).closest(
      '.ui-card-stat'
    ) as HTMLElement
    expect(within(vigentes).getByText('4')).toBeTruthy()
    const sinRevisar = (await canvas.findByText('Sin revisar')).closest(
      '.ui-card-stat'
    ) as HTMLElement
    expect(within(sinRevisar).getByText('2')).toBeTruthy()
    const altas = (await canvas.findByText('Severidad alta')).closest(
      '.ui-card-stat'
    ) as HTMLElement
    expect(within(altas).getByText('2')).toBeTruthy()

    // Tabla: 1 fila de cabecera + las 4 alertas del campus, cada una con su
    // snapshot de umbral (sin él la alerta no sería auditable).
    const filas = await canvas.findAllByRole('row')
    expect(filas.length).toBe(5)
    await canvas.findByText('marzo de 2026')
    const umbrales = await canvas.findAllByText(/umbral ±10 % \/ 2,0 σ/)
    expect(umbrales.length).toBe(4)
    // La descartada conserva su nota de contexto.
    await canvas.findByText(/laboratorio de refrigeración/i)
  },
}

export const AlcanceCampus: Story = {
  name: 'Alcance · todo el campus (por defecto)',
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { level: 1, name: 'Alertas de consumo' })

    // Sin elegir edificación: se ve el estado de TODAS las bandejas y el aviso
    // dice exactamente cuáles hay que recalcular (no un «desactualizada» a secas).
    await canvas.findByText(/2 bandejas sin recalcular/)
    await canvas.findByText(/1 con datos cambiados · 1 sin evaluar nunca/)
    await canvas.findByText(/Oficina Central, Bloque de Aulas 12/)

    // Recalcular es por edificación: con el campus entero en pantalla, no hay
    // un botón que dispare cinco evaluaciones a espaldas del usuario.
    const recalcular = canvas.getByRole('button', { name: /Recalcular alertas/i })
    expect(recalcular).toBeDisabled()

    // KPIs de todo el alcance: 5 alertas, 3 sin revisar, 3 de severidad alta,
    // repartidas en 2 de las 3 edificaciones.
    const vigentes = (await canvas.findByText('Alertas vigentes')).closest(
      '.ui-card-stat'
    ) as HTMLElement
    expect(within(vigentes).getByText('5')).toBeTruthy()
    const sinRevisar = (await canvas.findByText('Sin revisar')).closest(
      '.ui-card-stat'
    ) as HTMLElement
    expect(within(sinRevisar).getByText('3')).toBeTruthy()
    const altas = (await canvas.findByText('Severidad alta')).closest(
      '.ui-card-stat'
    ) as HTMLElement
    expect(within(altas).getByText('3')).toBeTruthy()
    const conAlertas = (await canvas.findByText('Edificaciones con alertas')).closest(
      '.ui-card-stat'
    ) as HTMLElement
    expect(within(conAlertas).getByText('2')).toBeTruthy()

    // La tabla suma una columna: sin ella habría que adivinar de qué bloque es
    // el período.
    await canvas.findByRole('columnheader', { name: 'Edificación' })
    expect(canvas.getAllByRole('row').length).toBe(6)
    expect(canvas.getAllByText('Oficina Central').length).toBeGreaterThan(0)

    // El umbral es por edificación: se muestra la foto del campus, pero se
    // ajusta eligiendo una.
    await canvas.findByRole('heading', { level: 2, name: 'Umbral por edificación' })
    await canvas.findByText('±15 % / 1,5 σ')
    await canvas.findByText('Sin configurar (norma)')
    await canvas.findByText('Elija una edificación en el selector para ajustar su umbral.')
    expect(canvas.queryByRole('button', { name: /Guardar umbral/i })).toBeNull()
  },
}

export const Filtros: Story = {
  name: 'Filtros · por estado y severidad',
  play: async ({ canvas, userEvent: ue }) => {
    await canvas.findByRole('heading', { level: 1, name: 'Alertas de consumo' })
    await elegirListbox(canvas.getByLabelText('Edificación'), 'edi-demo-campus')
    await canvas.findByText(/Bandeja vigente/)

    // Filtrar por estado: solo las nuevas (2 en el campus).
    await ue.click(canvas.getByRole('button', { name: 'Nuevas' }))
    await waitFor(() => {
      expect(canvas.getAllByRole('row').length).toBe(3)
    })

    // Encima, severidad alta: queda 1 (la de severidad media sale del filtro).
    await ue.click(canvas.getByRole('button', { name: 'Alta' }))
    await waitFor(() => {
      expect(canvas.getAllByRole('row').length).toBe(2)
    })
    expect(canvas.queryByText('febrero de 2026')).toBeNull()

    // Descartadas + alta deja 1; bajar a media deja el filtro sin resultados.
    await ue.click(canvas.getByRole('button', { name: 'Descartadas' }))
    await ue.click(canvas.getByRole('button', { name: 'Media' }))
    await canvas.findByText('Sin alertas con estos filtros')

    // Volver a «Todas» restaura la bandeja completa.
    await ue.click(canvas.getByRole('button', { name: 'Todas' }))
    await ue.click(canvas.getByRole('button', { name: 'Toda severidad' }))
    await waitFor(() => {
      expect(canvas.getAllByRole('row').length).toBe(5)
    })
  },
}

export const DescartarAlerta: Story = {
  name: 'Descartar · confirmación y estado preservado',
  play: async ({ canvas, userEvent: ue }) => {
    await canvas.findByRole('heading', { level: 1, name: 'Alertas de consumo' })
    await elegirListbox(canvas.getByLabelText('Edificación'), 'edi-demo-campus')
    await canvas.findByText(/Bandeja vigente/)

    const tabla = document.querySelector('.ui-table-shell') as HTMLElement
    const descartar = Array.from(
      tabla.querySelectorAll<HTMLButtonElement>('button')
    ).find((b) => (b.textContent ?? '').includes('Descartar')) as HTMLButtonElement
    await ue.click(descartar)

    // Confirmación explícita: descartar no borra el período inusual.
    const dialogo = await screen.findByRole('dialog')
    await within(dialogo).findByText('Descartar alerta')
    await within(dialogo).findByText(/no volverá a «nueva»/)
    await ue.click(within(dialogo).getByRole('button', { name: 'Descartar' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    // La server action mockeada responde con el nuevo estado.
    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toContain('descartada (simulado)')
  },
}

export const MarcarLeidaYRestaurar: Story = {
  name: 'Triage · marcar leída y restaurar',
  play: async ({ canvas, userEvent: ue }) => {
    await canvas.findByRole('heading', { level: 1, name: 'Alertas de consumo' })
    await elegirListbox(canvas.getByLabelText('Edificación'), 'edi-demo-campus')
    await canvas.findByText(/Bandeja vigente/)

    const leer = canvas.getAllByRole('button', { name: 'Marcar leída' })
    await ue.click(leer[0])
    expect((await screen.findByRole('alert')).textContent).toContain('leida (simulado)')

    // Sobre la alerta ya leída aparece «Restaurar» (devuelve a nueva).
    const restaurar = canvas.getAllByRole('button', { name: 'Restaurar' })
    await ue.click(restaurar[0])
    await waitFor(() => {
      const avisos = screen.getAllByRole('alert')
      expect(avisos.some((a) => a.textContent?.includes('nueva (simulado)'))).toBe(true)
    })
  },
}

export const Recalcular: Story = {
  name: 'Recalcular · bandeja desactualizada',
  play: async ({ canvas, userEvent: ue }) => {
    // Primera consulta en espera: el canvas aún no está comprometido cuando
    // arranca `play` y una consulta síncrona devolvería «no encontrado».
    await canvas.findByRole('heading', { level: 1, name: 'Alertas de consumo' })

    // Oficina Central: la firma guardada no coincide con los datos actuales.
    // El `<label for>` de la vista da al disparador el nombre accesible
    // «Edificación» (no el valor visible): se localiza por la etiqueta.
    await elegirListbox(canvas.getByLabelText('Edificación'), 'edi-demo-oficina')

    await canvas.findByText(/Bandeja desactualizada/)
    await canvas.findByText(/Recuerde recalcular para aplicar el umbral/)

    await ue.click(canvas.getByRole('button', { name: /Recalcular alertas/i }))
    await screen.findByText(/Bandeja recalculada/)
  },
}

export const SinEvaluar: Story = {
  name: 'Sin evaluar · bandeja vacía con acción',
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { level: 1, name: 'Alertas de consumo' })
    await elegirListbox(canvas.getByLabelText('Edificación'), 'edi-demo-nueva')

    await canvas.findByText(/aún no se ha evaluado/)
    await canvas.findByText('Sin alertas para esta edificación')
    await canvas.findByText(/Evalúe la edificación/)
    const boton = canvas.getByRole('button', { name: /Recalcular alertas/i })
    expect(boton).toBeEnabled()
  },
}

export const SoloLectura: Story = {
  name: 'Solo lectura · sin evaluar ni configurar',
  args: { puedeEvaluar: false, puedeConfigurar: false },
  play: async ({ canvas }) => {
    // En el alcance de campus el permiso de configuración no se anuncia (no hay
    // umbral que ajustar): se elige una edificación para ver los dos avisos.
    await canvas.findByRole('heading', { level: 1, name: 'Alertas de consumo' })
    await elegirListbox(canvas.getByLabelText('Edificación'), 'edi-demo-campus')

    await canvas.findByText(/requiere el permiso «Analizar consumo»/)
    await canvas.findByText(/requiere el permiso «Configurar umbral»/)

    const boton = canvas.getByRole('button', { name: /Recalcular alertas/i })
    expect(boton).toBeDisabled()
    // Sin `alerts:config` no hay control de guardado: solo el aviso.
    expect(canvas.queryByRole('button', { name: /Guardar umbral/i })).toBeNull()
    // Aun sin permisos, la bandeja se consulta.
    await canvas.findByText('marzo de 2026')
  },
}

export const ConfiguracionSinGuardar: Story = {
  name: 'Umbral · cambios sin guardar',
  play: async ({ canvas, userEvent: ue }) => {
    await canvas.findByRole('heading', { level: 1, name: 'Alertas de consumo' })
    await elegirListbox(canvas.getByLabelText('Edificación'), 'edi-demo-campus')
    await canvas.findByText('Umbral de la edificación')

    const guardar = canvas.getByRole('button', { name: /Guardar umbral/i })
    // Sin tocar nada no hay nada que guardar.
    expect(guardar).toBeDisabled()

    // Apagar la generación ensucia el formulario y explica que la bandeja no
    // se toca mientras esté desactivada.
    await ue.click(canvas.getByLabelText(/Generar alertas para esta edificación/i))
    await canvas.findByText('Cambios sin guardar.')
    await canvas.findByText(/no crea ni borra alertas/)
    await waitFor(() => expect(guardar).toBeEnabled())

    await ue.click(guardar)
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Umbral guardado (simulado)'
    )
  },
}
