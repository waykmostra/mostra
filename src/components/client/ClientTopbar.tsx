import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import NotificationBell from '@/components/shared/NotificationBell'
import Logo from '@/components/shared/Logo'
import ClientLogout from '@/app/client/ClientLogout'

/** Barre supérieure du portail client. Même chrome sombre que côté admin.
 *  `offset` la décale du rail projet quand il y en a un. */
export default async function ClientTopbar({ offset = false }: { offset?: boolean }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header
      className={`grain fixed top-0 right-0 z-30 h-14 border-b border-chrome-line bg-chrome ${
        offset ? 'left-0 md:left-[248px]' : 'left-0'
      }`}
    >
      <div className="relative flex h-full items-center justify-between gap-3 px-5 sm:px-8">
        {/* Sans rail, le wordmark vit ici ; avec rail, il est dans le rail. */}
        {offset ? (
          <span />
        ) : (
          <Link href="/client/dashboard" className="flex min-w-0 select-none items-center">
            <Logo variant="full" color="white" className="h-[22px] flex-shrink-0" />
          </Link>
        )}

        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <NotificationBell userId={user.id} />
              <Link
                href="/client/dashboard"
                className="whitespace-nowrap rounded-sm px-3 py-2 text-[13px] text-chrome-dim transition-colors hover:bg-white/[0.06] hover:text-chrome-text"
              >
                Mes projets
              </Link>
              <ClientLogout />
            </>
          ) : (
            <Link
              href="/login"
              className="whitespace-nowrap rounded-sm px-3 py-2 text-[13px] text-chrome-dim transition-colors hover:bg-white/[0.06] hover:text-chrome-text"
            >
              Se connecter
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
