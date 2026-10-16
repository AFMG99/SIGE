import { describe, expect, it } from 'vitest'
import {
  CATALOGO_TIPOS_EVENTO,
  etiquetaAmbitoDeEvento,
  eventoSchema,
  eventosVisiblesPara,
  formatearRangoEvento,
  nivelDeEvento,
  type EventoConAmbito,
  type EventoInfo,
} from './eventos'

// ============================================================
// S7 — catálogo y validación de eventos
// ============================================================

describe('CATALOGO_TIPOS_EVENTO', () => {
  it('incluye los cuatro tipos del prompt (S7)', () => {
    expect(CATALOGO_TIPOS_EVENTO.map((t) => t.codigo)).toEqual([
      'INSTITUCIONAL', 'ACADEMICO', 'MANTENIMIENTO', 'EXCEPCION',
    ])
  })
})

describe('eventoSchema (validación de entrada)', () => {
  const valido = {
    tipo: 'ACADEMICO',
    nombre: 'Sustentación de tesis',
    fechaInicio: '2026-11-05',
  }

  it('acepta un evento de día único sin descripción ni ámbito', () => {
    expect(eventoSchema.safeParse(valido).success).toBe(true)
  })

  it('acepta un evento con rango, descripción y cascada completa', () => {
    expect(
      eventoSchema.safeParse({
        ...valido,
        descripcion: 'Sala mayor, 8:00 a. m.',
        fechaFin: '2026-11-07',
        ambito: { bloqueId: 'bk-1', espacioId: 'sp-1', equipoId: 'eq-1' },
      }).success
    ).toBe(true)
  })

  it('rechaza el nombre vacío o en blanco', () => {
    expect(eventoSchema.safeParse({ ...valido, nombre: '' }).success).toBe(false)
    expect(eventoSchema.safeParse({ ...valido, nombre: '   ' }).success).toBe(false)
  })

  it('rechaza un tipo fuera del catálogo', () => {
    expect(eventoSchema.safeParse({ ...valido, tipo: 'FIESTA' }).success).toBe(false)
  })

  it('rechaza fechaInicio mal formada y exige la fecha de inicio', () => {
    expect(eventoSchema.safeParse({ ...valido, fechaInicio: '05-11-2026' }).success).toBe(false)
    const sinInicio = { ...valido } as Record<string, unknown>
    delete sinInicio.fechaInicio
    expect(eventoSchema.safeParse(sinInicio).success).toBe(false)
  })

  it('rechaza fechaFin anterior a fechaInicio y acepta la igual', () => {
    expect(
      eventoSchema.safeParse({ ...valido, fechaInicio: '2026-11-20', fechaFin: '2026-11-15' })
        .success
    ).toBe(false)
    expect(
      eventoSchema.safeParse({ ...valido, fechaInicio: '2026-11-20', fechaFin: '2026-11-20' })
        .success
    ).toBe(true)
  })

  it('acepta fechaFin vacía (día único)', () => {
    expect(eventoSchema.safeParse({ ...valido, fechaFin: '' }).success).toBe(true)
  })

  it('rechaza la cascada jerárquica rota (equipo sin espacio, espacio sin bloque)', () => {
    expect(
      eventoSchema.safeParse({ ...valido, ambito: { equipoId: 'eq-1' } }).success
    ).toBe(false)
    expect(
      eventoSchema.safeParse({ ...valido, ambito: { espacioId: 'sp-1' } }).success
    ).toBe(false)
  })
})

// ============================================================
// S8 — herencia de eventos por niveles (función pura)
// ============================================================

/**
 * Árbol de prueba: ed-1 (bloques bk-a/bk-b; en bk-a el espacio sp-a con el
 * equipo eq-h, en bk-b el espacio sp-lab) y ed-2 (bloque bk-x).
 */
interface EventoPrueba extends EventoConAmbito {
  id: string
}

const ev = (
  id: string,
  ambito: {
    edificacionId: string
    bloqueId?: string | null
    espacioId?: string | null
    equipoId?: string | null
  }
): EventoPrueba => ({ ...ambito, id })

const E_EDIFICACION = ev('e-ed', { edificacionId: 'ed-1' })
const E_BLOQUE = ev('e-bloque', { edificacionId: 'ed-1', bloqueId: 'bk-a' })
const E_ESPACIO = ev('e-espacio', { edificacionId: 'ed-1', bloqueId: 'bk-a', espacioId: 'sp-a' })
const E_EQUIPO = ev('e-equipo', {
  edificacionId: 'ed-1', bloqueId: 'bk-a', espacioId: 'sp-a', equipoId: 'eq-h',
})
const E_BLOQUE_HERMANO = ev('e-hermano', { edificacionId: 'ed-1', bloqueId: 'bk-b' })
const E_OTRA_EDIFICACION = ev('e-otra', { edificacionId: 'ed-2' })

const EVENTOS = [E_EDIFICACION, E_BLOQUE, E_ESPACIO, E_EQUIPO, E_BLOQUE_HERMANO, E_OTRA_EDIFICACION]

const ids = (lista: { id: string }[]): string[] => lista.map((e) => e.id)

describe('nivelDeEvento', () => {
  it('usa el nivel más específico de la cascada (igual que los horarios)', () => {
    expect(nivelDeEvento(E_EDIFICACION)).toBe('EDIFICACION')
    expect(nivelDeEvento(E_BLOQUE)).toBe('BLOQUE')
    expect(nivelDeEvento(E_ESPACIO)).toBe('ESPACIO')
    expect(nivelDeEvento(E_EQUIPO)).toBe('EQUIPO')
  })
})

describe('eventosVisiblesPara (herencia S8)', () => {
  it('en un contexto de equipo completo se ven los cuatro niveles del mismo árbol', () => {
    const visibles = eventosVisiblesPara(EVENTOS, {
      edificacionId: 'ed-1', bloqueId: 'bk-a', espacioId: 'sp-a', equipoId: 'eq-h',
    })
    expect(ids(visibles).sort()).toEqual(['e-bloque', 'e-ed', 'e-equipo', 'e-espacio'])
  })

  it('un evento de edificación se ve en cualquier nivel de su árbol', () => {
    expect(ids(eventosVisiblesPara(EVENTOS, { edificacionId: 'ed-1', bloqueId: 'bk-a' }))).toContain('e-ed')
    expect(ids(eventosVisiblesPara(EVENTOS, { edificacionId: 'ed-1', bloqueId: 'bk-a', espacioId: 'sp-a' }))).toContain('e-ed')
    expect(ids(eventosVisiblesPara(EVENTOS, { edificacionId: 'ed-1', bloqueId: 'bk-a', espacioId: 'sp-a', equipoId: 'eq-h' }))).toContain('e-ed')
  })

  it('un evento de bloque se ve en sus espacios y equipos, no en un bloque hermano', () => {
    // Espacio del mismo bloque: visible.
    expect(
      ids(eventosVisiblesPara(EVENTOS, { edificacionId: 'ed-1', bloqueId: 'bk-a', espacioId: 'sp-a' }))
    ).toContain('e-bloque')
    // Bloque hermano (bk-b): invisible.
    const enHermano = ids(
      eventosVisiblesPara(EVENTOS, { edificacionId: 'ed-1', bloqueId: 'bk-b', espacioId: 'sp-lab' })
    )
    expect(enHermano).not.toContain('e-bloque')
    expect(enHermano).toContain('e-hermano')
  })

  it('un evento de espacio se ve solo en sus equipos', () => {
    const enEspacio = ids(
      eventosVisiblesPara(EVENTOS, { edificacionId: 'ed-1', bloqueId: 'bk-a', espacioId: 'sp-a' })
    )
    expect(enEspacio).toContain('e-espacio')
    const enBloqueSinEspacio = ids(
      eventosVisiblesPara(EVENTOS, { edificacionId: 'ed-1', bloqueId: 'bk-a' })
    )
    expect(enBloqueSinEspacio).not.toContain('e-espacio')
  })

  it('un evento de equipo se ve únicamente en ese mismo equipo', () => {
    const enSuEquipo = ids(
      eventosVisiblesPara(EVENTOS, {
        edificacionId: 'ed-1', bloqueId: 'bk-a', espacioId: 'sp-a', equipoId: 'eq-h',
      })
    )
    expect(enSuEquipo).toContain('e-equipo')
    // Mismo espacio, otro equipo: no se hereda hacia abajo ni entre hermanos.
    const enOtroEquipo = ids(
      eventosVisiblesPara(EVENTOS, {
        edificacionId: 'ed-1', bloqueId: 'bk-a', espacioId: 'sp-a', equipoId: 'eq-led',
      })
    )
    expect(enOtroEquipo).not.toContain('e-equipo')
  })

  it('nunca cruza el árbol de otra edificación', () => {
    const visibles = ids(eventosVisiblesPara(EVENTOS, { edificacionId: 'ed-2' }))
    expect(visibles).toEqual(['e-otra'])
  })

  it('contexto completo vs parcial: la parcial solo ve sus ancestros directos', () => {
    // Contexto parcial de edificación (sin bloque): solo el evento de edificación.
    expect(ids(eventosVisiblesPara(EVENTOS, { edificacionId: 'ed-1' }))).toEqual(['e-ed'])
    // Contexto parcial de bloque: edificación + su bloque.
    expect(ids(eventosVisiblesPara(EVENTOS, { edificacionId: 'ed-1', bloqueId: 'bk-a' })).sort()).toEqual(
      ['e-bloque', 'e-ed']
    )
  })

  it('devuelve [] sin eventos o ante contexto sin edificación', () => {
    expect(eventosVisiblesPara([], { edificacionId: 'ed-1' })).toEqual([])
  })
})

// ============================================================
// Presentación — rango de fechas del evento
// ============================================================

describe('formatearRangoEvento', () => {
  it('día único: «15 nov»', () => {
    expect(formatearRangoEvento('2026-11-15', null)).toBe('15 nov')
    expect(formatearRangoEvento('2026-11-15', '2026-11-15')).toBe('15 nov')
  })

  it('rango del mismo mes: «15–20 nov»', () => {
    expect(formatearRangoEvento('2026-11-15', '2026-11-20')).toBe('15–20 nov')
  })

  it('rango entre meses del mismo año: «15 nov – 2 dic»', () => {
    expect(formatearRangoEvento('2026-11-15', '2026-12-02')).toBe('15 nov – 2 dic')
  })

  it('rango entre años: incluye ambos años', () => {
    expect(formatearRangoEvento('2025-12-30', '2026-01-02')).toBe('30 dic 2025 – 2 ene 2026')
  })
})

// ============================================================
// S9 — el calendario (contexto de edificación) ve TODO su árbol
// ============================================================

describe('eventosVisiblesPara con incluirDescendencia (S9 — calendario)', () => {
  it('la edificación seleccionada ve todos los eventos de su árbol', () => {
    const visibles = ids(
      eventosVisiblesPara(EVENTOS, { edificacionId: 'ed-1' }, { incluirDescendencia: true })
    )
    expect(visibles.sort()).toEqual(['e-bloque', 'e-ed', 'e-equipo', 'e-espacio', 'e-hermano'])
  })

  it('sin la opción el contrato S8 no cambia (solo el evento de edificación)', () => {
    expect(ids(eventosVisiblesPara(EVENTOS, { edificacionId: 'ed-1' }))).toEqual(['e-ed'])
  })

  it('jamás cruza de edificación y no altera contextos más específicos', () => {
    expect(
      ids(eventosVisiblesPara(EVENTOS, { edificacionId: 'ed-2' }, { incluirDescendencia: true }))
    ).toEqual(['e-otra'])
    const enBloque = ids(
      eventosVisiblesPara(
        EVENTOS,
        { edificacionId: 'ed-1', bloqueId: 'bk-a' },
        { incluirDescendencia: true }
      )
    )
    expect(enBloque.sort()).toEqual(['e-bloque', 'e-ed'])
  })
})

// ============================================================
// S9 — etiqueta del ámbito con los nombres resueltos en page.tsx
// ============================================================

describe('etiquetaAmbitoDeEvento (S9 — badge con nombre del objetivo)', () => {
  const base: EventoInfo = {
    id: 'ev-1',
    edificacionId: 'ed-1',
    tipo: 'INSTITUCIONAL',
    nombre: 'Evento de prueba',
    descripcion: null,
    fechaInicio: '2026-06-01',
    fechaFin: null,
    bloqueId: null,
    espacioId: null,
    equipoId: null,
  }

  it('usa los nombres del objetivo cuando el evento los trae (query extendida)', () => {
    expect(etiquetaAmbitoDeEvento(base)).toBe('Edificación completa')
    expect(
      etiquetaAmbitoDeEvento({
        ...base,
        bloqueId: 'bk-1',
        bloqueCodigo: 'A-101',
        bloqueNombre: 'Ala Norte',
      })
    ).toBe('Bloque · A-101 — Ala Norte')
    expect(
      etiquetaAmbitoDeEvento({
        ...base,
        bloqueId: 'bk-1',
        espacioId: 'sp-1',
        espacioNombre: 'Aula 101',
      })
    ).toBe('Espacio · Aula 101')
    expect(
      etiquetaAmbitoDeEvento({
        ...base,
        bloqueId: 'bk-1',
        espacioId: 'sp-1',
        equipoId: 'eq-1',
        equipoTipo: 'HVAC',
        equipoEspacioNombre: 'Aula 101',
      })
    ).toBe('Equipo · HVAC (Aula 101)')
  })

  it('cae al nombre del nivel cuando el evento no trae nombres resueltos', () => {
    expect(etiquetaAmbitoDeEvento({ ...base, bloqueId: 'bk-1' })).toBe('Bloque')
    expect(etiquetaAmbitoDeEvento({ ...base, bloqueId: 'bk-1', espacioId: 'sp-1' })).toBe('Espacio')
    expect(
      etiquetaAmbitoDeEvento({ ...base, bloqueId: 'bk-1', espacioId: 'sp-1', equipoId: 'eq-1' })
    ).toBe('Equipo')
  })
})
