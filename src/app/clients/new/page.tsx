import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getAllCompanies } from '@/lib/supabase/queries'
import NewClientForm from './NewClientForm'

export default async function NewClientPage({
  searchParams,
}: {
  searchParams?: { companyId?: string }
}) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const companies = await getAllCompanies(createClient())

  return (
    <NewClientForm
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      initialCompanyId={searchParams?.companyId}
    />
  )
}
