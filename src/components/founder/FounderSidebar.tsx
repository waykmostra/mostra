'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Target,
  Columns3,
  ListChecks,
  Trophy,
  TrendingUp,
  Eye,
  StickyNote,
  Database,
  BookOpen,
  ArrowLeft,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import Logo from '@/components/shared/Logo'

// Espace "Founder" — cockpit commercial & pilotage. La nav grandit au fil des
// features (Pipeline, Workflow, Objectifs, KPIs, Veille, Idées, Dashboard).
interface FounderNavItem {
  href: string
  label: string
  icon: LucideIcon
}

const FOUNDER_NAV: FounderNavItem[] = [
  { href: '/founder', label: 'Cockpit', icon: LayoutDashboard },
  { href: '/founder/prospection', label: 'Prospection', icon: Target },
  { href: '/founder/pipeline', label: 'Pipeline', icon: Columns3 },
  { href: '/founder/workflow', label: 'Workflow', icon: ListChecks },
  { href: '/founder/objectifs', label: 'Objectifs', icon: Trophy },
  { href: '/founder/kpis', label: 'KPIs hebdo', icon: TrendingUp },
  { href: '/founder/veille', label: 'Veille', icon: Eye },
  { href: '/founder/notes', label: 'Notes', icon: StickyNote },
  { href: '/founder/data', label: 'Data', icon: Database },
  { href: '/founder/wiki', label: 'Wiki', icon: BookOpen },
]

export default function FounderSidebar() {
  const pathname = usePathname()
  const { signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const close = () => setMobileOpen(false)

  return (
    <>
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir le menu"
        className="md:hidden fixed top-4 left-4 z-50 w-9 h-9 rounded-lg bg-[#111111] border border-[#2a2a2a]
          flex items-center justify-center text-[#a0a0a0] hover:text-white transition-colors"
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
          fixed top-0 left-0 h-screen w-[180px] bg-[#111111] border-r border-[#2a2a2a]
          flex flex-col z-50 transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Logo + badge Founder */}
        <div className="px-5 py-5 border-b border-[#2a2a2a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo variant="full" color="white" className="h-7" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-[#00D76B] bg-[#00D76B]/10 px-1.5 py-0.5 rounded">
              Founder
            </span>
          </div>
          <button
            onClick={close}
            aria-label="Fermer le menu"
            className="md:hidden w-6 h-6 flex items-center justify-center text-[#555555] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {FOUNDER_NAV.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/founder' ? pathname === '/founder' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={close}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                  ${
                    isActive
                      ? 'bg-[#00D76B]/10 text-[#00D76B] font-medium'
                      : 'text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a]'
                  }
                `}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-[#00D76B]' : ''}`} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-[#2a2a2a] space-y-1">
          <Link
            href="/dashboard"
            onClick={close}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <ArrowLeft className="h-4 w-4 flex-shrink-0" />
            Retour à l&apos;app
          </Link>
          <button
            onClick={signOut}
            aria-label="Se déconnecter"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-[#666666] hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}
