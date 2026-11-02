import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'
import { ReportesView } from '../ReportesView'
import {
  BLOQUES_FIXTURE,
  DATOS_REPORTE_FIXTURE,
  EDIFICACIONES_FIXTURE,
} from '../__fixtures__/reportes.fixtures'

const meta = {
  title: 'Features/Reportes/ReportesView',
  component: ReportesView,
  tags: ['ai-generated'],
  args: {
    edificaciones: EDIFICACIONES_FIXTURE,
    bloques: BLOQUES_FIXTURE,
    datosIniciales: DATOS_REPORTE_FIXTURE,
    puedeGenerar: true,
    puedeDescargar: true,
  },
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof ReportesView>

export default meta
type Story = StoryObj<typeof meta>

export const VistaGeneral: Story = {
  name: 'Vista General con Datos UPME 0016',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: 'Reportes Técnicos de Gestión Energética' })
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole('button', { name: 'Descargar Word (.docx)' })
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole('button', { name: 'Descargar PDF (.pdf)' })
    ).toBeInTheDocument()
    await expect(
      canvas.getByText('Tecnológico de Antioquia - Institución Universitaria')
    ).toBeInTheDocument()
  },
}

export const NavegacionPestanas: Story = {
  name: 'Interacción con pestañas de reporte',
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)

    // Click tab 2: Línea Base y Validación
    const tabLben = canvas.getByRole('button', { name: /2\. Línea Base y Validación/i })
    await userEvent.click(tabLben)
    await expect(
      canvas.getByText(/Parámetros Estadísticos y Validación de LBEn/i)
    ).toBeInTheDocument()

    // Click tab 3: Ahorros y Medidas
    const tabAhorros = canvas.getByRole('button', { name: /3\. Ahorros y Medidas/i })
    await userEvent.click(tabAhorros)
    await expect(
      canvas.getByText(/Estimación de Potenciales de Ahorro y Medidas Recomendadas/i)
    ).toBeInTheDocument()

    // Click tab 4: Histórico y USEs
    const tabHistorico = canvas.getByRole('button', { name: /4\. Histórico y USEs/i })
    await userEvent.click(tabHistorico)
    await expect(
      canvas.getByText(/Usos Significativos de Energía \(USEs\) y Facturación/i)
    ).toBeInTheDocument()
  },
}

export const SinDatosIniciales: Story = {
  name: 'Estado sin datos cargados inicialmente',
  args: {
    datosIniciales: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText(
        /Haga clic en «Actualizar Vista Previa» para procesar los datos de la edificación seleccionada/i
      )
    ).toBeInTheDocument()
  },
}

export const SinPermisoDescarga: Story = {
  name: 'Usuario sin permisos de descarga',
  args: {
    puedeDescargar: false,
    puedeGenerar: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const btnWord = canvas.getByRole('button', { name: 'Descargar Word (.docx)' })
    const btnPdf = canvas.getByRole('button', { name: 'Descargar PDF (.pdf)' })
    await expect(btnWord).toBeDisabled()
    await expect(btnPdf).toBeDisabled()
  },
}
