import { ModulePlaceholder } from '@/shared/views/ModulePlaceholder'
import { getCurrentUser } from '@/shared/models/authz'

export default async function AlertasPage() {
  const user = await getCurrentUser()
  if (!user) {
    return null
  }

  return <ModulePlaceholder title="Alertas" role={user.role} />
}