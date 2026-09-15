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

  // Formulaire encore en sombre (non migré) : on l'enveloppe pour qu'il reste
  // cohérent sous le shell clair, en attendant son passage en thème clair.
  return (
    <div className="min-h-screen bg-canvas px-4 sm:px-6 py-8">
      <NewProjectForm clients={clients} admins={admins} />
    </div>
  )
}
