/**
 * Lógica pura del hook «Cálculo de uso» (T5) — spec §6.2.
 *
 * La columna «Estado» de la vista previa muestra la clasificación BR4 en
 * español (existente / pendiente / desactualizado / fallido / revisar), la
 * misma que fija la spec para el usuario; la story «Vista previa» asertea el
 * texto visible y este test fija el mapeo completo de forma exhaustiva.
 *
 * El hook importa las server actions del módulo, que a su vez cargan Prisma y
 * `next/headers` (no disponibles en el entorno node), y el `ToastProvider`
 * (JSX, sin transform en el proyecto node): los dobles los sustituyen antes
 * de que se evalúe el módulo real.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/datos/controllers/calculoUso', () => ({
  autorizarCalculoUso: vi.fn(),
  prepararCalculoMasivo: vi.fn(),
  calcularUsoIndividual: vi.fn(),
}))
vi.mock('@/shared/views/ui/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn(), toasts: [], hideToast: vi.fn() }),
}))

import { etiquetaClasificacion } from './useCalculoMasivo'

describe('etiquetaClasificacion', () => {
  it('traduce las seis clasificaciones BR4 a etiquetas en español', () => {
    expect(etiquetaClasificacion('existente-intacto')).toBe('Existente')
    expect(etiquetaClasificacion('pendiente')).toBe('Pendiente')
    expect(etiquetaClasificacion('desactualizado')).toBe('Desactualizado')
    expect(etiquetaClasificacion('fallido')).toBe('Fallido')
    expect(etiquetaClasificacion('revisar')).toBe('Revisar')
    expect(etiquetaClasificacion('nuevo')).toBe('Nuevo')
  })
})
