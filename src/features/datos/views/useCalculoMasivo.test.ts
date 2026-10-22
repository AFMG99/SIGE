/**
 * Lógica pura del hook «Cálculo de uso» (T5/T6) — spec §6.2.
 *
 * La columna «Estado» de la vista previa muestra la clasificación BR4 en
 * español (existente / pendiente / desactualizado / fallido / revisar), la
 * misma que fija la spec para el usuario; la story «Vista previa» asertea el
 * texto visible y este test fija el mapeo de forma exhaustiva.
 *
 * El loop de lote (T6) expone dos helpers puros que este archivo fija:
 * `mezclarProcesados` (el servidor reenvía los periodos intactos en CADA
 * llamada, así que la fusión deduplica por clave y la última respuesta manda)
 * y `periodoEnCurso` (primer pendiente aún sin procesar, que alimenta el
 * indicador de progreso «Procesando X… (n de t)»).
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
  ejecutarCalculoMasivo: vi.fn(),
}))
vi.mock('@/shared/views/ui/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn(), toasts: [], hideToast: vi.fn() }),
}))

import type { ProcesadoLote } from '@/features/datos/controllers/calculoUso'
import { etiquetaClasificacion, mezclarProcesados, periodoEnCurso } from './useCalculoMasivo'

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

describe('mezclarProcesados (AC8/AC11: fusión de llamadas del lote)', () => {
  const conservado: ProcesadoLote = { clave: '2024-01', resultado: 'conservado' }
  const calculado: ProcesadoLote = { clave: '2024-02', resultado: 'calculado' }
  const fallido: ProcesadoLote = {
    clave: '2024-03',
    resultado: 'fallido',
    mensaje: 'No fue posible calcular las horas de uso. Intente de nuevo.',
  }

  it('concatena las llamadas respetando el orden de aparición', () => {
    const segunda: ProcesadoLote[] = [
      conservado,
      { clave: '2024-04', resultado: 'revisar' },
      { clave: '2024-05', resultado: 'calculado' },
    ]
    const fusion = mezclarProcesados([conservado, calculado, fallido], segunda)
    expect(fusion.map((p) => p.clave)).toEqual([
      '2024-01',
      '2024-02',
      '2024-03',
      '2024-04',
      '2024-05',
    ])
  })

  it('deduplica por clave: el servidor reenvía los intactos y la última gana', () => {
    const reenvio: ProcesadoLote[] = [{ clave: '2024-02', resultado: 'conservado' }]
    const fusion = mezclarProcesados([calculado], reenvio)
    expect(fusion).toEqual([{ clave: '2024-02', resultado: 'conservado' }])
  })

  it('conserva el mensaje del periodo fallido al fusionar', () => {
    const fusion = mezclarProcesados([], [fallido])
    expect(fusion).toHaveLength(1)
    expect(fusion[0].mensaje).toBe(
      'No fue posible calcular las horas de uso. Intente de nuevo.'
    )
  })
})

describe('periodoEnCurso (indicador de progreso del lote)', () => {
  it('devuelve el primer pendiente de la vista previa aún sin procesar', () => {
    const procesados: ProcesadoLote[] = [{ clave: '2024-01', resultado: 'conservado' }]
    expect(periodoEnCurso(['2024-01', '2024-02', '2024-03'], procesados)).toBe('2024-02')
  })

  it('devuelve null cuando todo el lote fue procesado', () => {
    const procesados: ProcesadoLote[] = [{ clave: '2024-01', resultado: 'calculado' }]
    expect(periodoEnCurso(['2024-01'], procesados)).toBeNull()
  })
})
