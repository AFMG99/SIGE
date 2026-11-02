import { beforeEach, describe, expect, it, vi } from 'vitest'

const t = vi.hoisted(() => {
  const state = {
    authenticated: true,
    allowed: true,
    spaces: [
      { id: 'space-1', nombre: 'Aula 101', piso: '1' },
    ],
    audits: [] as { action: string; targetId: string; detail: string }[],
  }
  const tx = {
    espacio: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  }
  const prisma = {
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => Promise<number>) => callback(tx)
    ),
  }
  return { state, tx, prisma }
})

vi.mock('@/shared/models/authz', () => ({
  getCurrentUser: async () =>
    t.state.authenticated ? { id: 'user-1', role: 'COORD_INFRAESTRUCTURA' } : null,
  canWithOverrides: async () => t.state.allowed,
}))

vi.mock('@/shared/models/prisma', () => ({ prisma: t.prisma }))
vi.mock('@/features/datos/controllers/auditoria', () => ({
  auditarAccion: async (entry: { action: string; targetId: string; detail: string }) => {
    t.state.audits.push(entry)
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { confirmarImportacionCad } from './confirmarImportacionCad'

beforeEach(() => {
  t.state.authenticated = true
  t.state.allowed = true
  t.state.spaces = [{ id: 'space-1', nombre: 'Aula 101', piso: '1' }]
  t.state.audits = []
  t.tx.espacio.findMany.mockReset()
  t.tx.espacio.findMany.mockImplementation(
    async ({ where }: { where?: { id?: { in: string[] } } }) =>
      where?.id
        ? t.state.spaces.filter((space) => where.id?.in.includes(space.id))
        : t.state.spaces
  )
  t.tx.espacio.update.mockReset()
  t.tx.espacio.update.mockResolvedValue({})
  t.prisma.$transaction.mockClear()
})

describe('confirmarImportacionCad', () => {
  it('valida, actualiza en transacción y audita medidas de espacios existentes', async () => {
    const response = await confirmarImportacionCad({
      bloqueId: 'block-1',
      espacios: [{ espacioId: 'space-1', piso: '2', largoM: 8, anchoM: 6, areaM2: 20 }],
    })

    expect(response).toMatchObject({ estado: 'ok', cantidad: 1 })
    expect(t.prisma.$transaction).toHaveBeenCalledOnce()
    expect(t.tx.espacio.update).toHaveBeenCalledWith({
      where: { id: 'space-1' },
      data: { piso: '2', largoM: 8, anchoM: 6, areaCalculadaM2: 20 },
    })
    expect(t.state.audits).toEqual([
      {
        action: 'espacio.cad_import',
        targetId: 'block-1',
        detail: '1 espacio(s) actualizado(s) desde una importación CAD validada.',
      },
    ])
  })

  it('requiere sesión y el permiso plans:modify', async () => {
    t.state.authenticated = false
    const noSession = await confirmarImportacionCad({
      bloqueId: 'block-1',
      espacios: [{ espacioId: 'space-1', piso: '2', largoM: 8, anchoM: 6, areaM2: 48 }],
    })
    expect(noSession).toMatchObject({ estado: 'error' })
    expect(t.prisma.$transaction).not.toHaveBeenCalled()

    t.state.authenticated = true
    t.state.allowed = false
    const noPermission = await confirmarImportacionCad({
      bloqueId: 'block-1',
      espacios: [{ espacioId: 'space-1', piso: '2', largoM: 8, anchoM: 6, areaM2: 48 }],
    })
    expect(noPermission).toMatchObject({ estado: 'error' })
    expect(t.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rechaza asociaciones repetidas, espacios fuera del bloque y colisiones de piso', async () => {
    const duplicate = await confirmarImportacionCad({
      bloqueId: 'block-1',
      espacios: [
        { espacioId: 'space-1', piso: '2', largoM: 8, anchoM: 6, areaM2: 48 },
        { espacioId: 'space-1', piso: '2', largoM: 7, anchoM: 5, areaM2: 35 },
      ],
    })
    expect(duplicate).toMatchObject({ estado: 'error' })
    expect(t.prisma.$transaction).not.toHaveBeenCalled()

    t.state.spaces = []
    const outOfBlock = await confirmarImportacionCad({
      bloqueId: 'block-1',
      espacios: [{ espacioId: 'space-1', piso: '2', largoM: 8, anchoM: 6, areaM2: 48 }],
    })
    expect(outOfBlock).toMatchObject({ estado: 'error' })

    t.state.spaces = [
      { id: 'space-1', nombre: 'Aula 101', piso: '1' },
      { id: 'space-2', nombre: 'Aula 101', piso: '2' },
    ]
    const floorCollision = await confirmarImportacionCad({
      bloqueId: 'block-1',
      espacios: [{ espacioId: 'space-1', piso: '2', largoM: 8, anchoM: 6, areaM2: 48 }],
    })
    expect(floorCollision).toMatchObject({ estado: 'error' })
    expect(t.tx.espacio.update).not.toHaveBeenCalled()
  })

  it('rechaza dimensiones inválidas antes de acceder a la base de datos', async () => {
    const response = await confirmarImportacionCad({
      bloqueId: 'block-1',
      espacios: [{ espacioId: 'space-1', piso: '2', largoM: 0, anchoM: 6, areaM2: 48 }],
    })

    expect(response).toMatchObject({ estado: 'error' })
    expect(t.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rechaza áreas no finitas o fuera del límite validado', async () => {
    const response = await confirmarImportacionCad({
      bloqueId: 'block-1',
      espacios: [
        {
          espacioId: 'space-1',
          piso: '2',
          largoM: 8,
          anchoM: 6,
          areaM2: Number.POSITIVE_INFINITY,
        },
      ],
    })

    expect(response).toMatchObject({ estado: 'error' })
    expect(t.prisma.$transaction).not.toHaveBeenCalled()
  })
})
