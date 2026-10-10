import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/shared/models/auth'

export default async function LoginLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (session) redirect('/dashboard')
  return <>{children}</>
}
