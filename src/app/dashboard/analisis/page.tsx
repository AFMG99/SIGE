import { ModulePlaceholder } from '@/components/ModulePlaceholder'
import { getCurrentUser } from '@/lib/authz'

export default async function AnalisisPage() {
  const user = await getCurrentUser()
  if (!user) {
    // This shouldn't happen since dashboard layout already checks auth,
    // but defensive coding doesn't hurt.
    return null
  }

  return <ModulePlaceholder title="Análisis estadístico y patrones" role={user.role} />
}