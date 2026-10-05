import type { BloqueInfo, EdificacionInfo, EspacioInfo } from '../useCatalogoEdificaciones'

/**
 * Catálogo de ejemplo que en producción llega desde Prisma en `page.tsx`.
 * Cubre los tres tipos de `CATALOGO_EDIFICACIONES`: con bloque (campus y
 * oficina) y sin bloque (residencial).
 *
 * Los ids cumplen `bloqueIdSchema` (`/^[A-Za-z0-9_-]{16,}$/`), igual que los
 * cuid reales: un id más corto invalida todas las filas de la importación.
 */

export const edificacionesDemo: EdificacionInfo[] = [
  { id: 'ed-campus-00000001', nombre: 'Campus Bloque A', tipo: 'EDUCATIVO_CAMPUS' },
  { id: 'ed-oficina-000001', nombre: 'Administración Principal', tipo: 'OFICINA_PUBLICA' },
  { id: 'ed-vivienda-00001', nombre: 'Vivienda 1', tipo: 'RESIDENCIAL_UNIFAMILIAR' },
]

export const bloquesDemo: BloqueInfo[] = [
  {
    id: 'bk-campus-a101-001',
    codigo: 'A-101',
    nombre: 'Ala Norte',
    edificacionId: 'ed-campus-00000001',
  },
  {
    id: 'bk-campus-a102-001',
    codigo: 'A-102',
    nombre: 'Ala Sur',
    edificacionId: 'ed-campus-00000001',
  },
  {
    id: 'bk-admin-piso1-001',
    codigo: 'ADM-1',
    nombre: 'Piso 1',
    edificacionId: 'ed-oficina-000001',
  },
]

export const espaciosDemo: EspacioInfo[] = [
  { id: 'sp-campus-101-0001', bloqueId: 'bk-campus-a101-001', nombre: 'Aula 101' },
  { id: 'sp-campus-102-0001', bloqueId: 'bk-campus-a101-001', nombre: 'Aula 102' },
  { id: 'sp-campus-201-0001', bloqueId: 'bk-campus-a102-001', nombre: 'Laboratorio 201' },
]
