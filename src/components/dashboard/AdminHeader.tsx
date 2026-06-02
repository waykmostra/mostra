import { createClient } from '@/lib/supabase/server'
import NotificationBell from '@/components/shared/NotificationBell'
import UserMenuDropdown from '@/components/dashboard/UserMenuDropdown'
import type { Profile } from '@/lib/types'

/**
 * Sticky header for all admin pages.
 * Fixed-positioned after the 180px sidebar on md+ screens.
 * Server component — fetches profile, passes data to client dropdown.
 */
export default async function AdminHeader() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  const profile = rawProfile as Pick<Profile, 'full_name' | 'avatar_url'> | null
  const name = profile?.full_name ?? user.email ?? ''
  const email = user.email ?? ''
  const initials = name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  return (
    <header className="fixed top-0 left-0 right-0 md:left-[180px] z-30 h-14 bg-[#0a0a0a]/90 backdrop-blur border-b border-[#1a1a1a]">
      <div className="h-full px-5 flex items-center justify-end gap-3">
        {/* Notification bell */}
        <NotificationBell userId={user.id} />

        {/* Divider */}
        <div className="h-4 w-px bg-[#2a2a2a]" />

        {/* User menu — client component with dropdown */}
        <UserMenuDropdown
          name={name}
          email={email}
          initials={initials}
          avatarUrl={profile?.avatar_url ?? null}
        />
      </div>
    </header>
  )
}
