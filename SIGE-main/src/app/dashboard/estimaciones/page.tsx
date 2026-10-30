import { redirect } from 'next/navigation'
import { getOverrideActions, requireModuleAccess } from '@/shared/models/authz'
import { ModulePlaceholder } from '@/shared/views/ModulePlaceholder'

export default async function EstimacionesPage() {
  const user = await requireModuleAccess('estimates')
  if (!user) {
    redirect('/dashboard')
  }

  const temporalActions = await getOverrideActions(user.id, 'estimates')

  return (
    <ModulePlaceholder
      title="Estimaciones"
      moduleId="estimates"
      role={user.role}
      temporalActions={temporalActions}
    />
  )
}