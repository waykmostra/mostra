import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getFinanceData, getProjects, getAllClients } from '@/lib/supabase/queries'
import FinanceClient from './FinanceClient'

export const metadata: Metadata = {
  title: 'Finance — MOSTRA',
  description: "Cashflow : revenus, dépenses et abonnements de l'agence.",
}

export default async function FinancePage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const [finance, projects, clientList] = await Promise.all([
    getFinanceData(supabase),
    getProjects(supabase),
    getAllClients(supabase),
  ])

  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }))
  const clientOptions = clientList.map((c) => ({
    id: c.id,
    name: c.companyName || c.contactName,
  }))

  return (
    <FinanceClient
      revenues={finance.revenues}
      manualRevenues={finance.manualRevenues}
      expenses={finance.expenses}
      subscriptions={finance.subscriptions}
      projects={projectOptions}
      clients={clientOptions}
    />
  )
}
