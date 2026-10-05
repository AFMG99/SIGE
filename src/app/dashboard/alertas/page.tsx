import { ModulePlaceholder } from '@/components/ModulePlaceholder'
import { getCurrentUser } from '@/lib/authz'

export default async function AlertasPage() {
  const user = await getCurrentUser()
  if (!user) {
    return null
  }

  return <ModulePlaceholder title="Alertas" role={user.role} />
}