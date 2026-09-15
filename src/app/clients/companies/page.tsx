import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getCompaniesWithStats } from '@/lib/supabase/queries'
import CompaniesView from './CompaniesView'

export const metadata: Metadata = {
  title: 'Sociétés — MOSTRA',
  description: 'Regroupez vos clients par entreprise.',
}

export default async function CompaniesPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const companies = await getCompaniesWithStats(supabase)

  return <CompaniesView initialCompanies={companies} />
}
