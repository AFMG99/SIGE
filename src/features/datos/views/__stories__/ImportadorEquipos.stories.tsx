import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { crearBloque, eliminarBloque } from '@/features/datos/controllers/edificaciones'
import { ImportadorEquipos } from '../ImportadorEquipos'
import {
  bloquesDemo,
  calendariosDemo,
  edificacionesDemo,
  espaciosDemo,
  horariosEquipoDemo,
  rangosCalendarioDemo,
} from '../__fixtures__/catalogo'
import { EDIFICACION_CAMPUS } from '../__fixtures__/calculoUso'
import { resultadoEquiposDemo } from '../__fixtures__/resultado'
import { archivoEquipos, elegirListbox, opcionesListbox, subirArchivo } from './ayuda'

const meta = {
  component: ImportadorEquipos,
  tags: ['ai-generated'],
  args: {
    puedeCargar: true,
    edificaciones: edificacionesDemo,
    bloques: bloquesDemo,
    espacios: espaciosDemo,
    crearBloque,
    eliminarBloque,
    onIrAlCatalogo: () => {},
    // Contexto de calendario (6d4): config operativa + rangos + horarios del campus.
    calendarios: calendariosDemo,
    rangos: rangosCalendarioDemo,
    horarios: horariosEquipoDemo,
  },
} satisfies Meta<typeof ImportadorEquipos>

export default meta
type Story = StoryObj<typeof meta>

/**
 * El asistente exige elegir la edificación antes de leer cualquier archivo.
 * El catálogo de edificaciones vive en Facturas de energía › Edificaciones: aquí
 * solo se hereda la lista.
 */
async function elegirEdificacion(
  canvas: { findByLabelText: (m: RegExp, o?: object) => Promise<HTMLElement> },
  userEvent: { click: (el: HTMLElement) => Promise<unknown> }
): Promise<void> {
  const trigger = await canvas.findByLabelText(/^edificación/i)
  await elegirListbox(trigger, 'ed-campus-00000001', userEvent)
}

export const Paso1Carga: Story = {
  name: 'Paso 1 · Edificación y carga',
}

export const Paso2Mapeo: Story = {
  name: 'Paso 2 · Mapeo por segmentación',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoEquipos())

    await expect(
      await canvas.findByRole('button', { name: /continuar a vista previa/i }, { timeout: 5000 })
    ).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /descargar plantilla/i })).toBeNull()
  },
}

export const Paso3VistaPrevia: Story = {
  name: 'Paso 3 · Vista previa por espacio',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoEquipos())

    const continuar = await canvas.findByRole(
      'button',
      { name: /continuar a vista previa/i },
      { timeout: 5000 }
    )
    await userEvent.click(continuar)

    await expect(await canvas.findByText(/listo para importar/i)).toBeVisible()
    // La vista previa deja de importar directo: el flujo pasa por cálculos opcionales.
    await expect(
      canvas.getByRole('button', { name: /continuar a cálculos opcionales/i })
    ).toBeVisible()
  },
}

export const Paso4Calculos: Story = {
  name: 'Paso 4 · Cálculo global desde el calendario con diff antes de aplicar',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoEquipos())

    const continuar = await canvas.findByRole(
      'button',
      { name: /continuar a vista previa/i },
      { timeout: 5000 }
    )
    await userEvent.click(continuar)
    await userEvent.click(
      await canvas.findByRole(
        'button',
        { name: /continuar a cálculos opcionales/i },
        { timeout: 5000 }
      )
    )

    // Tabla espejo de la vista previa: descriptivas en solo lectura (sin input
    // de tipo/bloque) y horas/días con los valores que trajo el archivo.
    await expect(
      await canvas.findByRole('heading', { name: /cálculo de uso desde el calendario/i })
    ).toBeVisible()
    expect(canvas.queryByLabelText(/fila 1, tipo de equipo/i)).toBeNull()
    const horasFila1 = (await canvas.findByLabelText(
      /fila 1, horas de uso por día/i
    )) as HTMLInputElement
    expect(horasFila1.value).toBe('8')

    // Cálculo global → modal: 5 meses con facturas (mock 2026) que alimentan
    // el PROMEDIO aplicable (12 h / 28 días); el último mes viene
    // preseleccionado como referencia (mayo 2026 → 12 h / 31 días).
    await userEvent.click(await canvas.findByRole('button', { name: /calcular todas las filas/i }))

    const dialog = await canvas.findByRole('dialog', { name: /cambios antes de aplicar/i })
    expect(
      within(dialog).getByRole('button', { name: 'mayo 2026' }).getAttribute('aria-pressed')
    ).toBe('true')
    for (const etiqueta of ['enero 2026', 'febrero 2026', 'marzo 2026', 'abril 2026']) {
      expect(within(dialog).getByRole('button', { name: etiqueta })).toBeVisible()
    }

    // Diff: las 7 filas cambian al promedio 12 h / 28 días (cabecera + 7 filas);
    // el mes elegido aparece como referencia entre paréntesis.
    const filasDiff = within(dialog).getAllByRole('row')
    expect(filasDiff).toHaveLength(8)
    expect(filasDiff[1].textContent).toContain('→')
    expect(filasDiff[1].textContent).toContain('(mayo 2026: 31)')

    await userEvent.click(
      within(dialog).getByRole('button', { name: /aplicar 7 cambios \(promedio de 5 meses\)/i })
    )

    await waitFor(() => {
      expect(canvas.queryByRole('dialog', { name: /cambios antes de aplicar/i })).toBeNull()
    })
    const toast = await canvas.findByText(
      /se actualizaron 7 filas con el promedio de 5 meses con facturas/i
    )
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })

    // Las filas quedaron con el promedio de la serie (12 h / 28 días).
    const horasTras = (await canvas.findByLabelText(
      /fila 1, horas de uso por día/i
    )) as HTMLInputElement
    const diasTras = (await canvas.findByLabelText(
      /fila 1, días de uso por mes/i
    )) as HTMLInputElement
    expect(horasTras.value).toBe('12')
    expect(diasTras.value).toBe('28')
  },
}

export const ModoCalculoUso: Story = {
  name: 'Paso 4 · Cálculo por fila: meses con facturas y cancelar no aplica',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoEquipos())

    const continuar = await canvas.findByRole(
      'button',
      { name: /continuar a vista previa/i },
      { timeout: 5000 }
    )
    await userEvent.click(continuar)
    await userEvent.click(
      await canvas.findByRole(
        'button',
        { name: /continuar a cálculos opcionales/i },
        { timeout: 5000 }
      )
    )

    // Cálculo individual desde la columna Acciones (alcance de 1 fila).
    await userEvent.click(await canvas.findByRole('button', { name: /calcular uso de la fila 1/i }))

    const dialog = await canvas.findByRole('dialog', { name: /cambios antes de aplicar/i })
    await expect(await within(dialog).findByText(/^Fila 1\./)).toBeVisible()

    // Los 5 meses con facturas son chips seleccionables; el último viene activo.
    for (const etiqueta of [
      'enero 2026',
      'febrero 2026',
      'marzo 2026',
      'abril 2026',
      'mayo 2026',
    ]) {
      expect(within(dialog).getByRole('button', { name: etiqueta })).toBeVisible()
    }
    expect(
      within(dialog).getByRole('button', { name: 'mayo 2026' }).getAttribute('aria-pressed')
    ).toBe('true')

    // Enero 2026 no tiene días operativos (los rangos empiezan el 09/02): su
    // referencia en la tabla es «—», pero el diff NO depende del mes elegido —
    // lo que se aplica es el promedio de la serie (12 h / 28 días).
    await userEvent.click(within(dialog).getByRole('button', { name: 'enero 2026' }))
    const filasEnero = within(dialog).getAllByRole('row')
    expect(filasEnero).toHaveLength(2)
    expect(filasEnero[1].textContent).toContain('→')
    expect(filasEnero[1].textContent).toContain('(enero 2026: —)')

    // Volver a mayo cambia la referencia mostrada; el promedio aplicable es el mismo.
    await userEvent.click(within(dialog).getByRole('button', { name: 'mayo 2026' }))
    const filasVuelta = within(dialog).getAllByRole('row')
    expect(filasVuelta).toHaveLength(2)
    expect(filasVuelta[1].textContent).toContain('→')
    expect(filasVuelta[1].textContent).toContain('(mayo 2026: 31)')

    // Cancelar: nada se aplica.
    await userEvent.click(within(dialog).getByRole('button', { name: /cancelar/i }))
    await waitFor(() => {
      expect(canvas.queryByRole('dialog', { name: /cambios antes de aplicar/i })).toBeNull()
    })
    const horas1 = (await canvas.findByLabelText(
      /fila 1, horas de uso por día/i
    )) as HTMLInputElement
    expect(horas1.value).toBe('8')

    // Reabrir y aplicar: solo cambia la fila 1 (la 2 conserva el archivo).
    await userEvent.click(await canvas.findByRole('button', { name: /calcular uso de la fila 1/i }))
    const dialog2 = await canvas.findByRole('dialog', { name: /cambios antes de aplicar/i })
    await userEvent.click(
      within(dialog2).getByRole('button', { name: /aplicar 1 cambio \(promedio de 5 meses\)/i })
    )
    await waitFor(() => {
      expect(canvas.queryByRole('dialog', { name: /cambios antes de aplicar/i })).toBeNull()
    })
    const toast = await canvas.findByText(
      /se actualizaron 1 fila con el promedio de 5 meses con facturas/i
    )
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 2000 })

    const horas1Tras = (await canvas.findByLabelText(
      /fila 1, horas de uso por día/i
    )) as HTMLInputElement
    const horas2 = (await canvas.findByLabelText(
      /fila 2, horas de uso por día/i
    )) as HTMLInputElement
    expect(horas1Tras.value).toBe('12')
    expect(horas2.value).toBe('8')
  },
}

export const Paso5Resultado: Story = {
  name: 'Paso 5 · Resultado de la importación',
  args: { resultadoInicial: resultadoEquiposDemo, edificacionInicial: EDIFICACION_CAMPUS },
}

export const ImportacionExitosa: Story = {
  name: 'Flujo completo · Edificación → cálculos opcionales → resultado',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoEquipos())

    const continuar = await canvas.findByRole(
      'button',
      { name: /continuar a vista previa/i },
      { timeout: 5000 }
    )
    await userEvent.click(continuar)

    // Vista previa navega al paso de cálculos (obligatorio pasar por él).
    const aCalculos = await canvas.findByRole(
      'button',
      { name: /continuar a cálculos opcionales/i },
      { timeout: 5000 }
    )
    await userEvent.click(aCalculos)

    // El cálculo es opcional: se puede saltar directo a la importación.
    const aImportacion = await canvas.findByRole(
      'button',
      { name: /continuar a importación/i },
      { timeout: 5000 }
    )
    await userEvent.click(aImportacion)

    const importar = await canvas.findByRole(
      'button',
      { name: /importar \d+ filas/i },
      { timeout: 5000 }
    )
    await userEvent.click(importar)

    // La barra de progreso avanza con un setInterval antes de mostrar el resultado.
    await expect(
      await canvas.findByText('Importación finalizada', {}, { timeout: 10000 })
    ).toBeVisible()
  },
}

export const EliminarBloqueConDatos: Story = {
  name: 'Catálogo · bloqueo al eliminar un bloque con datos',
  play: async ({ canvas, canvasElement, userEvent }) => {
    // El ConfirmDialog se monta vía createPortal en document.body.
    const screen = within(canvasElement.ownerDocument.body)

    const selectEdificacion = await canvas.findByLabelText(/^edificación/i)
    await elegirListbox(selectEdificacion, 'ed-campus-00000001', userEvent)
    const selectBloque = await canvas.findByLabelText(/bloque \/ piso/i)
    await elegirListbox(selectBloque, 'bk-campus-a102-001', userEvent)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar bloque A-102' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))

    const alerta = await screen.findByRole('alert')
    await waitFor(
      () => {
        expect(alerta.textContent ?? '').toContain(
          'No se puede eliminar el bloque "A-102 — Ala Sur"'
        )
      },
      { timeout: 3000 }
    )
    // El bloque sigue en el catálogo: nada se borró en cascada.
    const bloqueTras = await canvas.findByLabelText(/bloque \/ piso/i)
    const opciones = await opcionesListbox(bloqueTras, userEvent)
    expect(opciones.some((nombre) => /A-102 — Ala Sur/.test(nombre))).toBe(true)
  },
}

export const SoloLectura: Story = {
  name: 'Rol sin permiso de carga',
  args: { puedeCargar: false },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/solo lectura/i)).toBeVisible()
  },
}

// La precedencia por nivel de los horarios (espacio > bloque > edificación) y
// la política de operatividad del calendario viven en los tests unitarios de
// models/horarios.test.ts, models/calculoUso.test.ts y
// models/calculoUsoFilas.test.ts; las stories del paso 4 ejercitan el modal de
// diff (global y por fila) con el calendario demo.
