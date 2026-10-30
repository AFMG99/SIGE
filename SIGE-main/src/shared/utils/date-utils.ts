/**
 * Date formatting utilities for Spanish locale.
 *
 * All helpers accept an optional IANA `timeZone` (the user's saved preference
 * from Settings). When omitted the browser's timezone is used, which keeps
 * existing callers behaving exactly as before.
 */

export function formatDateLocale(
  dateString: string | null | undefined,
  timeZone?: string
): string {
  if (!dateString) return '—'
  try {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(timeZone ? { timeZone } : {}),
    })
  } catch {
    return '—'
  }
}

export function formatDateTimeLocale(
  dateString: string | null | undefined,
  timeZone?: string
): string {
  if (!dateString) return '—'
  try {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    })
  } catch {
    return '—'
  }
}

export function formatRelativeTime(
  dateString: string | null | undefined,
  timeZone?: string
): string {
  if (!dateString) return '—'
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Ahora mismo'
    if (diffMins < 60) return `Hace ${diffMins} min`
    if (diffHours < 24) return `Hace ${diffHours} h`
    if (diffDays < 7) return `Hace ${diffDays} d`
    return formatDateLocale(dateString, timeZone)
  } catch {
    return '—'
  }
}
