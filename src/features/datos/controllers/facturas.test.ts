import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================
// Regresión del defecto reportado: la consulta de periodos con
// facturas alimenta el paso «Cálculos opcionales» del importador, así
// que debe exigir el MISMO permiso que el resto del módulo
// (`consumption:upload`). Los roles que cargan datos (GESTOR_ENERGETICO,
// ADMIN_TI) no tienen `consumption:read`, que es de solo lectura, y con
// ese gate la consulta fallaba siempre y el modal caía al mes actual.
// ============================================================

const t = vi.hoisted(() => ({
  estado: {
    sinSesion: false,
    acciones: [] as string[],
    permitidas: ['upload'] as string[],
  },
  periodos: [] as { periodo: string }[],
  falla: false,
  findMany: vi.fn(),
}))

vi.mock('@/shared/models/authz', () => ({
  getCurrentUser: async () =>
    t.estado.sinSesion ? null : { id: 'usr-test', role: 'GESTOR_ENERGETICO' },
  canWithOverrides: async (_user: unknown, _module: string, accion?: string) => {
    t.estado.acciones.push(String(accion))
    return t.estado.permitidas.includes(String(accion))
  },
}))

vi.mock('@/shared/models/prisma', () => ({
  prisma: { facturaEnergia: { findMany: t.findMany } },
}))

vi.mock('@/features/datos/controllers/auditoria', () => ({
  auditarAccion: vi.fn(),
}))

import { periodosConFactura } from './facturas'

beforeEach(() => {
  t.estado.sinSesion = false
  t.estado.acciones = []
  t.estado.permitidas = ['upload']
  t.periodos = [{ periodo: '2024-01' }, { periodo: '2024-02' }]
  t.falla = false
  t.findMany.mockReset()
  t.findMany.mockImplementation(async () => {
    if (t.falla) throw new Error('DB caída')
    return t.periodos
  })
})

describe('periodosConFactura', () => {
  it('autoriza con consumption:upload y devuelve los periodos ordenados', async () => {
    const res = await periodosConFactura('edif-1')

    expect(res).toEqual({ estado: 'ok', periodos: ['2024-01', '2024-02'] })
    expect(t.estado.acciones).toEqual(['upload'])
    expect(t.estado.acciones).not.toContain('read')
    expect(t.findMany).toHaveBeenCalledWith({
      where: { edificacionId: 'edif-1' },
      distinct: ['periodo'],
      select: { periodo: true },
      orderBy: { periodo: 'asc' },
    })
  })

  it('rechaza al rol sin consumption:upload aunque tenga consumption:read', async () => {
    t.estado.permitidas = ['read']

    const res = await periodosConFactura('edif-1')

    expect(res.estado).toBe('error')
    expect(res.mensaje).toMatch(/no tiene permiso/i)
    expect(t.findMany).not.toHaveBeenCalled()
  })

  it('rechaza sin sesión', async () => {
    t.estado.sinSesion = true

    const res = await periodosConFactura('edif-1')

    expect(res.estado).toBe('error')
    expect(res.mensaje).toMatch(/sesión/i)
  })

  it('rechaza sin edificación', async () => {
    const res = await periodosConFactura('   ')

    expect(res.estado).toBe('error')
    expect(res.mensaje).toMatch(/edificación/i)
  })

  it('informa el fallo de la consulta sin propagar la excepción', async () => {
    t.falla = true
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await periodosConFactura('edif-1')

    expect(res.estado).toBe('error')
    expect(res.mensaje).toMatch(/no fue posible consultar/i)
    spy.mockRestore()
  })
})
