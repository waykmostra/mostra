'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { User, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface UserMenuDropdownProps {
  name: string
  email: string
  initials: string
  avatarUrl: string | null
}

export default function UserMenuDropdown({
  name,
  email,
  initials,
  avatarUrl,
}: UserMenuDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger — avatar + name */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-sm pl-1 pr-2 py-1 hover:bg-white/[0.06] transition-colors duration-[160ms]"
        aria-label="Menu utilisateur"
      >
        <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] font-semibold text-chrome-dim leading-none">
              {initials}
            </span>
          )}
        </div>
        <span className="hidden sm:block text-[13px] text-chrome-dim truncate max-w-[120px]">
          {name}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[240px] rounded-lg bg-surface p-2 shadow-[var(--hairline),var(--e3)]">
          <div className="px-3 py-2.5">
            <p className="text-[13px] font-semibold text-ink truncate">{name}</p>
            <p className="text-[11.5px] text-faint truncate mt-0.5">{email}</p>
          </div>

          <div className="h-px bg-line my-1" />

          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[13.5px] font-medium text-dim hover:text-ink hover:bg-surface-2 transition-colors duration-[160ms]"
          >
            <User className="h-4 w-4 flex-shrink-0" />
            Mon compte
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2.5 w-full rounded-md px-3 py-2.5 text-[13.5px] font-medium text-dim hover:text-late hover:bg-surface-2 transition-colors duration-[160ms] text-left"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}
