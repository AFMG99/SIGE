import { prisma } from './prisma'

export interface AuditLogInput {
  actorId: string
  actorEmail: string
  action: string
  targetId: string
  targetEmail: string
  detail?: string
}

/**
 * Logs an audit entry. Failures are swallowed to never break the main operation.
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        action: input.action,
        targetId: input.targetId,
        targetEmail: input.targetEmail,
        detail: input.detail,
      },
    })
  } catch (error) {
    console.error('Audit log failed:', error)
  }
}