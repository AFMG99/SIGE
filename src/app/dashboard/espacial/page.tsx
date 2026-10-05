import { redirect } from 'next/navigation'
import { getOverrideActions, requireModuleAccess } from '@/shared/models/authz'
import { ModulePlaceholder } from '@/shared/views/ModulePlaceholder'

export default async function EspacialPage() {
  const user = await requireModuleAccess('plans')
  if (!user) {
    redirect('/dashboard')
  }

  const temporalActions = await getOverrideActions(user.id, 'plans')

  return (
    <ModulePlaceholder
      title="Representación espacial"
      moduleId="plans"
      role={user.role}
      temporalActions={temporalActions}
    />
  )
}