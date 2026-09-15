'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ClientLogout() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="whitespace-nowrap rounded-sm px-3 py-2 text-[13px] text-chrome-faint transition-colors hover:bg-white/[0.06] hover:text-chrome-text"
    >
      Déconnexion
    </button>
  )
}
