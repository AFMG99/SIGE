import type {
  BloqueInfo,
  CalendarioInfo,
  EdificacionInfo,
  EspacioInfo,
  HorarioEquipoInfo,
  RangoCalendarioUI,
} from '../useCatalogoEdificaciones'

/**
 * Catálogo de ejemplo que en producción llega desde Prisma en `page.tsx`.
 * Cubre los tres tipos de `CATALOGO_EDIFICACIONES`: con bloque (campus y
 * oficina) y sin bloque (residencial).
 *
 * Los ids cumplen `bloqueIdSchema` (`/^[A-Za-z0-9_-]{16,}$/`), igual que los
 * cuid reales: un id más corto invalida todas las filas de la importación.
 */

export const edificacionesDemo: EdificacionInfo[] = [
  {
    id: 'ed-campus-00000001',
    nombre: 'Campus Bloque A',
    tipo: 'EDUCATIVO_CAMPUS',
    area: 4500,
    // Ubicación elegida por ciudad/zona (S1): chip visible en el drawer.
    lat: 6.2477,
    lon: -75.5662,
    ubicacionNombre: 'Medellín, Antioquia',
  },
  // Sin área (null): edificación preexistente que aún no la registra.
  { id: 'ed-oficina-000001', nombre: 'Administración Principal', tipo: 'OFICINA_PUBLICA', area: null },
  { id: 'ed-vivienda-00001', nombre: 'Vivienda 1', tipo: 'RESIDENCIAL_UNIFAMILIAR', area: 120.5 },
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

/** Configuración operativa del campus (H = 06:00–18:00, Tb = 23 °C). */
export const calendariosDemo: CalendarioInfo[] = [
  {
    id: 'cal-campus-0000001',
    edificacionId: 'ed-campus-00000001',
    horaInicioOperacion: 6,
    horasOperacionDia: 12,
    temperaturaBase: 23,
  },
]

/** Rangos del calendario del campus (plantilla TdeA, editable). */
export const rangosCalendarioDemo: RangoCalendarioUI[] = [
  {
    id: 'rg-campus-00000001',
    calendarioId: 'cal-campus-0000001',
    fechaInicio: '2026-02-09',
    fechaFin: '2026-06-13',
    tipoDia: 'LECTIVO',
    nombre: 'Período académico 2026-1',
  },
  {
    id: 'rg-campus-00000002',
    calendarioId: 'cal-campus-0000001',
    fechaInicio: '2026-06-14',
    fechaFin: '2026-08-02',
    tipoDia: 'VACACIONES',
    nombre: null,
  },
]

/** Horarios de funcionamiento de equipos (UPME §7.1/§7.3). */
export const horariosEquipoDemo: HorarioEquipoInfo[] = [
  {
    id: 'hq-campus-00000001',
    edificacionId: 'ed-campus-00000001',
    nombre: 'Iluminación aulas',
    diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
    horaInicio: 6,
    horaFin: 20,
  },
  {
    id: 'hq-campus-00000002',
    edificacionId: 'ed-campus-00000001',
    nombre: 'HVAC administración',
    diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'],
    horaInicio: 7,
    horaFin: 19,
  },
  // Trazabilidad por nivel (S3): fila de bloque sobre el A-101 del campus.
  {
    id: 'hq-campus-bloque-a101',
    edificacionId: 'ed-campus-00000001',
    bloqueId: 'bk-campus-a101-001',
    nombre: 'Aulas A-101 — operación extendida',
    diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
    horaInicio: 6,
    horaFin: 22,
    desde: null,
    hasta: null,
  },
  // Fila de espacio: solo el Aula 101, sábados.
  {
    id: 'hq-campus-espacio-101',
    edificacionId: 'ed-campus-00000001',
    bloqueId: 'bk-campus-a101-001',
    espacioId: 'sp-campus-101-0001',
    nombre: 'Aula 101 — evento sábado',
    diasSemana: ['SAB'],
    horaInicio: 8,
    horaFin: 14,
    desde: null,
    hasta: null,
  },
  // Fila de equipo: precondicionamiento del HVAC del Aula 101.
  {
    id: 'hq-campus-equipo-hvac',
    edificacionId: 'ed-campus-00000001',
    bloqueId: 'bk-campus-a101-001',
    espacioId: 'sp-campus-101-0001',
    equipoId: 'eq-campus-a101-01',
    nombre: 'HVAC Aula 101 — precondicionamiento',
    diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
    horaInicio: 6,
    horaFin: 8,
    desde: null,
    hasta: null,
  },
  // Vigencia vencida (S3): se muestra como trazabilidad, pero no aporta
  // horas al resumen de la semana en curso.
  {
    id: 'hq-campus-a102-verano',
    edificacionId: 'ed-campus-00000001',
    bloqueId: 'bk-campus-a102-001',
    nombre: 'A-102 — verano 2025',
    diasSemana: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'],
    horaInicio: 9,
    horaFin: 15,
    desde: '2025-06-01',
    hasta: '2025-08-15',
  },
]
