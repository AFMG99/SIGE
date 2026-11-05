import { redirect } from 'next/navigation'
import { canWithOverrides, requireModuleAccess } from '@/shared/models/authz'
import { getDatosEspaciales } from '@/features/espacial/controllers/getDatosEspaciales'
import { EspacialDashboard } from '@/features/espacial/views/EspacialDashboard'

// Forzar que Next.js consulte la base de datos en tiempo real en cada carga
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EspacialPage() {
  const user = await requireModuleAccess('plans')
  if (!user) {
    redirect('/dashboard')
  }

  const edificaciones = await getDatosEspaciales()
  const puedeImportarCad = await canWithOverrides(user, 'plans', 'modify')
  const puedeImportarModelo = await canWithOverrides(user, 'plans', 'modify')

  return <EspacialDashboard edificaciones={edificaciones} puedeImportarCad={puedeImportarCad} puedeImportarModelo={puedeImportarModelo} />
}
