'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChevronRight,
  Contact,
  FolderKanban,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  Settings,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import Logo from '@/components/shared/Logo'
import type { PhaseStatus, ProjectStatus } from '@/lib/types'

export interface SidebarProject {
  id: string
  name: string
  status: ProjectStatus
  currentPhase: { id: string; name: string; status: PhaseStatus } | null
}

interface Props {
  projects: SidebarProject[]
  isAdmin: boolean
}

const GROUPS: {
  label: string
  items: { href: string; label: string; icon: LucideIcon; adminOnly: boolean }[]
}[] = [
  {
    label: 'Espace',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
      { href: '/projects', label: 'Projets', icon: FolderKanban, adminOnly: false },
      { href: '/clients', label: 'Clients', icon: Users, adminOnly: false },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { href: '/team', label: 'Équipe', icon: Contact, adminOnly: true },
      { href: '/finance', label: 'Finance', icon: Wallet, adminOnly: true },
      { href: '/settings', label: 'Réglages', icon: Settings, adminOnly: true },
    ],
  },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
}

/** Une pastille suffit à dire l'état d'un projet dans une liste dense. */
function StateDot({ status }: { status: PhaseStatus }) {
  const tone =
    status === 'in_review'
      ? 'bg-soon'
      : status === 'completed' || status === 'approved'
        ? 'bg-brand'
        : status === 'in_progress'
          ? 'bg-brand'
          : 'bg-white/25'
  return <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${tone}`} />
}

export default function SidebarNav({ projects, isAdmin }: Props) {
  const pathname = usePathname()
  const { signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const close = () => setMobileOpen(false)

  // La largeur du rail vit dans --rail-w : le contenu des pages s'y adosse,
  // donc un seul endroit à changer. Le script du <head> l'applique avant le
  // premier paint pour éviter que la page saute au chargement.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('mostra-rail') === 'collapsed')
    } catch {}
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    document.documentElement.style.setProperty('--rail-w', next ? '68px' : '248px')
    try {
      localStorage.setItem('mostra-rail', next ? 'collapsed' : 'expanded')
    } catch {}
  }

  // Le projet ouvert se déplie tout seul : on ne demande pas à l'utilisateur
  // de retrouver à la main où il se trouve.
  useEffect(() => {
    const match = pathname.match(/^\/projects\/([^/]+)/)
    if (match && match[1] !== 'new') setExpanded(match[1])
  }, [pathname])

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir le menu"
        className="md:hidden fixed top-3 left-3 z-50 h-11 w-11 rounded-sm bg-chrome text-chrome-dim flex items-center justify-center transition-colors hover:text-chrome-text"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-chrome/60 backdrop-blur-sm"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          grain fixed top-0 left-0 h-screen w-[248px] bg-chrome overflow-hidden
          flex flex-col z-50 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:w-[var(--rail-w)]
        `}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-16 h-56 w-56 rounded-full bg-brand/[0.13] blur-[80px]"
        />

        <div
          className={`relative h-14 flex items-center border-b border-chrome-line ${
            collapsed ? 'md:justify-center md:px-0 px-5 justify-between' : 'px-5 justify-between'
          }`}
        >
          <Link href="/dashboard" onClick={close} className="flex items-center">
            <Logo
              variant={collapsed ? 'icon' : 'full'}
              color="white"
              className={collapsed ? 'h-[22px] md:h-6' : 'h-[22px]'}
            />
          </Link>
          <button
            onClick={close}
            aria-label="Fermer le menu"
            className="md:hidden h-9 w-9 -mr-2 flex items-center justify-center text-chrome-faint hover:text-chrome-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="chrome-scroll relative flex-1 overflow-y-auto px-3 py-5 flex flex-col gap-6">
          {/* Espace */}
          <NavGroup
            group={GROUPS[0]}
            isAdmin={isAdmin}
            pathname={pathname}
            onNavigate={close}
            collapsed={collapsed}
          />

          {/* Projets récents — dépliables, avec l'étape en cours en clair */}
          {projects.length > 0 && (
            <div className={collapsed ? 'md:hidden' : undefined}>
              <div className="mono-label px-2.5 mb-2 text-chrome-faint">Projets récents</div>
              <div className="flex flex-col gap-0.5">
                {projects.map((project) => {
                  const open = expanded === project.id
                  const onProject = pathname.startsWith(`/projects/${project.id}`)
                  return (
                    <div key={project.id}>
                      <div
                        className={`group flex items-center rounded-sm transition-colors duration-[160ms] ${
                          onProject ? 'bg-white/[0.055]' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : project.id)}
                          aria-expanded={open}
                          aria-label={open ? 'Replier' : 'Déplier'}
                          className="flex h-9 w-7 flex-shrink-0 items-center justify-center text-chrome-faint hover:text-chrome-text"
                        >
                          <ChevronRight
                            className={`h-3.5 w-3.5 transition-transform duration-[160ms] ${
                              open ? 'rotate-90' : ''
                            }`}
                          />
                        </button>
                        <Link
                          href={`/projects/${project.id}`}
                          onClick={close}
                          className={`flex min-w-0 flex-1 items-center gap-2 py-2 pr-2.5 text-[13px] ${
                            onProject
                              ? 'text-chrome-text font-medium'
                              : 'text-chrome-dim hover:text-chrome-text'
                          }`}
                        >
                          <span className="truncate">{project.name}</span>
                          {project.currentPhase && (
                            <StateDot status={project.currentPhase.status} />
                          )}
                        </Link>
                      </div>

                      {open && (
                        <div className="ml-[14px] flex flex-col gap-0.5 border-l border-chrome-line pb-1 pl-2 pt-0.5">
                          {project.currentPhase && (
                            <SubLink
                              href={`/projects/${project.id}/phases/${project.currentPhase.id}/view`}
                              active={pathname.includes(`/phases/${project.currentPhase.id}`)}
                              onNavigate={close}
                              trailing={project.currentPhase.name}
                            >
                              Étape en cours
                            </SubLink>
                          )}
                          <SubLink
                            href={`/projects/${project.id}`}
                            active={pathname === `/projects/${project.id}`}
                            onNavigate={close}
                          >
                            Vue d’ensemble
                          </SubLink>
                          <SubLink
                            href={`/projects/${project.id}/documents`}
                            active={pathname === `/projects/${project.id}/documents`}
                            onNavigate={close}
                            icon={FolderOpen}
                          >
                            Documents
                          </SubLink>
                          {isAdmin && (
                            <SubLink
                              href={`/projects/${project.id}/settings`}
                              active={pathname === `/projects/${project.id}/settings`}
                              onNavigate={close}
                              icon={SlidersHorizontal}
                            >
                              Étapes
                            </SubLink>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Gestion */}
          <NavGroup
            group={GROUPS[1]}
            isAdmin={isAdmin}
            pathname={pathname}
            onNavigate={close}
            collapsed={collapsed}
          />
        </nav>

        <div className="relative flex flex-col gap-0.5 border-t border-chrome-line px-3 py-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            className={`hidden h-10 items-center gap-3 rounded-sm px-2.5 text-[13.5px] text-chrome-faint transition-colors duration-[160ms] hover:bg-white/[0.03] hover:text-chrome-text md:flex ${
              collapsed ? 'md:justify-center md:px-0' : ''
            }`}
          >
            <PanelLeftClose
              className={`h-[17px] w-[17px] flex-shrink-0 transition-transform duration-[260ms] ${
                collapsed ? 'rotate-180' : ''
              }`}
            />
            <span className={collapsed ? 'md:hidden' : ''}>Replier</span>
          </button>

          <button
            onClick={signOut}
            title="Déconnexion"
            className={`flex h-10 w-full items-center gap-3 rounded-sm px-2.5 text-[13.5px] text-chrome-faint transition-colors duration-[160ms] hover:bg-white/[0.03] hover:text-chrome-text ${
              collapsed ? 'md:justify-center md:px-0' : ''
            }`}
          >
            <LogOut className="h-[17px] w-[17px] flex-shrink-0" />
            <span className={collapsed ? 'md:hidden' : ''}>Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  )
}

function NavGroup({
  group,
  isAdmin,
  pathname,
  onNavigate,
  collapsed,
}: {
  group: (typeof GROUPS)[number]
  isAdmin: boolean
  pathname: string
  onNavigate: () => void
  collapsed: boolean
}) {
  const items = group.items.filter((it) => !it.adminOnly || isAdmin)
  if (items.length === 0) return null

  return (
    <div>
      <div className={`mono-label px-2.5 mb-2 text-chrome-faint ${collapsed ? 'md:hidden' : ''}`}>
        {group.label}
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              title={label}
              aria-current={active ? 'page' : undefined}
              className={`group flex items-center gap-3 rounded-sm h-10 px-2.5 text-[13.5px] transition-colors duration-[160ms] ${
                collapsed ? 'md:justify-center md:px-0' : ''
              } ${
                active
                  ? 'bg-white/[0.055] text-chrome-text font-medium'
                  : 'text-chrome-dim hover:text-chrome-text hover:bg-white/[0.03]'
              }`}
            >
              <Icon
                className={`h-[17px] w-[17px] flex-shrink-0 transition-colors ${
                  active ? 'text-brand' : 'text-chrome-faint group-hover:text-chrome-dim'
                }`}
              />
              <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function SubLink({
  href,
  active,
  children,
  trailing,
  icon: Icon,
  onNavigate,
}: {
  href: string
  active: boolean
  children: React.ReactNode
  trailing?: string
  icon?: LucideIcon
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-sm px-2.5 py-[7px] text-[12.5px] transition-colors duration-[160ms] ${
        active
          ? 'bg-white/[0.055] text-chrome-text'
          : 'text-chrome-faint hover:text-chrome-dim hover:bg-white/[0.03]'
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0" />}
      <span className="truncate">{children}</span>
      {trailing && (
        <span className="ml-auto max-w-[84px] truncate text-[11.5px] text-brand/90">
          {trailing}
        </span>
      )}
    </Link>
  )
}
