'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Rocket, Users, Contact, Wallet, Settings, FolderKanban, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import Logo from '@/components/shared/Logo'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { href: '/projects', label: 'Projets', icon: FolderKanban, adminOnly: false },
  { href: '/clients', label: 'Clients', icon: Users, adminOnly: false },
  { href: '/team', label: 'Équipe', icon: Contact, adminOnly: true },
  { href: '/finance', label: 'Finance', icon: Wallet, adminOnly: true },
  { href: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut, isAdmin } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const close = () => setMobileOpen(false)
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <>
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir le menu"
        className="md:hidden fixed top-4 left-4 z-50 w-9 h-9 rounded-lg bg-surface border border-line
          flex items-center justify-center text-dim hover:text-ink transition-colors"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Backdrop — mobile only */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen w-[180px] bg-surface border-r border-line
          flex flex-col z-50 transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-line flex items-center justify-between">
          <Logo variant="full" className="h-7" />
          <button
            onClick={close}
            aria-label="Fermer le menu"
            className="md:hidden w-6 h-6 flex items-center justify-center text-faint hover:text-ink transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

            return (
              <Link
                key={href}
                href={href}
                onClick={close}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                  ${
                    isActive
                      ? 'bg-brand/10 text-brand font-medium'
                      : 'text-dim hover:text-ink hover:bg-surface-2'
                  }
                `}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-brand' : ''}`} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom — espace Founder (admin) séparé, puis logout */}
        <div className="px-3 py-4 border-t border-line space-y-1">
          {isAdmin && (
            <Link
              href="/founder"
              onClick={close}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${
                  pathname.startsWith('/founder')
                    ? 'bg-brand/10 text-brand font-medium'
                    : 'text-dim hover:text-ink hover:bg-surface-2'
                }
              `}
            >
              <Rocket className={`h-4 w-4 flex-shrink-0 ${pathname.startsWith('/founder') ? 'text-brand' : ''}`} />
              Espace Founder
            </Link>
          )}
          <button
            onClick={signOut}
            aria-label="Se déconnecter"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-faint hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}
