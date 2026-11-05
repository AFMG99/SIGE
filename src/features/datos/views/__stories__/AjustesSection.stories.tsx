import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { AjustesSection } from '../AjustesSection'
import { bloquesDemo, edificacionesDemo } from '../__fixtures__/catalogo'
import { ajustesExistentesDemo } from '../__fixtures__/existencias'

/**
 * Sección «Ajustes» del módulo de datos.
 *
 * Cubre tres regresiones/verificaciones reales de la UI:
 *  - T1: el bloque se elegía en un `<input type="text">` donde había que pegar
 *    el CUID; ahora es una cascada edificación → bloque con `ListboxSelect`.
 *  - T2: la pestaña «Aplicados» recibía siempre `[]` desde `DatosContent`, así
 *    que mentía ("el cálculo actual no aplicó ajustes") aunque no hubiera
 *    cálculo. Ahora distingue `null` (sin cálculo) de `[]` (cálculo sin ajustes).
 *  - T3: el modal decía «Nuevo Ajuste No Rutinario» aunque el select ofrecía
 *    «Rutinario», y éste no mostraba que solo documenta (§7.6.2).
 *
 * Las server actions del módulo están aliadas al doble determinista de
 * `../__mocks__/serverActions.ts` (ver `.storybook/main.ts`), por lo que el
 * formulario nunca toca la BD. `crearAjuste` mock responde `completado` y eso
 * dispararía `window.location.reload()`: estas stories abren y revisan el
 * formulario, pero NO lo envían.
 */

const meta = {
  component: AjustesSection,
  tags: ['ai-generated'],
  args: {
    ajustes: ajustesExistentesDemo,
    ajustesAplicados: null,
    modo: 'carga',
    puedeCargar: true,
    edificaciones: edificacionesDemo,
    bloques: bloquesDemo,
  },
} satisfies Meta<typeof AjustesSection>

export default meta
type Story = StoryObj<typeof meta>

type ContextoPlay = Parameters<NonNullable<Story['play']>>[0]
type Canvas = ContextoPlay['canvas']
type UserEvent = ContextoPlay['userEvent']

/** Abre el `ListboxSelect` etiquetado y elige opción por `data-value` (panel en portal). */
async function elegir(
  canvas: Canvas,
  userEvent: UserEvent,
  etiqueta: string,
  valor: string
): Promise<void> {
  const trigger = await canvas.findByLabelText(etiqueta)
  await userEvent.click(trigger)
  const doc = trigger.ownerDocument
  const panel = await waitFor(() => {
    const listbox = doc.querySelector('[role="listbox"]')
    expect(listbox, 'listbox abierto').not.toBeNull()
    return listbox as HTMLElement
  })
  const opcion = panel.querySelector<HTMLElement>(`[data-value="${valor}"]`)
  expect(opcion, `opción ${valor}`).not.toBeNull()
  await userEvent.click(opcion as HTMLElement)
}

export const SelectorDeBloqueEnCascada: Story = {
  name: 'Carga · el bloque se elige en cascada, no se teclea un ID',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /nuevo ajuste/i }))

    // Regresión T1: no debe existir el input de texto con el CUID.
    expect(canvas.queryByPlaceholderText(/id del bloque/i)).toBeNull()

    const edificacion = edificacionesDemo[0]
    const bloque = bloquesDemo.find((b) => b.edificacionId === edificacion.id)
    expect(bloque, 'bloque demo perteneciente a la primera edificación').toBeTruthy()

    // Cascada: sin edificación elegida el bloque no es seleccionable.
    const bloqueAntes = (await canvas.findByLabelText('Bloque')) as HTMLButtonElement
    expect(bloqueAntes.disabled).toBe(true)

    await elegir(canvas, userEvent, 'Edificación', edificacion.id)

    const bloqueDespues = (await canvas.findByLabelText('Bloque')) as HTMLButtonElement
    expect(bloqueDespues.disabled).toBe(false)

    await elegir(canvas, userEvent, 'Bloque', bloque!.id)

    const elegido = (await canvas.findByLabelText('Bloque')) as HTMLButtonElement
    expect(elegido.getAttribute('data-value')).toBe(bloque!.id)
    expect(elegido.textContent).toContain(bloque!.codigo)
  },
}

export const AplicadosSinCalculo: Story = {
  name: 'Aplicados · sin cálculo en la sesión (null)',
  args: {
    modo: 'datos',
    puedeCargar: false,
    ajustesAplicados: null,
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('tab', { name: /aplicados/i }))
    await expect(
      await canvas.findByRole('heading', { name: /sin ajustes aplicados/i })
    ).toBeVisible()
    // Null = nadie calculó: no se puede afirmar que "el cálculo no aplicó" nada.
    await expect(
      await canvas.findByText(/aún no se ha calculado una línea base/i)
    ).toBeVisible()
    await expect(
      canvas.queryByText(/el cálculo actual no aplicó ajustes/i)
    ).toBeNull()
  },
}

export const AplicadosTrasCalculoSinAjustes: Story = {
  name: 'Aplicados · el cálculo corrió y no aplicó ajustes ([])',
  args: {
    modo: 'datos',
    puedeCargar: false,
    ajustesAplicados: [],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('tab', { name: /aplicados/i }))
    await expect(
      await canvas.findByRole('heading', { name: /sin ajustes aplicados/i })
    ).toBeVisible()
    await expect(
      await canvas.findByText(/el cálculo actual no aplicó ajustes no rutinarios/i)
    ).toBeVisible()
    await expect(canvas.queryByText(/aún no se ha calculado/i)).toBeNull()
  },
}

const TEXTO_AYUDA_RUTINARIO =
  'Se registra para documentar (§7.6.2); no aplica al cálculo de la LBEn.'

export const AyudaRutinario: Story = {
  name: 'Ayuda contextual al crear un ajuste rutinario',
  play: async ({ canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo Ajuste' }))

    // El título del modal ya no contradice el select de Tipo.
    const titulo = await screen.findByRole('heading', { name: 'Nuevo ajuste' })
    await waitFor(() => expect(titulo).toBeVisible(), { timeout: 2000 })

    const tipo = await screen.findByLabelText('Tipo')

    // Por defecto es NO_RUTINARIO: no se muestra la ayuda.
    await expect(screen.queryByText(TEXTO_AYUDA_RUTINARIO)).toBeNull()

    // Elegir «Rutinario» muestra la nota de documentación (§7.6.2).
    await userEvent.selectOptions(tipo, 'RUTINARIO')
    await waitFor(
      () => expect(screen.getByText(TEXTO_AYUDA_RUTINARIO)).toBeVisible(),
      { timeout: 2000 }
    )

    // Volver a «No rutinario» la oculta de nuevo.
    await userEvent.selectOptions(tipo, 'NO_RUTINARIO')
    await waitFor(() => expect(screen.queryByText(TEXTO_AYUDA_RUTINARIO)).toBeNull(), {
      timeout: 2000,
    })
  },
}
