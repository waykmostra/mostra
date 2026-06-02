import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import NewClientForm from './NewClientForm'

export default async function NewClientPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  return <NewClientForm />
}
