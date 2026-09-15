import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import Breadcrumb from '@/components/shared/Breadcrumb'
import StatusBadge from '@/components/shared/StatusBadge'
import PhaseStepper from '@/components/project/PhaseStepper'
import PhaseFilesSection from '@/components/project/PhaseFilesSection'
import SubPhaseSection from '@/components/project/SubPhaseSection'
import SubPhaseTabs from '@/components/project/SubPhaseTabs'
import type { Project, ProjectPhase, SubPhase } from '@/lib/types'

interface PageProps {
  params: { id: string; phaseId: string }
  searchParams?: { script?: string; grid?: string; v?: string; sub?: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase
    .from('project_phases')
    .select('name')
    .eq('id', params.phaseId)
    .maybeSingle()
  return { title: `${(data as { name: string } | null)?.name ?? 'Étape'} — MOSTRA` }
}

/**
 * Une étape du projet. Le stepper en tête sert d'onglets : on reste sur la même
 * page et le contenu de l'étape choisie s'affiche dessous. Quand une étape
 * contient plusieurs sous-étapes, elles se suivent dans l'ordre.
 */
export default async function PhasePage({ params, searchParams }: PageProps) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()

  const { data: rawProject } = await supabase
    .from('projects')
    .select('id, name, share_token')
    .eq('id', params.id)
    .maybeSingle()
  const project = rawProject as Pick<Project, 'id' | 'name' | 'share_token'> | null
  if (!project) notFound()

  const { data: rawPhases } = await supabase
    .from('project_phases')
    .select('id, name, slug, status, sort_order')
    .eq('project_id', params.id)
    .order('sort_order', { ascending: true })
  const allPhases =
    (rawPhases as Pick<ProjectPhase, 'id' | 'name' | 'slug' | 'status' | 'sort_order'>[] | null) ??
    []

  const phase = allPhases.find((p) => p.id === params.phaseId)
  if (!phase) notFound()

  const { data: rawSubs } = await supabase
    .from('sub_phases')
    .select('id, name, slug, status, phase_id, sort_order')
    .in(
      'phase_id',
      allPhases.map((p) => p.id),
    )
    .order('sort_order', { ascending: true })

  const allSubs =
    (rawSubs as (Pick<SubPhase, 'id' | 'name' | 'slug' | 'status' | 'sort_order'> & {
      phase_id: string
    })[] | null) ?? []

  const subsByPhase: Record<string, Pick<SubPhase, 'id' | 'status'>[]> = {}
  for (const s of allSubs) {
    ;(subsByPhase[s.phase_id] ??= []).push({ id: s.id, status: s.status })
  }

  const subPhases = allSubs.filter((s) => s.phase_id === phase.id)

  // À l'ouverture on montre ce qui demande une action : la sous-étape en review,
  // sinon celle en cours, sinon la première.
  const activeSub =
    subPhases.find((s) => s.id === searchParams?.sub) ??
    subPhases.find((s) => s.status === 'in_review') ??
    subPhases.find((s) => s.status === 'in_progress') ??
    subPhases[0]

  const activeIndex = subPhases.findIndex((s) => s.id === activeSub?.id)
  const prevSub = activeIndex > 0 ? subPhases[activeIndex - 1] : null
  const canStartActive =
    !prevSub || prevSub.status === 'completed' || prevSub.status === 'approved'

  return (
    <div className="px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
      <div className="space-y-6">
        <div>
          <Breadcrumb
            items={[
              { label: 'Projets', href: '/projects' },
              { label: project.name, href: `/projects/${project.id}` },
              { label: phase.name },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h1 className="text-[1.75rem] leading-tight text-ink">{phase.name}</h1>
            <StatusBadge status={phase.status} className="flex-shrink-0" />
          </div>
        </div>

        {/* Les onglets du projet. */}
        <PhaseStepper
          phases={allPhases}
          subPhasesByPhase={subsByPhase}
          currentPhaseId={phase.id}
          hrefForPhase={(p) => `/projects/${project.id}/phases/${p.id}`}
        />

        {subPhases.length === 0 ? (
          <PhaseFilesSection
            phase={phase}
            projectId={project.id}
            requestedVersion={searchParams?.v ? parseInt(searchParams.v, 10) : undefined}
          />
        ) : (
          <>
            <SubPhaseTabs
              subPhases={subPhases}
              activeId={activeSub.id}
              hrefFor={(sub) => `/projects/${project.id}/phases/${phase.id}?sub=${sub.id}`}
            />

            <SubPhaseSection
              projectId={project.id}
              phaseId={phase.id}
              subPhase={activeSub}
              userRole="admin"
              canStart={canStartActive}
              shareToken={project.share_token}
              activeScriptParam={searchParams?.script}
              forceGrid={searchParams?.grid === '1'}
              showHeading={subPhases.length === 1}
            />
          </>
        )}
      </div>
    </div>
  )
}
