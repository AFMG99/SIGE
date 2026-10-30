'use client'

import { formatDateTimeLocale } from '@/shared/utils/date-utils'

interface AuditEntry {
  id: string
  actorId: string
  actorEmail: string
  action: string
  detail: string | null
  createdAt: string
}

interface ActivityTabProps {
  auditLogs: AuditEntry[]
}

const ACTION_LABELS: Record<string, string> = {
  'user.create': 'Creación de usuario',
  'user.update': 'Actualización de usuario',
  'user.suspend': 'Suspensión de usuario',
  'user.activate': 'Reactivación de usuario',
  'user.delete': 'Eliminación de usuario',
  'session.revoke': 'Revocar sesión',
}

export function ActivityTab({ auditLogs }: ActivityTabProps) {
  if (auditLogs.length === 0) {
    return (
      <div className="ui-empty" role="tabpanel" id="activity-panel" aria-labelledby="activity-tab">
        <svg className="h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="ui-title text-sm">Sin actividad registrada todavía</h3>
        <p className="text-sm">Los cambios en este usuario aparecerán aquí.</p>
      </div>
    )
  }

  return (
    <div role="tabpanel" id="activity-panel" aria-labelledby="activity-tab">
      <div className="ui-table-shell">
        <div className="overflow-x-auto">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Actor</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap">
                    <span className="ui-muted">{formatDateTimeLocale(log.createdAt)}</span>
                  </td>
                  <td>
                    <span className="ui-title text-sm">{ACTION_LABELS[log.action] || log.action}</span>
                  </td>
                  <td>
                    <span className="ui-muted">{log.actorEmail}</span>
                  </td>
                  <td>
                    <span className="ui-muted">{log.detail || '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}