/**
 * Etiquetas de ámbito de horarios compartidas por las vistas de datos
 * (tarjeta de horarios del calendario y detalle del día, 6d2/6d3).
 *
 * Vive en la capa `views` porque resuelve nombres de los view-models
 * (`BloqueInfo`, `EspacioInfo`, `EquipoExistente`); los modelos de dominio
 * no conocen estos tipos.
 */

import type { BloqueInfo, EspacioInfo, HorarioEquipoInfo } from './useCatalogoEdificaciones'
import type { EquipoExistente } from './existencias'

/**
 * Etiqueta legible del ámbito de un horario: «Equipo Mini-Split en Aula 101»,
 * «Espacio Aula 101», «Bloque A-101 — Ala Norte» o «Edificación completa».
 * Con catálogos vacíos degrada al tipo («Equipo», «Espacio», «Bloque»).
 */
export function etiquetaAmbitoDeHorario(
  h: Pick<HorarioEquipoInfo, 'bloqueId' | 'espacioId' | 'equipoId'>,
  bloques: BloqueInfo[],
  espacios: EspacioInfo[],
  equipos: EquipoExistente[]
): string {
  if (h.equipoId) {
    const q = equipos.find((x) => x.id === h.equipoId)
    return q ? `Equipo ${q.tipo} en ${q.espacio}` : 'Equipo'
  }
  if (h.espacioId) {
    const s = espacios.find((x) => x.id === h.espacioId)
    return s ? `Espacio ${s.nombre}` : 'Espacio'
  }
  if (h.bloqueId) {
    const b = bloques.find((x) => x.id === h.bloqueId)
    return b ? `Bloque ${b.codigo}${b.nombre ? ` — ${b.nombre}` : ''}` : 'Bloque'
  }
  return 'Edificación completa'
}
