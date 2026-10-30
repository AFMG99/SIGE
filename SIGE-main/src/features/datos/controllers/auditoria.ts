import { getCurrentUser } from '@/shared/models/authz'
import { logAudit } from '@/shared/models/audit'

/**
 * Registra una mutación de datos energéticos en `AuditLog` (best-effort).
 * Nunca lanza: la auditoría no debe poder romper la operación principal.
 *
 * Convención de los objetivos:
 *  - `targetId`: id de la entidad afectada; `'global'` en vaciados de tabla.
 *  - `targetEmail`: vacío a propósito (los objetivos son entidades, no
 *    usuarios; `ActivityTab` filtra por `targetId` de usuario y estas filas
 *    son solo para auditoría en BD).
 */
export async function auditarAccion(params: {
  action: string
  targetId: string
  detail: string
}): Promise<void> {
  try {
    const actor = await getCurrentUser()
    if (!actor) return
    await logAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: params.action,
      targetId: params.targetId,
      targetEmail: '',
      detail: params.detail,
    })
  } catch (error) {
    console.error('Error al registrar auditoría:', error)
  }
}
