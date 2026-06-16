import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getProjectDetail, getAllClients, getAllAdmins } from '@/lib/supabase/queries'
import StatusBadge from '@/components/shared/StatusBadge'
import PhaseCard from '@/components/project/PhaseCard'
import AddPhaseButton from '@/components/project/AddPhaseButton'
import ProjectOverviewCard from '@/components/project/ProjectOverviewCard'
import ProjectInfo from '@/components/project/ProjectInfo'
import ProjectTimeline from '@/components/project/ProjectTimeline'
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

  const { project, client, projectManager, phases, subPhasesByPhase, filesByPhase, comments, activity } = data

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
    <div className="min-h-screen bg-[#0a0a0a] px-4 sm:px-6 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back + Header */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-[#666666] hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-[#666666] mt-1 line-clamp-2">{project.description}</p>
              )}
            </div>
            <StatusBadge status={project.status} className="flex-shrink-0 mt-0.5" />
          </div>

          {/* Timeline des phases */}
          {phases.length > 0 && (
            <div className="mt-4">
              <ProjectTimeline phases={phases} subPhasesByPhase={subPhasesByPhase} />
            </div>
          )}
        </div>

        {/* Carte 360° — vue d'ensemble business (au-dessus de la pipeline) */}
        <ProjectOverviewCard
          project={project}
          client={client}
          projectManager={projectManager}
          phases={phases}
        />

        {/* Layout 2 colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
          {/* Gauche — pipeline + commentaires */}
          <div className="space-y-6">
            {/* Pipeline */}
            <section>
              <h2 className="text-sm font-semibold text-white mb-3">Pipeline</h2>
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-5">
                {phases.length === 0 ? (
                  <p className="text-xs text-[#444444] italic mb-1">
                    Aucune phase. Ajoute une première étape ci-dessous.
                  </p>
                ) : (
                  phases.map((phase, i) => {
                    const prev = phases[i - 1]
                    const canStart =
                      i === 0 || prev?.status === 'completed' || prev?.status === 'approved'

                    return (
                      <PhaseCard
                        key={phase.id}
                        phase={phase}
                        projectId={project.id}
                        isLast={i === phases.length - 1}
                        canStart={canStart}
                        files={filesByPhase[phase.id] ?? []}
                        subPhases={subPhasesByPhase[phase.id] ?? []}
                        userRole={userRole}
                      />
                    )
                  })
                )}

                <AddPhaseButton projectId={project.id} />
              </div>
            </section>

            {/* Commentaires */}
            <CommentSection
              comments={comments}
              projectId={project.id}
              phases={phases.map((p) => ({ id: p.id, name: p.name }))}
              userId={profile.id}
              userRole={userRole}
            />
          </div>

          {/* Droite — infos + activité */}
          <div className="space-y-4">
            <ProjectInfo
              project={project}
              client={client}
              projectManager={projectManager}
              isAdmin={true}
              availableClients={availableClients}
              availablePMs={availablePMs}
            />
            <ShareTokenManager
              projectId={project.id}
              shareToken={project.share_token}
              appUrl={appUrl}
            />
            <ActivityLog activity={activity} projectId={project.id} />
            <DangerZone
              projectId={project.id}
              projectName={project.name}
              isArchived={project.status === 'archived'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
