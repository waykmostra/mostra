'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Check, CreditCard, FolderOpen, LayoutList, Lock, Menu, X } from 'lucide-react'
import Logo from '@/components/shared/Logo'
import type { PhaseStatus } from '@/lib/types'

export interface RailPhase {
  id: string
  name: string
  status: PhaseStatus
}

interface Props {
  token: string
  projectName: string
  progress: number
  phases: RailPhase[]
}

function isDone(s: PhaseStatus) {
  return s === 'completed' || s === 'approved'
}

/**
 * Menu du projet côté client. Il donne la vue d'ensemble et permet de sauter
 * d'une étape à l'autre sans repasser par l'accueil — c'est la navigation
 * principale du portail.
 */
export default function ClientProjectRail({ token, projectName, progress, phases }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const base = `/client/${token}`
  const onOverview = pathname === base
  const onPayment = pathname === `${base}/paiement`

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir le menu du projet"
        className="fixed left-3 top-[68px] z-40 flex h-11 w-11 items-center justify-center rounded-sm bg-chrome text-chrome-dim transition-colors hover:text-chrome-text md:hidden"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-chrome/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`grain fixed left-0 top-0 z-50 flex h-screen w-[248px] flex-col overflow-hidden bg-chrome transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Même halo vert qu'en admin — le rail n'est jamais un aplat mort. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-brand/[0.13] blur-[80px]"
        />

        <div className="relative flex h-14 items-center justify-between border-b border-chrome-line px-5">
          <Link href="/client/dashboard" className="flex items-center">
            <Logo variant="full" color="white" className="h-[22px]" />
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
            className="-mr-2 flex h-9 w-9 items-center justify-center text-chrome-faint transition-colors hover:text-chrome-text md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative border-b border-chrome-line px-5 py-4">
          <p className="truncate font-display text-[14.5px] leading-snug text-chrome-text">
            {projectName}
          </p>
          <p className="mono-label tnum mt-2 text-brand">{progress}% terminé</p>
        </div>

        <nav className="chrome-scroll relative flex-1 overflow-y-auto px-3 py-4">
          <div className="mono-label mb-2 px-2.5 text-chrome-faint">Projet</div>
          <div className="mb-5 flex flex-col gap-0.5">
            <RailLink
              href={base}
              active={onOverview}
              icon={LayoutList}
              onNavigate={() => setMobileOpen(false)}
            >
              Vue d’ensemble
            </RailLink>
            <RailLink
              href={`${base}/documents`}
              active={pathname === `${base}/documents`}
              icon={FolderOpen}
              onNavigate={() => setMobileOpen(false)}
            >
              Vos documents
            </RailLink>
            <RailLink
              href={`${base}/paiement`}
              active={onPayment}
              icon={CreditCard}
              onNavigate={() => setMobileOpen(false)}
            >
              Paiement
            </RailLink>
          </div>

          <div className="mono-label mb-2 px-2.5 text-chrome-faint">Étapes</div>
          <div className="flex flex-col gap-0.5">
            {phases.map((phase) => {
              const done = isDone(phase.status)
              const locked = phase.status === 'pending'
              const active = pathname.includes(`/phases/${phase.id}`)
              const review = phase.status === 'in_review'

              if (locked) {
                return (
                  <div
                    key={phase.id}
                    className="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] text-white/25"
                  >
                    <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{phase.name}</span>
                  </div>
                )
              }

              return (
                <Link
                  key={phase.id}
                  href={`${base}/phases/${phase.id}`}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] transition-colors duration-[160ms] ${
                    active
                      ? 'bg-white/[0.055] text-chrome-text'
                      : 'text-chrome-dim hover:bg-white/[0.03] hover:text-chrome-text'
                  }`}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-brand" strokeWidth={2.5} />
                  ) : (
                    <span
                      className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                        review ? 'bg-soon' : 'bg-brand'
                      }`}
                    />
                  )}
                  <span className="truncate">{phase.name}</span>
                  {review && (
                    <span className="mono-label ml-auto flex-shrink-0 text-soon">À valider</span>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>
      </aside>
    </>
  )
}

function RailLink({
  href,
  active,
  icon: Icon,
  children,
  onNavigate,
}: {
  href: string
  active: boolean
  icon: typeof LayoutList
  children: React.ReactNode
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13.5px] transition-colors duration-[160ms] ${
        active
          ? 'bg-white/[0.055] font-medium text-chrome-text'
          : 'text-chrome-dim hover:bg-white/[0.03] hover:text-chrome-text'
      }`}
    >
      <Icon
        className={`h-[17px] w-[17px] flex-shrink-0 ${active ? 'text-brand' : 'text-chrome-faint'}`}
      />
      <span className="truncate">{children}</span>
    </Link>
  )
}
