'use client'

import { AdminUser } from '../UserTable'
import { ROLE_LABELS, STATUS_LABELS, STATUS_BADGES } from '@/shared/models/permissions'
import { formatDateLocale, formatDateTimeLocale } from '@/shared/utils/date-utils'
import { Avatar } from '@/shared/views/ui/Avatar'

interface ProfileTabProps {
  user: AdminUser
}

export function ProfileTab({ user }: ProfileTabProps) {
  return (
    <div className="space-y-6" role="tabpanel" id="profile-panel" aria-labelledby="profile-tab">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} email={user.email} size="xl" />
        <div>
          <h3 className="ui-title text-xl">{user.name || '—'}</h3>
          <p className="ui-muted">{user.email}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="ui-muted">Rol</dt>
          <dd className="ui-title mt-1">{ROLE_LABELS[user.role]}</dd>
        </div>
        <div>
          <dt className="ui-muted">Estado</dt>
          <dd className="mt-1">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGES[user.status]}`}>
              {STATUS_LABELS[user.status]}
            </span>
          </dd>
        </div>
        <div>
          <dt className="ui-muted">Teléfono</dt>
          <dd className="ui-title mt-1">{user.phone || '—'}</dd>
        </div>
        <div>
          <dt className="ui-muted">Último acceso</dt>
          <dd className="ui-title mt-1">{user.lastLoginAt ? formatDateTimeLocale(user.lastLoginAt) : '—'}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="ui-muted">Miembro desde</dt>
          <dd className="ui-title mt-1">{formatDateLocale(user.createdAt)}</dd>
        </div>
      </dl>
    </div>
  )
}