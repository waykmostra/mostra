import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, SlidersHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getProjectDetail, getAllClients, getAllAdmins } from '@/lib/supabase/queries'
import StatusBadge from '@/components/shared/StatusBadge'
import Breadcrumb from '@/components/shared/Breadcrumb'
import PhaseStepper from '@/components/project/PhaseStepper'
import ProjectOverviewCard from '@/components/project/ProjectOverviewCard'
import ProjectInfo from '@/components/project/ProjectInfo'
import ActivityLog from '@/components/project/ActivityLog'
import CommentSection from '@/components/project/CommentSection'
import DangerZone from '@/components/project/DangerZone'
import ShareTokenManager from '@/components/project/ShareTokenManager'

interface ProjectPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const supabase = createClient()
  const data = await getProjectDetail(supabase, params.id)
  if (!data) return { title: 'Projet — MOSTRA' }
  return {
    title: `${data.project.name} — MOSTRA`,
    description: data.project.description ?? `Suivi du projet ${data.project.name}.`,
  }
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const data = await getProjectDetail(supabase, params.id)
  if (!data) notFound()

  const userRole = 'admin' as const

  const { project, client, clients, projectManager, phases, subPhasesByPhase, comments, activity } = data

  const [clientOptions, adminOptions] = await Promise.all([
    getAllClients(supabase),
    getAllAdmins(supabase),
  ])

  const availableClients = clientOptions.map((c) => ({
    id: c.id,
    contactName: c.contactName,
    companyName: c.companyName,
    email: c.email,
  }))

  const availablePMs = adminOptions.map((a) => ({
    userId: a.id,
    fullName: a.fullName,
    email: a.email,
    role: 'admin' as const,
  }))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
      <div className="space-y-6">
        <div>
          <Breadcrumb
            items={[
              { label: 'Projets', href: '/projects' },
              { label: project.name },
            ]}
          />

          <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h1 className="truncate text-[1.75rem] leading-tight text-ink">{project.name}</h1>
              {project.description && (
                <p className="mt-1.5 max-w-[70ch] text-[14px] leading-relaxed text-dim">
                  {project.description}
                </p>
              )}
            </div>
            <StatusBadge status={project.status} className="mt-1 flex-shrink-0" />
          </div>
        </div>

        {/* La carte du projet : ce qui est fait, où on en est, ce qui reste. */}
        <PhaseStepper
          phases={phases}
          subPhasesByPhase={subPhasesByPhase}
          hrefForPhase={(phase) => `/projects/${project.id}/phases/${phase.id}`}
        />

        {/* Rangée 1 — l'état du projet à gauche, les leviers admin à droite. */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <section className="min-w-0">
            <h2 className="mono-label mb-3 text-faint">Vue d’ensemble</h2>
            <ProjectOverviewCard
              project={project}
              client={client}
              projectManager={projectManager}
              phases={phases}
            />
          </section>

          <section className="min-w-0">
            <h2 className="mono-label mb-3 text-faint">Admin</h2>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
              <div className="min-w-0 space-y-4">
                <ProjectInfo
                  project={project}
                  client={client}
                  clients={clients}
                  projectManager={projectManager}
                  isAdmin={true}
                  availableClients={availableClients}
                  availablePMs={availablePMs}
                />
                <Link
                  href={`/projects/${project.id}/settings`}
                  className="surface group flex items-center gap-3 px-4 py-3.5 transition-colors duration-[160ms] hover:bg-surface-2"
                >
                  <SlidersHorizontal
                    className="h-[18px] w-[18px] flex-shrink-0 text-faint"
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink">
                      Étapes du projet
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-faint">
                      Ajouter, renommer ou supprimer une étape
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-faint transition-colors group-hover:text-ink" />
                </Link>
              </div>

              <div className="min-w-0 space-y-4">
                <ShareTokenManager
                  projectId={project.id}
                  shareToken={project.share_token}
                  appUrl={appUrl}
                />
                <DangerZone
                  projectId={project.id}
                  projectName={project.name}
                  isArchived={project.status === 'archived'}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Rangée 2 — ce qui s'est dit, et ce qui s'est passé. */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <div className="min-w-0">
            <CommentSection
              comments={comments}
              projectId={project.id}
              phases={phases.map((p) => ({ id: p.id, name: p.name }))}
              userId={profile.id}
              userRole={userRole}
            />
          </div>

          <section className="min-w-0">
            <h2 className="mono-label mb-3 text-faint">Activité récente</h2>
            <ActivityLog activity={activity} projectId={project.id} />
          </section>
        </div>
      </div>
    </div>
  )
}
