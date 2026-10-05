import { redirect } from 'next/navigation'
import { getOverrideActions, requireModuleAccess } from '@/shared/models/authz'
import { ModulePlaceholder } from '@/shared/views/ModulePlaceholder'

export default async function ReportesPage() {
  const user = await requireModuleAccess('reports')
  if (!user) {
    redirect('/dashboard')
  }

  const temporalActions = await getOverrideActions(user.id, 'reports')

  return (
    <ModulePlaceholder
      title="Reportes"
      moduleId="reports"
      role={user.role}
      temporalActions={temporalActions}
    />
  )
}