import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/supabase/helpers'
import type { Profile, ContactMethod } from '@/lib/types'
import ProfileSection from './ProfileSection'
import SecuritySection from './SecuritySection'
import PreferencesSection from './PreferencesSection'
import PushNotificationsSection from '@/components/account/PushNotificationsSection'

export const metadata = { title: 'Mon compte — Mostra' }

export default async function AccountPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await db(supabase)
    .from('profiles')
    .select('full_name, avatar_url, contact_method')
    .eq('id', user.id)
    .maybeSingle()

  const profile = rawProfile as Pick<Profile, 'full_name' | 'avatar_url' | 'contact_method'> | null

  const name = profile?.full_name ?? user.email ?? ''
  const email = user.email ?? ''
  const avatarUrl = profile?.avatar_url ?? null
  const contactMethod: ContactMethod = (profile?.contact_method as ContactMethod) ?? 'email'

  return (
    <div className="max-w-[680px] mx-auto space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-lg font-bold text-white">Mon compte</h1>
        <p className="text-xs text-[#555555] mt-0.5">Gérez votre profil, sécurité et préférences</p>
      </div>

      <ProfileSection name={name} email={email} avatarUrl={avatarUrl} />
      <SecuritySection />
      <PreferencesSection contactMethod={contactMethod} />
      <PushNotificationsSection />
    </div>
  )
}
