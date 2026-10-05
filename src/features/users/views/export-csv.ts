'use client'

import { AdminUser } from './UserTable'
import { ROLE_LABELS, STATUS_LABELS } from '@/shared/models/permissions'
import { formatDateTimeLocale } from '@/shared/utils/date-utils'

export function exportUsersToCSV(users: AdminUser[]): void {
  const headers = ['Nombre', 'Correo', 'Teléfono', 'Rol', 'Estado', 'Último acceso']
  
  const rows = users.map((user) => [
    user.name || '',
    user.email,
    user.phone || '',
    ROLE_LABELS[user.role],
    STATUS_LABELS[user.status],
    user.lastLoginAt ? formatDateTimeLocale(user.lastLoginAt) : '',
  ])

  // UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF'
  const csvContent = BOM + [headers, ...rows].map((row) => 
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', 'usuarios.csv')
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}