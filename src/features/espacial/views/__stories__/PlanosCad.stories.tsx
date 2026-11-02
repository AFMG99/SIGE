import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'
import { PlanosCad } from '../ui/PlanosCad'
import type { Edificacion3DScene } from '../../models/espacial.types'

const edificacionDemo: Edificacion3DScene = {
  id: 'ed-campus',
  nombre: 'Campus Bloque 5',
  tipo: 'EDUCATIVO_CAMPUS',
  bloques: [
    {
      id: 'bloque-5',
      codigo: 'B5',
      nombre: 'Bloque 5',
      areaUtil: 1800,
      factorInfraestructura: 2,
      renderMode: 'PARAMETRIC',
      position: [0, 3, 0],
      dimensions: [8.4, 3.36, 8.4],
      metricas: {
        areaUtil: 1800,
        potenciaTotalW: 8200,
        cantidadEquipos: 46,
        densidadPotenciaWm2: 4.56,
      },
      espacios: [
        {
          id: 'espacio-101',
          nombre: 'Aula 101',
          bloqueId: 'bloque-5',
          piso: '1',
          largoM: 8,
          anchoM: 6,
          altoM: 3,
          areaCalculadaM2: 48,
          equipos: [],
          potenciaTotalW: 2400,
          cantidadEquipos: 8,
        },
      ],
    },
  ],
  totales: {
    potenciaTotalW: 8200,
    areaTotalM2: 1800,
    cantidadEquipos: 46,
    densidadPromedioWm2: 4.56,
  },
}

const dxfDemo = [
  '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC',
  '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', '1',
  '0', 'LAYER', '2', 'SIGE_ESPACIOS_PISO_1', '70', '0', '62', '7', '6', 'CONTINUOUS',
  '0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES',
  '0', 'LINE', '8', 'ARQ-MUROS', '5', 'W1',
  '10', '-1000', '20', '0', '30', '0', '11', '-1000', '21', '8000', '31', '0',
  '0', 'LWPOLYLINE', '8', 'SIGE_ESPACIOS_PISO_1', '5', 'A1', '90', '4', '70', '1',
  '10', '0', '20', '0', '10', '6000', '20', '0', '10', '6000', '20', '8000', '10', '0', '20', '8000',
  '0', 'TEXT', '8', 'SIGE_ESPACIOS_PISO_1', '10', '2000', '20', '3000', '40', '250', '1', 'Aula 101',
  '0', 'ENDSEC', '0', 'EOF',
].join('\n')

const dxfDemoConDosContornos = dxfDemo.replace(
  ['0', 'ENDSEC', '0', 'EOF'].join('\n'),
  [
    '0', 'LWPOLYLINE', '8', 'SIGE_ESPACIOS_PISO_1', '5', 'B1', '90', '4', '70', '1',
    '10', '7000', '20', '0', '10', '13000', '20', '0', '10', '13000', '20', '8000', '10', '7000', '20', '8000',
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n')
)

const meta = {
  component: PlanosCad,
  tags: ['ai-generated'],
  args: { edificacion: edificacionDemo, puedeImportar: true },
} satisfies Meta<typeof PlanosCad>

export default meta
type Story = StoryObj<typeof meta>

export const RevisarEImportar: Story = {
  name: 'Cargar DXF, asociar y confirmar',
  play: async ({ canvas, userEvent }) => {
    const archivo = new File([dxfDemo], 'planta-bloque-5.dxf', {
      type: 'application/dxf',
    })
    await userEvent.upload(canvas.getByLabelText('Seleccionar archivo de plano'), archivo)

    await expect(
      await canvas.findByText(/Lectura completa: 1 recinto/)
    ).toBeVisible()
    await expect(
      canvas.getByText(/SIGE solo toma como recintos las polilíneas cerradas/)
    ).toBeVisible()
    await expect(canvas.getByTestId('geometria-dxf-W1')).toBeVisible()
    await expect(
      canvas.getByText(/Extensión 8 × 6 m · área del recinto 48\.00 m²/)
    ).toBeVisible()
    await userEvent.click(canvas.getByTestId('contorno-dxf-A1'))
    await expect(
      canvas.getByRole('button', { name: 'Contorno A1 seleccionado en el plano' })
    ).toHaveAttribute('aria-pressed', 'true')
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Asociar contorno A1 con espacio SIGE' }),
      'espacio-101'
    )
    await expect(
      canvas.getByRole('combobox', { name: 'Espacio existente para contorno A1' })
    ).toHaveValue('espacio-101')
    await expect(canvas.getByTestId('contorno-dxf-A1')).toHaveAttribute(
      'fill',
      '#92bd2470'
    )

    await userEvent.click(canvas.getByRole('button', { name: /Revisar e importar \(1\)/ }))
    const dialog = within(document.body).getByRole('dialog')
    const dialogCanvas = within(dialog)
    await new Promise((resolve) => setTimeout(resolve, 600))
    await expect(dialogCanvas.getByText(/Se actualizarán 1 espacio/)).toBeVisible()
    await userEvent.click(dialogCanvas.getByRole('button', { name: 'Confirmar importación' }))

    await expect(
      await canvas.findByText('Se actualizaron 1 espacio del bloque seleccionado.')
    ).toBeVisible()
  },
}

export const SeleccionVisualBidireccional: Story = {
  name: 'Seleccionar contornos y espacios desde el plano',
  play: async ({ canvas, userEvent }) => {
    const archivo = new File([dxfDemoConDosContornos], 'planta-bloque-5.dxf', {
      type: 'application/dxf',
    })
    await userEvent.upload(canvas.getByLabelText('Seleccionar archivo de plano'), archivo)

    await expect(await canvas.findByText(/Lectura completa: 2 recinto/)).toBeVisible()
    const visor = canvas.getByRole('group', { name: /Visor DXF/ })
    const planoCompletoViewBox = visor.getAttribute('viewBox')
    await userEvent.click(canvas.getByTestId('contorno-dxf-B1'))
    await expect(
      canvas.getByRole('button', { name: 'Contorno B1 seleccionado en el plano' })
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(visor).not.toHaveAttribute('viewBox', planoCompletoViewBox)

    await userEvent.click(canvas.getByRole('button', { name: 'Mostrar contorno A1 en el plano' }))
    await expect(
      canvas.getByRole('button', { name: 'Contorno A1 seleccionado en el plano' })
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      canvas.getByRole('button', { name: 'Mostrar contorno B1 en el plano' })
    ).toHaveAttribute('aria-pressed', 'false')
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Asociar contorno A1 con espacio SIGE' }),
      'espacio-101'
    )
    await expect(
      canvas.getByRole('combobox', { name: 'Espacio existente para contorno A1' })
    ).toHaveValue('espacio-101')
  },
}

export const ReferenciaPdf: Story = {
  name: 'PDF como referencia visual',
  play: async ({ canvas, userEvent }) => {
    const archivo = new File(['%PDF-1.4\n%%EOF'], 'referencia.pdf', {
      type: 'application/pdf',
    })
    await userEvent.upload(canvas.getByLabelText('Seleccionar archivo de plano'), archivo)

    await expect(
      await canvas.findByText('PDF cargado solo como referencia visual; no se extraerán medidas.')
    ).toBeVisible()
    await expect(canvas.getByTitle('Vista previa del plano PDF')).toBeVisible()
  },
}

export const RechazarDwgDirecto: Story = {
  name: 'DWG requiere exportación',
  play: async ({ canvas, userEvent }) => {
    const archivo = new File(['DWG'], 'plano.dwg', { type: 'application/acad' })
    await userEvent.upload(canvas.getByLabelText('Seleccionar archivo de plano'), archivo)

    await expect(
      await canvas.findByRole('alert')
    ).toHaveTextContent(/La lectura directa de DWG no está disponible/)
    await expect(canvas.queryByTitle('Vista previa del plano PDF')).toBeNull()
  },
}
