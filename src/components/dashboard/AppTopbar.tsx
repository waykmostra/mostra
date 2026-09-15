import { createClient } from '@/lib/supabase/server'
import NotificationBell from '@/components/shared/NotificationBell'
import UserMenuDropdown from '@/components/dashboard/UserMenuDropdown'
import ThemeToggle from '@/components/shared/ThemeToggle'
import type { Profile } from '@/lib/types'

/** Barre supérieure. Prolonge le chrome sombre du rail ; la feuille de travail
 *  claire commence en dessous. Décalée de la sidebar sur md+.
 *
 *  Pas d'`overflow-hidden` ici : il rognerait les menus déroulants (notifications,
 *  compte) qui s'ouvrent sous la barre. Le grain est déjà borné par son inset-0. */
export default async function AppTopbar() {
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
  const initials =
    name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'

  return (
    <header className="grain fixed top-0 left-0 right-0 md:left-[var(--rail-w)] z-30 h-14 bg-chrome border-b border-chrome-line">
      <div className="relative h-full px-4 md:px-6 flex items-center justify-end gap-2">
        <ThemeToggle />
        <NotificationBell userId={user.id} />
        <div className="mx-1 h-5 w-px bg-chrome-line-strong" />
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
