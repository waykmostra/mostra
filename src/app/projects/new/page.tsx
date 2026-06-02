import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getAllClients, getAllAdmins } from '@/lib/supabase/queries'
import NewProjectForm from './NewProjectForm'

export default async function NewProjectPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const [clients, admins] = await Promise.all([
    getAllClients(supabase),
    getAllAdmins(supabase),
  ])

  return <NewProjectForm clients={clients} admins={admins} />
}
