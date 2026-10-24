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
    await expect(canvas.getByRole('button', { name: /importar \d+ filas/i })).toBeVisible()
  },
}

export const Paso4Resultado: Story = {
  name: 'Paso 4 · Resultado de la importación',
  args: { resultadoInicial: resultadoEquiposDemo, edificacionInicial: EDIFICACION_CAMPUS },
}

export const ImportacionExitosa: Story = {
  name: 'Flujo completo · Edificación → resultado',
  play: async ({ canvas, canvasElement, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await subirArchivo(canvasElement, userEvent, archivoEquipos())

    const continuar = await canvas.findByRole(
      'button',
      { name: /continuar a vista previa/i },
      { timeout: 5000 }
    )
    await userEvent.click(continuar)

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

export const UsoDesdeCalendario: Story = {
  name: '6d4 · Uso de equipos auto-completado desde el calendario',
  play: async ({ canvas, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    // Ingreso manual: 5 filas vacías → vista previa editable.
    await userEvent.click(await canvas.findByRole('button', { name: /ingreso manual/i }))

    // El bloque de uso aparece porque el campus tiene configuración operativa.
    const completar = await canvas.findByRole('button', {
      name: /completar horas y días de uso desde el calendario/i,
    })
    // Mes por defecto = actual (fuera de rangos en las fixtures); elegimos junio:
    // período académico hasta el 13/06 → 13 días operativos a H = 12 h.
    await userEvent.selectOptions(canvas.getByLabelText(/^mes$/i), '6')

    // Override manual: la fila 2 conserva sus 9 h escritas a mano.
    const manual = canvas.getByLabelText('Fila 2, Horas de uso por día') as HTMLInputElement
    await userEvent.clear(manual)
    await userEvent.type(manual, '9')

    await userEvent.click(completar)

    // Celdas vacías completadas con la media de Xe del mes elegido.
    const horas1 = canvas.getByLabelText('Fila 1, Horas de uso por día') as HTMLInputElement
    const dias1 = canvas.getByLabelText('Fila 1, Días de uso por mes') as HTMLInputElement
    expect(horas1.value).toBe('12')
    expect(dias1.value).toBe('13')
    // La fila 2 solo recibió el día vacío: su valor manual sigue intacto.
    expect(
      (canvas.getByLabelText('Fila 2, Horas de uso por día') as HTMLInputElement).value
    ).toBe('9')
    expect((canvas.getByLabelText('Fila 2, Días de uso por mes') as HTMLInputElement).value).toBe(
      '13'
    )
    // Confirmación de la operación (5 filas: 4 completamente vacías + la de la fila 2).
    // El aviso entra con `animate-slide-up` (0,5 s, arranca en opacity 0): la
    // visibilidad se ESPERA. Comprobar en el mismo tick lo vuelve una carrera
    // contra la animación.
    await waitFor(() =>
      expect(canvas.getByText(/Se completaron 5 filas/i)).toBeVisible()
    )
  },
}

export const OverrideHorariosPorAmbito: Story = {
  name: 'S1 · Horario efectivo por ámbito: espacio > bloque > edificación',
  args: {
    // Xe ON para el campus: el cálculo usa los horarios vigentes por fila.
    calendarios: calendariosDemo.map((c) =>
      c.edificacionId === 'ed-campus-00000001' ? { ...c, usarHorariosXe: true } : c
    ),
  },
  play: async ({ canvas, userEvent }) => {
    await elegirEdificacion(canvas, userEvent)
    await userEvent.click(await canvas.findByRole('button', { name: /ingreso manual/i }))
    // Rango lectivo 01/06–13/06 (13 días operativos; sábados 6 y 13).
    await userEvent.selectOptions(canvas.getByLabelText(/^mes$/i), '6')

    // Fila 1: Aula 101 — tiene horario propio (SAB 08–14): manda él.
    await elegirListbox(canvas.getByLabelText('Fila 1, Bloque'), 'bk-campus-a101-001', userEvent)
    await userEvent.type(canvas.getByLabelText('Fila 1, Espacio'), 'Aula 101')
    // Fila 2: solo bloque A-101 (LUN–VIE 06–22): hereda del bloque.
    await elegirListbox(canvas.getByLabelText('Fila 2, Bloque'), 'bk-campus-a101-001', userEvent)
    // Fila 3: sin bloque ni espacio: hereda de la edificación (unión de sus dos horarios).
    // Fila 4: bloque A-102 solo tiene el horario vencido (2025): como no está
    // vigente en junio 2026, el nivel BLOQUE no manda y cae a la edificación.
    await elegirListbox(canvas.getByLabelText('Fila 4, Bloque'), 'bk-campus-a102-001', userEvent)

    await userEvent.click(
      await canvas.findByRole('button', {
        name: /completar horas y días de uso desde el calendario/i,
      })
    )

    // Fila 1 (ESPACIO SAB 08–14): corre solo los sábados 6 y 13 → 12 h / 2 días = 6 h.
    expect(
      (canvas.getByLabelText('Fila 1, Horas de uso por día') as HTMLInputElement).value
    ).toBe('6')
    expect(
      (canvas.getByLabelText('Fila 1, Días de uso por mes') as HTMLInputElement).value
    ).toBe('2')
    // Fila 2 (BLOQUE LUN–VIE 06–22): 10 hábiles × 16 h → 16 h y 10 días
    // (si se sumaran los niveles, los sábados aportarían y daría 15/12).
    expect(
      (canvas.getByLabelText('Fila 2, Horas de uso por día') as HTMLInputElement).value
    ).toBe('16')
    expect(
      (canvas.getByLabelText('Fila 2, Días de uso por mes') as HTMLInputElement).value
    ).toBe('10')
    // Fila 3 (EDIFICACIÓN): 10 hábiles × 14 h + 2 sábados × 12 h = 164 h
    // sobre 12 días (el domingo 7 no corre) → 14 h y 12 días.
    expect(
      (canvas.getByLabelText('Fila 3, Horas de uso por día') as HTMLInputElement).value
    ).toBe('14')
    expect(
      (canvas.getByLabelText('Fila 3, Días de uso por mes') as HTMLInputElement).value
    ).toBe('12')
    // Fila 4: el horario vencido del A-102 no cuenta → mismos números que la edificación.
    expect(
      (canvas.getByLabelText('Fila 4, Horas de uso por día') as HTMLInputElement).value
    ).toBe('14')
    expect(
      (canvas.getByLabelText('Fila 4, Días de uso por mes') as HTMLInputElement).value
    ).toBe('12')
  },
}
