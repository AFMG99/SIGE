import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================
// Pre-check de resultados de uso en los borradores del catálogo (T7).
//
// `UsoPeriodo.edificacionId` y `UsoEquipoPeriodo.equipo` usan `onDelete:
// Restrict`, y `EquipoElectrico → Bloque` es Cascade: borrar un bloque o una
// edificación con resultados de uso estallaría en un P2003 crudo de Prisma.
// Estos tests fijan el guardamigo previo (mensaje en español, sin tocar la
// BD) y la regresión de que los bloqueos clásicos (equipos/facturas) siguen
// con su mensaje original.
// ============================================================

type Conteos = {
  espacios: number
  equipos: number
  variables: number
  lineasBase: number
  ajustes: number
}

const c = (sobrescritura: Partial<Conteos> = {}): Conteos => ({
  espacios: 0,
  equipos: 0,
  variables: 0,
  lineasBase: 0,
  ajustes: 0,
  ...sobrescritura,
})

const t = vi.hoisted(() => {
  const estado = {
    sinSesion: false,
    permitido: true,
    bloques: new Map<
      string,
      { id: string; codigo: string; nombre: string; conteos: Record<string, number> }
    >(),
    edificaciones: new Map<
      string,
      {
        id: string
        nombre: string
        facturas: number
        bloques: { codigo: string; nombre: string; conteos: Record<string, number> }[]
      }
    >(),
    usoEquipoPorBloque: new Map<string, number>(),
    usoPeriodoPorEdificacion: new Map<string, number>(),
    usoEquipoPorEdificacion: new Map<string, number>(),
    deletes: { bloque: 0, edificacion: 0 },
    auditorias: [] as { action: string; targetId: string; detail: string }[],
  }

  const prisma = {
    bloque: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const b = estado.bloques.get(where.id)
        if (!b) return null
        return { id: b.id, codigo: b.codigo, nombre: b.nombre, _count: { ...b.conteos } }
      },
      delete: async ({ where }: { where: { id: string } }) => {
        estado.deletes.bloque += 1
        estado.bloques.delete(where.id)
        return { id: where.id }
      },
    },
    edificacion: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const e = estado.edificaciones.get(where.id)
        if (!e) return null
        return {
          id: e.id,
          nombre: e.nombre,
          _count: { facturas: e.facturas },
          bloques: e.bloques.map((b) => ({ codigo: b.codigo, nombre: b.nombre, _count: { ...b.conteos } })),
        }
      },
      delete: async ({ where }: { where: { id: string } }) => {
        estado.deletes.edificacion += 1
        estado.edificaciones.delete(where.id)
        return { id: where.id }
      },
    },
    usoEquipoPeriodo: {
      count: async ({ where }: { where: { equipo: { bloqueId?: string; bloque?: { edificacionId: string } } } }) => {
        if (where.equipo.bloqueId !== undefined) {
          return estado.usoEquipoPorBloque.get(where.equipo.bloqueId) ?? 0
        }
        if (where.equipo.bloque?.edificacionId !== undefined) {
          return estado.usoEquipoPorEdificacion.get(where.equipo.bloque.edificacionId) ?? 0
        }
        return 0
      },
    },
    usoPeriodo: {
      count: async ({ where }: { where: { edificacionId: string } }) =>
        estado.usoPeriodoPorEdificacion.get(where.edificacionId) ?? 0,
    },
  }

  return { estado, prisma }
})

vi.mock('@/shared/models/prisma', () => ({ prisma: t.prisma }))
vi.mock('@/shared/models/authz', () => ({
  getCurrentUser: async () => (t.estado.sinSesion ? null : { id: 'usr-test' }),
  canWithOverrides: async () => t.estado.permitido,
}))
vi.mock('@/features/datos/controllers/auditoria', () => ({
  auditarAccion: async (p: { action: string; targetId: string; detail: string }) => {
    t.estado.auditorias.push(p)
  },
}))

import { eliminarBloque, eliminarEdificacion } from '@/features/datos/controllers/edificaciones'

beforeEach(() => {
  t.estado.sinSesion = false
  t.estado.permitido = true
  t.estado.bloques.clear()
  t.estado.edificaciones.clear()
  t.estado.usoEquipoPorBloque.clear()
  t.estado.usoPeriodoPorEdificacion.clear()
  t.estado.usoEquipoPorEdificacion.clear()
  t.estado.deletes = { bloque: 0, edificacion: 0 }
  t.estado.auditorias = []
})

describe('eliminarBloque — pre-check de resultados de uso (T7)', () => {
  it('bloque con resultados de uso ⇒ mensaje amigable, sin borrar ni auditar', async () => {
    t.estado.bloques.set('b1', { id: 'b1', codigo: 'BLQ-A', nombre: 'Aulas', conteos: { ...c({ equipos: 2 }) } })
    t.estado.usoEquipoPorBloque.set('b1', 5)

    const res = await eliminarBloque('b1')
    expect(res.estado).toBe('error')
    if (res.estado === 'error') {
      expect(res.mensaje).toContain('cálculos de uso de horas')
      expect(res.mensaje).toContain('Cálculo de uso')
    }
    expect(t.estado.deletes.bloque).toBe(0)
    expect(t.estado.auditorias).toEqual([])
  })

  it('regresión: bloque con equipos pero sin uso ⇒ mensaje clásico original (sin P2003)', async () => {
    t.estado.bloques.set('b1', { id: 'b1', codigo: 'BLQ-A', nombre: 'Aulas', conteos: { ...c({ equipos: 4, variables: 12 }) } })

    const res = await eliminarBloque('b1')
    expect(res.estado).toBe('error')
    if (res.estado === 'error') {
      expect(res.mensaje).toContain('4 equipos')
      expect(res.mensaje).toContain('Gestión de Equipos Eléctricos')
      expect(res.mensaje).not.toContain('uso de horas')
    }
    expect(t.estado.deletes.bloque).toBe(0)
  })

  it('bloque vacío sin uso ⇒ se elimina con su auditoría (camino feliz intacto)', async () => {
    t.estado.bloques.set('b1', { id: 'b1', codigo: 'BLQ-A', nombre: 'Aulas', conteos: { ...c() } })

    const res = await eliminarBloque('b1')
    expect(res.estado).toBe('completado')
    expect(t.estado.deletes.bloque).toBe(1)
    expect(t.estado.auditorias[0]?.action).toBe('bloque.delete')
  })
})

describe('eliminarEdificacion — pre-check de resultados de uso (T7)', () => {
  it('uso directo (UsoPeriodo.edificacionId) ⇒ mensaje amigable, sin borrar', async () => {
    t.estado.edificaciones.set('e1', {
      id: 'e1',
      nombre: 'Campus',
      facturas: 0,
      bloques: [{ codigo: 'BLQ-A', nombre: 'Aulas', conteos: { ...c({ equipos: 2 }) } }],
    })
    t.estado.usoPeriodoPorEdificacion.set('e1', 3)

    const res = await eliminarEdificacion('e1')
    expect(res.estado).toBe('error')
    if (res.estado === 'error') {
      expect(res.mensaje).toContain('cálculos de uso de horas')
      expect(res.mensaje).toContain('Cálculo de uso')
    }
    expect(t.estado.deletes.edificacion).toBe(0)
  })

  it('uso en cascada (UsoEquipoPeriodo vía bloques→equipos) ⇒ mensaje amigable, sin borrar', async () => {
    t.estado.edificaciones.set('e1', {
      id: 'e1',
      nombre: 'Campus',
      facturas: 0,
      bloques: [{ codigo: 'BLQ-A', nombre: 'Aulas', conteos: { ...c({ equipos: 2 }) } }],
    })
    t.estado.usoEquipoPorEdificacion.set('e1', 7)

    const res = await eliminarEdificacion('e1')
    expect(res.estado).toBe('error')
    if (res.estado === 'error') {
      expect(res.mensaje).toContain('7 cálculos de uso de horas')
    }
    expect(t.estado.deletes.edificacion).toBe(0)
  })

  it('regresión: edificación con facturas pero sin uso ⇒ mensaje clásico original', async () => {
    t.estado.edificaciones.set('e1', {
      id: 'e1',
      nombre: 'Campus',
      facturas: 2,
      bloques: [{ codigo: 'BLQ-A', nombre: 'Aulas', conteos: { ...c({ equipos: 5 }) } }],
    })

    const res = await eliminarEdificacion('e1')
    expect(res.estado).toBe('error')
    if (res.estado === 'error') {
      expect(res.mensaje).toContain('factura')
      expect(res.mensaje).not.toContain('uso de horas')
    }
    expect(t.estado.deletes.edificacion).toBe(0)
  })

  it('edificación sin datos ni uso ⇒ se elimina con su auditoría', async () => {
    t.estado.edificaciones.set('e1', { id: 'e1', nombre: 'Campus', facturas: 0, bloques: [] })

    const res = await eliminarEdificacion('e1')
    expect(res.estado).toBe('completado')
    expect(t.estado.deletes.edificacion).toBe(1)
    expect(t.estado.auditorias[0]?.action).toBe('edificacion.delete')
  })
})
