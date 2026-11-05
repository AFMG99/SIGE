import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/shared/models/authz'
import { LogoutContent } from '@/features/users/views/LogoutContent'

export default async function LogoutPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return <LogoutContent userName={user.name?.trim() || user.email} />
}
