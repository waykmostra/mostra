import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getTeamRoles } from '@/lib/supabase/team'
import NewTeamMemberForm from './NewTeamMemberForm'

export default async function NewTeamMemberPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const roles = await getTeamRoles(supabase)

  return <NewTeamMemberForm roles={roles} />
}
